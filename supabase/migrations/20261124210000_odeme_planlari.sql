-- =============================================================================
-- Ödeme planları (taksit)
--
--   * Hastanın borcu taksitlere bölünür: her taksitin vadesi ve tutarı vardır.
--   * Taksitin "ödendi" durumu elle işaretlenmez. Hastadan alınan tahsilatlar (patient_payments),
--     planın oluşturulduğu andan sonra alınanlar, sırayla taksitlere dağıtılır; durum buradan
--     hesaplanır: odendi / kismi / gecikti / bekliyor. Tek kayıt, tutarsızlık yok.
--   * Plan silinmez; gerekirse sebebiyle iptal edilir (iptal edilen plan dağıtıma girmez).
--   * Okuma: odeme.oku. Oluşturma ve iptal: odeme.yaz (resepsiyon dahil).
-- =============================================================================

create table public.payment_plans (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null,
  patient_id       uuid not null,
  title            text not null default 'Ödeme planı' check (length(trim(title)) > 0),
  total            integer not null check (total > 0),
  note             text,
  created_by       uuid references auth.users (id) default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id),
  cancel_reason    text,
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index payment_plans_patient_idx on public.payment_plans (clinic_id, patient_id, created_at);

create table public.payment_installments (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null,
  plan_id    uuid not null,
  seq        smallint not null check (seq > 0),
  due_date   date not null,
  amount     integer not null check (amount > 0),
  unique (plan_id, seq),
  foreign key (clinic_id, plan_id) references public.payment_plans (clinic_id, id)
);
create index payment_installments_due_idx on public.payment_installments (clinic_id, due_date);

alter table public.payment_plans enable row level security;
alter table public.payment_installments enable row level security;
grant select on public.payment_plans, public.payment_installments to authenticated;
-- Yazma yalnızca aşağıdaki fonksiyonlarla.
create policy "odeme plani okuma" on public.payment_plans for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));
create policy "taksit okuma" on public.payment_installments for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));

do $$
declare t text;
begin
  foreach t in array array['payment_plans', 'payment_installments'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

-- p_installments: [{"due_date": "2026-12-01", "amount": 1000000}, ...] (kuruş)
create function public.create_payment_plan(p_patient uuid, p_title text, p_note text, p_installments jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
  v_id     uuid;
  v_total  integer;
  v_n      integer;
begin
  select clinic_id into v_clinic from public.patients where id = p_patient;
  if v_clinic is null then
    raise exception 'Hasta bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_clinic, 'odeme.yaz') then
    raise exception 'Ödeme planı oluşturma yetkiniz yok.' using errcode = '42501';
  end if;
  v_n := jsonb_array_length(coalesce(p_installments, '[]'));
  if v_n < 1 or v_n > 60 then
    raise exception 'Taksit sayısı 1 ile 60 arasında olmalı.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(p_installments) e
              where (e ->> 'amount') is null or (e ->> 'amount')::integer <= 0
                 or (e ->> 'due_date') is null) then
    raise exception 'Her taksitin tarihi ve sıfırdan büyük tutarı olmalı.' using errcode = '23514';
  end if;
  select sum((e ->> 'amount')::integer) into v_total from jsonb_array_elements(p_installments) e;

  insert into public.payment_plans (clinic_id, patient_id, title, total, note, created_by_name)
  values (v_clinic, p_patient, coalesce(nullif(trim(p_title), ''), 'Ödeme planı'), v_total,
          nullif(trim(coalesce(p_note, '')), ''), private.member_name(v_clinic))
  returning id into v_id;

  insert into public.payment_installments (clinic_id, plan_id, seq, due_date, amount)
  select v_clinic, v_id, e.ord, (e.value ->> 'due_date')::date, (e.value ->> 'amount')::integer
    from jsonb_array_elements(p_installments) with ordinality as e(value, ord)
   order by (e.value ->> 'due_date')::date, e.ord;
  -- Sıra numarası vade sırasına göre
  update public.payment_installments i set seq = s.rn
    from (select id, row_number() over (order by due_date, seq) + 1000 as rn
            from public.payment_installments where plan_id = v_id) s
   where i.id = s.id;
  update public.payment_installments set seq = seq - 1000 where plan_id = v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_payment_plan(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_payment_plan(uuid, text, text, jsonb) to authenticated;

create function public.cancel_payment_plan(p_plan uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.payment_plans%rowtype;
begin
  select * into v_plan from public.payment_plans where id = p_plan;
  if not found then
    raise exception 'Ödeme planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_plan.clinic_id, 'odeme.yaz') then
    raise exception 'Ödeme planını iptal etme yetkiniz yok.' using errcode = '42501';
  end if;
  if v_plan.cancelled_at is not null then
    raise exception 'Plan zaten iptal edilmiş.' using errcode = '23514';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'İptal için sebep yazın.' using errcode = '23514';
  end if;
  update public.payment_plans
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = p_plan;
end;
$$;
revoke execute on function public.cancel_payment_plan(uuid, text) from public, anon;
grant execute on function public.cancel_payment_plan(uuid, text) to authenticated;

-- Taksit durumu: tahsilatlar (ilk açık planın oluşturulmasından sonra alınanlar) önce eski
-- plana, plan içinde vade sırasıyla taksitlere dağıtılır.
create view public.installment_status with (security_invoker = true) as
with plans as (
  select p.*,
         coalesce(sum(p.total) over (partition by p.patient_id order by p.created_at, p.id
                                     rows between unbounded preceding and 1 preceding), 0) as prev_total,
         min(p.created_at) over (partition by p.patient_id) as since
    from public.payment_plans p
   where p.cancelled_at is null
),
paid as (
  select pl.id as plan_id,
         least(greatest(coalesce((select sum(pp.amount) from public.patient_payments pp
                                   where pp.patient_id = pl.patient_id and pp.cancelled_at is null
                                     and pp.created_at >= pl.since), 0) - pl.prev_total, 0),
               pl.total) as plan_paid
    from plans pl
),
inst as (
  select i.*,
         sum(i.amount) over (partition by i.plan_id order by i.seq) as cum,
         count(*) over (partition by i.plan_id) as n
    from public.payment_installments i
)
select inst.id, inst.clinic_id, pl.patient_id, inst.plan_id, pl.title as plan_title,
       inst.seq, inst.n::int as count, inst.due_date, inst.amount,
       least(greatest(pd.plan_paid - (inst.cum - inst.amount), 0), inst.amount)::int as paid,
       case
         when pd.plan_paid >= inst.cum then 'odendi'
         when inst.due_date < current_date then 'gecikti'
         when pd.plan_paid > inst.cum - inst.amount then 'kismi'
         else 'bekliyor'
       end as status
  from inst
  join plans pl on pl.id = inst.plan_id
  join paid pd on pd.plan_id = inst.plan_id;
grant select on public.installment_status to authenticated;
