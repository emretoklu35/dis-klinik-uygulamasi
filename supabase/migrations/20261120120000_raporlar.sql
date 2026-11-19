-- =============================================================================
-- Raporlar: Gün sonu (kasa), Tamamlanan tedaviler, Doktor primi (hakediş)
--
--   * Görme: sahip ve yönetici tüm raporları (rapor.oku). Hekim yalnızca KENDİ
--     primini ve kendi tamamladığı tedavileri görür (rapor.kendi). Gün sonu (kasa)
--     yalnızca rapor.oku ile. Resepsiyon ve asistan raporları göremez.
--   * Raporlar sağlık ayrıntısı içermez: işlem adı, diş, hekim, hasta adı ve tutarlar.
--     Tedavi notu, alerji vb. hiçbir rapora girmez.
--   * Prim oranını (%) yalnızca sahip girer (prim.yonet). Oran girilmemiş hekim %0.
--   * Prim yöntemleri (tutarlar kuruş):
--       tedavi        : dönemde tamamlanan tedavinin ücreti × oran
--       odeme_tedavi  : dönemde tamamlanan tedavinin, hastanın ödediği kısmı × oran;
--                       ödenmemiş kısmın primi "bekleyen" olarak gösterilir.
--                       Ödenen kısım = ücret × (hastanın toplam ödemesi / toplam borcu), en çok 1
--       nakit         : dönemde alınan ödemeler, hastanın tedaviye bağlı ücretlerindeki
--                       hekim payına göre hekimlere bölünür × oran. Tedaviye bağlı ücreti
--                       olmayan hastanın ödemesi hiçbir hekime yazılmaz.
--   * Fonksiyonlar security definer'dır; her biri yetkiyi kendisi denetler.
-- =============================================================================

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',    array['rapor.oku', 'prim.yonet']),
  ('yonetici', array['rapor.oku']),
  ('hekim',    array['rapor.kendi'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- Prim oranları -------------------------------------------------------------------
create table public.doctor_commissions (
  member_id   uuid primary key,
  clinic_id   uuid not null,
  rate        numeric(5, 2) not null default 0 check (rate between 0 and 100),
  updated_by  uuid references auth.users (id),
  updated_at  timestamptz not null default now(),
  foreign key (clinic_id, member_id) references public.clinic_members (clinic_id, id)
);
grant select on public.doctor_commissions to authenticated;
alter table public.doctor_commissions enable row level security;
create policy "prim orani okuma" on public.doctor_commissions for select to authenticated
  using (clinic_id in (select private.clinics_with('rapor.oku'))
         or member_id = private.current_member(clinic_id));
create trigger doctor_commissions_audit after insert or update or delete on public.doctor_commissions
  for each row execute function private.audit_row();

create function public.set_commission_rate(p_member uuid, p_rate numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from public.clinic_members where id = p_member;
  if v_clinic is null or not private.has_permission(v_clinic, 'prim.yonet') then
    raise exception 'Prim oranını yalnızca klinik sahibi değiştirebilir.' using errcode = '42501';
  end if;
  if not private.member_has_role(p_member, 'hekim') then
    raise exception 'Prim oranı yalnızca hekimlere girilir.' using errcode = '23514';
  end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then
    raise exception 'Prim oranı 0 ile 100 arasında olmalı.' using errcode = '23514';
  end if;
  insert into public.doctor_commissions (member_id, clinic_id, rate, updated_by, updated_at)
  values (p_member, v_clinic, round(p_rate, 2), auth.uid(), now())
  on conflict (member_id) do update
    set rate = excluded.rate, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end;
$$;

-- Yetki kapsamı: tümü mü, yalnızca kendi mi? Yetki yoksa hata.
create function private.report_scope(p_clinic uuid, p_own_allowed boolean)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.has_permission(p_clinic, 'rapor.oku') then
    return null; -- tümü
  end if;
  if p_own_allowed and private.has_permission(p_clinic, 'rapor.kendi') then
    return private.current_member(p_clinic);
  end if;
  raise exception 'Bu raporu görme yetkiniz yok.' using errcode = '42501';
end;
$$;

-- Gün sonu: dönemde alınan ödemeler (iptal edilmeyen) ---------------------------------
create function public.report_payments(p_clinic uuid, p_from date, p_to date)
returns table (
  id uuid, paid_on date, created_at timestamptz, amount integer, method public.payment_method,
  patient_id uuid, patient_name text, received_by_name text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.report_scope(p_clinic, false);
  return query
    select y.id, y.paid_on, y.created_at, y.amount, y.method, y.patient_id,
           p.first_name || ' ' || p.last_name,
           coalesce(m.display_name, 'Sistem (demo verisi)')
    from public.patient_payments y
    join public.patients p on p.id = y.patient_id
    left join public.clinic_members m on m.clinic_id = y.clinic_id and m.user_id = y.received_by
    where y.clinic_id = p_clinic and y.cancelled_at is null
      and y.paid_on between p_from and p_to
    order by y.paid_on desc, y.created_at desc;
end;
$$;

-- Tamamlanan tedaviler ------------------------------------------------------------------
create function public.report_completed_treatments(p_clinic uuid, p_from date, p_to date)
returns table (
  treatment_id uuid, done_on date, completed_at timestamptz, procedure text, tooth text,
  doctor_member_id uuid, doctor_name text, patient_id uuid, patient_name text, amount bigint
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
    select t.id,
           coalesce((t.completed_at at time zone v_tz)::date, t.performed_on) as d,
           t.completed_at, t.procedure, t.tooth, t.doctor_member_id, m.display_name,
           t.patient_id, p.first_name || ' ' || p.last_name,
           coalesce((select sum(c.amount) from public.patient_charges c
                     where c.treatment_id = t.id and c.cancelled_at is null), 0)::bigint
    from public.treatments t
    join public.patients p on p.id = t.patient_id
    join public.clinic_members m on m.id = t.doctor_member_id
    where t.clinic_id = p_clinic and t.status = 'tamamlandi'
      and coalesce((t.completed_at at time zone v_tz)::date, t.performed_on) between p_from and p_to
      and (v_only is null or t.doctor_member_id = v_only)
    order by d desc, t.completed_at desc nulls last;
end;
$$;

-- Doktor primi: kalem kalem (istemci hekim bazında toplar) -----------------------------------
create function public.report_commission_items(p_clinic uuid, p_from date, p_to date, p_basis text)
returns table (
  doctor_member_id uuid, doctor_name text, rate numeric, patient_id uuid, patient_name text,
  label text, tooth text, item_date date, amount bigint, paid_amount bigint,
  prim bigint, prim_pending bigint
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_only uuid := private.report_scope(p_clinic, true);
  v_tz   text;
begin
  if p_basis not in ('tedavi', 'odeme_tedavi', 'nakit') then
    raise exception 'Bilinmeyen prim yöntemi.' using errcode = '23514';
  end if;
  select timezone into v_tz from public.clinics where id = p_clinic;

  if p_basis in ('tedavi', 'odeme_tedavi') then
    return query
      with t as (
        select tr.id, tr.patient_id, tr.doctor_member_id, tr.procedure, tr.tooth,
               coalesce((tr.completed_at at time zone v_tz)::date, tr.performed_on) as d,
               coalesce((select sum(c.amount) from public.patient_charges c
                         where c.treatment_id = tr.id and c.cancelled_at is null), 0)::bigint as amt
        from public.treatments tr
        where tr.clinic_id = p_clinic and tr.status = 'tamamlandi'
          and coalesce((tr.completed_at at time zone v_tz)::date, tr.performed_on) between p_from and p_to
          and (v_only is null or tr.doctor_member_id = v_only)
      ),
      bal as (
        select pt.id as patient_id,
               coalesce((select sum(c.amount) from public.patient_charges c
                         where c.patient_id = pt.id and c.cancelled_at is null), 0)::numeric as charged,
               coalesce((select sum(y.amount) from public.patient_payments y
                         where y.patient_id = pt.id and y.cancelled_at is null), 0)::numeric as paid
        from public.patients pt where pt.clinic_id = p_clinic
      ),
      x as (
        select t.*, m.display_name, coalesce(dc.rate, 0) as r,
               p.first_name || ' ' || p.last_name as pname,
               round(t.amt * least(1, coalesce(b.paid / nullif(b.charged, 0), 0)))::bigint as paid_amt
        from t
        join public.clinic_members m on m.id = t.doctor_member_id
        join public.patients p on p.id = t.patient_id
        left join bal b on b.patient_id = t.patient_id
        left join public.doctor_commissions dc on dc.member_id = t.doctor_member_id
      )
      select x.doctor_member_id, x.display_name, x.r, x.patient_id, x.pname, x.procedure, x.tooth, x.d,
             x.amt, x.paid_amt,
             case when p_basis = 'tedavi' then round(x.amt * x.r / 100)
                  else round(x.paid_amt * x.r / 100) end::bigint,
             case when p_basis = 'tedavi' then 0
                  else round((x.amt - x.paid_amt) * x.r / 100) end::bigint
      from x
      order by x.d desc;
  else
    return query
      with pay as (
        select y.id, y.patient_id, y.amount, y.paid_on, y.method
        from public.patient_payments y
        where y.clinic_id = p_clinic and y.cancelled_at is null and y.paid_on between p_from and p_to
      ),
      share as (
        select c.patient_id, tr.doctor_member_id, sum(c.amount)::numeric as amt
        from public.patient_charges c
        join public.treatments tr on tr.id = c.treatment_id
        where c.clinic_id = p_clinic and c.cancelled_at is null
        group by c.patient_id, tr.doctor_member_id
      ),
      tot as (select s.patient_id, sum(s.amt) as amt from share s group by s.patient_id),
      x as (
        select s.doctor_member_id, pay.patient_id, pay.paid_on, pay.method,
               round(pay.amount * s.amt / nullif(tot.amt, 0))::bigint as alloc
        from pay
        join share s on s.patient_id = pay.patient_id
        join tot on tot.patient_id = pay.patient_id
        where v_only is null or s.doctor_member_id = v_only
      )
      select x.doctor_member_id, m.display_name, coalesce(dc.rate, 0), x.patient_id,
             p.first_name || ' ' || p.last_name,
             'Ödeme'::text, null::text, x.paid_on, x.alloc, x.alloc,
             round(x.alloc * coalesce(dc.rate, 0) / 100)::bigint, 0::bigint
      from x
      join public.clinic_members m on m.id = x.doctor_member_id
      join public.patients p on p.id = x.patient_id
      left join public.doctor_commissions dc on dc.member_id = x.doctor_member_id
      order by x.paid_on desc;
  end if;
end;
$$;

revoke execute on function public.set_commission_rate(uuid, numeric),
  public.report_payments(uuid, date, date),
  public.report_completed_treatments(uuid, date, date),
  public.report_commission_items(uuid, date, date, text) from public, anon;
grant execute on function public.set_commission_rate(uuid, numeric),
  public.report_payments(uuid, date, date),
  public.report_completed_treatments(uuid, date, date),
  public.report_commission_items(uuid, date, date, text) to authenticated;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.current_member(uuid) to authenticated;
grant execute on function private.can_read_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.can_write_note(uuid, public.note_kind, boolean) to authenticated;
grant execute on function private.valid_teeth(smallint[]) to authenticated;
