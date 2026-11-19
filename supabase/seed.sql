-- =============================================================================
-- SAHTE DEMO VERİSİ — YALNIZCA YEREL GELİŞTİRME
-- İsimler, telefonlar, e-postalar ve sağlık bilgileri uydurmadır.
-- Gerçek hasta verisi bu dosyaya ASLA eklenmez.
--
-- Demo kullanıcılar (tümünün şifresi aşağıdaki v_password değeridir):
--   sahip.hekim@demo.test   → sahip + hekim  (Dr. Demo A)
--   hekim@demo.test         → hekim          (Dr. Demo B)
--   yonetici@demo.test      → yönetici
--   resepsiyon@demo.test    → resepsiyonist
--   asistan@demo.test       → asistan (medya yükler; görüntüleri/sağlık ayrıntısını görmez)
--   ekran@demo.test         → Mesai Ekranı (resepsiyon tableti; yalnızca QR kod gösterir)
-- =============================================================================

do $$
declare
  v_password text := 'DemoSifre2026';  -- yalnızca yerel test şifresi
  v_users jsonb := '[
    {"id":"a0000000-0000-4000-8000-000000000001","email":"sahip.hekim@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000002","email":"hekim@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000003","email":"yonetici@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000004","email":"resepsiyon@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000005","email":"asistan@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000006","email":"ekran@demo.test"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(v_users) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid, 'authenticated', 'authenticated',
      u->>'email', extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    values (
      u->>'id', (u->>'id')::uuid,
      jsonb_build_object('sub', u->>'id', 'email', u->>'email', 'email_verified', true),
      'email', now(), now()
    );
  end loop;
end;
$$;

-- Klinik ve koltuklar
insert into public.clinics (id, name) values
  ('c0000000-0000-4000-8000-000000000001', 'Örnek Diş Polikliniği');

insert into public.chairs (id, clinic_id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Koltuk 1'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Koltuk 2'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Koltuk 3');

-- Üyeler ve roller
insert into public.clinic_members (id, clinic_id, user_id, display_name) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Dr. Demo A'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Dr. Demo B'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Demo Yönetici'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000004', 'Demo Resepsiyon'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'Demo Asistan'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'Resepsiyon tableti');

insert into public.member_roles (member_id, clinic_id, role, granted_by) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'sahip',         null),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'hekim',         null),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'hekim',         null),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'yonetici',      null),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'resepsiyonist', null),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'asistan',       null),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'ekran',         null);

-- Hastalar (uygulamadaki demo hastalarla aynı)
insert into public.patients (id, clinic_id, first_name, last_name, phone, email, birth_date, gender, admin_note, created_at) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Demo',  'Hasta 1',     '0500 000 00 01', 'demo1@ornek.test', '1988-04-12', 'kadin',        null,                         '2025-02-03 10:00+03'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Demo',  'Hasta 2',     '0500 000 00 02', null,               '1975-09-30', 'erkek',        null,                         '2024-11-18 14:20+03'),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Demo',  'Hasta 3',     '0500 000 00 03', null,               '2001-01-22', 'kadin',        null,                         '2026-06-11 09:00+03'),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Örnek', 'Kişi',        '0500 000 00 04', null,               '1962-07-05', 'erkek',        null,                         '2023-03-27 16:45+03'),
  ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Test',  'Çocuk',       '0500 000 00 05', null,               '2016-12-01', 'belirtilmedi', 'Veli ile birlikte geliyor.', '2026-01-09 11:30+03'),
  ('e0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Şule',  'Örnekoğlu',   '0500 000 00 06', null,               '1993-03-17', 'kadin',        null,                         '2025-09-14 13:00+03');

-- Sağlık ayrıntıları (yalnızca hekim görür). Alerji işareti tetikleyiciyle güncellenir.
insert into public.patient_medical (patient_id, clinic_id, allergies, conditions, clinical_notes) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '{Penisilin}', '{}', 'Diş hekimi kaygısı var; işlemleri önceden anlatmak iyi geliyor.'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '{}', '{Hipertansiyon,"Kan sulandırıcı kullanıyor"}', null),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '{Lateks}', '{}', null),
  ('e0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '{}', '{"Diyabet (Tip 2)"}', 'İmplant tedavisi planlanıyor.');

-- Tedavi geçmişi
insert into public.treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', '2026-10-26', 'Kontrol muayenesi', null, 'tamamlandi'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', '2026-10-09', 'Diş taşı temizliği', null, 'tamamlandi'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '2026-10-20', 'Kanal tedavisi (1. seans)', '36', 'devam'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', '2026-08-14', 'İmplant değerlendirmesi', '46', 'tamamlandi'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002', '2026-07-01', 'Fissür örtücü', null, 'tamamlandi');

