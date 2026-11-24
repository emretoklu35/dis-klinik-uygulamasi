-- =============================================================================
-- Gider yönetimi: muhasebe rolü, laboratuvar ay sonu faturaları, gider raporu
--
--   * Giderleri hekim girmez. Laboratuvar giderini muhasebe, yönetici ve klinik sahibi girer
--     (maliyet.yaz). Kârlılığı ve gider raporunu da onlar görür (maliyet.oku).
--   * Laboratuvar ay sonunda fatura gönderir: hangi hekimin hangi işi. Fatura bir kez girilir,
--     kalemleri ilgili tedavilere dağıtılır (kârlılığa işlem bazında yansır). Faturanın para
--     birimi ve kuru tüm kalemlerde geçerlidir. Fatura silinmez, sebebiyle iptal edilir
--     (kalemleri de iptal olur).
--   * Stok alımları da gider sayılır: alış fiyatlı stok girişleri gider raporunda görünür.
-- =============================================================================

-- Muhasebe: maliyet, gider, ödeme ve raporlar; stok alımı (fiyatlı giriş)
insert into public.role_permissions (role, permission)
select 'muhasebe'::public.clinic_role, p
  from unnest(array['maliyet.oku', 'maliyet.yaz', 'odeme.oku', 'rapor.oku',
                    'stok.oku', 'stok.giris', 'stok.maliyet', 'gorev.oku', 'gorev.yaz', 'klinik.oku']) as p
on conflict do nothing;

-- Hekim, asistan ve resepsiyon gider girmez
delete from public.role_permissions
 where permission = 'maliyet.yaz' and role in ('hekim', 'asistan', 'resepsiyonist');

create table public.lab_statements (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null,
  lab_id           uuid not null,
  period_start     date not null,
  period_end       date not null check (period_end >= period_start),
  invoice_no       text,
  invoice_date     date not null default current_date,
  currency         text not null default 'TRY' check (currency in ('TRY', 'USD', 'EUR')),
  rate             numeric(12, 4) not null default 1 check (rate > 0),
  total_original   integer not null check (total_original > 0),
  note             text,
  created_by       uuid references auth.users (id) default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  cancelled_at     timestamptz,
  cancelled_by     uuid references auth.users (id),
  cancel_reason    text,
  unique (clinic_id, id),
  foreign key (clinic_id, lab_id) references public.labs (clinic_id, id)
);
create index lab_statements_clinic_idx on public.lab_statements (clinic_id, invoice_date desc);
alter table public.lab_statements enable row level security;
grant select on public.lab_statements to authenticated;
create policy "laboratuvar faturasi okuma" on public.lab_statements for select to authenticated
  using (clinic_id in (select private.clinics_with('maliyet.yaz'))
         or clinic_id in (select private.clinics_with('maliyet.oku')));
create trigger lab_statements_audit after insert or update or delete on public.lab_statements
  for each row execute function private.audit_row();

alter table public.treatment_expenses
  add column statement_id uuid,
  add foreign key (clinic_id, statement_id) references public.lab_statements (clinic_id, id);

