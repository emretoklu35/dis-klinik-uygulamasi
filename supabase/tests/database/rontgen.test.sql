-- =============================================================================
-- Röntgen tablosu ve Storage klasörü erişim testleri (pgTAP). Çalıştırma: npm run db:test
-- Kullanıcılar seed.sql'den: a..1 sahip+hekim, a..2 hekim, a..3 yönetici, a..4 resepsiyon
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(14);

-- Başka bir klinik (izolasyon)
insert into public.clinics (id, name) values ('c0000000-0000-4000-8000-000000000009', 'Başka Klinik');

-- ============================ HEKİM ==========================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('radiographs', 'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/test-oncesi.jpg')$$,
  'Hekim kendi kliniğinin klasörüne dosya yükleyebilir');
select lives_ok(
  $$insert into radiographs (clinic_id, patient_id, purpose, kind, storage_path, content_type) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'tedavi_oncesi', 'panoramik',
     'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/test-oncesi.jpg', 'image/jpeg')$$,
  'Hekim röntgen kaydı ekleyebilir');
select results_eq(
  $$select count(*)::int from radiographs where storage_path like '%/test-oncesi.jpg'$$,
  array[1], 'Hekim röntgen kaydını görür');
select results_eq(
  $$select count(*)::int from storage.objects where bucket_id = 'radiographs' and name like '%/test-oncesi.jpg'$$,
  array[1], 'Hekim röntgen dosyasını görür');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('radiographs', 'c0000000-0000-4000-8000-000000000009/x/sizma.jpg')$$,
  '42501', null, 'Hekim başka kliniğin klasörüne dosya yükleyemez');
select throws_ok(
  $$insert into radiographs (clinic_id, patient_id, purpose, kind, storage_path, content_type) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'kontrol', 'panoramik',
     'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000001/yanlis-hasta.jpg', 'image/jpeg')$$,
  '23514', null, 'Dosya yolu başka hastanın klasörünü gösteremez');
select results_eq(
  $$with u as (update storage.objects set name = name || '-degisti' where bucket_id = 'radiographs' returning 1)
    select count(*)::int from u$$,
  array[0], 'Röntgen dosyası değiştirilemez (hiçbir satır etkilenmez)');
select lives_ok(
  $$update radiographs set invalidated_at = now() where storage_path like '%/test-oncesi.jpg'$$,
  'Hekim yanlış röntgeni geçersiz işaretleyebilir (silmeden)');

-- ============================ RESEPSİYON =====================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is_empty('select * from radiographs', 'Resepsiyon röntgen kaydı göremez');
select is_empty($$select * from storage.objects where bucket_id = 'radiographs'$$,
  'Resepsiyon röntgen dosyası göremez');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values
    ('radiographs', 'c0000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000003/resepsiyon.jpg')$$,
  '42501', null, 'Resepsiyon röntgen yükleyemez');

-- ============================ YÖNETİCİ =======================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is_empty('select * from radiographs', 'Yönetici röntgen kaydını otomatik göremez');
select is_empty($$select * from storage.objects where bucket_id = 'radiographs'$$,
  'Yönetici röntgen dosyasını otomatik göremez');

-- ============================ DENETİM ========================================
reset role;
select is(
  (select array_to_string(changed_fields, ',') from audit_log
    where table_name = 'radiographs' and action = 'update' order by id desc limit 1),
  'invalidated_at',
  'Röntgen işlemleri denetim kaydına yalnızca alan adıyla yazılır');

select * from finish();
rollback;
