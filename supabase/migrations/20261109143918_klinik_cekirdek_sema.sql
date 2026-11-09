-- =============================================================================
-- Diş kliniği: çekirdek şema, roller/yetkiler, RLS ve denetim kaydı
--
-- Temel kararlar (bkz. teknik plan):
--   * Her kliniğe ait tabloda clinic_id vardır; RLS bu sütuna göre çalışır.
--   * Üyelik (clinic_members) ile roller (member_roles) ayrıdır; bir kişinin
--     aynı klinikte birden çok rolü olabilir (ör. sahip + hekim).
--   * Yetkiler rollerden gelir (role_permissions). Sağlık ayrıntısı ve tedavi
--     yetkisi YALNIZCA hekim rolündedir; sahip/yönetici bunu otomatik almaz.
--   * Hekim rolünü yalnızca sahip atayıp geri alabilir.
--   * Resepsiyon yalnızca "alerji kaydı var" işaretini (has_allergy_alert) görür.
--   * Randevuda genel tür herkese, işlem ayrıntısı yalnızca hekime açıktır.
--   * Denetim kaydı hiçbir alanın değerini tutmaz; yalnızca alan adlarını.
--   * Data API'ye hiçbir tablo otomatik açılmaz; yetkiler aşağıda açıkça verilir.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Yardımcı fonksiyonlar dışarıya açık olmayan bu şemada durur.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Tipler
-- -----------------------------------------------------------------------------
create type public.clinic_role as enum ('sahip', 'yonetici', 'hekim', 'resepsiyonist');
create type public.member_status as enum ('aktif', 'pasif');
create type public.gender as enum ('kadin', 'erkek', 'belirtilmedi');
create type public.visit_type as enum ('muayene', 'tedavi', 'kontrol');
create type public.appointment_status as enum ('bekliyor', 'onaylandi', 'tamamlandi', 'gelmedi', 'iptal');
create type public.treatment_status as enum ('planlandi', 'devam', 'tamamlandi');
create type public.task_priority as enum ('yuksek', 'normal');

-- -----------------------------------------------------------------------------
-- Klinik, üyelik, roller, yetkiler
-- -----------------------------------------------------------------------------
create table public.clinics (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  timezone      text not null default 'Europe/Istanbul',
  open_time     time not null default '09:00',
  close_time    time not null default '18:00',
  slot_minutes  smallint not null default 30 check (slot_minutes between 5 and 120),
  -- ISO gün numaraları: 1 = Pazartesi … 7 = Pazar
  working_days  smallint[] not null default '{1,2,3,4,5,6}',
  created_at    timestamptz not null default now(),
  check (close_time > open_time)
);

create table public.clinic_members (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references public.clinics (id),
  user_id       uuid not null references auth.users (id),
  display_name  text not null check (length(trim(display_name)) > 0),
  status        public.member_status not null default 'aktif',
  created_at    timestamptz not null default now(),
  unique (clinic_id, user_id),
  unique (clinic_id, id)
);
create index clinic_members_user_idx on public.clinic_members (user_id, clinic_id);

create table public.member_roles (
  member_id   uuid not null,
  clinic_id   uuid not null,
  role        public.clinic_role not null,
  granted_by  uuid references auth.users (id) default auth.uid(),
  granted_at  timestamptz not null default now(),
  primary key (member_id, role),
  foreign key (clinic_id, member_id) references public.clinic_members (clinic_id, id) on delete cascade
);
create index member_roles_clinic_idx on public.member_roles (clinic_id, role);

