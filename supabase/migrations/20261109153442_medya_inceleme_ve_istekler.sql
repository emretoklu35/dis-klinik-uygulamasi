-- =============================================================================
-- Medya iş akışı: asistan çeker/yükler → hekim inceler → gerekirse tekrar çekim ister
--
--   * Asistan (medya.yukle): röntgen/fotoğraf yükler. Yüklenen görüntüleri GÖREMEZ
--     (rontgen.oku yalnızca hekimde), tedaviye bağlayamaz.
--   * Hekim (rontgen.yaz): her görüntüyü inceler: "onaylandı" ya da "tekrar istendi" (sebep zorunlu).
--   * "Tekrar istendi" olunca otomatik bir çekim isteği (media_requests) açılır. İstek, görüntü
--     yolu içermez; asistan (medya.istek.oku) hangi hastada neyin, neden tekrar çekileceğini görür.
--   * Asistan isteğe karşılık yeni görüntü yükleyince istek otomatik kapanır.
-- =============================================================================

create type public.media_review_status as enum ('inceleme_bekliyor', 'onaylandi', 'tekrar_istendi');

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('asistan', array['klinik.oku', 'hasta.temel.oku', 'randevu.oku', 'gorev.oku', 'gorev.yaz',
                    'medya.yukle', 'medya.istek.oku']),
  ('hekim', array['medya.yukle', 'medya.istek.oku'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- Çekim istekleri ------------------------------------------------------------
create table public.media_requests (
  id                       uuid primary key default gen_random_uuid(),
  clinic_id                uuid not null,
  patient_id               uuid not null,
  source_radiograph_id     uuid references public.radiographs (id),
  kind                     public.radiograph_kind not null,
  purpose                  public.radiograph_purpose not null,
  tooth                    text,
  reason                   text not null check (length(trim(reason)) > 0),
  requested_by             uuid references auth.users (id) default auth.uid(),
  requested_at             timestamptz not null default now(),
  fulfilled_radiograph_id  uuid references public.radiographs (id),
  fulfilled_at             timestamptz,
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index media_requests_open_idx on public.media_requests (clinic_id, fulfilled_at, requested_at);

-- Röntgen: inceleme alanları ve hangi isteğe karşılık yüklendiği
alter table public.radiographs
  add column review_status public.media_review_status not null default 'inceleme_bekliyor',
  add column review_note text,
  add column reviewed_by uuid references auth.users (id),
  add column reviewed_at timestamptz,
  add column request_id uuid references public.media_requests (id);
create index radiographs_review_idx on public.radiographs (clinic_id, review_status);

-- Yetkiler -------------------------------------------------------------------
grant insert (request_id) on public.radiographs to authenticated;
grant update (review_status, review_note) on public.radiographs to authenticated;

grant select on public.media_requests to authenticated;
grant insert (clinic_id, patient_id, kind, purpose, tooth, reason) on public.media_requests to authenticated;

-- Yükleme: medya.yukle (asistan + hekim). Tedaviye bağlama yalnızca hekim.
drop policy "rontgen ekleme" on public.radiographs;
create policy "medya yukleme" on public.radiographs for insert to authenticated
  with check (
    clinic_id in (select private.clinics_with('medya.yukle'))
    and (treatment_id is null or clinic_id in (select private.clinics_with('rontgen.yaz')))
  );

drop policy "rontgen dosyasi yukleme" on storage.objects;
create policy "medya dosyasi yukleme" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1] in (select c::text from private.clinics_with('medya.yukle') c)
  );

alter table public.media_requests enable row level security;
create policy "istek okuma" on public.media_requests for select to authenticated
  using (clinic_id in (select private.clinics_with('medya.istek.oku')));
-- Hekim, ortada görüntü olmadan da istek açabilir (ör. "panoramik çekilsin").
create policy "istek acma" on public.media_requests for insert to authenticated
  with check (clinic_id in (select private.clinics_with('rontgen.yaz')));

create trigger media_requests_audit after insert or update or delete on public.media_requests
  for each row execute function private.audit_row();

-- Tetikleyiciler -------------------------------------------------------------

-- İnceleme: kim/ne zaman otomatik yazılır; "tekrar istendi" için sebep zorunlu.
create function private.radiograph_review()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.review_status is distinct from old.review_status then
    if new.review_status = 'tekrar_istendi' and coalesce(trim(new.review_note), '') = '' then
      raise exception 'Tekrar çekim için sebep yazın.' using errcode = '23514';
    end if;
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;
create trigger radiographs_review before update of review_status on public.radiographs
  for each row execute function private.radiograph_review();

-- "Tekrar istendi" → çekim isteği aç
create function private.radiograph_open_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.review_status = 'tekrar_istendi' and old.review_status is distinct from 'tekrar_istendi' then
    insert into public.media_requests (clinic_id, patient_id, source_radiograph_id, kind, purpose, tooth, reason, requested_by)
    values (new.clinic_id, new.patient_id, new.id, new.kind, new.purpose, new.tooth, new.review_note, auth.uid());
  end if;
  return null;
end;
$$;
create trigger radiographs_open_request after update of review_status on public.radiographs
  for each row execute function private.radiograph_open_request();

-- İsteğe karşılık yükleme: istek aynı klinik ve hastaya ait, açık olmalı; yükleme sonrası kapanır.
create function private.radiograph_check_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.request_id is not null and not exists (
    select 1 from public.media_requests r
    where r.id = new.request_id and r.clinic_id = new.clinic_id
      and r.patient_id = new.patient_id and r.fulfilled_at is null
  ) then
    raise exception 'Çekim isteği bu hastaya ait değil ya da zaten kapanmış.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger radiographs_check_request before insert on public.radiographs
  for each row execute function private.radiograph_check_request();

create function private.radiograph_fulfill_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.request_id is not null then
    update public.media_requests
       set fulfilled_radiograph_id = new.id, fulfilled_at = now()
     where id = new.request_id and fulfilled_at is null;
  end if;
  return null;
end;
$$;
create trigger radiographs_fulfill_request after insert on public.radiographs
  for each row execute function private.radiograph_fulfill_request();

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
