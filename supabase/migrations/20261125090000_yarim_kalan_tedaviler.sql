-- =============================================================================
-- Yarım kalan tedaviler raporu
--
-- Uygulanan (is_active) planlardan en az bir işlemi tamamlanmamış olanlar listelenir:
-- tamamlanma, kazanılan / kalan tutar, son tamamlanan işlem ve hastanın ileri tarihli
-- randevusu (yoksa "kaybolma" riski). Alternatif (uygulanmayan) planlar sayılmaz.
-- Görme: rapor.oku tümünü, rapor.kendi yalnızca planın hekimi olduğu satırları.
-- p_from / p_to: planın oluşturulma tarihi aralığı.
-- =============================================================================

create function public.report_unfinished_plans(p_clinic uuid, p_from date, p_to date)
returns table (
  plan_id uuid, plan_title text, plan_created_at timestamptz, locked boolean,
  patient_id uuid, patient_name text, patient_phone text,
  doctor_member_id uuid, doctor_name text,
  total_items integer, done_items integer, started_items integer,
  total_amount bigint, done_amount bigint,
  kinds public.treatment_kind[],
  last_done_at timestamptz, next_appointment timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_only uuid := private.report_scope(p_clinic, true);
  v_tz   text;
begin
  select timezone into v_tz from public.clinics where id = p_clinic;
  return query
    select pl.id, pl.title, pl.created_at, pl.locked_at is not null,
           p.id, p.first_name || ' ' || p.last_name, p.phone,
           pl.doctor_member_id, m.display_name,
           count(t.id)::int,
           count(t.id) filter (where t.status = 'tamamlandi')::int,
           count(t.id) filter (where t.status = 'devam')::int,
           coalesce(sum(t.amount), 0)::bigint,
           coalesce(sum(t.amount) filter (where t.status = 'tamamlandi'), 0)::bigint,
           array_agg(distinct t.kind),
           max(t.completed_at),
           (select min(a.starts_at) from public.appointments a
             where a.patient_id = p.id and a.starts_at > now()
               and a.status not in ('iptal', 'gelmedi'))
      from public.treatment_plans pl
      join public.patients p on p.id = pl.patient_id
      join public.clinic_members m on m.id = pl.doctor_member_id
      join public.treatments t on t.plan_id = pl.id
     where pl.clinic_id = p_clinic and pl.is_active
       and (pl.created_at at time zone v_tz)::date between p_from and p_to
       and (v_only is null or pl.doctor_member_id = v_only)
     group by pl.id, p.id, m.display_name
    having count(t.id) filter (where t.status <> 'tamamlandi') > 0
     order by max(t.completed_at) asc nulls first, pl.created_at;
end;
$$;
revoke execute on function public.report_unfinished_plans(uuid, date, date) from public, anon;
grant execute on function public.report_unfinished_plans(uuid, date, date) to authenticated;
