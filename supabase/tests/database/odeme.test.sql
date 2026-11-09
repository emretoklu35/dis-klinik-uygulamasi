-- =============================================================================
-- Ödeme, fiyat listesi ve değişiklik geçmişi testleri (pgTAP). Çalıştırma: npm run db:test
-- a..1 sahip+hekim, a..2 hekim, a..3 yönetici, a..4 resepsiyon, a..5 asistan
-- Hasta e..3: seed'de 14.000 TL borç, 6.000 TL tahsilat
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

-- Rol değiştirmeden önce bir tedavi kimliği al (resepsiyon tedavileri göremez)
create temp table test_tedavi as select clinic_id, patient_id, id from public.treatments limit 1;
grant select on test_tedavi to authenticated;

-- ============================ ASİSTAN ========================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select is_empty('select * from patient_charges', 'Asistan borç kalemlerini göremez');
select is_empty('select * from patient_payments', 'Asistan tahsilatları göremez');
select is_empty('select * from price_list_items', 'Asistan fiyat listesini göremez');
select is(
  (select total_charged from patient_balances where patient_id = 'e0000000-0000-4000-8000-000000000003'),
  0::bigint, 'Asistan için bakiye görünümü hiçbir tutar göstermez');

-- ============================ RESEPSİYON =====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select results_eq(
  $$select total_charged, total_paid from patient_balances where patient_id = 'e0000000-0000-4000-8000-000000000003'$$,
  $$values (1400000::bigint, 600000::bigint)$$, 'Resepsiyon hastanın borç/ödeme özetini görür');
select lives_ok(
  $$insert into patient_payments (clinic_id, patient_id, amount, method, note) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 100000, 'nakit', 'test-odeme')$$,
  'Resepsiyon tahsilat girebilir');
select throws_ok(
  $$insert into patient_payments (clinic_id, patient_id, amount, method) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 0, 'nakit')$$,
  '23514', null, 'Sıfır tutarlı tahsilat girilemez');
select lives_ok(
  $$insert into patient_charges (clinic_id, patient_id, price_item_id, description, amount) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
     'f0000000-0000-4000-8000-000000000003', 'test-dolgu', 250000)$$,
  'Resepsiyon liste fiyatıyla borç ekleyebilir');
select is(
  (select list_amount from patient_charges where description = 'test-dolgu'), 250000,
  'Liste tutarını veritabanı fiyat listesinden doldurur');
select throws_ok(
  $$insert into patient_charges (clinic_id, patient_id, price_item_id, description, amount) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
     'f0000000-0000-4000-8000-000000000003', 'test-indirimsiz', 200000)$$,
  '23514', null, 'Listeden farklı tutar sebepsiz girilemez');
select throws_ok(
  $$update patient_charges set amount = 220000 where description = 'test-dolgu'$$,
  '23514', null, 'Borç tutarı sebepsiz değiştirilemez');
select lives_ok(
  $$update patient_charges set amount = 220000, change_note = 'Hasta öğrenci indirimi' where description = 'test-dolgu'$$,
  'Resepsiyon borç tutarını sebebiyle değiştirebilir');
select results_eq(
  $$select old_amount, new_amount, changed_by::text, note from charge_changes order by id desc limit 1$$,
  $$values (250000, 220000, 'a0000000-0000-4000-8000-000000000004', 'Hasta öğrenci indirimi')$$,
  'Tutar değişikliği kim/eski/yeni/sebep ile geçmişe yazılır');
select lives_ok(
  $$update price_list_items set amount = 275000, change_note = 'Malzeme zammı' where id = 'f0000000-0000-4000-8000-000000000003'$$,
  'Resepsiyon fiyat listesini değiştirebilir');
select results_eq(
  $$select old_amount, new_amount, changed_by::text from price_changes order by id desc limit 1$$,
  $$values (250000, 275000, 'a0000000-0000-4000-8000-000000000004')$$,
  'Fiyat değişikliği kim/eski/yeni ile geçmişe yazılır');
select throws_ok(
  $$update patient_charges set cancelled_at = now(), cancel_reason = 'yanlış' where description = 'test-dolgu'$$,
  '42501', null, 'Resepsiyon borç kaydını iptal edemez');
select results_eq(
  $$with u as (update patient_payments set cancelled_at = now(), cancel_reason = 'x' where note = 'test-odeme' returning 1)
    select count(*)::int from u$$,
  array[0], 'Resepsiyon tahsilatı iptal edemez');
select throws_ok(
  $$update patient_payments set amount = 1 where note = 'test-odeme'$$,
  '42501', null, 'Tahsilat tutarı sonradan değiştirilemez');
select throws_ok(
  $$insert into patient_charges (clinic_id, patient_id, treatment_id, description, amount)
    select clinic_id, patient_id, id, 'test-bagli', 1000 from test_tedavi$$,
  '42501', null, 'Resepsiyon borcu tedaviye bağlayamaz (tedavileri göremez)');

-- ============================ HEKİM ==========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok(
  $$insert into patient_charges (clinic_id, patient_id, treatment_id, description, amount)
    select clinic_id, patient_id, id, 'test-hekim-bagli', 1000 from test_tedavi$$,
  'Hekim borcu tedaviye bağlayabilir');

-- ============================ SAHİP ==========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok(
  $$update patient_payments set cancelled_at = now() where note = 'test-odeme'$$,
  '23514', null, 'İptal sebepsiz yapılamaz');
select lives_ok(
  $$update patient_payments set cancelled_at = now(), cancel_reason = 'Yanlış hastaya girilmiş' where note = 'test-odeme'$$,
  'Sahip tahsilatı sebebiyle iptal edebilir');
select is(
  (select total_paid from patient_balances where patient_id = 'e0000000-0000-4000-8000-000000000003'),
  600000::bigint, 'İptal edilen tahsilat bakiyeye katılmaz');
select throws_ok(
  $$update patient_payments set cancel_reason = 'değişti' where note = 'test-odeme'$$,
  '23514', null, 'İptal edilmiş kayıt değiştirilemez');

-- ============================ BAŞKA KLİNİK ===================================
reset role;
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000009', 'baska@demo.test');
insert into public.clinics (id, name) values ('c0000000-0000-4000-8000-000000000009', 'Başka Klinik');
insert into public.clinic_members (id, clinic_id, user_id, display_name)
  values ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', 'Başka Sahip');
insert into public.member_roles (member_id, clinic_id, role)
  values ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'sahip');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000009","role":"authenticated"}';
select is_empty('select * from patient_payments', 'Başka kliniğin sahibi bu kliniğin ödemelerini göremez');

select * from finish();
rollback;
