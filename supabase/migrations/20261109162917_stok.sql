-- =============================================================================
-- Stok: malzeme kartları ve hareketler (giriş, kullanım, sayım, fire)
--
--   * Stok miktarı hiçbir zaman elle yazılmaz; hareketlerin toplamıdır.
--   * Hareketler değiştirilemez/silinemez; hata sayım düzeltmesiyle giderilir.
--   * Miktarlar malzemenin temel birimindedir (adet, karpül, ml…), tam sayı.
--   * Parti takibi açık malzemelerde (anestezik, dolgu, implant varsayılan) giriş
--     parti no + son kullanma tarihi ister; kullanım/fire bir partiden düşülür.
--   * Stok eksiye düşemez (veritabanı denetler, eşzamanlı işlemlerde de).
--   * Maliyet (alış fiyatı) ayrı tabloda; yalnızca sahip/yönetici görür.
--   * Stok listesi hasta verisi değildir; implant–hasta bağlantısı sonraki aşamada.
-- =============================================================================

create type public.stock_category as enum
  ('sarf', 'anestezik', 'dolgu', 'implant', 'frez_alet', 'sterilizasyon', 'ortodonti', 'diger');
create type public.stock_movement_kind as enum ('giris', 'kullanim', 'sayim', 'fire');

insert into public.role_permissions (role, permission)
select r.role::public.clinic_role, p.permission
from (values
  ('sahip',         array['stok.oku', 'stok.giris', 'stok.kullanim', 'stok.yonet', 'stok.maliyet']),
  ('yonetici',      array['stok.oku', 'stok.giris', 'stok.kullanim', 'stok.yonet', 'stok.maliyet']),
  ('hekim',         array['stok.oku', 'stok.kullanim']),
  ('resepsiyonist', array['stok.oku', 'stok.giris']),
  ('asistan',       array['stok.oku', 'stok.kullanim'])
) as r(role, perms)
cross join lateral unnest(r.perms) as p(permission);

create table public.stock_items (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references public.clinics (id),
  name        text not null check (length(trim(name)) > 0),
  category    public.stock_category not null default 'sarf',
  -- Temel birim (stok bu birimle tutulur): adet, karpül, ml, paket…
  unit        text not null default 'adet' check (length(trim(unit)) > 0),
  -- Paket: "kutu" = 100 adet gibi (girişte kolaylık)
  pack_name   text,
  pack_size   integer not null default 1 check (pack_size >= 1),
  min_level   integer not null default 0 check (min_level >= 0),
  track_lots  boolean not null default false,
  supplier    text,
  barcode     text,
  active      boolean not null default true,
  updated_by  uuid references auth.users (id) default auth.uid(),
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (clinic_id, id),
  unique (clinic_id, name)
);

create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid not null,
  item_id          uuid not null,
  kind             public.stock_movement_kind not null,
  -- İşaretli değişim: giriş +, kullanım/fire −, sayım ± (sayımda tetikleyici hesaplar)
  quantity         integer not null,
  -- Sayımda rafta sayılan miktar (bilgi)
  counted_quantity integer check (counted_quantity is null or counted_quantity >= 0),
  lot_no           text,
  expiry_date      date,
  note             text,
  created_by       uuid references auth.users (id) default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (clinic_id, id),
  foreign key (clinic_id, item_id) references public.stock_items (clinic_id, id)
);
create index stock_movements_item_idx on public.stock_movements (item_id, created_at desc);
create index stock_movements_lot_idx on public.stock_movements (item_id, lot_no);

-- Maliyet: yalnızca sahip/yönetici
create table public.stock_costs (
  movement_id  uuid primary key,
  clinic_id    uuid not null,
  unit_cost    integer not null check (unit_cost >= 0), -- kuruş, temel birim başına
  foreign key (clinic_id, movement_id) references public.stock_movements (clinic_id, id)
);

-- Mevcut stok ve partiler (alttaki RLS geçerli)
create view public.stock_levels with (security_invoker = true) as
select i.id as item_id, i.clinic_id,
       coalesce((select sum(m.quantity) from public.stock_movements m where m.item_id = i.id), 0)::integer as quantity
from public.stock_items i;

create view public.stock_lots with (security_invoker = true) as
select m.clinic_id, m.item_id, m.lot_no, max(m.expiry_date) as expiry_date, sum(m.quantity)::integer as quantity
from public.stock_movements m
where m.lot_no is not null
group by m.clinic_id, m.item_id, m.lot_no;

-- Hareket kuralları ------------------------------------------------------------
create function private.stock_movement_rules()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_item     public.stock_items%rowtype;
  v_current  integer;
  v_lot_qty  integer;
  v_lot_exp  date;
