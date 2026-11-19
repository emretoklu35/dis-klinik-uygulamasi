-- =============================================================================
-- Mesai takibi: resepsiyondaki tablette değişen QR kod, personel telefonuyla okutur.
--
--   * Tablet bir KİŞİ değil, cihaz hesabıdır (rol: 'ekran'). Yalnızca kod gösterebilir;
--     hasta, randevu, ödeme, not… hiçbir kayda erişemez.
--   * Tablet eşleştirme koduyla kurulur: sahip/yönetici kod üretir (10 dk geçerli), tablet
--     kodu girer; sunucu fonksiyonu (Edge Function) cihaz için hesap açıp onu klinikte
--     "Mesai Ekranı" üyesi yapar. Kayıt olma kapalı kalır.
--     'ekran' rolü elle (rol atama ekranından) verilemez; yalnızca eşleştirmeyle verilir.
--   * Kod her 30 saniyede değişir; klinik başına gizli anahtarla (HMAC) sunucuda üretilir,
--     tabloya yazılmaz. Okutma yalnızca şu anki ve bir önceki 30 sn'lik kodu kabul eder.
--   * Giriş/çıkış kaydını yalnızca check_in() yazar: kayıt OKUTAN kişinin hesabına düşer.
--   * Düzeltmeyi yalnızca yönetici/sahip, sebep yazarak yapar; eski ve yeni saat saklanır.
--   * Personel yalnızca kendi kayıtlarını, yönetici/sahip herkesinkini görür.
-- =============================================================================

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',         array['mesai.kendi', 'mesai.yonet']),
  ('yonetici',      array['mesai.kendi', 'mesai.yonet']),
  ('hekim',         array['mesai.kendi']),
  ('resepsiyonist', array['mesai.kendi']),
  ('asistan',       array['mesai.kendi']),
  -- Tablet: oturum ve klinik adını yüklemek için klinik.oku, kod göstermek için mesai.ekran
  ('ekran',         array['klinik.oku', 'mesai.ekran'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- 'ekran' rolü rol atama ekranından verilemez (bir personel hesabı kod üretemesin)
create or replace function private.can_manage_role(p_clinic uuid, p_role public.clinic_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_role
    when 'sahip' then private.has_permission(p_clinic, 'sahip.ata')
    when 'hekim' then private.has_permission(p_clinic, 'hekim.ata')
    when 'ekran' then false
    else private.has_permission(p_clinic, 'uye.yonet')
  end
$$;

-- Klinik başına gizli anahtar (yalnızca sunucu fonksiyonları okur) ---------------
create table private.clinic_secrets (
  clinic_id  uuid primary key references public.clinics (id) on delete cascade,
  secret     bytea not null default extensions.gen_random_bytes(32)
);
insert into private.clinic_secrets (clinic_id) select id from public.clinics;

create function private.clinic_secret_on_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.clinic_secrets (clinic_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger clinics_secret after insert on public.clinics
  for each row execute function private.clinic_secret_on_insert();

-- 30 saniyelik pencere için 6 haneli kod
create function private.kiosk_code(p_clinic uuid, p_window bigint)
returns text
language sql stable security definer set search_path = ''
as $$
  select lpad(
    (('x' || substr(encode(extensions.hmac(convert_to(p_window::text, 'UTF8'), s.secret, 'sha256'), 'hex'), 1, 7))::bit(28)::int
      % 1000000)::text, 6, '0')
  from private.clinic_secrets s
  where s.clinic_id = p_clinic
$$;

create function private.kiosk_window()
returns bigint
language sql stable set search_path = ''
as $$ select floor(extract(epoch from now()) / 30)::bigint $$;

-- Tabletler ve eşleştirme kodları -------------------------------------------------
create table public.kiosk_devices (
  member_id     uuid primary key,
  clinic_id     uuid not null,
  name          text not null check (length(trim(name)) > 0),
  paired_by     uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  revoked_at    timestamptz,
  foreign key (clinic_id, member_id) references public.clinic_members (clinic_id, id)
);

create table private.device_pairings (
  code        text primary key,
  clinic_id   uuid not null references public.clinics (id),
  name        text not null,
  created_by  uuid references auth.users (id),
  expires_at  timestamptz not null,
  used_at     timestamptz
);

-- Mesai kayıtları ------------------------------------------------------------------
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null,
  member_id   uuid not null,
  check_in    timestamptz not null,
  check_out   timestamptz,
  in_source   text not null check (in_source in ('qr', 'kod', 'duzeltme')),
  out_source  text check (out_source in ('qr', 'kod', 'duzeltme')),
  created_at  timestamptz not null default now(),
  unique (clinic_id, id),
  check (check_out is null or check_out > check_in),
  foreign key (clinic_id, member_id) references public.clinic_members (clinic_id, id)
);
create index attendance_member_idx on public.attendance (member_id, check_in desc);
create index attendance_clinic_idx on public.attendance (clinic_id, check_in desc);

create table public.attendance_changes (
  id             bigint generated always as identity primary key,
  clinic_id      uuid not null,
  attendance_id  uuid not null,
  old_in         timestamptz,
  old_out        timestamptz,
  new_in         timestamptz not null,
  new_out        timestamptz,
  reason         text not null check (length(trim(reason)) > 0),
  changed_by     uuid references auth.users (id),
  changed_at     timestamptz not null default now(),
  foreign key (clinic_id, attendance_id) references public.attendance (clinic_id, id)
);
create index attendance_changes_idx on public.attendance_changes (attendance_id, changed_at desc);

-- Okuma kuralları (yazma yalnızca aşağıdaki fonksiyonlarla)
grant select on public.attendance, public.attendance_changes, public.kiosk_devices to authenticated;
alter table public.attendance         enable row level security;
alter table public.attendance_changes enable row level security;
alter table public.kiosk_devices      enable row level security;

create policy "mesai okuma" on public.attendance for select to authenticated
  using (
    (member_id = private.current_member(clinic_id) and private.has_permission(clinic_id, 'mesai.kendi'))
    or clinic_id in (select private.clinics_with('mesai.yonet'))
  );
create policy "mesai duzeltme gecmisi" on public.attendance_changes for select to authenticated
  using (exists (select 1 from public.attendance a where a.id = attendance_id));
create policy "mesai ekranlari" on public.kiosk_devices for select to authenticated
  using (clinic_id in (select private.clinics_with('mesai.yonet')));

create trigger attendance_audit after insert or update or delete on public.attendance
  for each row execute function private.audit_row();

-- =============================================================================
-- Fonksiyonlar
-- =============================================================================

-- Tablet: şu anki kod (yalnızca Mesai Ekranı rolü)
create function public.kiosk_current_code()
returns table (clinic_name text, code text, qr text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_member public.clinic_members%rowtype;
  v_window bigint := private.kiosk_window();
begin
  select m.* into v_member
    from public.clinic_members m
    join public.kiosk_devices d on d.member_id = m.id and d.revoked_at is null
   where m.user_id = auth.uid() and m.status = 'aktif'
   limit 1;
  if not found or not private.has_permission(v_member.clinic_id, 'mesai.ekran') then
    raise exception 'Bu cihaz mesai ekranı olarak tanımlı değil.' using errcode = '42501';
  end if;
  update public.kiosk_devices set last_seen_at = now() where member_id = v_member.id;
  return query
    select c.name,
           private.kiosk_code(c.id, v_window),
           'DKMESAI:' || c.id::text || ':' || private.kiosk_code(c.id, v_window),
           to_timestamp((v_window + 1) * 30)
      from public.clinics c where c.id = v_member.clinic_id;
end;
$$;

-- Personel: QR'ı okut ya da kodu yaz → giriş veya çıkış
create function public.check_in(p_code text)
returns table (action text, at timestamptz, worked_minutes integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_raw     text := upper(trim(coalesce(p_code, '')));
  v_code    text;
  v_clinic  uuid;
  v_source  text;
  v_member  uuid;
  v_window  bigint := private.kiosk_window();
  v_open    public.attendance%rowtype;
  v_last    timestamptz;
  v_tz      text;
  c         uuid;
begin
  if v_raw like 'DKMESAI:%' then
    v_source := 'qr';
    v_code := split_part(v_raw, ':', 3);
    c := case when split_part(v_raw, ':', 2) ~* '^[0-9a-f-]{36}$'
              then split_part(v_raw, ':', 2)::uuid end;
    if private.has_permission(c, 'mesai.kendi')
       and v_code in (private.kiosk_code(c, v_window), private.kiosk_code(c, v_window - 1)) then
      v_clinic := c;
    end if;
  else
    v_source := 'kod';
    v_code := regexp_replace(v_raw, '\D', '', 'g');
    for c in select private.clinics_with('mesai.kendi') loop
      if v_code in (private.kiosk_code(c, v_window), private.kiosk_code(c, v_window - 1)) then
        v_clinic := c;
        exit;
      end if;
    end loop;
  end if;

  if v_clinic is null then
    raise exception 'Kod geçersiz ya da süresi doldu. Ekrandaki güncel kodu okutun.' using errcode = '23514';
  end if;

  v_member := private.current_member(v_clinic);
  select timezone into v_tz from public.clinics where id = v_clinic;

  -- Aynı anda iki kez okutma (giriş hemen çıkışa dönmesin)
  select greatest(max(a.check_in), max(a.check_out)) into v_last
    from public.attendance a where a.member_id = v_member;
  if v_last is not null and v_last > now() - interval '2 minutes' then
    raise exception 'Az önce kayıt yapıldı. Çıkış için birkaç dakika sonra tekrar okutun.' using errcode = '23514';
  end if;

  -- Bugün açık giriş varsa çıkış; önceki günlerden açık kalan "çıkış eksik" olarak kalır
  select * into v_open from public.attendance a
   where a.member_id = v_member and a.check_out is null
     and (a.check_in at time zone v_tz)::date = (now() at time zone v_tz)::date
   order by a.check_in desc limit 1
   for update;

  if found then
    update public.attendance set check_out = now(), out_source = v_source where id = v_open.id;
    return query select 'cikis'::text, now(),
      (extract(epoch from (now() - v_open.check_in)) / 60)::integer;
  else
    insert into public.attendance (clinic_id, member_id, check_in, in_source)
    values (v_clinic, v_member, now(), v_source);
    return query select 'giris'::text, now(), 0;
  end if;
end;
$$;

-- Yönetici/sahip: kaydı sebep yazarak düzelt
create function public.correct_attendance(p_id uuid, p_in timestamptz, p_out timestamptz, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.attendance%rowtype;
begin
  select * into v_row from public.attendance where id = p_id for update;
  if not found then
    raise exception 'Kayıt bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_row.clinic_id, 'mesai.yonet') then
    raise exception 'Mesai kaydını yalnızca yönetici ya da sahip düzeltebilir.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Düzeltme için sebep yazın.' using errcode = '23514';
  end if;
  if p_out is not null and p_out <= p_in then
    raise exception 'Çıkış saati girişten sonra olmalı.' using errcode = '23514';
  end if;
  if p_in > now() or (p_out is not null and p_out > now()) then
    raise exception 'İleri bir saat girilemez.' using errcode = '23514';
  end if;
  insert into public.attendance_changes (clinic_id, attendance_id, old_in, old_out, new_in, new_out, reason, changed_by)
  values (v_row.clinic_id, v_row.id, v_row.check_in, v_row.check_out, p_in, p_out, trim(p_reason), auth.uid());
  update public.attendance
     set check_in = p_in,
         check_out = p_out,
         in_source = case when p_in is distinct from v_row.check_in then 'duzeltme' else in_source end,
         out_source = case when p_out is distinct from v_row.check_out then 'duzeltme' else out_source end
   where id = p_id;
end;
$$;

-- Yönetici/sahip: hiç okutulmamış bir gün için kayıt ekle (sebep zorunlu)
create function public.add_attendance(p_member uuid, p_in timestamptz, p_out timestamptz, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
  v_id     uuid;
begin
  select clinic_id into v_clinic from public.clinic_members where id = p_member;
  if v_clinic is null or not private.has_permission(v_clinic, 'mesai.yonet') then
    raise exception 'Mesai kaydını yalnızca yönetici ya da sahip ekleyebilir.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Elle eklenen kayıt için sebep yazın.' using errcode = '23514';
  end if;
  if p_out is not null and p_out <= p_in then
    raise exception 'Çıkış saati girişten sonra olmalı.' using errcode = '23514';
  end if;
  if p_in > now() or (p_out is not null and p_out > now()) then
    raise exception 'İleri bir saat girilemez.' using errcode = '23514';
  end if;
  insert into public.attendance (clinic_id, member_id, check_in, check_out, in_source, out_source)
  values (v_clinic, p_member, p_in, p_out, 'duzeltme', case when p_out is not null then 'duzeltme' end)
  returning id into v_id;
  insert into public.attendance_changes (clinic_id, attendance_id, old_in, old_out, new_in, new_out, reason, changed_by)
  values (v_clinic, v_id, null, null, p_in, p_out, trim(p_reason), auth.uid());
  return v_id;
end;
$$;

-- Yönetici/sahip: tablet için eşleştirme kodu üret (10 dk geçerli, tek kullanımlık)
create function public.create_device_pairing(p_clinic uuid, p_name text)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes    bytea := extensions.gen_random_bytes(8);
  v_code     text := '';
  i          int;
begin
  if not private.has_permission(p_clinic, 'mesai.yonet') then
    raise exception 'Mesai ekranını yalnızca yönetici ya da sahip kurabilir.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Ekrana bir ad verin (ör. Resepsiyon tableti).' using errcode = '23514';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  insert into private.device_pairings (code, clinic_id, name, created_by, expires_at)
  values (v_code, p_clinic, trim(p_name), auth.uid(), now() + interval '10 minutes');
  return query select substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4), now() + interval '10 minutes';
end;
$$;

-- Tablet eşleştirme: YALNIZCA sunucu fonksiyonu (Edge Function "pair-device") çağırır.
-- Fonksiyon önce cihaz için bir hesap açar, sonra bu fonksiyonla o hesabı klinikte
-- Mesai Ekranı yapar. Kayıt olma (signup) kapalı kalır; tablete kimsenin şifresi girilmez.
create function public.device_pairing_valid(p_code text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from private.device_pairings
    where code = regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g')
      and used_at is null and expires_at > now())
$$;

create function public.claim_device_pairing(p_code text, p_user uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_code   text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_pair   private.device_pairings%rowtype;
  v_member uuid;
begin
  -- Bir personel hesabı yanlışlıkla tablete dönüşmesin
  if exists (select 1 from public.clinic_members where user_id = p_user) then
    raise exception 'Bu hesap bir personel hesabı; tablete dönüştürülemez.' using errcode = '42501';
  end if;
  select * into v_pair from private.device_pairings
   where code = v_code and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'Eşleştirme kodu geçersiz ya da süresi doldu. Yeni kod alın.' using errcode = '23514';
  end if;
  insert into public.clinic_members (clinic_id, user_id, display_name)
  values (v_pair.clinic_id, p_user, v_pair.name)
  returning id into v_member;
  insert into public.member_roles (member_id, clinic_id, role, granted_by)
  values (v_member, v_pair.clinic_id, 'ekran', v_pair.created_by);
  insert into public.kiosk_devices (member_id, clinic_id, name, paired_by)
  values (v_member, v_pair.clinic_id, v_pair.name, v_pair.created_by);
  update private.device_pairings set used_at = now() where code = v_pair.code;
  return v_pair.clinic_id;
end;
$$;

-- Yönetici/sahip: tableti kaldır (anında çalışmayı bırakır)
create function public.revoke_device(p_member uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_dev public.kiosk_devices%rowtype;
begin
  select * into v_dev from public.kiosk_devices where member_id = p_member for update;
  if not found or not private.has_permission(v_dev.clinic_id, 'mesai.yonet') then
    raise exception 'Mesai ekranını yalnızca yönetici ya da sahip kaldırabilir.' using errcode = '42501';
  end if;
  update public.kiosk_devices set revoked_at = now() where member_id = p_member;
  update public.clinic_members set status = 'pasif' where id = p_member;
end;
$$;

revoke execute on function public.kiosk_current_code(), public.check_in(text),
  public.correct_attendance(uuid, timestamptz, timestamptz, text),
  public.add_attendance(uuid, timestamptz, timestamptz, text),
  public.create_device_pairing(uuid, text), public.revoke_device(uuid),
  public.device_pairing_valid(text), public.claim_device_pairing(text, uuid)
  from public, anon, authenticated;
grant execute on function public.kiosk_current_code(), public.check_in(text),
  public.correct_attendance(uuid, timestamptz, timestamptz, text),
  public.add_attendance(uuid, timestamptz, timestamptz, text),
  public.create_device_pairing(uuid, text), public.revoke_device(uuid)
  to authenticated;
-- Eşleştirme yalnızca sunucu anahtarıyla (Edge Function)
grant execute on function public.device_pairing_valid(text), public.claim_device_pairing(text, uuid)
  to service_role;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.current_member(uuid) to authenticated;
grant execute on function private.can_read_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.can_write_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.valid_teeth(smallint[]) to authenticated;