-- Faturaya eklenebilecek işler: dönemde yapılmış ya da devam eden tedaviler
create function public.lab_candidates(p_clinic uuid, p_from date, p_to date)
returns table (
  treatment_id uuid, performed_on date, status public.treatment_status, procedure text,
  kind public.treatment_kind, tooth text, patient_name text, doctor_member_id uuid,
  doctor_name text, expensed bigint
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tz text;
begin
  if not private.has_permission(p_clinic, 'maliyet.yaz') then
    raise exception 'Laboratuvar faturası girme yetkiniz yok.' using errcode = '42501';
  end if;
  select timezone into v_tz from public.clinics where id = p_clinic;
  return query
    select t.id, coalesce((t.completed_at at time zone v_tz)::date, t.performed_on), t.status,
           t.procedure, t.kind, t.tooth, p.first_name || ' ' || p.last_name,
           t.doctor_member_id, m.display_name,
           coalesce((select sum(e.amount) from public.treatment_expenses e
                      where e.treatment_id = t.id and e.cancelled_at is null), 0)::bigint
      from public.treatments t
      join public.patients p on p.id = t.patient_id
      join public.clinic_members m on m.id = t.doctor_member_id
     where t.clinic_id = p_clinic and t.status <> 'planlandi'
       and coalesce((t.completed_at at time zone v_tz)::date, t.performed_on) between p_from and p_to
     order by m.display_name, coalesce((t.completed_at at time zone v_tz)::date, t.performed_on), p.last_name;
end;
$$;
revoke execute on function public.lab_candidates(uuid, date, date) from public, anon;
grant execute on function public.lab_candidates(uuid, date, date) to authenticated;

-- p_items: [{"treatment_id": ..., "amount": 150000, "description": "Zirkonyum kron"}] (faturanın para biriminde)
create function public.create_lab_statement(
  p_clinic uuid, p_lab uuid, p_lab_name text, p_from date, p_to date, p_invoice_no text,
  p_invoice_date date, p_currency text, p_rate numeric, p_total integer, p_note text, p_items jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_lab  uuid := p_lab;
  v_rate numeric := case when p_currency = 'TRY' then 1 else p_rate end;
  v_id   uuid;
  v_name text := private.member_name(p_clinic);
begin
  if not private.has_permission(p_clinic, 'maliyet.yaz') then
    raise exception 'Laboratuvar faturası girme yetkiniz yok.' using errcode = '42501';
  end if;
  if p_currency not in ('TRY', 'USD', 'EUR') then
    raise exception 'Para birimi TL, USD ya da EUR olmalı.' using errcode = '23514';
  end if;
  if v_rate is null or v_rate <= 0 then
    raise exception 'Döviz faturada fatura tarihindeki kuru yazın.' using errcode = '23514';
  end if;
  if coalesce(p_total, 0) <= 0 then
    raise exception 'Fatura toplamını girin.' using errcode = '23514';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'Faturadaki en az bir işi seçin.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
              where coalesce((e ->> 'amount')::integer, 0) <= 0
                 or not exists (select 1 from public.treatments t
                                 where t.id = (e ->> 'treatment_id')::uuid and t.clinic_id = p_clinic)) then
    raise exception 'Her iş için sıfırdan büyük bir tutar girin.' using errcode = '23514';
  end if;
  if v_lab is null then
    if length(trim(coalesce(p_lab_name, ''))) = 0 then
      raise exception 'Laboratuvarı seçin ya da adını yazın.' using errcode = '23514';
    end if;
    insert into public.labs (clinic_id, name) values (p_clinic, trim(p_lab_name))
    on conflict (clinic_id, name) do update set active = true
    returning id into v_lab;
  end if;

  insert into public.lab_statements
    (clinic_id, lab_id, period_start, period_end, invoice_no, invoice_date, currency, rate,
     total_original, note, created_by_name)
  values (p_clinic, v_lab, p_from, p_to, nullif(trim(coalesce(p_invoice_no, '')), ''),
          coalesce(p_invoice_date, current_date), p_currency, v_rate, p_total,
          nullif(trim(coalesce(p_note, '')), ''), v_name)
  returning id into v_id;

  insert into public.treatment_expenses
    (clinic_id, treatment_id, lab_id, statement_id, description, currency, amount_original, rate,
     amount, created_by_name)
  select p_clinic, (e ->> 'treatment_id')::uuid, v_lab, v_id,
         nullif(trim(coalesce(e ->> 'description', '')), ''), p_currency,
         (e ->> 'amount')::integer, v_rate, round((e ->> 'amount')::integer * v_rate), v_name
    from jsonb_array_elements(p_items) e;
  return v_id;
end;
$$;
revoke execute on function public.create_lab_statement(uuid, uuid, text, date, date, text, date, text, numeric, integer, text, jsonb) from public, anon;
grant execute on function public.create_lab_statement(uuid, uuid, text, date, date, text, date, text, numeric, integer, text, jsonb) to authenticated;

create function public.cancel_lab_statement(p_statement uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_clinic uuid;
begin
  select clinic_id into v_clinic from public.lab_statements where id = p_statement and cancelled_at is null;
  if v_clinic is null then
    raise exception 'Fatura bulunamadı ya da zaten iptal edilmiş.' using errcode = 'P0002';
  end if;
  if not private.has_permission(v_clinic, 'maliyet.yaz') then
    raise exception 'Fatura iptal etme yetkiniz yok.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'İptal için sebep yazın.' using errcode = '23514';
  end if;
  update public.lab_statements
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = trim(p_reason)
   where id = p_statement;
  update public.treatment_expenses
     set cancelled_at = now(), cancelled_by = auth.uid(), cancel_reason = 'Fatura iptal: ' || trim(p_reason)
   where statement_id = p_statement and cancelled_at is null;
end;
$$;
revoke execute on function public.cancel_lab_statement(uuid, text) from public, anon;
grant execute on function public.cancel_lab_statement(uuid, text) to authenticated;

-- Gider raporu: laboratuvar (fatura tarihi; faturasız tekil giderde giriş tarihi) ve stok alımları
create function public.report_expenses(p_clinic uuid, p_from date, p_to date)
returns table (
  kind text, day date, label text, detail text, doctor_name text, amount bigint, ref uuid
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tz text;
begin
  if not private.has_permission(p_clinic, 'maliyet.oku') then
    raise exception 'Giderleri görme yetkiniz yok.' using errcode = '42501';
  end if;
  select timezone into v_tz from public.clinics where id = p_clinic;
  return query
    select 'laboratuvar'::text,
           coalesce(s.invoice_date, (e.created_at at time zone v_tz)::date),
           coalesce(l.name, 'Laboratuvar'),
           t.procedure || coalesce(' · ' || t.tooth, '') || ' · ' || p.first_name || ' ' || p.last_name,
           m.display_name, e.amount::bigint, coalesce(s.id, e.id)
      from public.treatment_expenses e
      join public.treatments t on t.id = e.treatment_id
      join public.patients p on p.id = t.patient_id
      join public.clinic_members m on m.id = t.doctor_member_id
      left join public.labs l on l.id = e.lab_id
      left join public.lab_statements s on s.id = e.statement_id
     where e.clinic_id = p_clinic and e.cancelled_at is null
       and coalesce(s.invoice_date, (e.created_at at time zone v_tz)::date) between p_from and p_to
    union all
    select 'stok'::text, (mv.created_at at time zone v_tz)::date, i.name,
           mv.quantity || ' ' || i.unit || coalesce(' · parti ' || mv.lot_no, ''),
           null::text, (mv.quantity * c.unit_cost)::bigint, mv.id
      from public.stock_movements mv
      join public.stock_costs c on c.movement_id = mv.id
      join public.stock_items i on i.id = mv.item_id
     where mv.clinic_id = p_clinic and mv.kind = 'giris' and mv.quantity > 0
       and (mv.created_at at time zone v_tz)::date between p_from and p_to
     order by 2 desc;
end;
$$;
revoke execute on function public.report_expenses(uuid, date, date) from public, anon;
grant execute on function public.report_expenses(uuid, date, date) to authenticated;
