-- =============================================================================
-- Laboratuvar ay sonu faturası ve gider raporu testleri (pgTAP).
-- a..7 muhasebe, a..2 hekim (Dr. Demo B, üye b..2), a..4 resepsiyon; hasta e..2
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

-- Hazırlık: hekim B'nin bu ay tamamladığı iki iş
insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
        'test-lab', 'b0000000-0000-4000-8000-000000000002');
insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
       'b0000000-0000-4000-8000-000000000002', current_date, x.p, x.t, 'tamamlandi', 'kron_kopru', id, 1000000
  from treatment_plans, (values ('test-lab-a', '16'), ('test-lab-b', '26')) as x(p, t)
 where title = 'test-lab';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select * from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  '42501', null, 'Hekim laboratuvar faturası girmez');
select throws_ok(
  $$select add_treatment_expense((select id from treatments where procedure = 'test-lab-a'), null, 'X', null, 'TRY', 1000, null)$$,
  '42501', null, 'Hekim tekil gider de girmez');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000007","role":"authenticated"}';
select is(
  (select count(*)::int from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)
    where procedure like 'test-lab-%'), 2, 'Muhasebe dönemdeki işleri hekim ve hastasıyla görür');

select lives_ok(
  $$select create_lab_statement('c0000000-0000-4000-8000-000000000001', null, 'Test Ay Sonu Lab',
      current_date - 30, current_date, 'F-001', current_date, 'USD', 34.5, 10000, null,
      jsonb_build_array(
        jsonb_build_object('treatment_id', (select treatment_id from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date) where procedure = 'test-lab-a'), 'amount', 6000, 'description', 'Zirkonyum'),
        jsonb_build_object('treatment_id', (select treatment_id from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date) where procedure = 'test-lab-b'), 'amount', 4000)))$$,
  'Muhasebe ay sonu faturasını işlere dağıtarak girer');
select results_eq(
  $$select expensed from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)
     where procedure like 'test-lab-%' order by procedure$$,
  $$values (207000::bigint), (138000::bigint)$$,
  'Kalemler faturanın kuruyla TL''ye çevrilip işlere yazılır');
select is(
  (select expensed from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)
    where procedure = 'test-lab-a'), 207000::bigint, 'Faturalanan iş listede gideriyle görünür');
select is(
  (select sum(amount)::bigint from report_expenses('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)
    where kind = 'laboratuvar' and label = 'Test Ay Sonu Lab'), 345000::bigint,
  'Gider raporunda laboratuvar toplamı');

select lives_ok($$select cancel_lab_statement((select id from lab_statements where invoice_no = 'F-001'), 'Yanlış ay')$$,
  'Fatura sebebiyle iptal edilir');
select is(
  (select sum(expensed)::int from lab_candidates('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)
    where procedure like 'test-lab-%'), 0,
  'İptal edilen faturanın kalemleri de iptal olur');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$select * from report_expenses('c0000000-0000-4000-8000-000000000001', current_date - 30, current_date)$$,
  '42501', null, 'Resepsiyon gider raporunu göremez');

select * from finish();
rollback;
