-- =============================================================================
-- Ödemeler: fiyat listesi, borç kalemleri, tahsilatlar ve değişiklik geçmişi
--
--   * Tutarlar KURUŞ cinsinden tam sayıdır (4.000,00 TL = 400000).
--   * Fiyat listesi sabittir ama hekim/desk değiştirebilir; her tutar değişikliği
--     kim/ne zaman/eski/yeni/not ile price_changes'e yazılır.
--   * Borç kalemi fiyat listesinden gelir; hastaya özel tutar farklıysa sebep zorunlu.
--     Sonradan tutar değişirse charge_changes'e yazılır (sebep zorunlu).
--   * Kayıtlar silinmez. Hatalı borç/tahsilat yalnızca SAHİP tarafından, sebebiyle
--     iptal edilir; iptal edilen kayıt bir daha değiştirilemez.
--   * Görme: sahip, yönetici, hekim, resepsiyon. Asistan göremez.
--   * Not: Genel denetim kaydı (audit_log) yine değer tutmaz. Tutar geçmişi, istenen
--     "kim neyi değiştirdi" bilgisinin kendisi olduğu için ayrı tablolarda tutulur.
-- =============================================================================

create type public.payment_method as enum ('nakit', 'kredi_karti', 'havale', 'diger');

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',         array['odeme.oku', 'odeme.yaz', 'fiyat.yaz', 'odeme.iptal']),
  ('yonetici',      array['odeme.oku', 'odeme.yaz', 'fiyat.yaz']),
  ('hekim',         array['odeme.oku', 'odeme.yaz', 'fiyat.yaz']),
  ('resepsiyonist', array['odeme.oku', 'odeme.yaz', 'fiyat.yaz'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

-- Fiyat listesi ---------------------------------------------------------------
create table public.price_list_items (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid not null references public.clinics (id),
  name         text not null check (length(trim(name)) > 0),
  amount       integer not null check (amount >= 0),
  active       boolean not null default true,
  -- Değişiklik notu: tetikleyici geçmişe yazar ve temizler
  change_note  text,
  updated_by   uuid references auth.users (id) default auth.uid(),
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (clinic_id, id),
  unique (clinic_id, name)
);

create table public.price_changes (
  id          bigint generated always as identity primary key,
  clinic_id   uuid not null,
  item_id     uuid not null,
  old_amount  integer not null,
  new_amount  integer not null,
  note        text,
  changed_by  uuid references auth.users (id),
  changed_at  timestamptz not null default now(),
  foreign key (clinic_id, item_id) references public.price_list_items (clinic_id, id)
);
create index price_changes_item_idx on public.price_changes (item_id, changed_at desc);

-- Borç kalemleri ----------------------------------------------------------------
create table public.patient_charges (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null,
  patient_id     uuid not null,
  price_item_id  uuid,
  treatment_id   uuid,
  description    text not null check (length(trim(description)) > 0),
  tooth          text,
  -- Fiyat listesindeki tutar (tetikleyici doldurur; istemci yazamaz)
  list_amount    integer,
  amount         integer not null check (amount >= 0),
  adjust_note    text,
  change_note    text,
  created_by     uuid references auth.users (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users (id),
  cancel_reason  text,
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id),
  foreign key (clinic_id, price_item_id) references public.price_list_items (clinic_id, id),
  foreign key (clinic_id, treatment_id) references public.treatments (clinic_id, id),
  -- Listeden farklı tutar sebepsiz girilemez
  check (list_amount is null or amount = list_amount or length(trim(coalesce(adjust_note, ''))) > 0)
);
create index patient_charges_patient_idx on public.patient_charges (clinic_id, patient_id, created_at);

create table public.charge_changes (
  id          bigint generated always as identity primary key,
  clinic_id   uuid not null,
  charge_id   uuid not null,
  old_amount  integer not null,
  new_amount  integer not null,
  note        text not null,
  changed_by  uuid references auth.users (id),
  changed_at  timestamptz not null default now(),
  foreign key (clinic_id, charge_id) references public.patient_charges (clinic_id, id)
);
create index charge_changes_charge_idx on public.charge_changes (charge_id, changed_at desc);

-- Tahsilatlar -------------------------------------------------------------------
create table public.patient_payments (
  id             uuid primary key default gen_random_uuid(),
  clinic_id      uuid not null,
  patient_id     uuid not null,
  amount         integer not null check (amount > 0),
  method         public.payment_method not null,
  paid_on        date not null default current_date,
  note           text,
  received_by    uuid references auth.users (id) default auth.uid(),
  created_at     timestamptz not null default now(),
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users (id),
  cancel_reason  text,
  unique (clinic_id, id),
  foreign key (clinic_id, patient_id) references public.patients (clinic_id, id)
);
create index patient_payments_patient_idx on public.patient_payments (clinic_id, patient_id, paid_on);

-- Bakiye görünümü: alttaki tabloların RLS kuralları geçerli (security_invoker)
create view public.patient_balances with (security_invoker = true) as
select p.clinic_id,
       p.id as patient_id,
       coalesce((select sum(c.amount) from public.patient_charges c
                 where c.patient_id = p.id and c.cancelled_at is null), 0)::bigint as total_charged,
       coalesce((select sum(y.amount) from public.patient_payments y
                 where y.patient_id = p.id and y.cancelled_at is null), 0)::bigint as total_paid
from public.patients p;

-- Tetikleyiciler -------------------------------------------------------------------

-- Fiyat değişikliği → geçmiş
create function private.price_item_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount then
    insert into public.price_changes (clinic_id, item_id, old_amount, new_amount, note, changed_by)
    values (new.clinic_id, new.id, old.amount, new.amount, nullif(trim(coalesce(new.change_note, '')), ''), auth.uid());
  end if;
  new.change_note := null;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger price_list_items_before_update before update on public.price_list_items
  for each row execute function private.price_item_before_update();

-- Borç ekleme: liste tutarını fiyat listesinden doldur (istemciye güvenme)
create function private.charge_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.price_item_id is not null then
    select i.amount into new.list_amount
    from public.price_list_items i
    where i.id = new.price_item_id and i.clinic_id = new.clinic_id and i.active;
    if new.list_amount is null then
      raise exception 'Fiyat listesi kalemi bulunamadı ya da kullanımdan kaldırılmış.' using errcode = '23514';
    end if;
  else
    new.list_amount := null;
  end if;
  new.change_note := null;
  return new;
end;
$$;
create trigger patient_charges_before_insert before insert on public.patient_charges
  for each row execute function private.charge_before_insert();

-- İptal kuralları (borç ve tahsilat için ortak)
create function private.money_cancel_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
begin
  if v_old ->> 'cancelled_at' is not null then
    raise exception 'İptal edilmiş kayıt değiştirilemez.' using errcode = '23514';
  end if;
  if v_new ->> 'cancelled_at' is not null then
    if not private.has_permission(old.clinic_id, 'odeme.iptal') then
      raise exception 'Kaydı yalnızca klinik sahibi iptal edebilir.' using errcode = '42501';
    end if;
    if length(trim(coalesce(v_new ->> 'cancel_reason', ''))) = 0 then
      raise exception 'İptal için sebep yazın.' using errcode = '23514';
    end if;
    new.cancelled_at := now();
    new.cancelled_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger patient_charges_cancel before update on public.patient_charges
  for each row execute function private.money_cancel_rules();
create trigger patient_payments_cancel before update on public.patient_payments
  for each row execute function private.money_cancel_rules();

-- Borç tutarı değişikliği → geçmiş (sebep zorunlu)
create function private.charge_amount_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.amount is distinct from old.amount then
    if not private.has_permission(old.clinic_id, 'odeme.yaz') then
      raise exception 'Tutarı değiştirme yetkiniz yok.' using errcode = '42501';
    end if;
    if length(trim(coalesce(new.change_note, ''))) = 0 then
      raise exception 'Tutar değişikliği için sebep yazın.' using errcode = '23514';
    end if;
    insert into public.charge_changes (clinic_id, charge_id, old_amount, new_amount, note, changed_by)
    values (new.clinic_id, new.id, old.amount, new.amount, trim(new.change_note), auth.uid());
    -- Liste tutarından farkın açıklaması da güncel kalsın
    new.adjust_note := trim(new.change_note);
  end if;
  new.change_note := null;
  return new;
end;
$$;
create trigger patient_charges_amount_change before update on public.patient_charges
  for each row execute function private.charge_amount_change();

-- Tahsilat tarihi ileri olamaz
create function private.payment_date_check()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.paid_on > current_date then
    raise exception 'Ödeme tarihi ileri bir tarih olamaz.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger patient_payments_date before insert on public.patient_payments
  for each row execute function private.payment_date_check();

do $$
declare t text;
begin
  foreach t in array array['price_list_items', 'patient_charges', 'patient_payments'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

-- Yetkiler ------------------------------------------------------------------------
grant select on public.price_list_items, public.price_changes, public.patient_charges,
               public.charge_changes, public.patient_payments, public.patient_balances
  to authenticated;
grant insert (clinic_id, name, amount), update (name, amount, active, change_note)
  on public.price_list_items to authenticated;
grant insert (clinic_id, patient_id, price_item_id, treatment_id, description, tooth, amount, adjust_note),
      update (amount, change_note, cancelled_at, cancel_reason)
  on public.patient_charges to authenticated;
grant insert (clinic_id, patient_id, amount, method, paid_on, note),
      update (cancelled_at, cancel_reason)
  on public.patient_payments to authenticated;
-- price_changes / charge_changes: yalnızca okuma; yazma yalnızca tetikleyiciyle.

alter table public.price_list_items enable row level security;
alter table public.price_changes    enable row level security;
alter table public.patient_charges  enable row level security;
alter table public.charge_changes   enable row level security;
alter table public.patient_payments enable row level security;

create policy "fiyat okuma" on public.price_list_items for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));
create policy "fiyat ekleme" on public.price_list_items for insert to authenticated
  with check (clinic_id in (select private.clinics_with('fiyat.yaz')));
create policy "fiyat guncelleme" on public.price_list_items for update to authenticated
  using (clinic_id in (select private.clinics_with('fiyat.yaz')))
  with check (clinic_id in (select private.clinics_with('fiyat.yaz')));

create policy "fiyat gecmisi okuma" on public.price_changes for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));

