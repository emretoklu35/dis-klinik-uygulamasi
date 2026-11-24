-- =============================================================================
-- Tedavi maliyetleri ve kârlılık
--
--   * Laboratuvar giderleri: plandaki işleme bağlı; TL, USD ya da EUR girilir. Döviz ise
--     girildiği günün kuru (elle) kaydedilir; TL karşılığı sabitlenir. Gider silinmez,
--     sebebiyle iptal edilir.
--   * Malzeme: seansta stoktan düşülen malzeme o seansta yapılan tedaviye bağlanır;
--     maliyet stok girişlerindeki ağırlıklı ortalama alış fiyatından hesaplanır.
--   * Kârlılık: gelir (indirimli fiyat) − laboratuvar − malzeme − hekim primi (tedavi bazlı
--     oran) = brüt kâr.
--   * Yetkiler: kârlılığı yalnızca "maliyet.oku" görür (sahip, yönetici). Gider girme
--     "maliyet.yaz" (sahip, yönetici, hekim, asistan, resepsiyon); girenler kâr rakamını görmez.
-- =============================================================================

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',         array['maliyet.oku', 'maliyet.yaz']),
  ('yonetici',      array['maliyet.oku', 'maliyet.yaz']),
  ('hekim',         array['maliyet.yaz']),
  ('asistan',       array['maliyet.yaz']),
  ('resepsiyonist', array['maliyet.yaz'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission)
on conflict do nothing;

-- Laboratuvarlar (bir kez girilir, sonra listeden seçilir)
create table public.labs (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  name        text not null check (length(trim(name)) > 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (clinic_id, id),
  unique (clinic_id, name)
);
alter table public.labs enable row level security;
grant select on public.labs to authenticated;
create policy "laboratuvar okuma" on public.labs for select to authenticated
  using (clinic_id in (select private.clinics_with('maliyet.yaz'))
         or clinic_id in (select private.clinics_with('maliyet.oku')));

create table public.treatment_expenses (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null,
  treatment_id     uuid not null,
  lab_id           uuid,
  description      text,
  currency         text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  amount_original  integer not null check (amount_original > 0),   -- kuruş / cent
  rate             numeric(12, 4) not null check (rate > 0),        -- 1 birim = rate TL
  amount           integer not null check (amount > 0),             -- TL karşılığı, kuruş
  created_by       uuid references auth.users (id) default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id),
  cancel_reason    text,
  foreign key (clinic_id, treatment_id) references public.treatments (clinic_id, id),
  foreign key (clinic_id, lab_id) references public.labs (clinic_id, id)
);
create index treatment_expenses_treatment_idx on public.treatment_expenses (treatment_id);
alter table public.treatment_expenses enable row level security;
grant select on public.treatment_expenses to authenticated;
create policy "tedavi gideri okuma" on public.treatment_expenses for select to authenticated
  using (clinic_id in (select private.clinics_with('maliyet.yaz'))
         or clinic_id in (select private.clinics_with('maliyet.oku')));
create trigger treatment_expenses_audit after insert or update or delete on public.treatment_expenses
  for each row execute function private.audit_row();

create function public.add_treatment_expense(
  p_treatment uuid, p_lab uuid, p_lab_name text, p_description text,
  p_currency text, p_amount_original integer, p_rate numeric)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
  v_lab    uuid := p_lab;
  v_rate   numeric := case when p_currency = 'TRY' then 1 else p_rate end;
  v_id     uuid;
begin
  select clinic_id into v_clinic from public.treatments where id = p_treatment;
  if v_clinic is null then
    raise exception 'Tedavi bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_clinic, 'maliyet.yaz') then
    raise exception 'Gider girme yetkiniz yok.' using errcode = '42501';
  end if;
  if p_currency not in ('TRY', 'USD', 'EUR') then
    raise exception 'Para birimi TL, USD ya da EUR olmalı.' using errcode = '23514';
  end if;
  if coalesce(p_amount_original, 0) <= 0 then
    raise exception 'Sıfırdan büyük bir tutar girin.' using errcode = '23514';
  end if;
  if v_rate is null or v_rate <= 0 then
    raise exception 'Döviz için girildiği günün kurunu yazın.' using errcode = '23514';
  end if;
  -- Yeni laboratuvar adı yazıldıysa listeye eklenir (varsa olan kullanılır)
  if v_lab is null and length(trim(coalesce(p_lab_name, ''))) > 0 then
    insert into public.labs (clinic_id, name) values (v_clinic, trim(p_lab_name))
    on conflict (clinic_id, name) do update set active = true
    returning id into v_lab;
  end if;
  insert into public.treatment_expenses
    (clinic_id, treatment_id, lab_id, description, currency, amount_original, rate, amount, created_by_name)
  values
    (v_clinic, p_treatment, v_lab, nullif(trim(coalesce(p_description, '')), ''), p_currency,
     p_amount_original, v_rate, round(p_amount_original * v_rate), private.member_name(v_clinic))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.add_treatment_expense(uuid, uuid, text, text, text, integer, numeric) from public, anon;
grant execute on function public.add_treatment_expense(uuid, uuid, text, text, text, integer, numeric) to authenticated;

create function public.cancel_treatment_expense(p_expense uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from public.treatment_expenses where id = p_expense and cancelled_at is null;
  if v_clinic is null then
    raise exception 'Gider bulunamadı ya da zaten iptal edilmiş.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_clinic, 'maliyet.yaz') then
    raise exception 'Gider iptal etme yetkiniz yok.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'İptal için sebep yazın.' using errcode = '23514';
  end if;
  update public.treatment_expenses
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = p_expense;
end;
$$;
revoke execute on function public.cancel_treatment_expense(uuid, text) from public, anon;
grant execute on function public.cancel_treatment_expense(uuid, text) to authenticated;

-- Seansta kullanılan malzemeyi tedaviye bağlama ------------------------------------------
alter table public.stock_movements
  add column treatment_id uuid,
  add foreign key (clinic_id, treatment_id) references public.treatments (clinic_id, id);
create index stock_movements_treatment_idx on public.stock_movements (treatment_id) where treatment_id is not null;

-- p_links: [{"item_id": ..., "treatment_id": ...}] — o seansın kullanım hareketleri bağlanır
create function public.link_visit_materials(p_appointment uuid, p_links jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_appt public.appointments%rowtype;
  v_link jsonb;
begin
  select * into v_appt from public.appointments where id = p_appointment;
  if not found then
    raise exception 'Randevu bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_appt.clinic_id, 'seans.kapat') then
    raise exception 'Malzemeyi yalnızca seansı kapatan hekim bağlar.' using errcode = '42501';
  end if;
  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]')) loop
    if not exists (select 1 from public.treatments t
                    where t.id = (v_link ->> 'treatment_id')::uuid and t.patient_id = v_appt.patient_id) then
      raise exception 'Tedavi bu hastaya ait değil.' using errcode = '23514';
    end if;
    update public.stock_movements
       set treatment_id = (v_link ->> 'treatment_id')::uuid
     where appointment_id = p_appointment and kind = 'kullanim'
       and item_id = (v_link ->> 'item_id')::uuid;
  end loop;
end;
$$;
revoke execute on function public.link_visit_materials(uuid, jsonb) from public, anon;
grant execute on function public.link_visit_materials(uuid, jsonb) to authenticated;

-- Malzemenin ağırlıklı ortalama alış maliyeti (kuruş, temel birim başına)
create function private.item_avg_cost(p_item uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case when sum(m.quantity) > 0 then sum(m.quantity * c.unit_cost)::numeric / sum(m.quantity) end
    from public.stock_movements m
    join public.stock_costs c on c.movement_id = m.id
   where m.item_id = p_item and m.quantity > 0
$$;

-- Kârlılık: planın işlem bazında gelir ve maliyetleri ---------------------------------------
create function public.plan_profitability(p_plan uuid)
returns table (
  treatment_id uuid, procedure text, tooth text, status public.treatment_status,
  revenue bigint, lab bigint, material bigint, commission bigint, commission_rate numeric,
  profit bigint, material_unpriced boolean
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from public.treatment_plans where id = p_plan;
  if v_clinic is null then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_clinic, 'maliyet.oku') then
    raise exception 'Kârlılığı görme yetkiniz yok.' using errcode = '42501';
  end if;
  return query
    with base as (
      select t.id, t.procedure, t.tooth, t.status, t.performed_on, t.created_at,
             coalesce(t.amount, 0)::bigint as revenue,
             coalesce((select sum(e.amount) from public.treatment_expenses e
                        where e.treatment_id = t.id and e.cancelled_at is null), 0)::bigint as lab,
             coalesce((select round(sum(-m.quantity * coalesce(private.item_avg_cost(m.item_id), 0)))
                         from public.stock_movements m
                        where m.treatment_id = t.id and m.kind = 'kullanim'), 0)::bigint as material,
             exists (select 1 from public.stock_movements m
                      where m.treatment_id = t.id and m.kind = 'kullanim'
                        and private.item_avg_cost(m.item_id) is null) as unpriced,
             coalesce(dc.rate, 0) as rate
        from public.treatments t
        left join public.doctor_commissions dc on dc.member_id = t.doctor_member_id
       where t.plan_id = p_plan
    )
    select b.id, b.procedure, b.tooth, b.status, b.revenue, b.lab, b.material,
           round(b.revenue * b.rate / 100)::bigint, b.rate,
           (b.revenue - b.lab - b.material - round(b.revenue * b.rate / 100))::bigint,
           b.unpriced
      from base b
     order by b.performed_on, b.created_at;
end;
$$;
revoke execute on function public.plan_profitability(uuid) from public, anon;
grant execute on function public.plan_profitability(uuid) to authenticated;
