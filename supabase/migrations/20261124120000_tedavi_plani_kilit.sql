-- =============================================================================
-- Tedavi planı kilidi: "Anlaşılan fiyat, tedavi bitene kadar aynı kalır."
--
--   * Hasta planı onaylayınca hekim planı kilitler (tedavi.yaz).
--   * Kilitli planda işlem eklenemez, silinemez; işlemin adı, türü, dişi ve ücreti
--     değiştirilemez. Durum (devam / tamamlandı), tarih ve not değişebilir; tamamlanan
--     işlemin ücreti yine borca eklenir.
--   * Kilitli plan silinemez.
--   * Kilidi yalnızca "plan.kilit.ac" yetkisi olan açar (varsayılan: klinik sahibi).
--   * Kimin, ne zaman kilitlediği ve en son kimin açtığı saklanır.
-- =============================================================================

insert into public.role_permissions (role, permission)
values ('sahip'::public.clinic_role, 'plan.kilit.ac');

alter table public.treatment_plans
  add column locked_at       timestamptz,
  add column locked_by       uuid references auth.users (id),
  add column locked_by_name  text,
  add column unlocked_at     timestamptz,
  add column unlocked_by     uuid references auth.users (id),
  add column unlocked_by_name text;

-- Oturumdaki kişinin bu klinikteki adı
create function private.member_name(p_clinic uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select m.display_name from public.clinic_members m
   where m.clinic_id = p_clinic and m.user_id = auth.uid()
$$;

create function public.lock_treatment_plan(p_plan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.treatment_plans%rowtype;
begin
  select * into v_plan from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_plan.clinic_id, 'tedavi.yaz') then
    raise exception 'Planı yalnızca hekim kilitleyebilir.' using errcode = '42501';
  end if;
  if v_plan.locked_at is not null then
    raise exception 'Plan zaten kilitli.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.treatments where plan_id = p_plan) then
    raise exception 'Boş plan kilitlenemez; önce işlem ekleyin.' using errcode = '23514';
  end if;
  update public.treatment_plans
     set locked_at = now(), locked_by = auth.uid(),
         locked_by_name = private.member_name(v_plan.clinic_id)
   where id = p_plan;
end;
$$;
revoke execute on function public.lock_treatment_plan(uuid) from public, anon;
grant execute on function public.lock_treatment_plan(uuid) to authenticated;

create function public.unlock_treatment_plan(p_plan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.treatment_plans%rowtype;
begin
  select * into v_plan from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_plan.clinic_id, 'plan.kilit.ac') then
    raise exception 'Plan kilidini yalnızca klinik sahibi açabilir.' using errcode = '42501';
  end if;
  if v_plan.locked_at is null then
    raise exception 'Plan kilitli değil.' using errcode = '23514';
  end if;
  update public.treatment_plans
     set locked_at = null, locked_by = null, locked_by_name = null,
         unlocked_at = now(), unlocked_by = auth.uid(),
         unlocked_by_name = private.member_name(v_plan.clinic_id)
   where id = p_plan;
end;
$$;
revoke execute on function public.unlock_treatment_plan(uuid) from public, anon;
grant execute on function public.unlock_treatment_plan(uuid) to authenticated;

-- Kilitli plandaki işlemler: ekleme ve anlaşılan bilgileri değiştirme yasak
create function private.treatments_respect_plan_lock()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.treatment_plans where id = new.plan_id and locked_at is not null) then
      raise exception 'Kilitli plana işlem eklenemez. Yeni bir plan açın ya da planı kopyalayın.'
        using errcode = '23514';
    end if;
    return new;
  end if;
  if exists (select 1 from public.treatment_plans where id = old.plan_id and locked_at is not null)
     and (new.plan_id is distinct from old.plan_id
          or new.procedure is distinct from old.procedure
          or new.kind is distinct from old.kind
          or new.tooth is distinct from old.tooth
          or new.amount is distinct from old.amount
          or new.price_item_id is distinct from old.price_item_id) then
    raise exception 'Plan kilitli: işlemin adı, türü, dişi ve ücreti değiştirilemez.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
-- Plan atama tetikleyicisinden (treatments_assign_plan) sonra çalışsın diye adı "z" ile başlar
create trigger z_treatments_respect_plan_lock before insert or update on public.treatments
  for each row execute function private.treatments_respect_plan_lock();

-- Kilitli plan silinemez
create or replace function public.delete_treatment_plan(p_plan uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.treatment_plans%rowtype;
begin
  select * into v_plan from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_plan.clinic_id, 'tedavi.yaz') then
    raise exception 'Tedavi planını yalnızca hekim silebilir.' using errcode = '42501';
  end if;
  if v_plan.locked_at is not null then
    raise exception 'Kilitli plan silinemez.' using errcode = '23514';
  end if;
  if exists (select 1 from public.treatments where plan_id = p_plan and status <> 'planlandi') then
    raise exception 'Başlanmış ya da tamamlanmış işlemi olan plan silinemez.' using errcode = '23514';
  end if;
  if exists (select 1 from public.patient_notes n join public.treatments t on t.id = n.treatment_id
              where t.plan_id = p_plan) then
    raise exception 'Bu plandaki bir işleme bağlı not var; plan silinemez.' using errcode = '23514';
  end if;
  delete from public.treatments where plan_id = p_plan;
  delete from public.treatment_plans where id = p_plan;
end;
$$;
