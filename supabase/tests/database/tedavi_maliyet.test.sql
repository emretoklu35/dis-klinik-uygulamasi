-- =============================================================================
-- Tedavi maliyetleri ve kârlılık testleri (pgTAP).
-- a..7 muhasebe, a..2 hekim (Dr. Demo B, üye b..2), a..3 yönetici; hasta e..2
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

-- Hazırlık (yönetici yetkisiyle değil, doğrudan): ücretli bir tedavi ve maliyetli malzeme
insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        'test-maliyet', 'b0000000-0000-4000-8000-000000000002');
insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
       'b0000000-0000-4000-8000-000000000002', current_date, 'test-kron', '16', 'planlandi', 'kron_kopru', id, 1000000
  from treatment_plans where title = 'test-maliyet';
insert into doctor_commissions (member_id, clinic_id, rate)
values ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 20)
on conflict (member_id) do update set rate = 20;
insert into stock_items (clinic_id, name, unit) values ('c0000000-0000-4000-8000-000000000001', 'test-zirkon-blok', 'adet');
with m as (
  insert into stock_movements (clinic_id, item_id, kind, quantity)
  select clinic_id, id, 'giris', 10 from stock_items where name = 'test-zirkon-blok'
  returning id, clinic_id)
insert into stock_costs (movement_id, clinic_id, unit_cost) select id, clinic_id, 30000 from m;
insert into stock_movements (clinic_id, item_id, kind, quantity, treatment_id)
select i.clinic_id, i.id, 'kullanim', -2, t.id
  from stock_items i, treatments t where i.name = 'test-zirkon-blok' and t.procedure = 'test-kron';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select throws_ok(
  $$select add_treatment_expense((select id from treatment_summaries('e0000000-0000-4000-8000-000000000002') where procedure = 'test-kron'), null, 'Test Lab', 'kron',
      'USD', 5000, null)$$,
  '23514', null, 'Döviz giderinde kur zorunlu');
select lives_ok(
  $$select add_treatment_expense((select id from treatment_summaries('e0000000-0000-4000-8000-000000000002') where procedure = 'test-kron'), null, 'Test Lab', 'kron',
      'USD', 5000, 34.5)$$,
  'Yönetici döviz cinsinden laboratuvar gideri girer');
select is((select amount from treatment_expenses where description = 'kron'), 172500,
  'Döviz gideri girildiği günün kuruyla TL''ye çevrilip sabitlenir');
select is((select count(*)::int from labs where name = 'Test Lab'), 1, 'Yeni laboratuvar listeye eklenir');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select * from plan_profitability((select id from treatment_plans where title = 'test-maliyet'))$$,
  '42501', null, 'Hekim kârlılığı göremez');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select results_eq(
  $$select revenue, lab, material, commission, profit
      from plan_profitability((select id from treatment_plans where title = 'test-maliyet'))$$,
  $$values (1000000::bigint, 172500::bigint, 60000::bigint, 200000::bigint, 567500::bigint)$$,
  'Kâr = gelir − laboratuvar − malzeme (ort. alış maliyeti) − hekim primi');

select throws_ok($$select cancel_treatment_expense((select id from treatment_expenses where description = 'kron'), '')$$,
  '23514', null, 'Gider sebepsiz iptal edilemez');
select lives_ok($$select cancel_treatment_expense((select id from treatment_expenses where description = 'kron'), 'Yanlış girildi')$$,
  'Gider sebebiyle iptal edilir');
select is(
  (select lab from plan_profitability((select id from treatment_plans where title = 'test-maliyet'))), 0::bigint,
  'İptal edilen gider kârlılıktan düşer');

select * from finish();
rollback;