-- Randevular: içinde bulunulan haftaya göre üretilir (takvim boş görünmesin diye).
do $$
declare
  v_clinic uuid := 'c0000000-0000-4000-8000-000000000001';
  v_monday date := date_trunc('week', now() at time zone 'Europe/Istanbul')::date;
  r record;
  v_id uuid;
  v_start timestamptz;
  v_status public.appointment_status;
begin
  for r in
    select * from (values
      -- gün, saat, hasta, hekim üye, koltuk, dk, tür, işlem (yalnızca hekim görür), durum
      (-5, '10:00', 4, 1, 1, 45, 'muayene', 'İmplant değerlendirmesi',     null),
      (-3, '14:30', 6, 2, 2, 30, 'kontrol', 'Ortodonti kontrolü',          'gelmedi'),
      ( 0, '09:30', 1, 1, 1, 30, 'kontrol', 'Kontrol muayenesi',           'onaylandi'),
      ( 0, '10:15', 2, 2, 2, 45, 'tedavi',  'Diş taşı temizliği',          'onaylandi'),
      ( 0, '11:00', 3, 1, 1, 60, 'tedavi',  'Dolgu',                       null),
      ( 0, '14:00', 5, 2, 3, 30, 'kontrol', 'Fissür örtücü kontrolü',      'onaylandi'),
      ( 1, '09:00', 2, 2, 3, 15, 'muayene', 'Panoramik röntgen',           'onaylandi'),
      ( 1, '13:30', 4, 1, 1, 30, 'kontrol', 'İmplant kontrolü',            null),
      ( 2, '10:00', 6, 2, 2, 30, 'kontrol', 'Ortodonti kontrolü',          'onaylandi'),
      ( 2, '15:00', 3, 1, 1, 60, 'tedavi',  'Kanal tedavisi (3. seans)',   'onaylandi'),
      ( 3, '15:30', 1, 1, 2, 45, 'tedavi',  'Dolgu',                       null),
      ( 4, '11:30', 5, 2, 3, 30, 'kontrol', 'Kontrol muayenesi',           'onaylandi'),
      ( 5, '10:00', 4, 1, 1, 90, 'tedavi',  'İmplant cerrahisi',           'onaylandi'),
      ( 9, '09:30', 3, 1, 1, 45, 'tedavi',  'Kron ölçüsü',                 null),
      (10, '16:00', 2, 2, 2, 30, 'kontrol', 'Kontrol muayenesi',           null)
    ) as t(day_offset, start_time, patient_no, doctor_no, chair_no, minutes, visit, procedure, status)
  loop
    v_start := ((v_monday + r.day_offset) + r.start_time::time) at time zone 'Europe/Istanbul';
    v_status := case
      when r.status = 'gelmedi' then 'gelmedi'
      when v_start < now() then 'tamamlandi'
      else coalesce(r.status, 'bekliyor')
    end::public.appointment_status;

    insert into public.appointments (
      clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type, status
    ) values (
      v_clinic,
      ('e0000000-0000-4000-8000-00000000000' || r.patient_no)::uuid,
      ('b0000000-0000-4000-8000-00000000000' || r.doctor_no)::uuid,
      ('d0000000-0000-4000-8000-00000000000' || r.chair_no)::uuid,
      v_start,
      v_start + make_interval(mins => r.minutes),
      r.visit::public.visit_type,
      v_status
    ) returning id into v_id;

    insert into public.appointment_clinical (appointment_id, clinic_id, procedure)
    values (v_id, v_clinic, r.procedure);
  end loop;
end;
$$;

-- Görevler
insert into public.tasks (clinic_id, title, due_date, priority, done_at) values
  ('c0000000-0000-4000-8000-000000000001', 'Yarınki randevular için hatırlatma listesi hazırla', current_date,     'yuksek', null),
  ('c0000000-0000-4000-8000-000000000001', 'Sterilizasyon cihazı haftalık kontrolü',             current_date,     'yuksek', null),
  ('c0000000-0000-4000-8000-000000000001', 'Sarf malzeme siparişini gözden geçir',               current_date + 1, 'normal', null),
  ('c0000000-0000-4000-8000-000000000001', 'Laboratuvara ölçü gönderimi',                         current_date + 3, 'normal', now());

