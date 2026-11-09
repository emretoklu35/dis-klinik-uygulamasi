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
-- =============================================================================

do $$
declare
  v_password text := 'DemoSifre2026';  -- yalnızca yerel test şifresi
  v_users jsonb := '[
    {"id":"a0000000-0000-4000-8000-000000000001","email":"sahip.hekim@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000002","email":"hekim@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000003","email":"yonetici@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000004","email":"resepsiyon@demo.test"},
    {"id":"a0000000-0000-4000-8000-000000000005","email":"asistan@demo.test"}
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
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000005', 'Demo Asistan');

insert into public.member_roles (member_id, clinic_id, role, granted_by) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'sahip',         null),
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'hekim',         null),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'hekim',         null),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'yonetici',      null),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'resepsiyonist', null),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'asistan',       null);

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
