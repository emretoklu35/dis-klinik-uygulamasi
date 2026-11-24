-- =============================================================================
-- Tedavi planı onayı (proforma imzası)
--
--   * Hasta, klinikteki ekranda proformayı parmağıyla imzalar.
--   * İmza ile birlikte imzalandığı andaki plan içeriği (işlemler, dişler, ücretler,
--     toplam) değişmez bir kopya olarak saklanır: "hasta neyi onayladı" sorusunun cevabı.
--   * İmzalanan plan kendiliğinden kilitlenir (anlaşılan fiyat değişmez).
--   * Onay kayıtları silinmez ve değiştirilmez. Kilit açılıp plan değişirse yeniden
--     imzalatılabilir; eski onay geçmişte kalır.
-- =============================================================================

create table public.treatment_plan_approvals (
  id                uuid primary key default gen_random_uuid(),
  clinic_id         uuid not null,
  plan_id           uuid not null,
  patient_id        uuid not null,
  -- İmza: {"w": genişlik, "h": yükseklik, "d": SVG yol verisi}
  signature         jsonb not null,
  -- İmzalanan içerik: [{procedure, tooth, status, amount}]
  items             jsonb not null,
  total             integer not null,
  plan_title        text not null,
  patient_name      text not null,
  signed_at         timestamptz not null default now(),
  recorded_by       uuid references auth.users (id),
  recorded_by_name  text,
  foreign key (clinic_id, plan_id) references public.treatment_plans (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index treatment_plan_approvals_plan_idx on public.treatment_plan_approvals (plan_id, signed_at desc);

alter table public.treatment_plan_approvals enable row level security;
grant select on public.treatment_plan_approvals to authenticated;
-- Ekleme yalnızca aşağıdaki fonksiyonla; güncelleme ve silme yok.
create policy "plan onayi okuma" on public.treatment_plan_approvals for select to authenticated
  using (clinic_id in (select private.clinics_with('tedavi.oku'))
         or clinic_id in (select private.clinics_with('tedavi.ozet.oku')));

create function public.sign_treatment_plan(p_plan uuid, p_signature jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan  public.treatment_plans%rowtype;
  v_items jsonb;
  v_total integer;
  v_name  text;
  v_id    uuid;
begin
  select * into v_plan from public.treatment_plans where id = p_plan;
  if not found then
    raise exception 'Tedavi planı bulunamadı.' using errcode = 'P0002';
  end if;
  if not (private.has_permission(v_plan.clinic_id, 'tedavi.yaz')
          or private.has_permission(v_plan.clinic_id, 'tedavi.ozet.oku')) then
    raise exception 'Hasta onayını alma yetkiniz yok.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_signature -> 'd') <> 'string'
     or length(p_signature ->> 'd') < 20 or length(p_signature ->> 'd') > 200000 then
    raise exception 'İmza okunamadı; lütfen yeniden imzalayın.' using errcode = '23514';
  end if;
  -- Kilitli planda, kilitten sonra alınmış bir onay varsa yeniden imzalatılmaz
  if v_plan.locked_at is not null and exists (
       select 1 from public.treatment_plan_approvals a
        where a.plan_id = p_plan and a.signed_at >= v_plan.locked_at) then
    raise exception 'Bu plan zaten imzalandı.' using errcode = '23514';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'procedure', t.procedure, 'tooth', t.tooth, 'status', t.status, 'amount', t.amount)
           order by t.performed_on, t.created_at), '[]'::jsonb),
         coalesce(sum(t.amount), 0)::integer
    into v_items, v_total
    from public.treatments t where t.plan_id = p_plan;
  if jsonb_array_length(v_items) = 0 then
    raise exception 'Boş plan imzalatılamaz; önce işlem ekleyin.' using errcode = '23514';
  end if;
  select p.first_name || ' ' || p.last_name into v_name from public.patients p where p.id = v_plan.patient_id;

  insert into public.treatment_plan_approvals
    (clinic_id, plan_id, patient_id, signature, items, total, plan_title, patient_name,
     recorded_by, recorded_by_name)
  values
    (v_plan.clinic_id, p_plan, v_plan.patient_id,
     jsonb_build_object('w', (p_signature ->> 'w')::numeric, 'h', (p_signature ->> 'h')::numeric,
                        'd', p_signature ->> 'd'),
     v_items, v_total, v_plan.title, v_name, auth.uid(), private.member_name(v_plan.clinic_id))
  returning id into v_id;

  if v_plan.locked_at is null then
    update public.treatment_plans
       set locked_at = now(), locked_by = auth.uid(),
           locked_by_name = coalesce(private.member_name(v_plan.clinic_id), '') || ' (hasta imzası)'
     where id = p_plan;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.sign_treatment_plan(uuid, jsonb) from public, anon;
grant execute on function public.sign_treatment_plan(uuid, jsonb) to authenticated;