-- Fiyat listesi (SAHTE tutarlar, kuruş cinsinden: 150000 = 1.500,00 TL)
insert into public.price_list_items (id, clinic_id, name, amount, updated_by) values
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Kontrol muayenesi',  50000, null),
  ('f0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Diş taşı temizliği', 150000, null),
  ('f0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Dolgu',              250000, null),
  ('f0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Kanal tedavisi',     600000, null),
  ('f0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Diş çekimi',         200000, null),
  ('f0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Panoramik röntgen',   75000, null),
  ('f0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'İmplant',           2500000, null),
  ('f0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', 'Kron (zirkonyum)',   900000, null);

-- Örnek borç ve tahsilatlar (SAHTE)
insert into public.patient_charges (clinic_id, patient_id, price_item_id, description, tooth, amount, adjust_note, created_by) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000004', 'Kanal tedavisi', '36', 600000, null, null),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000008', 'Kron (zirkonyum)', '36', 800000, 'Kanal tedavisiyle birlikte indirim', null),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'Diş taşı temizliği', null, 150000, null, null);

insert into public.patient_payments (clinic_id, patient_id, amount, method, paid_on, note, received_by) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 300000, 'kredi_karti', current_date - 20, 'Kanal 1. seans', null),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 300000, 'nakit',       current_date - 3,  null, null),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 150000, 'havale',      current_date - 30, null, null);

