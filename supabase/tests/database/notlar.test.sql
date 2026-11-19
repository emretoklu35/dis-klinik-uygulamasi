-- =============================================================================
-- Hasta notları, ek not, kilit, favori cümle ve seans kapatma testleri (pgTAP).
-- a..1 sahip+hekim (Dr. Demo A), a..2 hekim (Dr. Demo B), a..4 resepsiyon, a..5 asistan
-- Hasta e..3: seed'de klinik (biri gizli), randevu ve ödeme notları var.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(39);

-- Rol değiştirmeden önce kimlikleri al
create temp table t_ids as
select
  (select id from public.treatments
    where patient_id = 'e0000000-0000-4000-8000-000000000003' and procedure = 'Dolgu' and status = 'planlandi') as treatment_id,
  (select id from public.appointments
    where patient_id = 'e0000000-0000-4000-8000-000000000003' and status not in ('iptal', 'gelmedi')
    order by starts_at limit 1) as appointment_id,
  (select id from public.patient_notes
    where patient_id = 'e0000000-0000-4000-8000-000000000003' and template = 'muayene') as dr_a_note,
  (select id from public.patient_notes
    where patient_id = 'e0000000-0000-4000-8000-000000000002' and kind = 'klinik') as dr_b_old_note;
grant select on t_ids to authenticated;

-- ============================ RESEPSİYON =====================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select is_empty($$select 1 from patient_notes where kind = 'klinik'$$,
  'Resepsiyon klinik notları göremez');
select isnt_empty($$select 1 from patient_notes where kind = 'randevu'$$,
  'Resepsiyon randevu notlarını görür');
select isnt_empty($$select 1 from patient_notes where kind = 'odeme'$$,
  'Resepsiyon ödeme notlarını görür');
select lives_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'randevu', 'test-genel-not')$$,
  'Resepsiyon randevu notu yazabilir');
select is((select author_member_id from patient_notes where body = 'test-genel-not'),
  'b0000000-0000-4000-8000-000000000004'::uuid, 'Yazan kişi veritabanında oturumdaki üye olarak atanır');
select throws_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'klinik', 'test-izinsiz')$$,
  '42501', null, 'Resepsiyon klinik not yazamaz');
select lives_ok(
  $$update patient_notes set body = 'test-genel-not (düzeltildi)' where body = 'test-genel-not'$$,
  'Yazan kişi 24 saat içinde notunu düzeltebilir');
select results_eq(
  $$select r.old_body, n.edit_count from note_revisions r join patient_notes n on n.id = r.note_id
    where n.body = 'test-genel-not (düzeltildi)'$$,
  $$values ('test-genel-not'::text, 1)$$, 'Düzeltmede eski metin geçmişe yazılır');
select throws_ok(
  $$delete from patient_notes where body like 'test-genel-not%'$$,
  '42501', null, 'Notlar silinemez');
select throws_ok(
  $$select close_visit((select appointment_id from t_ids), '{}'::jsonb)$$,
  '42501', null, 'Resepsiyon seans kapatamaz');
select is_empty($$select 1 from treatment_summaries('e0000000-0000-4000-8000-000000000003')$$,
  'Resepsiyon tedavi özetini göremez');

-- ============================ ASİSTAN ========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select isnt_empty($$select 1 from patient_notes where kind = 'klinik'$$,
  'Asistan klinik notları görür');
select is_empty($$select 1 from patient_notes where hidden$$,
  'Asistan gizli notları göremez');
select is_empty($$select 1 from patient_notes where kind = 'odeme'$$,
  'Asistan ödeme notlarını göremez');
select is_empty($$select 1 from treatment_summaries('e0000000-0000-4000-8000-000000000003')$$,
  'Asistan tedavi özetini göremez');
select lives_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body, teeth) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik',
     'test-asistan-not', '{46, 36, 36}')$$,
  'Asistan klinik not yazabilir (hekimin söylediğini yazar)');
select is((select teeth from patient_notes where body = 'test-asistan-not'),
  '{36,46}'::smallint[], 'Diş numaraları tekilleştirilip sıralanır');
select throws_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body, hidden) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik', 'test-gizli', true)$$,
  '42501', null, 'Asistan gizli not yazamaz');
select throws_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body, treatment_id) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik', 'test-tedavi',
     (select treatment_id from t_ids))$$,
  '42501', null, 'Asistan notu tedaviye bağlayamaz (tedavileri göremez)');

