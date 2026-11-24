-- =============================================================================
-- İndirim testleri (pgTAP).
-- a..2 hekim (Dr. Demo B, üye b..2; sınır %20), a..1 sahip + hekim (sınırsız); hasta e..2
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        'test-indirim', 'b0000000-0000-4000-8000-000000000002');
insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
       'b0000000-0000-4000-8000-000000000002', current_date, x.p, x.t, 'planlandi', 'kron_kopru', id, x.a
  from treatment_plans, (values ('test-a', '16', 1000000), ('test-b', '17', 1000000)) as x(p, t, a)
 where title = 'test-indirim';

select is((select list_amount from treatments where procedure = 'test-a'), 1000000,
  'Yeni işlemde liste fiyatı ücretle aynı');

select lives_ok($$select apply_plan_discount((select id from treatment_plans where title = 'test-indirim'), null, 'yuzde', 15)$$,
  'Hekim sınır içinde (%15) indirim yapar');
select results_eq($$select amount, list_amount from treatments where procedure like 'test-_' order by procedure$$,
  $$values (850000, 1000000), (850000, 1000000)$$, 'İndirimli fiyat ve liste fiyatı ayrı tutulur');

select lives_ok($$select apply_plan_discount((select id from treatment_plans where title = 'test-indirim'), null, 'yuzde', 10)$$,
  'İndirim yeniden uygulanabilir');
select is((select amount from treatments where procedure = 'test-a'), 900000,
  'İndirim liste fiyatından hesaplanır, üst üste binmez');

select throws_ok($$select apply_plan_discount((select id from treatment_plans where title = 'test-indirim'), null, 'yuzde', 30)$$,
  '42501', null, 'Hekim sınırı (%20) aşamaz');
select is((select amount from treatments where procedure = 'test-a'), 900000,
  'Reddedilen indirim fiyatları değiştirmez');

select lives_ok($$select apply_plan_discount((select id from treatment_plans where title = 'test-indirim'), null, 'tutar', 300000)$$,
  'Tutar olarak indirim (3.000 ₺, %15)');
select is((select sum(amount)::int from treatments where procedure like 'test-_'), 1700000,
  'Tutar indirimi işlemlere dağıtılır');

select is((select count(*)::int from treatment_discounts d join treatment_plans p on p.id = d.plan_id where p.title = 'test-indirim'), 3,
  'Her indirim kaydedilir');

-- Klinik sahibi sınıra takılmaz
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select apply_plan_discount((select id from treatment_plans where title = 'test-indirim'), null, 'yuzde', 40)$$,
  'Klinik sahibi sınırsız indirim yapar');

-- Formdan elle değiştirilen ücret yeni liste fiyatıdır
update treatments set amount = 1200000 where procedure = 'test-a';
select is((select list_amount from treatments where procedure = 'test-a'), 1200000,
  'Elle değiştirilen ücret liste fiyatı olur');

select * from finish();
rollback;
