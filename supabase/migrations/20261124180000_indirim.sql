-- =============================================================================
-- Tedavi planında indirim ve klinik iletişim bilgileri
--
-- İndirim
--   * Plandaki işlemlere yüzde ya da tutar olarak uygulanır; anında geçerlidir (onay yok).
--   * Her işlemde liste fiyatı (list_amount) ve indirimli fiyat (amount) ayrı tutulur.
--     İndirim her zaman liste fiyatı üzerinden hesaplanır (üst üste binmez); 0 indirimi kaldırır.
--   * Tamamlanmış işleme indirim uygulanmaz (ücreti zaten borca geçti). Kilitli/imzalı plana
--     indirim uygulanmaz (hastanın onayladığı fiyat değişmez).
--   * Üst sınır: klinik ayarı (discount_limit_pct, varsayılan %20). "indirim.sinirsiz" yetkisi
--     (klinik sahibi) sınıra takılmaz ve sınırı değiştirir.
--   * Her indirim kaydedilir (kim, ne zaman, hangi işlemler, öncesi/sonrası).
--   * İşlemin ücreti formdan elle değiştirilirse bu yeni liste fiyatıdır (indirim sayılmaz).
-- =============================================================================

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',    array['indirim.yap', 'indirim.sinirsiz']),
  ('yonetici', array['indirim.yap']),
  ('hekim',    array['indirim.yap'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission)
on conflict do nothing;

alter table public.clinics
  add column discount_limit_pct smallint not null default 20 check (discount_limit_pct between 0 and 100),
  add column address text,
  add column phone   text,
  add column email   text;
-- İletişim bilgileri klinik yönetimince düzenlenir; indirim sınırı yalnızca fonksiyonla.
grant update (address, phone, email) on public.clinics to authenticated;

alter table public.treatments add column list_amount integer check (list_amount is null or list_amount >= 0);
update public.treatments set list_amount = amount where amount is not null;
grant insert (list_amount) on public.treatments to authenticated;

-- Ücret indirim fonksiyonu dışında değişirse yeni liste fiyatıdır.
create function private.treatments_list_amount()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(current_setting('app.indirim', true), '') = '1' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.amount is distinct from old.amount then
    new.list_amount := new.amount;
  end if;
  return new;
end;
$$;
create trigger treatments_list_amount before insert or update of amount on public.treatments
  for each row execute function private.treatments_list_amount();

create table public.treatment_discounts (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null,
  plan_id          uuid not null,
  patient_id       uuid not null,
  treatment_ids    uuid[] not null,
  mode             text not null check (mode in ('yuzde', 'tutar')),
  value            numeric not null,
  total_before     integer not null,
  total_after      integer not null,
  created_by       uuid references auth.users (id) default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  foreign key (clinic_id, plan_id) references public.treatment_plans (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index treatment_discounts_clinic_idx on public.treatment_discounts (clinic_id, created_at desc);
alter table public.treatment_discounts enable row level security;
grant select on public.treatment_discounts to authenticated;
create policy "indirim okuma" on public.treatment_discounts for select to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.oku'))
         or clinic_id in (select private.clinics_with('tedavi.ozet.oku')));

-- p_treatments: indirimin uygulanacağı işlemler (null: planın tamamlanmamış, ücretli tüm işlemleri)
-- p_mode: 'yuzde' (0–100) ya da 'tutar' (kuruş; liste fiyatlarına oranla dağıtılır)
create function public.apply_plan_discount(p_plan uuid, p_treatments uuid[], p_mode text, p_value numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan    public.treatment_plans%rowtype;
  v_limit   smallint;
  v_ids     uuid[];
  v_before  integer;
  v_after   integer := 0;
  v_given   integer := 0;
  v_cut     integer;
  v_n       integer;
  v_i       integer := 0;
  r         record;
begin
  select * into v_plan from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_plan.clinic_id, 'indirim.yap') then
    raise exception 'İndirim yapma yetkiniz yok.' using errcode = '42501';
  end if;
  if v_plan.locked_at is not null then
    raise exception 'Plan kilitli; anlaşılan fiyata indirim uygulanamaz.' using errcode = '23514';
  end if;
  if p_mode not in ('yuzde', 'tutar') or p_value is null or p_value < 0
     or (p_mode = 'yuzde' and p_value > 100) then
    raise exception 'Geçerli bir indirim girin.' using errcode = '23514';
  end if;

  select array_agg(t.id order by t.performed_on, t.created_at),
         coalesce(sum(coalesce(t.list_amount, t.amount)), 0)::integer, count(*)
    into v_ids, v_before, v_n
    from public.treatments t
   where t.plan_id = p_plan and t.status <> 'tamamlandi' and t.amount is not null
     and (p_treatments is null or t.id = any (p_treatments));
  if v_n = 0 or v_before = 0 then
    raise exception 'İndirim uygulanacak ücretli ve tamamlanmamış işlem yok.' using errcode = '23514';
  end if;
  if p_mode = 'tutar' and p_value > v_before then
    raise exception 'İndirim tutarı işlemlerin toplamından büyük olamaz.' using errcode = '23514';
  end if;

  perform set_config('app.indirim', '1', true);
  for r in select t.id, coalesce(t.list_amount, t.amount) as base
             from public.treatments t where t.id = any (v_ids)
            order by t.performed_on, t.created_at loop
    v_i := v_i + 1;
    if p_mode = 'yuzde' then
      v_cut := round(r.base * p_value / 100.0);
    elsif v_i = v_n then
      v_cut := round(p_value) - v_given;          -- kuruş farkı son işleme
    else
      v_cut := round(p_value * r.base / v_before);
    end if;
    v_cut := least(greatest(v_cut, 0), r.base);
    v_given := v_given + v_cut;
    v_after := v_after + (r.base - v_cut);
    update public.treatments set list_amount = r.base, amount = r.base - v_cut where id = r.id;
  end loop;
  perform set_config('app.indirim', '', true);

  select discount_limit_pct into v_limit from public.clinics where id = v_plan.clinic_id;
  if not private.has_permission(v_plan.clinic_id, 'indirim.sinirsiz')
     and (v_before - v_after) * 100.0 / v_before > v_limit + 0.001 then
    raise exception 'İndirim sınırınız %%%; daha fazlası için klinik sahibine başvurun.', v_limit
      using errcode = '42501';
  end if;

  insert into public.treatment_discounts
    (clinic_id, plan_id, patient_id, treatment_ids, mode, value, total_before, total_after, created_by_name)
  values (v_plan.clinic_id, p_plan, v_plan.patient_id, v_ids, p_mode, p_value, v_before, v_after,
          private.member_name(v_plan.clinic_id));
end;
$$;
revoke execute on function public.apply_plan_discount(uuid, uuid[], text, numeric) from public, anon;
grant execute on function public.apply_plan_discount(uuid, uuid[], text, numeric) to authenticated;

create function public.set_discount_limit(p_clinic uuid, p_pct smallint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_permission(p_clinic, 'indirim.sinirsiz') then
    raise exception 'İndirim sınırını yalnızca klinik sahibi değiştirebilir.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Sınır %%0 ile %%100 arasında olmalı.' using errcode = '23514';
  end if;
  update public.clinics set discount_limit_pct = p_pct where id = p_clinic;
end;
$$;
revoke execute on function public.set_discount_limit(uuid, smallint) from public, anon;
grant execute on function public.set_discount_limit(uuid, smallint) to authenticated;

-- Özet okuma liste fiyatını da döndürür (proformada üstü çizili eski fiyat)
drop function public.treatment_summaries(uuid);
create function public.treatment_summaries(p_patient uuid)
returns table (
  id            uuid,
  performed_on  date,
  procedure     text,
  kind          public.treatment_kind,
  tooth         text,
  status        public.treatment_status,
  doctor_name   text,
  plan_id       uuid,
  amount        integer,
  list_amount   integer
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.performed_on, t.procedure, t.kind, t.tooth, t.status, m.display_name, t.plan_id,
         t.amount, t.list_amount
  from public.treatments t
  join public.clinic_members m on m.id = t.doctor_member_id
  where t.patient_id = p_patient
    and (t.clinic_id in (select private.clinics_with('tedavi.ozet.oku'))
         or t.clinic_id in (select private.clinics_with('tedavi.oku')))
  order by t.performed_on, t.created_at
$$;
revoke execute on function public.treatment_summaries(uuid) from public, anon;
grant execute on function public.treatment_summaries(uuid) to authenticated;
