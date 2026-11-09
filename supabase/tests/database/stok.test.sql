-- =============================================================================
-- Stok testleri (pgTAP). Çalıştırma: npm run db:test
-- a..1 sahip+hekim, a..2 hekim, a..4 resepsiyon, a..5 asistan
-- 5..1 Eldiven (160 adet), 5..3 Artikain (parti takipli; ART-2401: 36, ART-2409: 100)
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

-- ============================ ASİSTAN ========================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select results_eq('select count(*)::int from stock_items', array[7], 'Asistan stok listesini görür');
select lives_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'kullanim', -10)$$,
  'Asistan kullanım düşebilir');
select is(
  (select quantity from stock_levels where item_id = '50000000-0000-4000-8000-000000000001'), 150,
  'Mevcut stok hareketlerin toplamıdır (160 − 10)');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'kullanim', -151)$$,
  '23514', null, 'Stok eksiye düşemez');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'giris', 100)$$,
  '42501', null, 'Asistan teslimat girişi yapamaz');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'kullanim', -2)$$,
  '23514', null, 'Parti takipli malzemede parti seçmeden düşülemez');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, lot_no) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'kullanim', -37, 'ART-2401')$$,
  '23514', null, 'Partide olandan fazlası düşülemez (ART-2401: 36)');
select lives_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, lot_no) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'kullanim', -6, 'ART-2401')$$,
  'Partiden kullanım düşülebilir');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, lot_no) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'fire', -1, 'ART-2401')$$,
  '23514', null, 'Fire sebepsiz girilemez');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, counted_quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'sayim', 147)$$,
  '23514', null, 'Sayım farkı açıklamasız girilemez');
select lives_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, counted_quantity, note) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'sayim', 0, 147, 'Aylık sayım')$$,
  'Asistan sayım girebilir');
select results_eq(
  $$select quantity, created_by::text from stock_movements where kind = 'sayim' order by created_at desc limit 1$$,
  $$values (-3, 'a0000000-0000-4000-8000-000000000005')$$,
  'Sayım farkını veritabanı hesaplar (150 → 147 = −3) ve kim girdiği yazılır');
select throws_ok(
  $$update stock_movements set quantity = 0$$,
  '42501', null, 'Hareketler sonradan değiştirilemez (yetki yok)');
select throws_ok(
  $$insert into stock_items (clinic_id, name) values ('c0000000-0000-4000-8000-000000000001', 'Test')$$,
  '42501', null, 'Asistan malzeme kartı açamaz');
select is_empty('select * from stock_costs', 'Asistan maliyetleri göremez');

-- ============================ RESEPSİYON =====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, lot_no) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'giris', 50, 'ART-2412')$$,
  '23514', null, 'Parti takipli girişte son kullanma tarihi zorunlu');
select lives_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity, lot_no, expiry_date) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'giris', 50, 'ART-2412', current_date + 500)$$,
  'Resepsiyon teslimat girişi yapabilir');
select throws_ok(
  $$insert into stock_movements (clinic_id, item_id, kind, quantity) values
    ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'kullanim', -1)$$,
  '42501', null, 'Resepsiyon kullanım düşemez');

-- ============================ SAHİP ==========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok(
  $$with m as (
      insert into stock_movements (clinic_id, item_id, kind, quantity) values
        ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'giris', 50)
      returning id, clinic_id)
    insert into stock_costs (movement_id, clinic_id, unit_cost) select id, clinic_id, 250 from m$$,
  'Sahip girişle birlikte maliyet kaydedebilir');
select isnt_empty('select * from stock_costs', 'Sahip maliyetleri görür');
select lives_ok(
  $$update stock_items set min_level = 250 where id = '50000000-0000-4000-8000-000000000001'$$,
  'Sahip kritik seviyeyi değiştirebilir');

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
select is_empty('select * from stock_items', 'Başka kliniğin sahibi bu kliniğin stoğunu göremez');

select * from finish();
rollback;