-- Rol → yetki eşlemesi. İstemciden değiştirilemez; yalnızca migration ile.
create table public.role_permissions (
  role        public.clinic_role not null,
  permission  text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  -- sahip: yönetim + sahip/hekim atama; sağlık ayrıntısı YOK
  ('sahip', array['klinik.oku','klinik.yonet','uye.yonet','sahip.ata','hekim.ata',
                  'hasta.temel.oku','hasta.temel.yaz','hasta.arsivle',
                  'randevu.oku','randevu.yaz','gorev.oku','gorev.yaz','denetim.oku']),
  -- yönetici: sahip ve hekim rolü atayamaz; sağlık ayrıntısı YOK
  ('yonetici', array['klinik.oku','klinik.yonet','uye.yonet',
                     'hasta.temel.oku','hasta.temel.yaz','hasta.arsivle',
                     'randevu.oku','randevu.yaz','gorev.oku','gorev.yaz','denetim.oku']),
  -- hekim: sağlık ayrıntısı ve tedavi yalnızca burada
  ('hekim', array['klinik.oku','hasta.temel.oku','hasta.temel.yaz',
                  'saglik.detay.oku','saglik.detay.yaz','tedavi.oku','tedavi.yaz',
                  'randevu.oku','randevu.yaz','gorev.oku','gorev.yaz']),
  -- resepsiyonist: iletişim, randevu (genel tür), görev; alerji yalnızca işaret olarak
  ('resepsiyonist', array['klinik.oku','hasta.temel.oku','hasta.temel.yaz',
                          'randevu.oku','randevu.yaz','gorev.oku','gorev.yaz'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- -----------------------------------------------------------------------------
-- Yetki yardımcıları (RLS politikaları bunları çağırır)
-- -----------------------------------------------------------------------------

-- Oturumdaki kullanıcının, verilen yetkiye sahip olduğu klinikler.
create function private.clinics_with(perm text)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select distinct m.clinic_id
  from public.clinic_members m
  join public.member_roles r on r.member_id = m.id
  join public.role_permissions p on p.role = r.role
  where m.user_id = (select auth.uid())
    and m.status = 'aktif'
    and p.permission = perm
$$;

create function private.has_permission(p_clinic uuid, perm text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from private.clinics_with(perm) c where c = p_clinic)
$$;

-- Rol atama/geri alma yetkisi: sahip→sahip.ata, hekim→hekim.ata, diğerleri→uye.yonet
create function private.can_manage_role(p_clinic uuid, p_role public.clinic_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_role
    when 'sahip' then private.has_permission(p_clinic, 'sahip.ata')
    when 'hekim' then private.has_permission(p_clinic, 'hekim.ata')
    else private.has_permission(p_clinic, 'uye.yonet')
  end
$$;

create function private.member_has_role(p_member uuid, p_role public.clinic_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_roles r
    join public.clinic_members m on m.id = r.member_id
    where r.member_id = p_member and r.role = p_role and m.status = 'aktif'
  )
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;

-- -----------------------------------------------------------------------------
-- Klinik verisi
-- -----------------------------------------------------------------------------
create table public.chairs (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references public.clinics (id),
  name       text not null check (length(trim(name)) > 0),
  active     boolean not null default true,
  unique (clinic_id, id),
  unique (clinic_id, name)
);

create table public.patients (
  id                 uuid primary key default gen_random_uuid(),
  clinic_id          uuid not null references public.clinics (id),
  first_name         text not null check (length(trim(first_name)) > 0),
  last_name          text not null check (length(trim(last_name)) > 0),
  phone              text not null,
  email              text,
  birth_date         date,
  gender             public.gender not null default 'belirtilmedi',
  -- İdari not (ör. "veli ile geliyor"). Klinik bilgi patient_medical'da tutulur.
  admin_note         text,
  -- Yalnızca işaret. Ayrıntı patient_medical'da; bu alanı tetikleyici günceller.
  has_allergy_alert  boolean not null default false,
  archived_at        timestamptz,
  created_by         uuid references auth.users (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  unique (clinic_id, id)
);
create index patients_clinic_idx on public.patients (clinic_id, last_name, first_name);

-- Sağlık ayrıntıları: yalnızca hekim yetkisiyle okunur/yazılır.
create table public.patient_medical (
  patient_id      uuid primary key,
  clinic_id       uuid not null,
  allergies       text[] not null default '{}',
  conditions      text[] not null default '{}',
  clinical_notes  text,
  updated_at      timestamptz not null default now(),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index patient_medical_clinic_idx on public.patient_medical (clinic_id);

create table public.treatments (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null,
  patient_id        uuid not null,
  doctor_member_id  uuid not null,
  performed_on      date not null,
  procedure         text not null check (length(trim(procedure)) > 0),
  tooth             text,
  status            public.treatment_status not null default 'planlandi',
  note              text,
  created_at        timestamptz not null default now(),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, doctor_member_id) references public.clinic_members (clinic_id, id)
);
create index treatments_patient_idx on public.treatments (clinic_id, patient_id, performed_on);

create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null,
  patient_id        uuid not null,
  doctor_member_id  uuid not null,
  chair_id          uuid not null,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  -- Herkesin gördüğü genel tür. İşlem ayrıntısı appointment_clinical'da.
  visit_type        public.visit_type not null,
  status            public.appointment_status not null default 'bekliyor',
  -- İdari not (ör. "sabah saatlerini tercih ediyor")
  desk_note         text,
  created_by        uuid references auth.users (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (clinic_id, id),
  check (ends_at > starts_at),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, doctor_member_id) references public.clinic_members (clinic_id, id),
  foreign key (clinic_id, chair_id) references public.chairs (clinic_id, id),
  -- Aynı hekim veya aynı koltuk için iptal edilmemiş randevular çakışamaz.
  constraint appointments_doctor_no_overlap exclude using gist (
    doctor_member_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'iptal'),
  constraint appointments_chair_no_overlap exclude using gist (
    chair_id with =, tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status <> 'iptal')
);
create index appointments_clinic_time_idx on public.appointments (clinic_id, starts_at);
create index appointments_patient_idx on public.appointments (clinic_id, patient_id, starts_at);

-- Randevunun klinik ayrıntısı: yalnızca hekim yetkisiyle.
create table public.appointment_clinical (
  appointment_id  uuid primary key,
  clinic_id       uuid not null,
  procedure       text,
  tooth           text,
  clinical_note   text,
  foreign key (clinic_id, appointment_id) references public.appointments (clinic_id, id)
);
create index appointment_clinical_clinic_idx on public.appointment_clinical (clinic_id);

create table public.tasks (
  id                  uuid primary key default gen_random_uuid(),
  clinic_id           uuid not null references public.clinics (id),
  title               text not null check (length(trim(title)) > 0),
  due_date            date,
  priority            public.task_priority not null default 'normal',
  done_at             timestamptz,
  assignee_member_id  uuid,
  created_by          uuid references auth.users (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  foreign key (clinic_id, assignee_member_id) references public.clinic_members (clinic_id, id)
);
create index tasks_clinic_idx on public.tasks (clinic_id, done_at, due_date);

-- Denetim kaydı: DEĞER YOK, yalnızca alan adları.
create table public.audit_log (
  id              bigint generated always as identity primary key,
  clinic_id       uuid,
  actor_user_id   uuid,
  table_name      text not null,
  record_id       uuid,
  action          text not null check (action in ('insert', 'update', 'delete')),
  changed_fields  text[] not null default '{}',
  at              timestamptz not null default now()
);
create index audit_log_clinic_idx on public.audit_log (clinic_id, at desc);

-- -----------------------------------------------------------------------------
-- Tetikleyiciler: iş kuralları
-- -----------------------------------------------------------------------------

-- Alerji işaretini patient_medical'dan patients'a taşır.
create function private.sync_allergy_alert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.patients p
     set has_allergy_alert = cardinality(new.allergies) > 0
   where p.id = new.patient_id
     and p.has_allergy_alert is distinct from (cardinality(new.allergies) > 0);
  return null;
end;
$$;
create trigger patient_medical_sync_alert
  after insert or update of allergies on public.patient_medical
  for each row execute function private.sync_allergy_alert();

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger patient_medical_touch before update on public.patient_medical
  for each row execute function private.touch_updated_at();

-- Arşivleme yalnızca hasta.arsivle yetkisiyle.
create function private.check_patient_archive()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at
     and auth.uid() is not null
     and not private.has_permission(new.clinic_id, 'hasta.arsivle') then
    raise exception 'Hastayı arşivleme yetkiniz yok.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger patients_check_archive before update on public.patients
  for each row execute function private.check_patient_archive();

-- Randevu ve tedavideki hekim gerçekten (aktif) hekim rolünde olmalı.
create function private.check_doctor_role()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.member_has_role(new.doctor_member_id, 'hekim') then
    raise exception 'Seçilen kişi bu klinikte aktif hekim değil.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger appointments_check_doctor before insert or update of doctor_member_id on public.appointments
  for each row execute function private.check_doctor_role();
create trigger treatments_check_doctor before insert or update of doctor_member_id on public.treatments
  for each row execute function private.check_doctor_role();

-- Klinikte en az bir aktif sahip kalmalı.
create function private.ensure_owner_remains()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  -- Fonksiyon iki tabloda kullanıldığı için alanlara jsonb üzerinden erişilir.
  v_old    jsonb := to_jsonb(old);
  v_new    jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) end;
  v_clinic uuid := (v_old ->> 'clinic_id')::uuid;
  v_member uuid := coalesce(v_old ->> 'member_id', v_old ->> 'id')::uuid;
begin
  if tg_table_name = 'member_roles' and v_old ->> 'role' <> 'sahip' then
    return old;
  end if;
  if tg_table_name = 'clinic_members'
     and not (v_old ->> 'status' = 'aktif' and v_new ->> 'status' = 'pasif'
              and private.member_has_role(v_member, 'sahip')) then
    return new;
  end if;
  if not exists (
    select 1 from public.member_roles r
    join public.clinic_members m on m.id = r.member_id
    where r.clinic_id = v_clinic and r.role = 'sahip' and m.status = 'aktif'
      and r.member_id <> v_member
  ) then
    raise exception 'Klinikte en az bir aktif sahip kalmalı.' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger member_roles_keep_owner before delete on public.member_roles
  for each row execute function private.ensure_owner_remains();
create trigger clinic_members_keep_owner before update of status on public.clinic_members
  for each row execute function private.ensure_owner_remains();

-- Sahibi yalnızca sahip pasifleştirebilir.
create function private.check_member_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status
     and auth.uid() is not null
     and private.member_has_role(old.id, 'sahip')
     and not private.has_permission(old.clinic_id, 'sahip.ata') then
    raise exception 'Sahibin üyeliğini yalnızca sahip değiştirebilir.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger clinic_members_check_status before update of status on public.clinic_members
  for each row execute function private.check_member_status_change();

-- -----------------------------------------------------------------------------
-- Denetim tetikleyicisi: yalnızca aktör, zaman, kayıt kimliği, alan adları
-- -----------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new    jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_old    jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_row    jsonb := coalesce(v_new, v_old);
  v_fields text[];
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_fields
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key)
      and n.key <> 'updated_at';
    if cardinality(v_fields) = 0 then
      return null;
    end if;
  elsif tg_op = 'INSERT' then
    select coalesce(array_agg(n.key order by n.key), '{}') into v_fields
    from jsonb_each(v_new) n
    where n.value <> 'null'::jsonb;
  else
    v_fields := '{}';
  end if;

  insert into public.audit_log (clinic_id, actor_user_id, table_name, record_id, action, changed_fields)
  values (
    coalesce((v_row ->> 'clinic_id')::uuid, case when tg_table_name = 'clinics' then (v_row ->> 'id')::uuid end),
    auth.uid(),
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'patient_id', v_row ->> 'appointment_id', v_row ->> 'member_id')::uuid,
    lower(tg_op),
    v_fields
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['clinics','clinic_members','member_roles','chairs','patients',
                           'patient_medical','treatments','appointments','appointment_clinical','tasks']
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Yetkiler (GRANT): anon hiçbir tabloya erişemez; authenticated yalnızca
-- gereken işlemleri ve sütunları yapabilir. Satırları RLS süzer.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.clinics, public.clinic_members, public.member_roles, public.role_permissions,
               public.chairs, public.patients, public.patient_medical, public.treatments,
               public.appointments, public.appointment_clinical, public.tasks, public.audit_log
  to authenticated;

grant update (name, timezone, open_time, close_time, slot_minutes, working_days) on public.clinics to authenticated;
grant insert (clinic_id, user_id, display_name) on public.clinic_members to authenticated;
grant update (display_name, status) on public.clinic_members to authenticated;
grant insert (member_id, clinic_id, role), delete on public.member_roles to authenticated;
grant insert (clinic_id, name, active), update (name, active) on public.chairs to authenticated;

-- has_allergy_alert ve clinic_id istemciden değiştirilemez.
grant insert (clinic_id, first_name, last_name, phone, email, birth_date, gender, admin_note)
  on public.patients to authenticated;
grant update (first_name, last_name, phone, email, birth_date, gender, admin_note, archived_at)
  on public.patients to authenticated;

grant insert (patient_id, clinic_id, allergies, conditions, clinical_notes),
      update (allergies, conditions, clinical_notes)
  on public.patient_medical to authenticated;

grant insert (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, note),
      update (performed_on, procedure, tooth, status, note)
  on public.treatments to authenticated;

grant insert (clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type, desk_note),
      update (doctor_member_id, chair_id, starts_at, ends_at, visit_type, status, desk_note)
  on public.appointments to authenticated;

grant insert (appointment_id, clinic_id, procedure, tooth, clinical_note),
      update (procedure, tooth, clinical_note)
  on public.appointment_clinical to authenticated;

grant insert (clinic_id, title, due_date, priority, assignee_member_id),
      update (title, due_date, priority, done_at, assignee_member_id), delete
  on public.tasks to authenticated;
-- audit_log: yalnızca okuma (yukarıda). Yazma yalnızca tetikleyiciyle.

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.clinics              enable row level security;
alter table public.clinic_members       enable row level security;
alter table public.member_roles         enable row level security;
alter table public.role_permissions     enable row level security;
alter table public.chairs               enable row level security;
alter table public.patients             enable row level security;
alter table public.patient_medical      enable row level security;
alter table public.treatments           enable row level security;
alter table public.appointments         enable row level security;
alter table public.appointment_clinical enable row level security;
alter table public.tasks                enable row level security;
alter table public.audit_log            enable row level security;

-- Klinik
create policy "uyeler klinigi gorur" on public.clinics for select to authenticated
  using (id in (select private.clinics_with('klinik.oku')));
create policy "yonetim klinigi gunceller" on public.clinics for update to authenticated
  using (id in (select private.clinics_with('klinik.yonet')))
  with check (id in (select private.clinics_with('klinik.yonet')));

-- Üyeler
create policy "uyeler uyeleri gorur" on public.clinic_members for select to authenticated
  using (clinic_id in (select private.clinics_with('klinik.oku')));
create policy "yonetim uye ekler" on public.clinic_members for insert to authenticated
  with check (clinic_id in (select private.clinics_with('uye.yonet')));
create policy "yonetim uye gunceller" on public.clinic_members for update to authenticated
  using (clinic_id in (select private.clinics_with('uye.yonet')))
  with check (clinic_id in (select private.clinics_with('uye.yonet')));

-- Roller: sahip/hekim rolü özel yetki ister (can_manage_role)
create policy "uyeler rolleri gorur" on public.member_roles for select to authenticated
  using (clinic_id in (select private.clinics_with('klinik.oku')));
create policy "yetkili rol atar" on public.member_roles for insert to authenticated
  with check (private.can_manage_role(clinic_id, role));
create policy "yetkili rol geri alir" on public.member_roles for delete to authenticated
  using (private.can_manage_role(clinic_id, role));

create policy "rol tablosu herkese acik" on public.role_permissions for select to authenticated
  using (true);

-- Koltuklar
create policy "uyeler koltuklari gorur" on public.chairs for select to authenticated
  using (clinic_id in (select private.clinics_with('klinik.oku')));
create policy "yonetim koltuk ekler" on public.chairs for insert to authenticated
  with check (clinic_id in (select private.clinics_with('klinik.yonet')));
create policy "yonetim koltuk gunceller" on public.chairs for update to authenticated
  using (clinic_id in (select private.clinics_with('klinik.yonet')))
  with check (clinic_id in (select private.clinics_with('klinik.yonet')));

-- Hastalar (temel bilgi + alerji işareti). Silme politikası bilerek yok.
create policy "hasta temel okuma" on public.patients for select to authenticated
  using (clinic_id in (select private.clinics_with('hasta.temel.oku')));
create policy "hasta temel ekleme" on public.patients for insert to authenticated
  with check (clinic_id in (select private.clinics_with('hasta.temel.yaz')));
create policy "hasta temel guncelleme" on public.patients for update to authenticated
  using (clinic_id in (select private.clinics_with('hasta.temel.yaz')))
  with check (clinic_id in (select private.clinics_with('hasta.temel.yaz')));

-- Sağlık ayrıntıları: yalnızca hekim
create policy "saglik detay okuma" on public.patient_medical for select to authenticated
  using (clinic_id in (select private.clinics_with('saglik.detay.oku')));
create policy "saglik detay ekleme" on public.patient_medical for insert to authenticated
  with check (clinic_id in (select private.clinics_with('saglik.detay.yaz')));
create policy "saglik detay guncelleme" on public.patient_medical for update to authenticated
  using (clinic_id in (select private.clinics_with('saglik.detay.yaz')))
  with check (clinic_id in (select private.clinics_with('saglik.detay.yaz')));

-- Tedaviler: yalnızca hekim
create policy "tedavi okuma" on public.treatments for select to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.oku')));
create policy "tedavi ekleme" on public.treatments for insert to authenticated
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));
create policy "tedavi guncelleme" on public.treatments for update to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.yaz')))
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));

