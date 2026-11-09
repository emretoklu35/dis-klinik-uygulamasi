/**
 * Ödemeler: fiyat listesi, borç kalemleri, tahsilatlar ve değişiklik geçmişi (Supabase).
 * Tutarlar kuruş cinsinden. Kayıtlar silinmez; yalnızca sahip sebebiyle iptal eder.
 */

import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import type { Database } from '@/lib/database.types';
import { toAppError, unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

export type PaymentMethod = Database['public']['Enums']['payment_method'];

export const methodLabels: Record<PaymentMethod, string> = {
  nakit: 'Nakit',
  kredi_karti: 'Kredi kartı',
  havale: 'Havale/EFT',
  diger: 'Diğer',
};

export type Cancellation = { at: string; byName: string; reason: string };

export type PriceItem = {
  id: string;
  name: string;
  amount: number;
  active: boolean;
  updatedByName?: string;
  updatedAt: string;
};

export type AmountChange = {
  oldAmount: number;
  newAmount: number;
  note?: string;
  changedByName: string;
  changedAt: string;
};

export type Charge = {
  id: string;
  description: string;
  tooth?: string;
  listAmount?: number;
  amount: number;
  adjustNote?: string;
  createdByName: string;
  createdAt: string;
  cancelled: Cancellation | null;
  changes: AmountChange[];
};

export type Payment = {
  id: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  note?: string;
  receivedByName: string;
  createdAt: string;
  cancelled: Cancellation | null;
};

export type PatientAccount = {
  charges: Charge[];
  payments: Payment[];
  totalCharged: number;
  totalPaid: number;
  remaining: number;
};

/** user_id → görünen ad (kim ekledi/değiştirdi göstermek için) */
async function memberNames(clinicId: string) {
  const { data } = await supabase
    .from('clinic_members')
    .select('user_id, display_name')
    .eq('clinic_id', clinicId);
  const map = new Map((data ?? []).map((m) => [m.user_id, m.display_name]));
  return (id: string | null) =>
    id ? (map.get(id) ?? 'Bilinmeyen kullanıcı') : 'Sistem (demo verisi)';
}

function cancellation(
  r: { cancelled_at: string | null; cancelled_by: string | null; cancel_reason: string | null },
  name: (id: string | null) => string,
): Cancellation | null {
  return r.cancelled_at
    ? { at: r.cancelled_at, byName: name(r.cancelled_by), reason: r.cancel_reason ?? '' }
    : null;
}

export const paymentRepository = {
  // ---------------- Fiyat listesi ----------------
  async listPriceItems(clinicId: string): Promise<PriceItem[]> {
    const [rows, name] = await Promise.all([
      supabase
        .from('price_list_items')
        .select('id, name, amount, active, updated_by, updated_at')
        .eq('clinic_id', clinicId)
        .order('name'),
      memberNames(clinicId),
    ]);
    return unwrap(rows, 'Fiyat listesi yüklenemedi.').map((r) => ({
      id: r.id,
      name: r.name,
      amount: r.amount,
      active: r.active,
      updatedByName: r.updated_by ? name(r.updated_by) : undefined,
      updatedAt: r.updated_at,
    }));
  },

  async priceHistory(clinicId: string, itemId: string): Promise<AmountChange[]> {
    const [rows, name] = await Promise.all([
      supabase
        .from('price_changes')
        .select('old_amount, new_amount, note, changed_by, changed_at')
        .eq('item_id', itemId)
        .order('changed_at', { ascending: false }),
      memberNames(clinicId),
    ]);
    return unwrap(rows, 'Fiyat geçmişi yüklenemedi.').map((r) => ({
      oldAmount: r.old_amount,
      newAmount: r.new_amount,
      note: r.note ?? undefined,
      changedByName: name(r.changed_by),
      changedAt: r.changed_at,
    }));
  },

  async createPriceItem(clinicId: string, name: string, amount: number) {
    unwrap(
      await supabase
        .from('price_list_items')
        .insert({ clinic_id: clinicId, name, amount })
        .select('id')
        .single(),
      'Fiyat kalemi eklenemedi.',
    );
  },

  async updatePriceItem(id: string, changes: { amount?: number; active?: boolean; note?: string }) {
    unwrap(
      await supabase
        .from('price_list_items')
        .update({
          ...(changes.amount !== undefined ? { amount: changes.amount } : {}),
          ...(changes.active !== undefined ? { active: changes.active } : {}),
          change_note: changes.note ?? null,
        })
        .eq('id', id)
        .select('id')
        .single(),
      'Fiyat güncellenemedi.',
    );
  },

  // ---------------- Hasta hesabı ----------------
  async getAccount(clinicId: string, patientId: string): Promise<PatientAccount> {
    const [chargeRows, paymentRows, name] = await Promise.all([
      supabase
        .from('patient_charges')
        .select(
          'id, description, tooth, list_amount, amount, adjust_note, created_by, created_at, cancelled_at, cancelled_by, cancel_reason',
        )
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('patient_payments')
        .select(
          'id, amount, method, paid_on, note, received_by, created_at, cancelled_at, cancelled_by, cancel_reason',
        )
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false }),
      memberNames(clinicId),
    ]);
    const chargesRaw = unwrap(chargeRows, 'Borç kalemleri yüklenemedi.');
    const paymentsRaw = unwrap(paymentRows, 'Tahsilatlar yüklenemedi.');

    const changesByCharge = new Map<string, AmountChange[]>();
    if (chargesRaw.length) {
      const changes = unwrap(
        await supabase
          .from('charge_changes')
          .select('charge_id, old_amount, new_amount, note, changed_by, changed_at')
          .in(
            'charge_id',
            chargesRaw.map((c) => c.id),
          )
          .order('changed_at', { ascending: false }),
        'Değişiklik geçmişi yüklenemedi.',
      );
      for (const c of changes) {
        const list = changesByCharge.get(c.charge_id) ?? [];
        list.push({
          oldAmount: c.old_amount,
          newAmount: c.new_amount,
          note: c.note,
          changedByName: name(c.changed_by),
          changedAt: c.changed_at,
        });
        changesByCharge.set(c.charge_id, list);
      }
    }

    const charges: Charge[] = chargesRaw.map((c) => ({
      id: c.id,
      description: c.description,
      tooth: c.tooth ?? undefined,
      listAmount: c.list_amount ?? undefined,
      amount: c.amount,
      adjustNote: c.adjust_note ?? undefined,
      createdByName: name(c.created_by),
      createdAt: c.created_at,
      cancelled: cancellation(c, name),
      changes: changesByCharge.get(c.id) ?? [],
    }));
    const payments: Payment[] = paymentsRaw.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paidOn: p.paid_on,
      note: p.note ?? undefined,
      receivedByName: name(p.received_by),
      createdAt: p.created_at,
      cancelled: cancellation(p, name),
    }));

    const totalCharged = charges.filter((c) => !c.cancelled).reduce((s, c) => s + c.amount, 0);
    const totalPaid = payments.filter((p) => !p.cancelled).reduce((s, p) => s + p.amount, 0);
    return { charges, payments, totalCharged, totalPaid, remaining: totalCharged - totalPaid };
  },

  async addCharge(
    clinicId: string,
    patientId: string,
    input: {
      priceItemId?: string;
      description: string;
      tooth?: string;
      amount: number;
      adjustNote?: string;
    },
  ) {
    unwrap(
      await supabase
        .from('patient_charges')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          price_item_id: input.priceItemId ?? null,
          description: input.description,
          tooth: input.tooth ?? null,
          amount: input.amount,
          adjust_note: input.adjustNote ?? null,
        })
        .select('id')
        .single(),
      'Borç kalemi eklenemedi.',
    );
  },

  async changeChargeAmount(id: string, amount: number, note: string) {
    unwrap(
      await supabase
        .from('patient_charges')
        .update({ amount, change_note: note })
        .eq('id', id)
        .select('id')
        .single(),
      'Tutar değiştirilemedi.',
    );
  },

  async addPayment(
    clinicId: string,
    patientId: string,
    input: { amount: number; method: PaymentMethod; paidOn: string; note?: string },
  ) {
    unwrap(
      await supabase
        .from('patient_payments')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          amount: input.amount,
          method: input.method,
          paid_on: input.paidOn,
          note: input.note ?? null,
        })
        .select('id')
        .single(),
      'Tahsilat kaydedilemedi.',
    );
  },

  async cancel(kind: 'charge' | 'payment', id: string, reason: string) {
    const table = kind === 'charge' ? 'patient_charges' : 'patient_payments';
    const { data, error } = await supabase
      .from(table)
      .update({ cancelled_at: new Date().toISOString(), cancel_reason: reason })
      .eq('id', id)
      .select('id');
    if (error) throw toAppError(error, 'Kayıt iptal edilemedi.');
    if (!data?.length) throw toAppError({ code: '42501' }, 'Kayıt iptal edilemedi.');
  },
};

export function usePatientAccount(patientId: string | undefined) {
  const { clinic, can } = useClinicSession();
  const enabled = can('odeme.oku') && !!patientId;
  const load = useCallback(
    () =>
      enabled
        ? paymentRepository.getAccount(clinic.id, patientId!)
        : Promise.resolve<PatientAccount | null>(null),
    [clinic.id, patientId, enabled],
  );
  return useFocusLoad<PatientAccount | null>(load, null, 'Ödemeler yüklenemedi.');
}

export function usePriceList(enabled = true) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () =>
      enabled ? paymentRepository.listPriceItems(clinic.id) : Promise.resolve([] as PriceItem[]),
    [clinic.id, enabled],
  );
  return useFocusLoad<PriceItem[]>(load, [], 'Fiyat listesi yüklenemedi.');
}
