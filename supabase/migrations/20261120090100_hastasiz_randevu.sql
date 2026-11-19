-- =============================================================================
-- Hastasız randevu: telefonla yer ayırtıp adını sonra veren kişiler için.
--
--   * appointments.patient_id artık boş olabilir; takvimde "Hastasız randevu" görünür.
--   * Hasta sonradan BİR KEZ bağlanır. Bağlandıktan sonra randevunun hastası
--     değiştirilemez (yanlış kişiye tedavi/ödeme yazılmasın); gerekirse yeni randevu açılır.
--   * Seans kapatma, not ve ödeme hasta ister; hastasız randevuda önce hasta bağlanmalıdır.
-- =============================================================================

alter table public.appointments alter column patient_id drop not null;
grant update (patient_id) on public.appointments to authenticated;

create function private.appointment_patient_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.patient_id is not null and new.patient_id is distinct from old.patient_id then
    raise exception 'Randevunun hastası değiştirilemez; gerekirse yeni randevu oluşturun.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger appointments_patient_change before update of patient_id on public.appointments
  for each row execute function private.appointment_patient_change();

-- Seans kapatmada açık hata mesajı (yoksa tedavi kaydı hasta olmadan reddedilir)
create function private.appointment_requires_patient()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'tamamlandi' and new.patient_id is null then
    raise exception 'Hastasız randevu tamamlanamaz; önce randevuya hasta bağlayın.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger appointments_requires_patient before update of status on public.appointments
  for each row execute function private.appointment_requires_patient();

-- Aktivite akışında hastasız randevular da görünsün
create or replace view public.activity_feed with (security_invoker = true) as
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
       a.patient_id, case when p.id is null then null else p.first_name || ' ' || p.last_name end, a.created_by,
       a.visit_type::text, to_char(a.starts_at at time zone c.timezone, 'YYYY-MM-DD"T"HH24:MI'), null
from public.appointments a
left join public.patients p on p.id = a.patient_id
join public.clinics c on c.id = a.clinic_id

union all
-- Randevu durumu değişti
select 'as-' || a.id, a.clinic_id, a.status_changed_at, 'randevu', 'randevu_durum',
       a.patient_id, case when p.id is null then null else p.first_name || ' ' || p.last_name end, a.status_changed_by,
       a.status::text, to_char(a.starts_at at time zone c.timezone, 'YYYY-MM-DD"T"HH24:MI'), null
from public.appointments a
left join public.patients p on p.id = a.patient_id
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

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.current_member(uuid) to authenticated;
grant execute on function private.can_read_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.can_write_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.valid_teeth(smallint[]) to authenticated;
