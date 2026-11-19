-- =============================================================================
-- Rapor testleri (pgTAP): kim neyi görür, prim hesapları, prim oranı yetkisi.
-- a..1 sahip+hekim (Dr. A, %30), a..2 hekim (Dr. B, %25), a..3 yönetici, a..4 resepsiyon, a..5 asistan
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

create temp table t_range as select current_date - 400 as d1, current_date as d2;
grant select on t_range to authenticated;

set local role authenticated;

-- ============================ RESEPSİYON / ASİSTAN =============================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$select * from report_payments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))$$,
  '42501', null, 'Resepsiyon gün sonu raporunu göremez');
select throws_ok(
  $$select * from report_completed_treatments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))$$,
  '42501', null, 'Resepsiyon tedavi raporunu göremez');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select throws_ok(
  $$select * from report_commission_items('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range), 'tedavi')$$,
  '42501', null, 'Asistan prim raporunu göremez');

-- ============================ YÖNETİCİ ========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select isnt_empty(
  $$select 1 from report_payments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))$$,
  'Yönetici gün sonu raporunu görür');
select is(
  (select count(distinct doctor_member_id)::int from report_completed_treatments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))),
  2, 'Yönetici tüm hekimlerin tamamladığı tedavileri görür');
select throws_ok(
  $$select set_commission_rate('b0000000-0000-4000-8000-000000000002', 40)$$,
  '42501', null, 'Prim oranını yönetici değiştiremez');

-- ============================ HEKİM (Dr. B) ====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok(
  $$select * from report_payments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))$$,
  '42501', null, 'Hekim gün sonu (kasa) raporunu göremez');
select results_eq(
  $$select distinct doctor_member_id from report_completed_treatments('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range))$$,
  $$values ('b0000000-0000-4000-8000-000000000002'::uuid)$$,
  'Hekim yalnızca kendi tamamladığı tedavileri görür');
select results_eq(
  $$select distinct doctor_member_id from report_commission_items('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range), 'odeme_tedavi')$$,
  $$values ('b0000000-0000-4000-8000-000000000002'::uuid)$$,
  'Hekim yalnızca kendi primini görür');
select is(
  (select count(*)::int from report_commission_items('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range), 'tedavi')
   where prim <> round(amount * 25 / 100.0)),
  0, 'Tedavi bazlı prim = tedavi ücreti × %25');
select is(
  (select count(*)::int from report_commission_items('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range), 'odeme_tedavi')
   where abs(prim + prim_pending - round(amount * 25 / 100.0)) > 1 or paid_amount > amount),
  0, 'Ödeme ve tedavi bazlı: ödenen kısmın primi + bekleyen prim = toplam prim');
select throws_ok(
  $$select set_commission_rate('b0000000-0000-4000-8000-000000000002', 40)$$,
  '42501', null, 'Hekim kendi prim oranını değiştiremez');

-- ============================ SAHİP (Dr. A) ====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select is(
  (select sum(amount)::bigint from report_commission_items('c0000000-0000-4000-8000-000000000001', current_date - 3, current_date - 3, 'nakit')
   where patient_name = 'Şule Örnekoğlu'),
  150000::bigint, 'Nakit bazlı: ödeme, hastadaki tedavi payına göre hekime yazılır');
select is(
  (select paid_amount from report_commission_items('c0000000-0000-4000-8000-000000000001', (select d1 from t_range), (select d2 from t_range), 'odeme_tedavi')
   where patient_name = 'Şule Örnekoğlu' and label = 'Diş çekimi'),
  150000::bigint, 'Borcunu tamamen ödeyen hastanın tedavisi tamamen ödenmiş sayılır');
select lives_ok(
  $$select set_commission_rate('b0000000-0000-4000-8000-000000000002', 35)$$,
  'Sahip prim oranını değiştirir');
select throws_ok(
  $$select set_commission_rate('b0000000-0000-4000-8000-000000000004', 10)$$,
  '23514', null, 'Prim oranı yalnızca hekimlere girilir');

select * from finish();
rollback;
