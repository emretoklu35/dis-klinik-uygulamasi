-- =============================================================================
-- Tedavi planları
--
--   * Bir hastanın birden fazla planı olabilir (ör. "Köprülü plan", "İmplantlı plan").
--     Aynı anda yalnızca biri uygulanır (is_active). Diğerleri silinmez, kenarda durur.
--   * Her tedavi bir plana aittir. Planı verilmeden eklenen tedavi (ör. seans kapatmada
--     yeni işlem) hastanın uygulanan planına girer; plan yoksa yeni bir plan açılır.
--   * Plandaki işlemin ücreti (amount) olabilir. İşlem "tamamlandı" olunca ücreti hastanın
--     borcuna kendiliğinden eklenir; aynı tedavi için borç zaten girildiyse (seans kapatma)
--     ikinci kez eklenmez.
--   * Önceki migration'da tedavi türü (kind) için yazma izni unutulmuştu; burada verilir.
-- =============================================================================

-- Uygulamanın tedavi türünü yazabilmesi (eksik izin düzeltmesi)
grant insert (kind), update (kind) on public.treatments to authenticated;

create table public.treatment_plans (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null,
  patient_id        uuid not null,
  title             text not null check (length(trim(title)) > 0),
  doctor_member_id  uuid not null,
  is_active         boolean not null default false,
  created_by        uuid references auth.users (id) default auth.uid(),
  created_at        timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, doctor_member_id) references public.clinic_members (clinic_id, id)
);
create index treatment_plans_patient_idx on public.treatment_plans (clinic_id, patient_id, created_at);
-- Hasta başına en fazla bir uygulanan plan
create unique index treatment_plans_one_active on public.treatment_plans (patient_id) where is_active;

alter table public.treatment_plans enable row level security;
grant select on public.treatment_plans to authenticated;
grant insert (clinic_id, patient_id, title, doctor_member_id, is_active),
      update (title, is_active)
  on public.treatment_plans to authenticated;

-- Tedavileri (ya da özetini) görebilen planları görür; tedavi yazabilen plan açar/düzenler.
create policy "plan okuma" on public.treatment_plans for select to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.oku'))
         or clinic_id in (select private.clinics_with('tedavi.ozet.oku')));
create policy "plan ekleme" on public.treatment_plans for insert to authenticated
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));
create policy "plan guncelleme" on public.treatment_plans for update to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.yaz')))
  with check (clinic_id in (select private.clinics_with('tedavi.yaz')));

-- Tedavilere plan ve ücret
alter table public.treatments
  add column plan_id uuid,
  add column amount integer check (amount is null or amount >= 0),
  add column price_item_id uuid,
  add foreign key (clinic_id, plan_id) references public.treatment_plans (clinic_id, id),
  add foreign key (clinic_id, price_item_id) references public.price_list_items (clinic_id, id);
create index treatments_plan_idx on public.treatments (plan_id);
grant insert (plan_id, amount, price_item_id), update (plan_id, amount, price_item_id)
  on public.treatments to authenticated;

-- Mevcut tedaviler: her hasta için "İlk plan" (uygulanan) açılır ve tedaviler ona bağlanır.
insert into public.treatment_plans (clinic_id, patient_id, title, doctor_member_id, is_active, created_by, created_at)
select distinct on (t.patient_id)
       t.clinic_id, t.patient_id, 'İlk plan', t.doctor_member_id, true, null,
       min(t.created_at) over (partition by t.patient_id)
  from public.treatments t
 order by t.patient_id, t.performed_on desc, t.created_at desc;
update public.treatments t
   set plan_id = p.id
  from public.treatment_plans p
 where p.patient_id = t.patient_id and p.is_active and t.plan_id is null;
alter table public.treatments alter column plan_id set not null;

-- Eski tedavilerin ücreti: o tedaviye bağlı (iptal edilmemiş) borç kayıtlarından alınır.
-- Hastanın borcu değişmez; borç zaten var olduğu için yeni borç da eklenmez.
update public.treatments t
   set amount = c.total,
       price_item_id = coalesce(t.price_item_id, c.item)
  from (select treatment_id,
               sum(amount)::integer as total,
               case when count(*) = 1 then min(price_item_id::text)::uuid end as item
          from public.patient_charges
         where treatment_id is not null and cancelled_at is null
         group by treatment_id) c
 where c.treatment_id = t.id and t.amount is null;

-- Planı verilmeyen tedavi uygulanan plana girer; plan başka hastanınsa reddedilir.
create function private.treatments_assign_plan()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_patient uuid;
begin
  if new.plan_id is null then
    select id into new.plan_id from public.treatment_plans
     where patient_id = new.patient_id and is_active;
    if new.plan_id is null then
      insert into public.treatment_plans (clinic_id, patient_id, title, doctor_member_id, is_active)
      values (new.clinic_id, new.patient_id, 'Tedavi planı', new.doctor_member_id, true)
      returning id into new.plan_id;
    end if;
  else
    select patient_id into v_patient from public.treatment_plans where id = new.plan_id;
    if v_patient is distinct from new.patient_id then
      raise exception 'Tedavi planı bu hastaya ait değil.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger treatments_assign_plan before insert or update of plan_id on public.treatments
  for each row execute function private.treatments_assign_plan();