begin
  -- Aynı malzemeye eşzamanlı hareketleri sıraya sok (stok eksiye düşmesin)
  select * into v_item from public.stock_items
   where id = new.item_id and clinic_id = new.clinic_id for update;
  if not found then
    raise exception 'Malzeme bulunamadı.' using errcode = '23514';
  end if;
  if not v_item.active and new.kind <> 'sayim' then
    raise exception 'Malzeme kullanımdan kaldırılmış.' using errcode = '23514';
  end if;

  new.lot_no := nullif(trim(coalesce(new.lot_no, '')), '');
  new.note := nullif(trim(coalesce(new.note, '')), '');

  if new.kind = 'giris' then
    if new.quantity <= 0 then
      raise exception 'Giriş miktarı sıfırdan büyük olmalı.' using errcode = '23514';
    end if;
    if v_item.track_lots and (new.lot_no is null or new.expiry_date is null) then
      raise exception 'Bu malzemede parti no ve son kullanma tarihi zorunlu.' using errcode = '23514';
    end if;
  elsif new.kind in ('kullanim', 'fire') then
    if new.quantity >= 0 then
      raise exception 'Kullanım/fire miktarı eksi olmalı.' using errcode = '23514';
    end if;
    if new.kind = 'fire' and new.note is null then
      raise exception 'Fire/imha için sebep yazın.' using errcode = '23514';
    end if;
    if v_item.track_lots and new.lot_no is null then
      raise exception 'Hangi partiden düşüleceğini seçin.' using errcode = '23514';
    end if;
  elsif new.kind = 'sayim' then
    if new.counted_quantity is null then
      raise exception 'Sayılan miktarı girin.' using errcode = '23514';
    end if;
    if new.note is null then
      raise exception 'Sayım farkı için açıklama yazın.' using errcode = '23514';
    end if;
    if v_item.track_lots and new.lot_no is null then
      raise exception 'Parti takipli malzemede sayım parti bazında yapılır.' using errcode = '23514';
    end if;
  end if;

  -- Mevcut miktar (parti takipliyse parti bazında)
  if new.lot_no is not null and new.kind <> 'giris' then
    select coalesce(sum(quantity), 0), max(expiry_date) into v_lot_qty, v_lot_exp
      from public.stock_movements where item_id = new.item_id and lot_no = new.lot_no;
    v_current := v_lot_qty;
    new.expiry_date := coalesce(new.expiry_date, v_lot_exp);
  else
    select coalesce(sum(quantity), 0) into v_current
      from public.stock_movements where item_id = new.item_id;
  end if;

  if new.kind = 'sayim' then
    new.quantity := new.counted_quantity - v_current;
    if new.quantity = 0 then
      raise exception 'Sayım sistemdeki miktarla aynı; düzeltme gerekmiyor.' using errcode = '23514';
    end if;
  elsif v_current + new.quantity < 0 then
    raise exception 'Stokta yeterli miktar yok (mevcut: % %).', v_current, v_item.unit using errcode = '23514';
  end if;

  new.created_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;
create trigger stock_movements_rules before insert on public.stock_movements
  for each row execute function private.stock_movement_rules();

create function private.stock_item_touch()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
create trigger stock_items_touch before update on public.stock_items
  for each row execute function private.stock_item_touch();

do $$
declare t text;
begin
  foreach t in array array['stock_items', 'stock_movements', 'stock_costs'] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function private.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

-- Yetkiler --------------------------------------------------------------------
grant select on public.stock_items, public.stock_movements, public.stock_costs,
               public.stock_levels, public.stock_lots to authenticated;
grant insert (clinic_id, name, category, unit, pack_name, pack_size, min_level, track_lots, supplier, barcode),
      update (name, category, unit, pack_name, pack_size, min_level, track_lots, supplier, barcode, active)
  on public.stock_items to authenticated;
grant insert (clinic_id, item_id, kind, quantity, counted_quantity, lot_no, expiry_date, note)
  on public.stock_movements to authenticated;
grant insert (movement_id, clinic_id, unit_cost) on public.stock_costs to authenticated;
-- Hareketler ve maliyetler değiştirilemez/silinemez (update/delete yetkisi yok).

alter table public.stock_items     enable row level security;
alter table public.stock_movements enable row level security;
alter table public.stock_costs     enable row level security;

create policy "stok okuma" on public.stock_items for select to authenticated
  using (clinic_id in (select private.clinics_with('stok.oku')));
create policy "stok kart ekleme" on public.stock_items for insert to authenticated
  with check (clinic_id in (select private.clinics_with('stok.yonet')));
create policy "stok kart guncelleme" on public.stock_items for update to authenticated
  using (clinic_id in (select private.clinics_with('stok.yonet')))
  with check (clinic_id in (select private.clinics_with('stok.yonet')));

create policy "stok hareket okuma" on public.stock_movements for select to authenticated
  using (clinic_id in (select private.clinics_with('stok.oku')));
create policy "stok hareket ekleme" on public.stock_movements for insert to authenticated
  with check (
    (kind = 'giris' and clinic_id in (select private.clinics_with('stok.giris')))
    or (kind in ('kullanim', 'fire', 'sayim') and clinic_id in (select private.clinics_with('stok.kullanim')))
  );

create policy "stok maliyet okuma" on public.stock_costs for select to authenticated
  using (clinic_id in (select private.clinics_with('stok.maliyet')));
create policy "stok maliyet ekleme" on public.stock_costs for insert to authenticated
  with check (clinic_id in (select private.clinics_with('stok.maliyet')));

revoke execute on all functions in schema private from public, anon;
grant execute on function private.clinics_with(text) to authenticated;
grant execute on function private.has_permission(uuid, text) to authenticated;
grant execute on function private.can_manage_role(uuid, public.clinic_role) to authenticated;
grant execute on function private.member_has_role(uuid, public.clinic_role) to authenticated;
