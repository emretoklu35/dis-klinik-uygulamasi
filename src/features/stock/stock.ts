/**
 * Stok: malzeme kartları, partiler ve hareketler (Supabase).
 * Mevcut miktar hareketlerin toplamıdır; hareketler değiştirilemez.
 */

import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import type { Database } from '@/lib/database.types';
import { addDays, todayKey } from '@/lib/dates';
import { toAppError, unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

type Enums = Database['public']['Enums'];
export type StockCategory = Enums['stock_category'];
export type MovementKind = Enums['stock_movement_kind'];

export const EXPIRY_WARNING_DAYS = 30;

export const categoryLabels: Record<StockCategory, string> = {
  sarf: 'Sarf',
  anestezik: 'Anestezik',
  dolgu: 'Dolgu malzemesi',
  implant: 'İmplant',
  frez_alet: 'Frez / alet',
  sterilizasyon: 'Sterilizasyon',
  ortodonti: 'Ortodonti',
  diger: 'Diğer',
};

export const kindLabels: Record<MovementKind, string> = {
  giris: 'Giriş',
  kullanim: 'Kullanım',
  sayim: 'Sayım düzeltmesi',
  fire: 'Fire / imha',
};

/** Parti ve son kullanma tarihi takibi varsayılan olarak zorunlu olan kategoriler */
export const LOT_TRACKED_CATEGORIES: StockCategory[] = ['anestezik', 'dolgu', 'implant'];

export type Lot = { lotNo: string; expiryDate?: string; quantity: number };

export type StockItem = {
  id: string;
  name: string;
  category: StockCategory;
  unit: string;
  packName?: string;
  packSize: number;
  minLevel: number;
  trackLots: boolean;
  supplier?: string;
  active: boolean;
  quantity: number;
  /** Elde kalan partiler, son kullanma tarihine göre (en yakın önce) */
  lots: Lot[];
  isCritical: boolean;
  /** Süresi geçmiş ya da 30 gün içinde dolacak, elde olan en yakın parti */
  expiringLot?: Lot & { expired: boolean };
};

export type Movement = {
  id: string;
  kind: MovementKind;
  quantity: number;
  countedQuantity?: number;
  lotNo?: string;
  expiryDate?: string;
  note?: string;
  createdByName: string;
  createdAt: string;
  /** Yalnızca maliyet yetkisi olanlara gelir (kuruş) */
  unitCost?: number;
};

export type NewItemInput = {
  name: string;
  category: StockCategory;
  unit: string;
  packName?: string;
  packSize: number;
  minLevel: number;
  trackLots: boolean;
  supplier?: string;
};

export type MovementInput = {
  itemId: string;
  kind: MovementKind;
  /** İşaretli: giriş +, kullanım/fire −; sayımda yok sayılır (veritabanı hesaplar) */
  quantity: number;
  countedQuantity?: number;
  lotNo?: string;
  expiryDate?: string;
  note?: string;
  /** Girişte birim maliyet (kuruş); yalnızca maliyet yetkisiyle kaydedilir */
  unitCost?: number;
};

const ITEM_FIELDS =
  'id, name, category, unit, pack_name, pack_size, min_level, track_lots, supplier, active';

async function memberNames(clinicId: string) {
  const { data } = await supabase
    .from('clinic_members')
    .select('user_id, display_name')
    .eq('clinic_id', clinicId);
  const map = new Map((data ?? []).map((m) => [m.user_id, m.display_name]));
  return (id: string | null) =>
    id ? (map.get(id) ?? 'Bilinmeyen kullanıcı') : 'Sistem (demo verisi)';
}

type ItemRow = {
  id: string;
  name: string;
  category: StockCategory;
  unit: string;
  pack_name: string | null;
  pack_size: number;
  min_level: number;
  track_lots: boolean;
  supplier: string | null;
  active: boolean;
};

function buildItem(r: ItemRow, quantity: number, lots: Lot[]): StockItem {
  const today = todayKey();
  const warnUntil = addDays(today, EXPIRY_WARNING_DAYS);
  const soon = lots.find((l) => l.expiryDate && l.expiryDate <= warnUntil);
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    unit: r.unit,
    packName: r.pack_name ?? undefined,
    packSize: r.pack_size,
    minLevel: r.min_level,
    trackLots: r.track_lots,
    supplier: r.supplier ?? undefined,
    active: r.active,
    quantity,
    lots,
    isCritical: r.active && quantity < r.min_level,
    expiringLot: soon ? { ...soon, expired: soon.expiryDate! < today } : undefined,
  };
}