-- Stok (SAHTE malzemeler). Hareketler sistem kaydı olarak girilir (created_by boş).
-- Eldiven ve maske tek tek sayılmaz: temel birimleri KUTU (kullanım = bir kutu açıldı).
insert into public.stock_items (id, clinic_id, name, category, unit, pack_name, pack_size, min_level, track_lots, supplier, updated_by) values
  ('50000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'Muayene eldiveni (M)', 'sarf',          'kutu',    null,     1,   3, false, 'Demo Medikal', null),
  ('50000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Cerrahi maske',        'sarf',          'kutu',    null,     1,   2, false, 'Demo Medikal', null),
  ('50000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'Artikain anestezik',   'anestezik',     'karpül', 'kutu',   50,  40, true,  'Demo Ecza',    null),
  ('50000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'Kompozit A2',          'dolgu',         'şırınga', null,     1,   5, true,  'Demo Dental',  null),
  ('50000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'İmplant 4.0×10 mm',    'implant',       'adet',    null,     1,   3, true,  'Demo İmplant', null),
  ('50000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Sterilizasyon poşeti', 'sterilizasyon', 'adet',   'paket', 200, 300, false, 'Demo Medikal', null),
  ('50000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000001', 'Elmas frez (yuvarlak)','frez_alet',     'adet',    null,     1,  10, false, 'Demo Dental',  null);

-- Bu hareketler seed sırasında tetikleyiciden geçer (oturum yok → created_by boş kalır)
insert into public.stock_movements (clinic_id, item_id, kind, quantity, lot_no, expiry_date, note) values
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'giris',      5, null, null, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'kullanim',  -3, null, null, null),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'giris',      5, null, null, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'giris',    100, 'ART-2401', current_date + 20,  'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'giris',    100, 'ART-2409', current_date + 400, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'kullanim', -64, 'ART-2401', null, null),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 'giris',      8, 'KMP-77', current_date + 180, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 'kullanim',  -5, 'KMP-77', null, null),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005', 'giris',      6, 'IMP-A10', current_date + 900, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000006', 'giris',    600, null, null, 'Açılış stoğu'),
  ('c0000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000007', 'giris',     25, null, null, 'Açılış stoğu');

-- Planlanan tedaviler (seans kapatma ve diş şeması örneği için)
insert into public.treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', current_date, 'Dolgu',              '37', 'planlandi'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', current_date + 9, 'Kron (zirkonyum)', '36', 'planlandi'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', current_date + 5, 'İmplant cerrahisi', '46', 'planlandi');

-- Hasta notları (SAHTE). Seed'de oturum olmadığı için yazan kişi ve zaman burada verilir.
insert into public.patient_notes (clinic_id, patient_id, kind, body, teeth, important, hidden, template, data, author_member_id, created_at) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik',
   E'Şikâyet: Sol alt bölgede sıcak-soğuk hassasiyeti.\nBulgu: 36 derin çürük, perküsyon (+).\nDeğerlendirme: Geri dönüşümsüz pulpitis.\nPlan/Yapılan: Kanal tedavisine başlandı, geçici dolgu yapıldı.',
   '{36}', true, false, 'muayene', null, 'b0000000-0000-4000-8000-000000000001', now() - interval '21 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik',
   E'36 kanal 2. seans: kanallar genişletildi, kalsiyum hidroksit konuldu. Hassasiyet azaldı.',
   '{36}', false, false, 'kanal', null, 'b0000000-0000-4000-8000-000000000001', now() - interval '7 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'randevu',
   'Teyit için arandı; işten çıkışta gelebileceğini söyledi, öğleden sonra saatlerini tercih ediyor.',
   '{}', false, false, 'randevu_teyit', null, 'b0000000-0000-4000-8000-000000000004', now() - interval '2 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'odeme',
   'Kalan tutarı kron seansında ödeyeceğini belirtti.',
   '{}', false, false, 'borc_bilgi', null, 'b0000000-0000-4000-8000-000000000004', now() - interval '3 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000003', 'klinik',
   'Hasta tedavi sürecinde kaygılı; işlemler adım adım anlatılmalı.',
   '{}', false, true, null, null, 'b0000000-0000-4000-8000-000000000001', now() - interval '20 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'klinik',
   E'İmplant değerlendirmesi: 46 bölgesinde yeterli kemik hacmi var. Panoramik röntgen incelendi.\nDiyabet kontrol altında; cerrahi öncesi kan şekeri değeri istenecek.',
   '{46}', true, false, 'muayene', null, 'b0000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000004', 'klinik',
   'Cerrahi öncesi panoramik ve periapikal çekildi, hekime iletildi.',
   '{46}', false, false, null, null, 'b0000000-0000-4000-8000-000000000005', now() - interval '5 days' + interval '20 minutes'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'randevu',
   'Hatırlatma için SMS yerine telefonla aranmayı tercih ediyor.',
   '{}', false, false, null, null, 'b0000000-0000-4000-8000-000000000004', now() - interval '40 days'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 'klinik',
   'Diş taşı temizliği yapıldı. Kan sulandırıcı kullandığı için kanama kontrolü yapıldı, sorun olmadı.',
   '{}', false, false, null, null, 'b0000000-0000-4000-8000-000000000002', now() - interval '31 days');

-- Ek not örneği (kilitli nota sonradan ekleme)
insert into public.patient_notes (clinic_id, patient_id, kind, body, parent_id, author_member_id, created_at)
select n.clinic_id, n.patient_id, n.kind, 'Ek: Tomografi gerekmedi; periapikal röntgen yeterli bulundu.', n.id,
       'b0000000-0000-4000-8000-000000000001', now() - interval '19 days'
from public.patient_notes n
where n.patient_id = 'e0000000-0000-4000-8000-000000000003' and n.template = 'muayene';

-- Favori cümleler (Dr. Demo A)
insert into public.note_phrases (clinic_id, member_id, text) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Hasta bilgilendirildi, onam alındı.'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'İşlem sonrası öneriler sözlü ve yazılı verildi.'),
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'Lokal anestezi altında çalışıldı, komplikasyon gelişmedi.');

-- Aktivite akışı için "kim yaptı" bilgileri (SAHTE). Seed oturumsuz çalıştığı için elle verilir.
update public.patients set created_by = 'a0000000-0000-4000-8000-000000000004';
update public.appointments
   set created_by = 'a0000000-0000-4000-8000-000000000004',
       created_at = least(created_at, starts_at - interval '3 days');
update public.treatments t
   set created_by = m.user_id,
       created_at = least(t.created_at, (t.performed_on - 7) + time '10:00'),
       completed_by = case when t.status = 'tamamlandi' then m.user_id end
  from public.clinic_members m
 where m.id = t.doctor_member_id;
update public.patient_payments
   set received_by = 'a0000000-0000-4000-8000-000000000004',
       created_at = paid_on + time '11:30';
update public.patient_charges
   set created_by = 'a0000000-0000-4000-8000-000000000004',
       created_at = now() - interval '20 days';
update public.tasks set created_by = 'a0000000-0000-4000-8000-000000000003',
                        created_at = now() - interval '1 day';
update public.stock_movements
   set created_at = case when kind = 'giris' then now() - interval '14 days' else now() - interval '4 days' end,
       created_by = case when kind = 'giris' then 'a0000000-0000-4000-8000-000000000003'::uuid
                         else 'a0000000-0000-4000-8000-000000000005'::uuid end;

-- Mesai (SAHTE): resepsiyon tableti ve son iş günlerinin giriş/çıkışları
insert into public.kiosk_devices (member_id, clinic_id, name, paired_by, last_seen_at) values
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000001', 'Resepsiyon tableti',
   'a0000000-0000-4000-8000-000000000001', now());