-- ============================ HEKİM (Dr. Demo B) ==============================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select isnt_empty($$select 1 from patient_notes where hidden$$, 'Hekim gizli notları görür');
select is(
  (select count(*)::int from treatment_summaries('e0000000-0000-4000-8000-000000000003')),
  (select count(*)::int from treatments where patient_id = 'e0000000-0000-4000-8000-000000000003'),
  'Hekim tedavi özetinde hastanın tüm tedavilerini görür');
select throws_ok(
  $$update patient_notes set body = 'başkasının notu' where id = (select dr_a_note from t_ids)$$,
  '42501', null, 'Hekim başkasının notunu düzeltemez');
select throws_ok(
  $$update patient_notes set body = 'eski not' where id = (select dr_b_old_note from t_ids)$$,
  '23514', null, '24 saati geçen not kilitlidir');
select lives_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body, parent_id) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'randevu',
     'test-ek-not', (select dr_a_note from t_ids))$$,
  'Kilitli nota ek not eklenebilir');
select results_eq(
  $$select kind::text, patient_id from patient_notes where body = 'test-ek-not'$$,
  $$values ('klinik'::text, 'e0000000-0000-4000-8000-000000000003'::uuid)$$,
  'Ek not türünü ve hastasını ana nottan alır');
select throws_ok(
  $$insert into patient_notes (clinic_id, patient_id, kind, body, teeth) values
    ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik', 'test-dis', '{19}')$$,
  '23514', null, 'Geçersiz diş numarası (FDI dışı) girilemez');
select is_empty($$select 1 from note_phrases$$, 'Hekim başkasının favori cümlelerini göremez');

-- Seans kapatma
select lives_ok(
  format($$select close_visit(%L, %L::jsonb)$$,
    (select appointment_id from t_ids),
    jsonb_build_object(
      'done_treatment_ids', jsonb_build_array((select treatment_id from t_ids)),
      'new_treatments', jsonb_build_array(jsonb_build_object(
        'procedure', 'test-periapikal', 'tooth', '37', 'amount', 40000)),
      'stock', jsonb_build_array(jsonb_build_object(
        'item_id', '50000000-0000-4000-8000-000000000001', 'quantity', 1)),
      'note', jsonb_build_object('body', 'test-seans-notu', 'teeth', jsonb_build_array(37)),
      'follow_up', jsonb_build_object('title', 'test-takip', 'due_date', (current_date + 14)::text)
    )::text),
  'Hekim seansı kapatır');
select is((select status::text from treatments where id = (select treatment_id from t_ids)),
  'tamamlandi', 'Seansta işaretlenen tedavi tamamlanır');
select is((select amount from patient_charges where description = 'test-periapikal'), 40000,
  'Seansta yapılan yeni tedavinin ücreti hesaba düşer');
select is((select count(*)::int from stock_movements
            where appointment_id = (select appointment_id from t_ids)
              and patient_id = 'e0000000-0000-4000-8000-000000000003' and quantity = -1), 1,
  'Kullanılan malzeme hasta ve seansla birlikte stoktan düşer');
select isnt_empty($$select 1 from tasks where title = 'test-takip'$$, 'Takip görevi açılır');
select is((select status::text from appointments where id = (select appointment_id from t_ids)),
  'tamamlandi', 'Randevu tamamlandı olur');
select throws_ok(
  format($$select close_visit(%L, '{}'::jsonb)$$, (select appointment_id from t_ids)),
  '23514', null, 'Aynı seans iki kez kapatılamaz');

-- ============================ YÖNETİCİ ========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select isnt_empty($$select 1 from treatment_summaries('e0000000-0000-4000-8000-000000000003')$$,
  'Yönetici tedavi özetini görür (tarih, işlem, diş, hekim, durum)');
select is_empty($$select 1 from treatments$$,
  'Yönetici tedavi tablosunu (tedavi notu dahil) doğrudan okuyamaz');
select is_empty($$select 1 from patient_notes where kind = 'klinik'$$,
  'Yönetici klinik notları göremez');
select results_eq(
  $$with u as (update treatments set status = 'tamamlandi' returning 1) select count(*)::int from u$$,
  $$values (0)$$, 'Yönetici tedavileri değiştiremez');

-- ============================ SAHİP + HEKİM (Dr. Demo A) =======================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select isnt_empty($$select 1 from treatment_summaries('e0000000-0000-4000-8000-000000000003')$$,
  'Sahip tedavi özetini görür');

select * from finish();
rollback;