export const stockRepository = {
  async listItems(clinicId: string): Promise<StockItem[]> {
    const [items, levels, lots] = await Promise.all([
      supabase.from('stock_items').select(ITEM_FIELDS).eq('clinic_id', clinicId).order('name'),
      supabase.from('stock_levels').select('item_id, quantity').eq('clinic_id', clinicId),
      supabase
        .from('stock_lots')
        .select('item_id, lot_no, expiry_date, quantity')
        .eq('clinic_id', clinicId)
        .gt('quantity', 0)
        .order('expiry_date', { ascending: true, nullsFirst: false }),
    ]);
    const qty = new Map(
      unwrap(levels, 'Stok yüklenemedi.').map((l) => [l.item_id, l.quantity ?? 0]),
    );
    const lotsByItem = new Map<string, Lot[]>();
    for (const l of unwrap(lots, 'Partiler yüklenemedi.')) {
      if (!l.item_id || !l.lot_no) continue;
      const list = lotsByItem.get(l.item_id) ?? [];
      list.push({
        lotNo: l.lot_no,
        expiryDate: l.expiry_date ?? undefined,
        quantity: l.quantity ?? 0,
      });
      lotsByItem.set(l.item_id, list);
    }
    return unwrap(items, 'Malzemeler yüklenemedi.').map((r) =>
      buildItem(r, qty.get(r.id) ?? 0, lotsByItem.get(r.id) ?? []),
    );
  },

  async getItem(clinicId: string, id: string) {
    const all = await this.listItems(clinicId);
    const item = all.find((i) => i.id === id) ?? null;
    if (!item) return null;

    const [rows, name] = await Promise.all([
      supabase
        .from('stock_movements')
        .select(
          'id, kind, quantity, counted_quantity, lot_no, expiry_date, note, created_by, created_at',
        )
        .eq('item_id', id)
        .order('created_at', { ascending: false })
        .limit(200),
      memberNames(clinicId),
    ]);
    const movementsRaw = unwrap(rows, 'Hareketler yüklenemedi.');
    // Maliyet tablosu yetkisi olmayanlar için boş döner (RLS)
    const { data: costs } = movementsRaw.length
      ? await supabase
          .from('stock_costs')
          .select('movement_id, unit_cost')
          .in(
            'movement_id',
            movementsRaw.map((m) => m.id),
          )
      : { data: [] };
    const costOf = new Map((costs ?? []).map((c) => [c.movement_id, c.unit_cost]));

    const movements: Movement[] = movementsRaw.map((m) => ({
      id: m.id,
      kind: m.kind,
      quantity: m.quantity,
      countedQuantity: m.counted_quantity ?? undefined,
      lotNo: m.lot_no ?? undefined,
      expiryDate: m.expiry_date ?? undefined,
      note: m.note ?? undefined,
      createdByName: name(m.created_by),
      createdAt: m.created_at,
      unitCost: costOf.get(m.id),
    }));
    return { item, movements };
  },

  async createItem(clinicId: string, input: NewItemInput) {
    const row = unwrap(
      await supabase
        .from('stock_items')
        .insert({
          clinic_id: clinicId,
          name: input.name,
          category: input.category,
          unit: input.unit,
          pack_name: input.packName ?? null,
          pack_size: input.packSize,
          min_level: input.minLevel,
          track_lots: input.trackLots,
          supplier: input.supplier ?? null,
        })
        .select('id')
        .single(),
      'Malzeme eklenemedi.',
    );
    return row.id;
  },

  async updateItem(
    id: string,
    changes: { minLevel?: number; supplier?: string | null; active?: boolean },
  ) {
    unwrap(
      await supabase
        .from('stock_items')
        .update({
          ...(changes.minLevel !== undefined ? { min_level: changes.minLevel } : {}),
          ...(changes.supplier !== undefined ? { supplier: changes.supplier } : {}),
          ...(changes.active !== undefined ? { active: changes.active } : {}),
        })
        .eq('id', id)
        .select('id')
        .single(),
      'Malzeme güncellenemedi.',
    );
  },

  async addMovement(clinicId: string, input: MovementInput, canCost: boolean) {
    const row = unwrap(
      await supabase
        .from('stock_movements')
        .insert({
          clinic_id: clinicId,
          item_id: input.itemId,
          kind: input.kind,
          quantity: input.kind === 'sayim' ? 0 : input.quantity,
          counted_quantity: input.countedQuantity ?? null,
          lot_no: input.lotNo ?? null,
          expiry_date: input.expiryDate ?? null,
          note: input.note ?? null,
        })
        .select('id')
        .single(),
      'Hareket kaydedilemedi.',
    );
    if (canCost && input.kind === 'giris' && input.unitCost !== undefined) {
      const { error } = await supabase
        .from('stock_costs')
        .insert({ movement_id: row.id, clinic_id: clinicId, unit_cost: input.unitCost });
      if (error) throw toAppError(error, 'Giriş kaydedildi ama maliyet kaydedilemedi.');
    }
  },
};

export function useStockItems(enabled = true) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (enabled ? stockRepository.listItems(clinic.id) : Promise.resolve([] as StockItem[])),
    [clinic.id, enabled],
  );
  return useFocusLoad<StockItem[]>(load, [], 'Stok yüklenemedi.');
}

export function useStockItem(id: string | undefined) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (id ? stockRepository.getItem(clinic.id, id) : Promise.resolve(null)),
    [clinic.id, id],
  );
  return useFocusLoad<Awaited<ReturnType<typeof stockRepository.getItem>>>(
    load,
    null,
    'Malzeme yüklenemedi.',
  );
}

/** Sipariş önerisi: kritik seviyenin 2 katına tamamla, paket varsa pakete yuvarla. */
export function suggestedOrder(item: StockItem) {
  const need = Math.max(item.minLevel * 2 - item.quantity, 0);
  if (item.packSize > 1) {
    const packs = Math.ceil(need / item.packSize);
    return { packs, units: packs * item.packSize };
  }
  return { packs: undefined, units: need };
}

export function formatQty(n: number, unit: string) {
  return `${n.toLocaleString('tr-TR')} ${unit}`;
}