-- Randevular (genel tür). Silme yok; iptal durumu kullanılır.
create policy "randevu okuma" on public.appointments for select to authenticated
  using (clinic_id in (select private.clinics_with('randevu.oku')));
create policy "randevu ekleme" on public.appointments for insert to authenticated
  with check (clinic_id in (select private.clinics_with('randevu.yaz')));
create policy "randevu guncelleme" on public.appointments for update to authenticated
  using (clinic_id in (select private.clinics_with('randevu.yaz')))
  with check (clinic_id in (select private.clinics_with('randevu.yaz')));

-- Randevu klinik ayrıntısı: yalnızca hekim
create policy "randevu klinik okuma" on public.appointment_clinical for select to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.oku')));
create policy "randevu klinik ekleme" on public.appointment_clinical for insert to authenticated
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));
create policy "randevu klinik guncelleme" on public.appointment_clinical for update to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.yaz')))
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));

-- Görevler
create policy "gorev okuma" on public.tasks for select to authenticated
  using (clinic_id in (select private.clinics_with('gorev.oku')));
create policy "gorev ekleme" on public.tasks for insert to authenticated
  with check (clinic_id in (select private.clinics_with('gorev.yaz')));
create policy "gorev guncelleme" on public.tasks for update to authenticated
  using (clinic_id in (select private.clinics_with('gorev.yaz')))
  with check (clinic_id in (select private.clinics_with('gorev.yaz')));
create policy "gorev silme" on public.tasks for delete to authenticated
  using (clinic_id in (select private.clinics_with('gorev.yaz')));

-- Denetim kaydı: yalnızca okuma, yalnızca sahip/yönetici
create policy "denetim okuma" on public.audit_log for select to authenticated
  using (clinic_id in (select private.clinics_with('denetim.oku')));
