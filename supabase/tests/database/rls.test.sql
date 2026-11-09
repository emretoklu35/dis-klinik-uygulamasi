-- =============================================================================
-- RLS ve iş kuralı testleri (pgTAP). Çalıştırma: npm run db:test
-- Seed'deki sahte kullanıcılarla, her rolün ne görüp ne göremeyeceğini dener.
-- Her şey tek işlem (transaction) içinde çalışır ve sonda geri alınır.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(39);

-- Kısaltmalar ------------------------------------------------------------------
-- Kullanıcılar: a..1 sahip+hekim, a..2 hekim, a..3 yönetici, a..4 resepsiyon
-- Üyeler:       b..1            b..2       b..3          b..4
-- Klinik c..1, hasta e..1 (Penisilin alerjisi), e..2 (alerji yok)

-- Başka bir klinik (izolasyon testi için)
insert into auth.users (id, email) values ('a0000000-0000-4000-8000-000000000009', 'baska@demo.test');
insert into public.clinics (id, name) values ('c0000000-0000-4000-8000-000000000009', 'Başka Klinik');
insert into public.clinic_members (id, clinic_id, user_id, display_name)
  values ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', 'Başka Hekim');
insert into public.member_roles (member_id, clinic_id, role) values
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'sahip'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009', 'hekim');
insert into public.patients (clinic_id, first_name, last_name, phone)
  values ('c0000000-0000-4000-8000-000000000009', 'Başka', 'Hasta', '0500 000 00 99');

-- ============================ RESEPSİYON =====================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select results_eq('select count(*)::int from patients', array[6],
  'Resepsiyon kendi kliniğinin 6 hastasını görür');
select is((select has_allergy_alert from patients where id = 'e0000000-0000-4000-8000-000000000001'), true,
  'Resepsiyon alerji işaretini görür');
select is_empty('select * from patient_medical',
  'Resepsiyon sağlık ayrıntılarını (alerji adı vb.) göremez');
select is_empty('select * from appointment_clinical',
  'Resepsiyon randevunun işlem ayrıntısını göremez');
select is_empty('select * from treatments',
  'Resepsiyon tedavi kayıtlarını göremez');
select isnt_empty('select visit_type, starts_at, ends_at from appointments',
  'Resepsiyon randevuların genel türünü ve süresini görür');
select throws_ok(
  $$update patients set has_allergy_alert = false where id = 'e0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'Alerji işareti istemciden değiştirilemez');
select throws_ok(
  $$update patients set archived_at = now() where id = 'e0000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'Resepsiyon hasta arşivleyemez');
select lives_ok(
  $$update patients set phone = '0500 000 00 22' where id = 'e0000000-0000-4000-8000-000000000002'$$,
  'Resepsiyon hasta iletişim bilgisini güncelleyebilir');
select throws_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'hekim')$$,
  '42501', null, 'Resepsiyon rol atayamaz');
select is_empty('select * from audit_log', 'Resepsiyon denetim kaydını göremez');
select throws_ok(
  $$insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
            'b0000000-0000-4000-8000-000000000002', current_date, 'Dolgu')$$,
  '42501', null, 'Resepsiyon tedavi kaydı ekleyemez');
select throws_ok(
  $$insert into patient_medical (patient_id, clinic_id, allergies)
    values ('e0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '{Aspirin}')$$,
  '42501', null, 'Resepsiyon sağlık bilgisi giremez');

-- ============================ YÖNETİCİ =======================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is_empty('select * from patient_medical',
  'Yönetici sağlık ayrıntılarını otomatik göremez');
select throws_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'hekim')$$,
  '42501', null, 'Yönetici hekim rolü atayamaz');
select throws_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'sahip')$$,
  '42501', null, 'Yönetici sahip rolü atayamaz');
select lives_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'yonetici')$$,
  'Yönetici yönetici rolü atayabilir');
select isnt_empty('select * from audit_log', 'Yönetici denetim kaydını görür');
select results_eq(
  $$with u as (update patient_medical set allergies = '{}' returning 1) select count(*)::int from u$$,
  array[0], 'Yönetici sağlık bilgisini değiştiremez (hiçbir satır etkilenmez)');

-- ============================ HEKİM ==========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select results_eq('select count(*)::int from patient_medical', array[4],
  'Hekim sağlık ayrıntılarını görür');