-- Tamamlanan işlemin ücreti borca eklenir. İşlem sonunda (deferred) çalışır; böylece seans
-- kapatmada aynı işlem için ayrıca girilen borç görülür ve ikinci kez eklenmez.
create function private.treatments_charge_on_completion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_t public.treatments%rowtype;
  v_item uuid;
begin
  select * into v_t from public.treatments where id = new.id;
  if v_t.status <> 'tamamlandi' or v_t.amount is null then
    return null;
  end if;
  if exists (select 1 from public.patient_charges c
              where c.treatment_id = v_t.id and c.cancelled_at is null) then
    return null;
  end if;
  -- Fiyat kalemi kullanımdan kaldırıldıysa borç kalemsiz girilir
  select i.id into v_item from public.price_list_items i
   where i.id = v_t.price_item_id and i.clinic_id = v_t.clinic_id and i.active;
  insert into public.patient_charges
    (clinic_id, patient_id, price_item_id, treatment_id, description, tooth, amount, adjust_note)
  values
    (v_t.clinic_id, v_t.patient_id, v_item, v_t.id, v_t.procedure, v_t.tooth, v_t.amount,
     case when v_item is not null then 'Tedavi planındaki ücret' end);
  return null;
end;
$$;
create constraint trigger treatments_charge_on_completion
  after insert or update of status, amount on public.treatments
  deferrable initially deferred
  for each row execute function private.treatments_charge_on_completion();

-- Uygulanan planı değiştir (hastanın diğer planları kapanır)
create function public.set_active_treatment_plan(p_plan uuid)
returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  v_patient uuid;
begin
  select patient_id into v_patient from public.treatment_plans where id = p_plan;
  if v_patient is null then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  update public.treatment_plans set is_active = false where patient_id = v_patient and is_active and id <> p_plan;
  update public.treatment_plans set is_active = true where id = p_plan;
  if not found then
    raise exception 'Tedavi planını değiştirme yetkiniz yok.' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.set_active_treatment_plan(uuid) from public, anon;
grant execute on function public.set_active_treatment_plan(uuid) to authenticated;

-- Planı kopyala: yeni (uygulanmayan) plan; işlemler "planlandı" olarak, ücretleriyle gelir.
create function public.copy_treatment_plan(p_plan uuid, p_title text)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_src public.treatment_plans%rowtype;
  v_member uuid;
  v_new uuid;
begin
  select * into v_src from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  select m.id into v_member from public.clinic_members m
   where m.clinic_id = v_src.clinic_id and m.user_id = auth.uid() and m.status = 'aktif';
  insert into public.treatment_plans (clinic_id, patient_id, title, doctor_member_id, is_active)
  values (v_src.clinic_id, v_src.patient_id, trim(p_title), coalesce(v_member, v_src.doctor_member_id), false)
  returning id into v_new;
  insert into public.treatments
    (clinic_id, patient_id, doctor_member_id, performed_on, procedure, kind, tooth, status, note,
     plan_id, amount, price_item_id)
  select clinic_id, patient_id, doctor_member_id, current_date, procedure, kind, tooth, 'planlandi', note,
         v_new, amount, price_item_id
    from public.treatments where plan_id = p_plan
   order by performed_on, created_at;
  return v_new;
end;
$$;
revoke execute on function public.copy_treatment_plan(uuid, text) from public, anon;
grant execute on function public.copy_treatment_plan(uuid, text) to authenticated;

-- Planı sil: yalnızca hiç başlanmamış (tamamlanan/devam eden işlemi olmayan) plan.
create function public.delete_treatment_plan(p_plan uuid)
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
revoke execute on function public.delete_treatment_plan(uuid) from public, anon;
grant execute on function public.delete_treatment_plan(uuid) to authenticated;

-- Özet okuma (yönetici/sahip) plan ve ücreti de döndürür.
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
  amount        integer
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.performed_on, t.procedure, t.kind, t.tooth, t.status, m.display_name, t.plan_id, t.amount
  from public.treatments t
  join public.clinic_members m on m.id = t.doctor_member_id
  where t.patient_id = p_patient
    and (t.clinic_id in (select private.clinics_with('tedavi.ozet.oku'))
         or t.clinic_id in (select private.clinics_with('tedavi.oku')))
  order by t.performed_on, t.created_at
$$;
revoke execute on function public.treatment_summaries(uuid) from public, anon;
grant execute on function public.treatment_summaries(uuid) to authenticated;
