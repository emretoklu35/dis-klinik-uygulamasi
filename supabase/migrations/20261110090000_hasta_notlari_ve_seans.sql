-- =============================================================================
-- Hasta notları, seans kapatma, dişe bağlı kayıt ve malzeme izlenebilirliği
--
--   * Not türleri ve görme kuralları:
--       klinik  → hekim + asistan (sağlık verisi; resepsiyon/yönetici/sahip göremez)
--                 "gizli" klinik not → yalnızca hekim
--       odeme   → ödemeleri görenler (odeme.oku)
--       randevu → tüm klinik personeli
--   * "Ne yapıldı" bilgisinin tek yeri tedavilerdir (treatments); not olarak tekrar yazılmaz.
--     Yönetici ve sahip, sağlık ayrıntısı olmadan tedavi ÖZETİNİ görür
--     (treatment_summaries: tarih, işlem, diş, hekim, durum — tedavi notu yok).
--   * Yazan kişi ve zaman veritabanında atanır; istemci değiştiremez.
--   * Not SİLİNMEZ. Yazan kişi 24 saat içinde düzeltebilir; eski metin
--     note_revisions'a yazılır. Sonra not kilitlenir; düzeltme "ek not" ile yapılır.
--   * Diş numaraları FDI sistemindedir (11–48 kalıcı, 51–85 süt dişi).
--   * Seans kapatma (close_visit) tek işlemdir: tedaviler tamamlanır, ücretler hesaba
--     düşer, kullanılan malzeme stoktan (hasta ve randevuyla birlikte) düşülür,
--     seans notu yazılır, takip görevi açılır, randevu "tamamlandı" olur. Bir adım
--     başarısız olursa hiçbiri kaydedilmez. Tüm RLS kuralları geçerlidir (security invoker).
-- =============================================================================

