-- =============================================================================
-- Aktivite akışı: klinikte kim, ne zaman, ne yaptı — tek zaman çizelgesi.
--
--   * Ayrı bir kayıt tablosu YOK. Akış, mevcut kayıtlardan (hasta, randevu, tedavi,
--     görüntü, not, ücret, ödeme, stok, görev) okunan bir görünümdür.
--   * Görünüm security_invoker'dır: her satır, kaynağındaki tablonun RLS kuralına
--     tabidir. Yani herkes akışta yalnızca zaten görmeye yetkili olduğu olayları görür
--     (resepsiyon tedavi ve klinik not olaylarını, asistan ödemeleri göremez vb.).
--   * Eksik "kim yaptı / ne zaman" alanları eklenir: tedavi ekleyen ve tamamlayan,
--     randevu durumunu değiştiren, görevi tamamlayan. Değerleri tetikleyici atar.
-- =============================================================================

-- Tedavi: kim ekledi, kim/ne zaman tamamladı
alter table public.treatments
  add column created_by   uuid references auth.users (id) default auth.uid(),
  add column completed_at timestamptz,
  add column completed_by uuid references auth.users (id);

-- Randevu: durum (onay, iptal, gelmedi, tamamlandı) kim/ne zaman değişti
alter table public.appointments
  add column status_changed_at timestamptz,
  add column status_changed_by uuid references auth.users (id);

-- Görev: kim tamamladı
alter table public.tasks
  add column done_by uuid references auth.users (id);

create function private.treatment_completion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'tamamlandi' and old.status is distinct from 'tamamlandi' then
    new.completed_at := now();
    new.completed_by := auth.uid();
  elsif new.status <> 'tamamlandi' then
    new.completed_at := null;
    new.completed_by := null;
  end if;
  return new;
end;
$$;
create trigger treatments_completion before update of status on public.treatments
  for each row execute function private.treatment_completion();

-- Doğrudan "tamamlandı" olarak eklenen tedavi (ör. seans kapatmada yeni işlem)
create function private.treatment_insert_completion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.created_by := coalesce(auth.uid(), new.created_by);
  if new.status = 'tamamlandi' then
    -- Oturum yoksa (yerel seed) tamamlanma zamanı tedavi günü kabul edilir
    new.completed_at := coalesce(new.completed_at,
      case when auth.uid() is null then (new.performed_on + time '12:00')::timestamptz else now() end);
    new.completed_by := coalesce(auth.uid(), new.completed_by);
  end if;
  return new;
end;
$$;
create trigger treatments_insert_completion before insert on public.treatments
  for each row execute function private.treatment_insert_completion();

create function private.appointment_status_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger appointments_status_change before update of status on public.appointments
  for each row execute function private.appointment_status_change();

create function private.task_done_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.done_at is not null and old.done_at is null then
    new.done_by := auth.uid();
  elsif new.done_at is null then
    new.done_by := null;
  end if;
  return new;
end;
$$;
create trigger tasks_done_change before update of done_at on public.tasks
  for each row execute function private.task_done_change();

-- -----------------------------------------------------------------------------
-- Akış görünümü
--   event   : olay türü (istemci metne çevirir)
--   title   : işlem / malzeme / görev adı ya da not türü
--   detail  : diş, durum, tutar birimi, not önizlemesi vb.
--   amount  : tutar (kuruş) ya da miktar
-- -----------------------------------------------------------------------------
create view public.activity_feed with (security_invoker = true) as
-- Hasta eklendi
select 'p-' || p.id as id, p.clinic_id, p.created_at as occurred_at,
       'hasta'::text as category, 'hasta_eklendi'::text as event,
       p.id as patient_id, p.first_name || ' ' || p.last_name as patient_name,
       p.created_by as actor_user_id,
       null::text as title, null::text as detail, null::integer as amount
from public.patients p

union all
-- Randevu oluşturuldu
select 'a-' || a.id, a.clinic_id, a.created_at, 'randevu', 'randevu_olusturuldu',
       a.patient_id, p.first_name || ' ' || p.last_name, a.created_by,
       a.visit_type::text, to_char(a.starts_at at time zone c.timezone, 'YYYY-MM-DD"T"HH24:MI'), null
from public.appointments a
join public.patients p on p.id = a.patient_id
join public.clinics c on c.id = a.clinic_id

