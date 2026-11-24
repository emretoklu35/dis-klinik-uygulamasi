-- =============================================================================
-- Yarım kalan tedaviler raporu testleri (pgTAP).
-- a..1 sahip (rapor.oku), a..2 hekim (rapor.kendi, üye b..2), a..4 resepsiyon
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(6);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

-- Hekim B'nin yarım kalan planı: 1 tamamlandı, 1 planlandı
insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id, is_active)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006',
       'test-yarim', 'b0000000-0000-4000-8000-000000000002', false;
select set_active_treatment_plan(id) from treatment_plans where title = 'test-yarim';
insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006',
       'b0000000-0000-4000-8000-000000000002', current_date, x.p, x.s::treatment_status, 'implant', id, x.a
  from treatment_plans, (values ('test-y1', 'tamamlandi', 100000), ('test-y2', 'planlandi', 300000)) as x(p, s, a)
 where title = 'test-yarim';

select is(
  (select done_items || '/' || total_items || ' ' || done_amount || '/' || total_amount
     from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1)
    where plan_title = 'test-yarim'),
  '1/2 100000/400000', 'Yarım kalan plan tamamlanma ve tutarlarıyla listelenir');
select is(
  (select count(*)::int from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1)
    where doctor_member_id <> 'b0000000-0000-4000-8000-000000000002'), 0,
  'Hekim yalnızca kendi planlarını görür');
select is(
  (select 'implant' = any (kinds) from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1)
    where plan_title = 'test-yarim'), true, 'İşlem türleri filtre için döner');

update treatments set status = 'tamamlandi' where procedure = 'test-y2';
select is(
  (select count(*)::int from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 1, current_date + 1)
    where plan_title = 'test-yarim'), 0, 'Tamamlanan plan listeden çıkar');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select * from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  'Klinik sahibi raporu görür');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from report_unfinished_plans('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  '42501', null, 'Resepsiyon bu raporu göremez');

select * from finish();
rollback;
