-- =============================================================================
-- Mesai takibi testleri (pgTAP): tablet eşleştirme, değişen kod, giriş/çıkış, düzeltme.
-- a..1 sahip+hekim, a..2 hekim, a..3 yönetici, a..4 resepsiyon, a..5 asistan
-- a..9: yeni (anonim) tablet oturumu
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

-- Rol değiştirmeden önce: şu anki ve bir önceki kod, yeni tablet için anonim kullanıcı
create temp table t_code as
select private.kiosk_code('c0000000-0000-4000-8000-000000000001', private.kiosk_window()) as code,
       private.kiosk_code('c0000000-0000-4000-8000-000000000001', private.kiosk_window() - 1) as prev;
create temp table t_pair (code text);
grant select on t_code to authenticated, service_role;
grant select, insert on t_pair to authenticated, service_role;
insert into auth.users (id, aud, role)
values ('a0000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated'),
       ('a0000000-0000-4000-8000-00000000000a', 'authenticated', 'authenticated');

-- Resepsiyon bugün içeride olsun (günün saatinden bağımsız; 2 dk tekrar okutma sınırının dışında)
insert into public.attendance (clinic_id, member_id, check_in, in_source)
values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004',
        now() - interval '3 minutes', 'qr');

set local role authenticated;

-- ============================ EŞLEŞTİRME ======================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok(
  $$select * from create_device_pairing('c0000000-0000-4000-8000-000000000001', 'Test tableti')$$,
  '42501', null, 'Resepsiyon mesai ekranı kuramaz');
select throws_ok(
  $$select * from kiosk_current_code()$$,
  '42501', null, 'Personel hesabı kod üretemez');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select lives_ok(
  $$insert into t_pair select code from create_device_pairing('c0000000-0000-4000-8000-000000000001', 'Test tableti')$$,
  'Yönetici eşleştirme kodu üretir');
select throws_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'ekran')$$,
  '42501', null, 'Mesai Ekranı rolü elle bir personele verilemez');

select throws_ok(
  $$select claim_device_pairing((select code from t_pair), 'a0000000-0000-4000-8000-000000000009')$$,
  '42501', null, 'Eşleştirmeyi uygulamadaki kullanıcılar değil, yalnızca sunucu yapar');

-- Sunucu fonksiyonu (Edge Function) service_role ile çağırır
set local role service_role;
select throws_ok(
  $$select claim_device_pairing((select code from t_pair), 'a0000000-0000-4000-8000-000000000004')$$,
  '42501', null, 'Personel hesabı tablete dönüştürülemez');
select is(claim_device_pairing((select code from t_pair), 'a0000000-0000-4000-8000-000000000009'),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'Yeni tablet eşleştirme koduyla kliniğe bağlanır');
select throws_ok(
  $$select claim_device_pairing((select code from t_pair), 'a0000000-0000-4000-8000-00000000000a')$$,
  '23514', null, 'Eşleştirme kodu tek kullanımlıktır');
set local role authenticated;

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000009","role":"authenticated"}';
select ok((select code from kiosk_current_code()) in (select code from t_code union select prev from t_code),
  'Tablet güncel kodu gösterir');
select is_empty($$select 1 from patients$$, 'Tablet hasta kayıtlarını göremez');
select is_empty($$select 1 from attendance$$, 'Tablet mesai kayıtlarını göremez');

-- ============================ GİRİŞ / ÇIKIŞ ====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is(
  (select action from check_in('DKMESAI:c0000000-0000-4000-8000-000000000001:' || (select code from t_code))),
  'giris', 'Hekim QR okutunca giriş kaydedilir');
select throws_ok(
  $$select * from check_in('DKMESAI:c0000000-0000-4000-8000-000000000001:' || (select code from t_code))$$,
  '23514', null, 'Arka arkaya okutma girişi hemen çıkışa çevirmez');
select throws_ok(
  $$select * from check_in('DKMESAI:c0000000-0000-4000-8000-000000000001:000000x')$$,
  '23514', null, 'Geçersiz ya da süresi dolmuş kod reddedilir');
select is((select count(distinct member_id)::int from attendance), 1,
  'Personel yalnızca kendi mesai kayıtlarını görür');
select is((select member_id from attendance limit 1), 'b0000000-0000-4000-8000-000000000002'::uuid,
  'Kayıt okutan kişinin hesabına yazılır');
select throws_ok(
  $$select correct_attendance((select id from attendance limit 1), now() - interval '2 hours', null, 'deneme')$$,
  '42501', null, 'Personel kendi kaydını düzeltemez');

-- Resepsiyon bugün içeride (yukarıda eklendi): elle yazılan kodla çıkış
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is((select action from check_in((select code from t_code))), 'cikis',
  'Bugün girişi olan personel kodu yazınca çıkış kaydedilir');

-- Asistanın dünden açık kalan kaydı var: bugün okutması yeni giriş sayılır
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';
select is((select action from check_in((select code from t_code))), 'giris',
  'Önceki günden çıkışı eksik kayıt, bugünkü okutmayı çıkışa çevirmez');

-- ============================ YÖNETİCİ =========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select ok((select count(distinct member_id) from attendance) >= 4, 'Yönetici herkesin kayıtlarını görür');
select throws_ok(
  $$select correct_attendance(
      (select id from attendance where member_id = 'b0000000-0000-4000-8000-000000000005' and check_out is null
        order by check_in limit 1), now() - interval '30 hours', now() - interval '21 hours', '  ')$$,
  '23514', null, 'Sebepsiz düzeltme yapılamaz');
select lives_ok(
  $$select correct_attendance(
      (select id from attendance where member_id = 'b0000000-0000-4000-8000-000000000005' and check_out is null
        order by check_in limit 1), now() - interval '30 hours', now() - interval '21 hours',
      'Çıkışı okutmayı unutmuş; 18:00''de çıktığını söyledi')$$,
  'Yönetici sebep yazarak eksik çıkışı düzeltir');
select isnt_empty($$select 1 from attendance_changes where reason like 'Çıkışı okutmayı unutmuş%' and old_out is null$$,
  'Düzeltmede eski ve yeni saat saklanır');
select lives_ok(
  $$select add_attendance('b0000000-0000-4000-8000-000000000002', now() - interval '10 days 1 hour',
      now() - interval '10 days', 'Telefonu bozuktu, elle eklendi')$$,
  'Yönetici okutulmamış bir gün için sebepli kayıt ekler');

select lives_ok(
  $$select revoke_device((select member_id from kiosk_devices where name = 'Test tableti'))$$,
  'Yönetici tableti kaldırır');

select * from finish();
rollback;