create type public.note_kind as enum ('klinik', 'randevu', 'odeme');

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',         array['not.oku', 'not.yaz', 'tedavi.ozet.oku']),
  ('yonetici',      array['not.oku', 'not.yaz', 'tedavi.ozet.oku']),
  ('resepsiyonist', array['not.oku', 'not.yaz']),
  ('asistan',       array['not.oku', 'not.yaz', 'not.klinik.oku', 'not.klinik.yaz']),
  ('hekim',         array['not.oku', 'not.yaz', 'not.klinik.oku', 'not.klinik.yaz', 'not.gizli', 'seans.kapat'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- Geçerli FDI diş numaraları
create function private.valid_teeth(t smallint[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(
    (x / 10 between 1 and 4 and x % 10 between 1 and 8) or
    (x / 10 between 5 and 8 and x % 10 between 1 and 5)), true)
  from unnest(t) as x
$$;

-- Notlar ---------------------------------------------------------------------------
create table public.patient_notes (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null,
  patient_id        uuid not null,
  kind              public.note_kind not null,
  body              text not null check (length(trim(body)) > 0),
  teeth             smallint[] not null default '{}' check (private.valid_teeth(teeth)),
  important         boolean not null default false,
  hidden            boolean not null default false,
  -- Şablon anahtarı (ör. 'implant', 'seans') ve yapılandırılmış alanlar
  template          text,
  data              jsonb,
  appointment_id    uuid,
  treatment_id      uuid,
  -- Ek not: kilitlenmiş bir nota sonradan yapılan ekleme
  parent_id         uuid,
  author_member_id  uuid not null,
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  edit_count        integer not null default 0,
  unique (clinic_id, id),
  check (not hidden or kind = 'klinik'),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, appointment_id) references public.appointments (clinic_id, id),
  foreign key (clinic_id, treatment_id) references public.treatments (clinic_id, id),
  foreign key (clinic_id, parent_id) references public.patient_notes (clinic_id, id),
  foreign key (clinic_id, author_member_id) references public.clinic_members (clinic_id, id)
);
create index patient_notes_patient_idx on public.patient_notes (clinic_id, patient_id, created_at desc);
create index patient_notes_appointment_idx on public.patient_notes (appointment_id) where appointment_id is not null;
create index patient_notes_parent_idx on public.patient_notes (parent_id) where parent_id is not null;

create table public.note_revisions (
  id          bigint generated always as identity primary key,
  clinic_id   uuid not null,
  note_id     uuid not null,
  old_body    text not null,
  old_teeth   smallint[] not null,
  changed_by  uuid references auth.users (id),
  changed_at  timestamptz not null default now(),
  foreign key (clinic_id, note_id) references public.patient_notes (clinic_id, id)
);
create index note_revisions_note_idx on public.note_revisions (note_id, changed_at desc);

-- Kişisel favori cümleler (yalnızca sahibi görür)
create table public.note_phrases (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null,
  member_id   uuid not null,
  text        text not null check (length(trim(text)) between 1 and 300),
  created_at  timestamptz not null default now(),
  foreign key (clinic_id, member_id) references public.clinic_members (clinic_id, id)
);
create index note_phrases_member_idx on public.note_phrases (member_id, created_at);

-- Stok hareketi hangi hastada / seansta kullanıldı (implant parti izlenebilirliği)
alter table public.stock_movements
  add column patient_id uuid,
  add column appointment_id uuid,
  add foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  add foreign key (clinic_id, appointment_id) references public.appointments (clinic_id, id);
create index stock_movements_patient_idx on public.stock_movements (patient_id) where patient_id is not null;

-- Oturumdaki kullanıcının bu klinikteki üye kimliği
create function private.current_member(p_clinic uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.clinic_members m
  where m.clinic_id = p_clinic and m.user_id = (select auth.uid()) and m.status = 'aktif'
$$;

-- Tetikleyiciler --------------------------------------------------------------------
create function private.note_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_parent public.patient_notes%rowtype;
begin
  new.body := trim(new.body);
  new.teeth := coalesce((select array_agg(distinct x order by x) from unnest(new.teeth) x), '{}');

  -- Ek not: türü, hastası ve gizliliği ana nottan gelir; ek nota ek yapılmaz (köke bağlanır)
  if new.parent_id is not null then
    select * into v_parent from public.patient_notes
     where id = new.parent_id and clinic_id = new.clinic_id;
    if not found then
      raise exception 'Ana not bulunamadı.' using errcode = '23514';
    end if;
    if v_parent.parent_id is not null then
      new.parent_id := v_parent.parent_id;
    end if;
    new.patient_id := v_parent.patient_id;
    new.kind := v_parent.kind;
    new.hidden := v_parent.hidden;
    new.appointment_id := coalesce(new.appointment_id, v_parent.appointment_id);
    new.treatment_id := coalesce(new.treatment_id, v_parent.treatment_id);
  end if;

  if new.appointment_id is not null and not exists (
    select 1 from public.appointments a where a.id = new.appointment_id and a.patient_id = new.patient_id) then
    raise exception 'Randevu bu hastaya ait değil.' using errcode = '23514';
  end if;
  if new.treatment_id is not null and not exists (
    select 1 from public.treatments t where t.id = new.treatment_id and t.patient_id = new.patient_id) then
    raise exception 'Tedavi bu hastaya ait değil.' using errcode = '23514';
  end if;

  -- Yazan kişi her zaman oturumdaki üyedir (yerel seed dışında auth.uid() hep doludur)
  if auth.uid() is not null then
    new.author_member_id := private.current_member(new.clinic_id);
    if new.author_member_id is null then
      raise exception 'Bu klinikte aktif üyeliğiniz yok.' using errcode = '42501';
    end if;
    new.created_at := now();
  end if;
  new.edited_at := null;
  new.edit_count := 0;
  return new;
end;
$$;
create trigger patient_notes_before_insert before insert on public.patient_notes
  for each row execute function private.note_before_insert();

create function private.note_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if old.author_member_id is distinct from private.current_member(old.clinic_id) then
      raise exception 'Notu yalnızca yazan kişi düzeltebilir.' using errcode = '42501';
    end if;
    if old.created_at < now() - interval '24 hours' then
      raise exception 'Not 24 saati geçtiği için kilitlendi; düzeltme için ek not ekleyin.' using errcode = '23514';
    end if;
  end if;

  new.body := trim(new.body);
  new.teeth := coalesce((select array_agg(distinct x order by x) from unnest(new.teeth) x), '{}');
  if new.body is distinct from old.body or new.teeth is distinct from old.teeth then
    insert into public.note_revisions (clinic_id, note_id, old_body, old_teeth, changed_by)
    values (old.clinic_id, old.id, old.body, old.teeth, auth.uid());
    new.edited_at := now();
    new.edit_count := old.edit_count + 1;
  end if;
  return new;
end;
$$;
create trigger patient_notes_before_update before update on public.patient_notes
  for each row execute function private.note_before_update();

create function private.note_phrase_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.text := trim(new.text);
  if auth.uid() is not null then
    new.member_id := private.current_member(new.clinic_id);
    if new.member_id is null then
      raise exception 'Bu klinikte aktif üyeliğiniz yok.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger note_phrases_before_insert before insert on public.note_phrases
  for each row execute function private.note_phrase_before_insert();

create trigger patient_notes_audit after insert or update or delete on public.patient_notes
  for each row execute function private.audit_row();

-- Görme / yazma kuralı (RLS politikaları ve testler aynı ifadeyi kullanır)
create function private.can_read_note(p_clinic uuid, p_kind public.note_kind, p_hidden boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_kind
    when 'klinik' then private.has_permission(p_clinic, 'not.klinik.oku')
                       and (not p_hidden or private.has_permission(p_clinic, 'not.gizli'))
    when 'odeme'  then private.has_permission(p_clinic, 'odeme.oku')
    else private.has_permission(p_clinic, 'not.oku')
  end
$$;

create function private.can_write_note(p_clinic uuid, p_kind public.note_kind, p_hidden boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case p_kind
    when 'klinik' then private.has_permission(p_clinic, 'not.klinik.yaz')
                       and (not p_hidden or private.has_permission(p_clinic, 'not.gizli'))
    when 'odeme'  then private.has_permission(p_clinic, 'odeme.yaz')
    else private.has_permission(p_clinic, 'not.yaz')
  end
$$;

-- Yetkiler ------------------------------------------------------------------------
grant select on public.patient_notes, public.note_revisions, public.note_phrases to authenticated;
grant insert (clinic_id, patient_id, kind, body, teeth, important, hidden, template, data,
              appointment_id, treatment_id, parent_id),
      update (body, teeth, important, data)
  on public.patient_notes to authenticated;
grant insert (clinic_id, text), delete on public.note_phrases to authenticated;
grant insert (patient_id, appointment_id) on public.stock_movements to authenticated;
-- note_revisions: yalnızca okuma; yazma yalnızca tetikleyiciyle. Notlar silinemez.

alter table public.patient_notes  enable row level security;
alter table public.note_revisions enable row level security;
alter table public.note_phrases   enable row level security;

create policy "not okuma" on public.patient_notes for select to authenticated
  using (private.can_read_note(clinic_id, kind, hidden));
create policy "not ekleme" on public.patient_notes for insert to authenticated
  with check (
    private.can_write_note(clinic_id, kind, hidden)
    -- Ek not yalnızca görebildiğiniz bir nota eklenir (alt sorguda notların RLS'i geçerli)
    and (parent_id is null or exists (
      select 1 from public.patient_notes p where p.id = patient_notes.parent_id))
    -- Tedaviye bağlama yalnızca tedavileri görebilenler (hekim)
    and (treatment_id is null or clinic_id in (select private.clinics_with('tedavi.oku')))
  );
-- Yazan kişi ve 24 saat kilidini tetikleyici denetler.
create policy "not duzeltme" on public.patient_notes for update to authenticated
  using (private.can_write_note(clinic_id, kind, hidden))
  with check (private.can_write_note(clinic_id, kind, hidden));

-- Geçmiş, notu görebilen herkese açık (alt sorguda notların RLS'i geçerli)
create policy "not gecmisi okuma" on public.note_revisions for select to authenticated
  using (exists (select 1 from public.patient_notes n where n.id = note_id));

create policy "favori cumle okuma" on public.note_phrases for select to authenticated
  using (member_id = private.current_member(clinic_id));
create policy "favori cumle ekleme" on public.note_phrases for insert to authenticated
  with check (member_id = private.current_member(clinic_id));
create policy "favori cumle silme" on public.note_phrases for delete to authenticated
  using (member_id = private.current_member(clinic_id));

-- =============================================================================
-- Tedavi özeti: yönetici ve sahip "ne yapıldı"yı sağlık ayrıntısı olmadan görür.
-- Tedavi tablosunu okuyamayan roller için kısıtlı sütunlarla güvenli okuma.
-- Tedavi notu (note) ve sağlık bilgisi DÖNMEZ. Hekimler tabloyu zaten doğrudan okur.
-- =============================================================================
create function public.treatment_summaries(p_patient uuid)
returns table (
  id            uuid,
  performed_on  date,
  procedure     text,
  tooth         text,
  status        public.treatment_status,
  doctor_name   text
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.performed_on, t.procedure, t.tooth, t.status, m.display_name
  from public.treatments t
  join public.clinic_members m on m.id = t.doctor_member_id
  where t.patient_id = p_patient
    and (t.clinic_id in (select private.clinics_with('tedavi.ozet.oku'))
         or t.clinic_id in (select private.clinics_with('tedavi.oku')))
  order by t.performed_on, t.created_at
$$;
revoke execute on function public.treatment_summaries(uuid) from public, anon;
grant execute on function public.treatment_summaries(uuid) to authenticated;

-- =============================================================================
-- Seans kapatma
--
-- p (jsonb):
--   done_treatment_ids : [uuid]                         → durum "tamamlandı"
--   new_treatments     : [{procedure, tooth, price_item_id?, amount?}]
--                        → bugün yapılan, planda olmayan tedavi (+ isteğe bağlı ücret)
--   charges            : [{treatment_id, price_item_id, description, tooth, amount}]
--   stock              : [{item_id, quantity (>0, temel birim), lot_no?}]
--   note               : {body, teeth?, important?}
--   follow_up          : {title, task_title?, due_date} | null
-- Dönüş: oluşan seans notunun kimliği
-- =============================================================================
create function public.close_visit(p_appointment uuid, p jsonb)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_appt     public.appointments%rowtype;
  v_day      date;
  v_tid      uuid;
  v_note_id  uuid;
  v_item     jsonb;
  v_teeth    smallint[];
  v_summary  jsonb := '{"treatments": [], "stock": []}'::jsonb;
  v_name     text;
  v_unit     text;
  v_body     text;
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'Randevu bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_appt.clinic_id, 'seans.kapat') then
    raise exception 'Seansı yalnızca hekim kapatabilir.' using errcode = '42501';
  end if;
  if v_appt.status in ('iptal', 'gelmedi') then
    raise exception 'İptal edilmiş ya da gelinmemiş randevunun seansı kapatılamaz.' using errcode = '23514';
  end if;
  if exists (select 1 from public.patient_notes n
             where n.appointment_id = v_appt.id and n.template = 'seans' and n.parent_id is null) then
    raise exception 'Bu seans zaten kapatılmış.' using errcode = '23514';
  end if;

  select (v_appt.starts_at at time zone c.timezone)::date into v_day
    from public.clinics c where c.id = v_appt.clinic_id;

  -- 1) Plandaki tedaviler tamamlandı
  for v_tid in select (jsonb_array_elements_text(coalesce(p -> 'done_treatment_ids', '[]')))::uuid loop
    -- Tamamlanma tarihi seans günüdür
    update public.treatments set status = 'tamamlandi', performed_on = v_day
     where id = v_tid and patient_id = v_appt.patient_id
     returning procedure, tooth into v_name, v_unit;
    if not found then
      raise exception 'Tedavi bulunamadı.' using errcode = '23514';
    end if;
    v_summary := jsonb_set(v_summary, '{treatments}', (v_summary -> 'treatments') ||
                 jsonb_build_object('procedure', v_name, 'tooth', v_unit));
  end loop;

  -- 2) Bugün yapılan yeni tedaviler (+ ücret)
  for v_item in select * from jsonb_array_elements(coalesce(p -> 'new_treatments', '[]')) loop
    insert into public.treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status)
    values (v_appt.clinic_id, v_appt.patient_id, v_appt.doctor_member_id, v_day,
            trim(v_item ->> 'procedure'), nullif(trim(coalesce(v_item ->> 'tooth', '')), ''), 'tamamlandi')
    returning id into v_tid;
    v_summary := jsonb_set(v_summary, '{treatments}', (v_summary -> 'treatments') ||
                 jsonb_build_object('procedure', trim(v_item ->> 'procedure'), 'tooth', v_item ->> 'tooth'));
    if v_item ? 'amount' and (v_item ->> 'amount') is not null then
      insert into public.patient_charges (clinic_id, patient_id, price_item_id, treatment_id, description, tooth, amount)
      values (v_appt.clinic_id, v_appt.patient_id, (v_item ->> 'price_item_id')::uuid, v_tid,
              trim(v_item ->> 'procedure'), nullif(trim(coalesce(v_item ->> 'tooth', '')), ''),
              (v_item ->> 'amount')::integer);
    end if;
  end loop;

  -- 3) Plandaki tedavilerin ücretleri
  for v_item in select * from jsonb_array_elements(coalesce(p -> 'charges', '[]')) loop
    insert into public.patient_charges (clinic_id, patient_id, price_item_id, treatment_id, description, tooth, amount)
    values (v_appt.clinic_id, v_appt.patient_id, (v_item ->> 'price_item_id')::uuid,
            (v_item ->> 'treatment_id')::uuid, trim(v_item ->> 'description'),
            nullif(trim(coalesce(v_item ->> 'tooth', '')), ''), (v_item ->> 'amount')::integer);
  end loop;

  -- 4) Kullanılan malzemeler (hasta ve seansla birlikte)
  for v_item in select * from jsonb_array_elements(coalesce(p -> 'stock', '[]')) loop
    if coalesce((v_item ->> 'quantity')::integer, 0) <= 0 then
      raise exception 'Kullanılan miktar sıfırdan büyük olmalı.' using errcode = '23514';
    end if;
    insert into public.stock_movements (clinic_id, item_id, kind, quantity, lot_no, patient_id, appointment_id)
    values (v_appt.clinic_id, (v_item ->> 'item_id')::uuid, 'kullanim', -(v_item ->> 'quantity')::integer,
            v_item ->> 'lot_no', v_appt.patient_id, v_appt.id);
    select name, unit into v_name, v_unit from public.stock_items where id = (v_item ->> 'item_id')::uuid;
    v_summary := jsonb_set(v_summary, '{stock}', (v_summary -> 'stock') ||
                 jsonb_build_object('name', v_name, 'quantity', (v_item ->> 'quantity')::integer,
                                    'unit', v_unit, 'lot_no', v_item ->> 'lot_no'));
  end loop;

  -- 5) Seans notu (klinik)
  select coalesce(array_agg(x::smallint), '{}') into v_teeth
    from jsonb_array_elements_text(coalesce(p -> 'note' -> 'teeth', '[]')) x;
  v_body := nullif(trim(coalesce(p -> 'note' ->> 'body', '')), '');
  if v_body is null then
    v_body := 'Seans tamamlandı.';
  end if;
  if p -> 'follow_up' is not null and jsonb_typeof(p -> 'follow_up') = 'object' then
    v_summary := v_summary || jsonb_build_object('follow_up', (p -> 'follow_up') - 'task_title');
  end if;
  insert into public.patient_notes (clinic_id, patient_id, kind, body, teeth, important, template, data, appointment_id)
  values (v_appt.clinic_id, v_appt.patient_id, 'klinik', v_body, v_teeth,
          coalesce((p -> 'note' ->> 'important')::boolean, false), 'seans', v_summary, v_appt.id)
  returning id into v_note_id;

  -- 6) Takip görevi
  if p -> 'follow_up' is not null and jsonb_typeof(p -> 'follow_up') = 'object'
     and length(trim(coalesce(p -> 'follow_up' ->> 'title', ''))) > 0 then
    insert into public.tasks (clinic_id, title, due_date, priority)
    -- Görev başlığında hasta adı olabilir (görev listesinde kimin için olduğu görünsün)
    values (v_appt.clinic_id, trim(coalesce(p -> 'follow_up' ->> 'task_title', p -> 'follow_up' ->> 'title')),
            nullif(p -> 'follow_up' ->> 'due_date', '')::date, 'normal');
  end if;

  -- 7) Randevu tamamlandı
  update public.appointments set status = 'tamamlandi' where id = v_appt.id;

  return v_note_id;
end;
$$;

revoke execute on function public.close_visit(uuid, jsonb) from public, anon;
grant execute on function public.close_visit(uuid, jsonb) to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.current_member(uuid) to authenticated;
grant execute on function private.can_read_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.can_write_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.valid_teeth(smallint[]) to authenticated;
