-- =============================================================================
-- Ödeme planı (taksit) testleri (pgTAP).
-- a..4 resepsiyon (odeme.yaz), a..5 asistan; hasta e..5
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(10);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select throws_ok(
  $$select create_payment_plan('e0000000-0000-4000-8000-000000000005', 'test-taksit', null, '[]')$$,
  '23514', null, 'Taksitsiz plan oluşturulamaz');

select lives_ok(
  $$select create_payment_plan('e0000000-0000-4000-8000-000000000005', 'test-taksit', null,
      jsonb_build_array(
        jsonb_build_object('due_date', current_date + 30, 'amount', 1000000),
        jsonb_build_object('due_date', current_date - 1, 'amount', 1000000)))$$,
  'Resepsiyon iki taksitli ödeme planı oluşturur');
select is((select total from payment_plans where title = 'test-taksit'), 2000000, 'Plan toplamı taksitlerin toplamı');
select results_eq(
  $$select seq::int, status from installment_status s join payment_plans p on p.id = s.plan_id
     where p.title = 'test-taksit' order by seq$$,
  $$values (1, 'gecikti'), (2, 'bekliyor')$$,
  'Taksitler vade sırasıyla numaralanır; vadesi geçen gecikti görünür');

insert into patient_payments (clinic_id, patient_id, amount, method)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 1500000, 'nakit');
select results_eq(
  $$select status, paid from installment_status s join payment_plans p on p.id = s.plan_id
     where p.title = 'test-taksit' order by seq$$,
  $$values ('odendi', 1000000), ('kismi', 500000)$$,
  'Tahsilat taksitlere sırayla dağıtılır (ödendi işareti elle verilmez)');

-- Tahsilatı yalnızca klinik sahibi iptal eder
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
update patient_payments set cancelled_at = now(), cancel_reason = 'test'
 where patient_id = 'e0000000-0000-4000-8000-000000000005' and amount = 1500000;
select is(
  (select count(*)::int from installment_status s join payment_plans p on p.id = s.plan_id
    where p.title = 'test-taksit' and s.status = 'odendi'), 0,
  'İptal edilen tahsilat taksit durumundan düşer');

select throws_ok($$select cancel_payment_plan((select id from payment_plans where title = 'test-taksit'), '')$$,
  '23514', null, 'Sebepsiz iptal edilemez');
select lives_ok($$select cancel_payment_plan((select id from payment_plans where title = 'test-taksit'), 'Hasta peşin ödeyecek')$$,
  'Plan sebebiyle iptal edilir');
select is(
  (select count(*)::int from installment_status s join payment_plans p on p.id = s.plan_id where p.title = 'test-taksit'), 0,
  'İptal edilen plan takipte görünmez');

-- Asistan ödemeleri görmez
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select count(*)::int from payment_plans), 0, 'Asistan ödeme planlarını göremez');

select * from finish();
rollback;