select isnt_empty('select procedure from appointment_clinical',
  'Hekim randevunun işlem ayrıntısını görür');
select lives_ok(
  $$update patient_medical set allergies = '{}' where patient_id = 'e0000000-0000-4000-8000-000000000001'$$,
  'Hekim alerji bilgisini güncelleyebilir');
select is((select has_allergy_alert from patients where id = 'e0000000-0000-4000-8000-000000000001'), false,
  'Alerji silinince işaret tetikleyiciyle kalkar');
select lives_ok(
  $$insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
            'b0000000-0000-4000-8000-000000000002', current_date, 'Dolgu', '26', 'tamamlandi')$$,
  'Hekim tedavi kaydı ekleyebilir');
select throws_ok(
  $$insert into appointments (clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type)
    select clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type
    from appointments where doctor_member_id = 'b0000000-0000-4000-8000-000000000002' and status <> 'iptal' limit 1$$,
  '23P01', null, 'Aynı hekime çakışan randevu verilemez (veritabanı kısıtı)');
select throws_ok(
  $$insert into appointments (clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
            'b0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000003',
            now() + interval '30 days', now() + interval '30 days 30 minutes', 'kontrol')$$,
  '23514', null, 'Hekim olmayan üyeye randevu atanamaz');
select throws_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'hekim')$$,
  '42501', null, 'Hekim, hekim rolü atayamaz');

-- ============================ SAHİP + HEKİM ==================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select results_eq('select count(*)::int from patient_medical', array[4],
  'Sahip+hekim, hekim rolü sayesinde sağlık ayrıntılarını görür');
select lives_ok(
  $$insert into member_roles (member_id, clinic_id, role) values
    ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', 'hekim')$$,
  'Sahip hekim rolü atayabilir');
select lives_ok(
  $$delete from member_roles where member_id = 'b0000000-0000-4000-8000-000000000003' and role = 'hekim'$$,
  'Sahip hekim rolünü geri alabilir');
select lives_ok(
  $$delete from member_roles where member_id = 'b0000000-0000-4000-8000-000000000001' and role = 'hekim'$$,
  'Sahip kendi hekim rolünü bırakabilir');
select is_empty('select * from patient_medical',
  'Hekim rolü kalkınca sağlık ayrıntısı hemen görünmez olur');
select isnt_empty('select * from audit_log',
  'Sahiplik yetkisi kalır (denetim kaydını hâlâ görür)');
select throws_ok(
  $$delete from member_roles where member_id = 'b0000000-0000-4000-8000-000000000001' and role = 'sahip'$$,
  '23514', null, 'Son sahip kendi sahipliğini bırakamaz');

-- ============================ BAŞKA KLİNİK ===================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000009","role":"authenticated"}';

select results_eq(
  $$select count(*)::int from patients where clinic_id = 'c0000000-0000-4000-8000-000000000001'$$,
  array[0], 'Başka kliniğin kullanıcısı bu kliniğin hastalarını göremez');
select throws_ok(
  $$insert into patients (clinic_id, first_name, last_name, phone)
    values ('c0000000-0000-4000-8000-000000000001', 'Sızma', 'Denemesi', '0500 000 00 98')$$,
  '42501', null, 'Başka kliniğin kullanıcısı bu kliniğe hasta ekleyemez');

-- ============================ PASİF ÜYE ve ANON ==============================
reset role;
update public.clinic_members set status = 'pasif' where id = 'b0000000-0000-4000-8000-000000000004';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';
select is_empty('select * from patients', 'Pasif üye hiçbir hastayı göremez');

reset role;
set local role anon;
select throws_ok('select * from patients', '42501', null, 'Giriş yapmamış kullanıcı tabloya erişemez');

-- ============================ DENETİM KAYDI ==================================
reset role;
select is(
  (select array[actor_user_id::text] || changed_fields from audit_log
    where table_name = 'patients' and action = 'update'
      and record_id = 'e0000000-0000-4000-8000-000000000002'
    order by id desc limit 1),
  array['a0000000-0000-4000-8000-000000000004', 'phone'],
  'Denetim kaydı aktörü ve yalnızca değişen alan adını tutar');

select * from finish();
rollback;
