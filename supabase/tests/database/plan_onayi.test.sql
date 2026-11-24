-- =============================================================================
-- Tedavi planı onayı (proforma imzası) testleri (pgTAP).
-- a..2 hekim (Dr. Demo B, üye b..2); a..4 resepsiyon; hasta e..2
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(9);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        'test-onay', 'b0000000-0000-4000-8000-000000000002');

select throws_ok(
  $$select sign_treatment_plan((select id from treatment_plans where title = 'test-onay'),
      '{"w":300,"h":120,"d":"M 10 10 L 20 20 L 30 25 L 40 30"}')$$,
  '23514', null, 'Boş plan imzalatılamaz');

insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
       'b0000000-0000-4000-8000-000000000002', current_date, x.p, x.t, 'planlandi', x.k::treatment_kind, id, x.a
  from treatment_plans,
       (values ('test-kanal', '36', 'kanal', 600000), ('test-kron', '36', 'kron_kopru', 900000)) as x(p, t, k, a)
 where title = 'test-onay';

select throws_ok(
  $$select sign_treatment_plan((select id from treatment_plans where title = 'test-onay'), '{"w":300,"h":120,"d":"M1"}')$$,
  '23514', null, 'Okunamayan imza reddedilir');

select lives_ok(
  $$select sign_treatment_plan((select id from treatment_plans where title = 'test-onay'),
      '{"w":300,"h":120,"d":"M 10 10 L 20 20 L 30 25 L 40 30"}')$$,
  'Hasta planı imzalar');
select is((select total from treatment_plan_approvals a join treatment_plans p on p.id = a.plan_id where p.title = 'test-onay'),
  1500000, 'İmzalanan toplam saklanır');
select is((select jsonb_array_length(items) from treatment_plan_approvals a join treatment_plans p on p.id = a.plan_id where p.title = 'test-onay'),
  2, 'İmzalanan işlemlerin kopyası saklanır');
select isnt((select locked_at from treatment_plans where title = 'test-onay'), null,
  'İmzalanan plan kilitlenir');
select throws_ok(
  $$select sign_treatment_plan((select id from treatment_plans where title = 'test-onay'),
      '{"w":300,"h":120,"d":"M 10 10 L 20 20 L 30 25 L 40 30"}')$$,
  '23514', null, 'Aynı kilit için ikinci kez imzalatılmaz');
select throws_ok(
  $$delete from treatment_plan_approvals$$,
  '42501', null, 'Onay kaydı silinemez');

-- Resepsiyon planları göremez, onay da alamaz
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$select sign_treatment_plan((select id from treatment_plans limit 1),
      '{"w":300,"h":120,"d":"M 10 10 L 20 20 L 30 25 L 40 30"}')$$,
  null, null, 'Yetkisiz kullanıcı onay alamaz');

select * from finish();
rollback;