union all
-- Randevu durumu değişti
select 'as-' || a.id, a.clinic_id, a.status_changed_at, 'randevu', 'randevu_durum',
       a.patient_id, p.first_name || ' ' || p.last_name, a.status_changed_by,
       a.status::text, to_char(a.starts_at at time zone c.timezone, 'YYYY-MM-DD"T"HH24:MI'), null
from public.appointments a
join public.patients p on p.id = a.patient_id
join public.clinics c on c.id = a.clinic_id
where a.status_changed_at is not null

union all
-- Tedavi planlandı / eklendi (yalnızca tedavileri görenler)
select 't-' || t.id, t.clinic_id, t.created_at, 'tedavi', 'tedavi_eklendi',
       t.patient_id, p.first_name || ' ' || p.last_name, t.created_by,
       t.procedure, t.tooth, null
from public.treatments t
join public.patients p on p.id = t.patient_id
where t.status <> 'tamamlandi' or t.completed_at is null or t.completed_at > t.created_at + interval '1 minute'

union all
-- Tedavi tamamlandı
select 'tc-' || t.id, t.clinic_id, t.completed_at, 'tedavi', 'tedavi_tamamlandi',
       t.patient_id, p.first_name || ' ' || p.last_name, t.completed_by,
       t.procedure, t.tooth, null
from public.treatments t
join public.patients p on p.id = t.patient_id
where t.completed_at is not null

union all
-- Görüntü yüklendi
select 'r-' || r.id, r.clinic_id, r.created_at, 'gorsel', 'gorsel_yuklendi',
       r.patient_id, p.first_name || ' ' || p.last_name, r.uploaded_by,
       r.kind::text, r.purpose::text, null
from public.radiographs r
join public.patients p on p.id = r.patient_id

union all
-- Görüntü incelendi (onaylandı / tekrar istendi)
select 'rr-' || r.id, r.clinic_id, r.reviewed_at, 'gorsel', 'gorsel_incelendi',
       r.patient_id, p.first_name || ' ' || p.last_name, r.reviewed_by,
       r.kind::text, r.review_status::text, null
from public.radiographs r
join public.patients p on p.id = r.patient_id
where r.reviewed_at is not null

union all
-- Not yazıldı (not türüne göre RLS: klinik notu yalnızca hekim/asistan görür)
select 'n-' || n.id, n.clinic_id, n.created_at, 'not',
       case when n.parent_id is not null then 'ek_not'
            when n.template = 'seans' then 'seans_kapatildi'
            else 'not_yazildi' end,
       n.patient_id, p.first_name || ' ' || p.last_name, m.user_id,
       n.kind::text, left(n.body, 160), null
from public.patient_notes n
join public.patients p on p.id = n.patient_id
join public.clinic_members m on m.id = n.author_member_id

union all
-- Ücret eklendi
select 'c-' || ch.id, ch.clinic_id, ch.created_at, 'odeme', 'ucret_eklendi',
       ch.patient_id, p.first_name || ' ' || p.last_name, ch.created_by,
       ch.description, ch.tooth, ch.amount
from public.patient_charges ch
join public.patients p on p.id = ch.patient_id

union all
-- Ödeme alındı
select 'y-' || y.id, y.clinic_id, y.created_at, 'odeme', 'odeme_alindi',
       y.patient_id, p.first_name || ' ' || p.last_name, y.received_by,
       y.method::text, null, y.amount
from public.patient_payments y
join public.patients p on p.id = y.patient_id

union all
-- Stok hareketi (kullanım hastaya bağlıysa hasta adıyla)
select 's-' || s.id, s.clinic_id, s.created_at, 'stok', 'stok_' || s.kind::text,
       s.patient_id, case when p.id is null then null else p.first_name || ' ' || p.last_name end,
       s.created_by, i.name, i.unit, s.quantity
from public.stock_movements s
join public.stock_items i on i.id = s.item_id
left join public.patients p on p.id = s.patient_id

union all
-- Görev oluşturuldu
select 'g-' || g.id, g.clinic_id, g.created_at, 'gorev', 'gorev_olusturuldu',
       null, null, g.created_by, g.title, null, null
from public.tasks g

union all
-- Görev tamamlandı
select 'gd-' || g.id, g.clinic_id, g.done_at, 'gorev', 'gorev_tamamlandi',
       null, null, g.done_by, g.title, null, null
from public.tasks g
where g.done_at is not null;

grant select on public.activity_feed to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.current_member(uuid) to authenticated;
grant execute on function private.can_read_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.can_write_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.valid_teeth(smallint[]) to authenticated;
