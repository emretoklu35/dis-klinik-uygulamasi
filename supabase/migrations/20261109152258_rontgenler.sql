-- =============================================================================
-- Röntgenler: tedavi öncesi / bitim (sonrası) / kontrol / teşhis görüntüleri
--
--   * Görüntü dosyası Storage'daki HERKESE KAPALI "radiographs" klasöründe durur;
--     tabloda yalnızca yolu ve bilgileri tutulur.
--   * Dosya yolu: <klinik_id>/<hasta_id>/<rastgele_id>.<jpg|png>  (adında hasta adı yok)
--   * Röntgen sağlık verisidir: görme/yükleme yalnızca hekim (rontgen.oku / rontgen.yaz).
--   * Röntgen silinmez; yanlışsa "geçersiz" işaretlenir (invalidated_at).
--   * Storage nesneleri veritabanı yedeğine DAHİL DEĞİLDİR (ayrı yedekleme gerekir).
-- =============================================================================

create type public.radiograph_purpose as enum ('tedavi_oncesi', 'tedavi_sonrasi', 'kontrol', 'teshis');
create type public.radiograph_kind as enum ('panoramik', 'periapikal', 'bitewing', 'sefalometrik', 'diger');

insert into public.role_permissions (role, permission) values
  ('hekim', 'rontgen.oku'),
  ('hekim', 'rontgen.yaz');

-- Röntgen bir tedaviye bağlanabilsin diye (klinikler arası bağlantıyı engelleyen bileşik anahtar)
alter table public.treatments add constraint treatments_clinic_id_id_key unique (clinic_id, id);

create table public.radiographs (
  id              uuid primary key default gen_random_uuid(),
  clinic_id       uuid not null,
  patient_id      uuid not null,
  treatment_id    uuid,
  purpose         public.radiograph_purpose not null,
  kind            public.radiograph_kind not null default 'panoramik',
  tooth           text,
  taken_on        date not null default current_date,
  note            text,
  storage_path    text not null unique,
  content_type    text not null check (content_type in ('image/jpeg', 'image/png')),
  invalidated_at  timestamptz,
  uploaded_by     uuid references auth.users (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, treatment_id) references public.treatments (clinic_id, id),
  -- Yol kliniğin ve hastanın klasöründe olmalı (Storage kuralı da klinik klasörüne bakar)
  check (storage_path like clinic_id::text || '/' || patient_id::text || '/%')
);
create index radiographs_patient_idx on public.radiographs (clinic_id, patient_id, taken_on desc);
create index radiographs_treatment_idx on public.radiographs (treatment_id);

create trigger radiographs_audit after insert or update or delete on public.radiographs
  for each row execute function private.audit_row();

alter table public.radiographs enable row level security;

grant select on public.radiographs to authenticated;
grant insert (clinic_id, patient_id, treatment_id, purpose, kind, tooth, taken_on, note, storage_path, content_type)
  on public.radiographs to authenticated;
grant update (treatment_id, purpose, kind, tooth, taken_on, note, invalidated_at)
  on public.radiographs to authenticated;

create policy "rontgen okuma" on public.radiographs for select to authenticated
  using (clinic_id in (select private.clinics_with('rontgen.oku')));
create policy "rontgen ekleme" on public.radiographs for insert to authenticated
  with check (clinic_id in (select private.clinics_with('rontgen.yaz')));
create policy "rontgen guncelleme" on public.radiographs for update to authenticated
  using (clinic_id in (select private.clinics_with('rontgen.yaz')))
  with check (clinic_id in (select private.clinics_with('rontgen.yaz')));

-- -----------------------------------------------------------------------------
-- Storage: herkese kapalı klasör + klinik klasörüne göre erişim
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('radiographs', 'radiographs', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Yolun ilk parçası klinik kimliğidir.
create policy "rontgen dosyasi okuma" on storage.objects for select to authenticated
  using (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1] in (select c::text from private.clinics_with('rontgen.oku') c)
  );

create policy "rontgen dosyasi yukleme" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'radiographs'
    and (storage.foldername(name))[1] in (select c::text from private.clinics_with('rontgen.yaz') c)
  );
-- Güncelleme ve silme politikası bilerek yok: dosyalar değiştirilemez ve silinemez.
