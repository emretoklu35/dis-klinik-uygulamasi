-- =============================================================================
-- Tedavi planı kilidi testleri (pgTAP).
-- a..2 hekim (Dr. Demo B, üye b..2), a..1 sahip + hekim; hasta e..2
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        'test-kilit', 'b0000000-0000-4000-8000-000000000002');

select throws_ok($$select lock_treatment_plan((select id from treatment_plans where title = 'test-kilit'))$$,
  '23514', null, 'Boş plan kilitlenemez');

insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
       'b0000000-0000-4000-8000-000000000002', current_date, 'test-kanal', '36', 'planlandi', 'kanal', id, 600000
  from treatment_plans where title = 'test-kilit';

select lives_ok($$select lock_treatment_plan((select id from treatment_plans where title = 'test-kilit'))$$,
  'Hekim planı kilitler');
select isnt((select locked_by_name from treatment_plans where title = 'test-kilit'), null,
  'Kilitleyen kişinin adı saklanır');

select throws_ok($$update treatments set amount = 500000 where procedure = 'test-kanal'$$,
  '23514', null, 'Kilitli planda ücret değiştirilemez');
select throws_ok($$update treatments set tooth = '37' where procedure = 'test-kanal'$$,
  '23514', null, 'Kilitli planda diş değiştirilemez');
select throws_ok(
  $$insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, status, kind, plan_id)
    select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
           'b0000000-0000-4000-8000-000000000002', current_date, 'test-ek', 'planlandi', 'dolgu', id
      from treatment_plans where title = 'test-kilit'$$,
  '23514', null, 'Kilitli plana işlem eklenemez');
select throws_ok($$select delete_treatment_plan((select id from treatment_plans where title = 'test-kilit'))$$,
  '23514', null, 'Kilitli plan silinemez');

-- Durum değişebilir; tamamlanınca anlaşılan ücret borca eklenir
select lives_ok($$update treatments set status = 'tamamlandi', note = 'bitti' where procedure = 'test-kanal'$$,
  'Kilitli planda işlem tamamlanabilir');
set constraints all immediate;
select is(
  (select c.amount from patient_charges c join treatments t on t.id = c.treatment_id where t.procedure = 'test-kanal'),
  600000, 'Anlaşılan ücret borca eklenir');
set constraints all deferred;

select throws_ok($$select unlock_treatment_plan((select id from treatment_plans where title = 'test-kilit'))$$,
  '42501', null, 'Hekim kilidi açamaz');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select unlock_treatment_plan((select id from treatment_plans where title = 'test-kilit'))$$,
  'Klinik sahibi kilidi açar');
select is(
  (select locked_at is null and unlocked_by_name is not null from treatment_plans where title = 'test-kilit'),
  true, 'Kilit açıldı; açan kişi saklandı');

select * from finish();
rollback;