create policy "borc okuma" on public.patient_charges for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));
create policy "borc ekleme" on public.patient_charges for insert to authenticated
  with check (
    clinic_id in (select private.clinics_with('odeme.yaz'))
    -- Tedaviye bağlama yalnızca tedavileri görebilen hekim
    and (treatment_id is null or clinic_id in (select private.clinics_with('tedavi.oku')))
  );
-- Tutar değişikliği (odeme.yaz) ve iptal (odeme.iptal) ayrıntısını tetikleyiciler denetler.
create policy "borc guncelleme" on public.patient_charges for update to authenticated
  using (clinic_id in (select private.clinics_with('odeme.yaz'))
         or clinic_id in (select private.clinics_with('odeme.iptal')))
  with check (clinic_id in (select private.clinics_with('odeme.yaz'))
              or clinic_id in (select private.clinics_with('odeme.iptal')));

create policy "borc gecmisi okuma" on public.charge_changes for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));

create policy "tahsilat okuma" on public.patient_payments for select to authenticated
  using (clinic_id in (select private.clinics_with('odeme.oku')));
create policy "tahsilat ekleme" on public.patient_payments for insert to authenticated
  with check (clinic_id in (select private.clinics_with('odeme.yaz')));
-- Tahsilat tutarı değiştirilemez; yalnızca sahip iptal eder.
create policy "tahsilat iptal" on public.patient_payments for update to authenticated
  using (clinic_id in (select private.clinics_with('odeme.iptal')))
  with check (clinic_id in (select private.clinics_with('odeme.iptal')));

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
