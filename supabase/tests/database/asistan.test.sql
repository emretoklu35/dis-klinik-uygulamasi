-- =============================================================================
-- Asistan ve medya inceleme iş akışı testleri (pgTAP). Çalıştırma: npm run db:test
-- a..5 asistan, a..2 hekim, a..4 resepsiyon (seed.sql)
-- Asistan: hastayı bulur, alerji işaretini görür, medya yükler; görüntüleri ve
-- sağlık ayrıntısını göremez. Hekim inceler, gerekirse tekrar çekim ister.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(21);

-- ============================ ASİSTAN: yükleme ===============================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select results_eq('select count(*)::int from patients', array[6], 'Asistan hastaları bulabilir');
select is((select has_allergy_alert from patients where id = 'e0000000-0000-4000-8000-000000000003'), true,
  'Asistan alerji işaretini görür (ör. lateks)');
select is_empty('select * from patient_medical', 'Asistan sağlık ayrıntısını göremez');
select is_empty('select * from treatments', 'Asistan tedavi listesini göremez');
select is_empty('select * from appointment_clinical', 'Asistan randevu işlem ayrıntısını göremez');

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('radiographs', 'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-1.jpg')$$,
  'Asistan dosya yükleyebilir');
select lives_ok(
  $$insert into radiographs (clinic_id, patient_id, purpose, kind, storage_path, content_type) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'tedavi_oncesi', 'panoramik',
     'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-1.jpg', 'image/jpeg')$$,
  'Asistan röntgen kaydı oluşturabilir');
select is_empty('select * from radiographs', 'Asistan yüklenen görüntü kayıtlarını göremez');
select is_empty($$select * from storage.objects where bucket_id = 'radiographs'$$,
  'Asistan görüntü dosyalarını göremez');
select throws_ok(
  $$insert into radiographs (clinic_id, patient_id, treatment_id, purpose, kind, storage_path, content_type)
    select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003',
           gen_random_uuid(), 'tedavi_oncesi', 'panoramik',
           'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-x.jpg', 'image/jpeg'$$,
  '42501', null, 'Asistan görüntüyü tedaviye bağlayamaz');
select results_eq(
  $$with u as (update radiographs set review_status = 'onaylandi' returning 1) select count(*)::int from u$$,
  array[0], 'Asistan görüntüyü onaylayamaz');
select throws_ok(
  $$insert into media_requests (clinic_id, patient_id, kind, purpose, reason) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'panoramik', 'kontrol', 'x')$$,
  '42501', null, 'Asistan çekim isteği açamaz');

-- ============================ HEKİM: inceleme ================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select is(
  (select review_status::text from radiographs where storage_path like '%/asistan-1.jpg'),
  'inceleme_bekliyor', 'Yeni yükleme hekime "inceleme bekliyor" olarak gelir');
select throws_ok(
  $$update radiographs set review_status = 'tekrar_istendi' where storage_path like '%/asistan-1.jpg'$$,
  '23514', null, 'Tekrar çekim sebepsiz istenemez');
select lives_ok(
  $$update radiographs set review_status = 'tekrar_istendi', review_note = 'Bulanık çıktı, tekrar çekilsin'
    where storage_path like '%/asistan-1.jpg'$$,
  'Hekim sebebiyle tekrar çekim isteyebilir');
select is(
  (select reviewed_by::text from radiographs where storage_path like '%/asistan-1.jpg'),
  'a0000000-0000-4000-8000-000000000002', 'İncelemeyi yapan hekim otomatik kaydedilir');

-- ============================ ASİSTAN: tekrar çekim ==========================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from media_requests where reason = 'Bulanık çıktı, tekrar çekilsin' and fulfilled_at is null$$,
  array[1], 'Asistan açık tekrar çekim isteğini görür');
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
      ('radiographs', 'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-2.jpg');
    insert into radiographs (clinic_id, patient_id, purpose, kind, storage_path, content_type, request_id)
    select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'tedavi_oncesi', 'panoramik',
           'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-2.jpg', 'image/jpeg', id
    from media_requests where reason = 'Bulanık çıktı, tekrar çekilsin'$$,
  'Asistan isteğe karşılık yeni görüntü yükler');
select isnt(
  (select fulfilled_at from media_requests where reason = 'Bulanık çıktı, tekrar çekilsin'), null,
  'Yeni yükleme isteği otomatik kapatır');
select throws_ok(
  $$insert into radiographs (clinic_id, patient_id, purpose, kind, storage_path, content_type, request_id)
    select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'tedavi_oncesi', 'panoramik',
           'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/asistan-3.jpg', 'image/jpeg', id
    from media_requests where reason = 'Bulanık çıktı, tekrar çekilsin'$$,
  '23514', null, 'Kapanmış isteğe ikinci yükleme yapılamaz');

-- ============================ RESEPSİYON =====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is_empty('select * from media_requests', 'Resepsiyon çekim isteklerini görmez');

select * from finish();
rollback;