do $$
declare
  d date;
  m record;
  v_in timestamptz;
begin
  for d in select g::date from generate_series(current_date - 13, current_date - 1, interval '1 day') g
           where extract(isodow from g) between 1 and 6 loop
    for m in select * from (values
      ('b0000000-0000-4000-8000-000000000001'::uuid, '08:45'::time, '18:10'::time),
      ('b0000000-0000-4000-8000-000000000002'::uuid, '09:05'::time, '18:00'::time),
      ('b0000000-0000-4000-8000-000000000004'::uuid, '08:30'::time, '17:45'::time),
      ('b0000000-0000-4000-8000-000000000005'::uuid, '08:50'::time, '18:20'::time)
    ) as t(member_id, t_in, t_out) loop
      -- Günden güne birkaç dakikalık fark
      v_in := ((d + m.t_in) at time zone 'Europe/Istanbul') + make_interval(mins => (extract(day from d)::int * 7) % 23 - 8);
      insert into public.attendance (clinic_id, member_id, check_in, check_out, in_source, out_source)
      values ('c0000000-0000-4000-8000-000000000001', m.member_id, v_in,
              ((d + m.t_out) at time zone 'Europe/Istanbul') + make_interval(mins => (extract(day from d)::int * 5) % 31 - 10),
              'qr', 'qr');
    end loop;
  end loop;
  -- Dün çıkışı okutulmamış bir kayıt (yönetici "Çıkış eksik" olarak görür)
  update public.attendance set check_out = null, out_source = null
   where member_id = 'b0000000-0000-4000-8000-000000000005'
     and check_in = (select max(check_in) from public.attendance where member_id = 'b0000000-0000-4000-8000-000000000005');
  -- Bugün içeride olanlar (yalnızca mesai saati başladıysa)
  if now() < (current_date + time '08:40') at time zone 'Europe/Istanbul' then
    return;
  end if;
  insert into public.attendance (clinic_id, member_id, check_in, in_source) values
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000004', least(now() - interval '1 hour', (current_date + time '08:34') at time zone 'Europe/Istanbul'), 'qr'),
    ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', least(now() - interval '50 minutes', (current_date + time '08:51') at time zone 'Europe/Istanbul'), 'qr');
end;
$$;

-- Raporlar için (SAHTE): prim oranları, tedaviye bağlı ücretler, bu ay tamamlanan tedaviler
insert into public.doctor_commissions (member_id, clinic_id, rate) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 30),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 25);

-- Mevcut diş taşı ücretini tedavisine bağla
update public.patient_charges c set treatment_id = t.id
  from public.treatments t
 where t.patient_id = c.patient_id and t.procedure = c.description and c.description = 'Diş taşı temizliği';

do $$
declare
  v_t uuid;
  r record;
begin
  for r in select * from (values
    -- hasta, hekim, gün farkı, işlem, diş, tutar (kuruş), fiyat kalemi
    ('e0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 25, 'Kontrol muayenesi', null,  50000, 'f0000000-0000-4000-8000-000000000001'),
    ('e0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002',  6, 'Dolgu',             '46', 250000, 'f0000000-0000-4000-8000-000000000003'),
    ('e0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001',  3, 'Diş çekimi',        '38', 150000, null),
    ('e0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000002',  2, 'Dolgu',             '75', 250000, 'f0000000-0000-4000-8000-000000000003')
  ) as t(patient_id, doctor_id, days_ago, procedure, tooth, amount, price_item)
  loop
    insert into public.treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status)
    values ('c0000000-0000-4000-8000-000000000001', r.patient_id::uuid, r.doctor_id::uuid,
            current_date - r.days_ago, r.procedure, r.tooth, 'tamamlandi')
    returning id into v_t;
    insert into public.patient_charges (clinic_id, patient_id, price_item_id, treatment_id, description, tooth, amount, created_by)
    values ('c0000000-0000-4000-8000-000000000001', r.patient_id::uuid, r.price_item::uuid, v_t,
            r.procedure, r.tooth, r.amount, 'a0000000-0000-4000-8000-000000000004');
  end loop;
end;
$$;

insert into public.patient_payments (clinic_id, patient_id, amount, method, paid_on, received_by) values
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000006', 150000, 'nakit',       current_date - 3, 'a0000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002', 100000, 'kredi_karti', current_date - 6, 'a0000000-0000-4000-8000-000000000004'),
  ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',  50000, 'havale',      current_date - 1, 'a0000000-0000-4000-8000-000000000004');
