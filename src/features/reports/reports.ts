/**
 * Raporlar: veri erişimi ve tarih aralığı yardımcıları.
 * Hesaplar veritabanı fonksiyonlarında yapılır; her fonksiyon yetkiyi kendisi denetler
 * (sahip/yönetici: tümü; hekim: yalnızca kendi tedavileri ve primi).
 */

import { useCallback } from 'react';

import type { PaymentMethod } from '@/features/payments/payments';
import { useClinicSession } from '@/features/session/session-context';
import { addDays, fromDateKey, startOfWeek, todayKey } from '@/lib/dates';
import { toAppError } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

// ----------------------------------------------------------------------------
// Tarih aralığı
// ----------------------------------------------------------------------------
export type DateRange = { from: string; to: string };

export type RangePreset =
  'bugun' | 'dun' | 'bu_hafta' | 'gecen_hafta' | 'bu_ay' | 'gecen_ay' | 'son7' | 'son30' | 'bu_yil';

export const presetLabels: Record<RangePreset, string> = {
  bugun: 'Bugün',
  dun: 'Dün',
  bu_hafta: 'Bu Hafta',
  gecen_hafta: 'Geçen Hafta',
  bu_ay: 'Bu Ay',
  gecen_ay: 'Geçen Ay',
  son7: 'Son 7 Gün',
  son30: 'Son 30 Gün',
  bu_yil: 'Bu Yıl',
};

export const PRESET_ORDER: RangePreset[] = [
  'bugun',
  'dun',
  'bu_hafta',
  'gecen_hafta',
  'bu_ay',
  'gecen_ay',
  'son7',
  'son30',
  'bu_yil',
];

export function presetRange(p: RangePreset, today = todayKey()): DateRange {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (p) {
    case 'bugun':
      return { from: today, to: today };
    case 'dun':
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case 'bu_hafta':
      return { from: startOfWeek(today), to: today };
    case 'gecen_hafta': {
      const s = addDays(startOfWeek(today), -7);
      return { from: s, to: addDays(s, 6) };
    }
    case 'bu_ay':
      return { from: monthStart, to: today };
    case 'gecen_ay': {
      const last = addDays(monthStart, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
    case 'son7':
      return { from: addDays(today, -6), to: today };
    case 'son30':
      return { from: addDays(today, -29), to: today };
    case 'bu_yil':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

export function matchPreset(r: DateRange): RangePreset | null {
  return (
    PRESET_ORDER.find((p) => {
      const x = presetRange(p);
      return x.from === r.from && x.to === r.to;
    }) ?? null
  );
}

const short = (key: string, withYear: boolean) =>
  fromDateKey(key).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });

/** "20 Eki - 20 Kas, 2026" */
export function rangeLabel(r: DateRange) {
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  return sameYear
    ? `${short(r.from, false)} - ${short(r.to, false)}, ${r.to.slice(0, 4)}`
    : `${short(r.from, true)} - ${short(r.to, true)}`;
}

/** "20 Kas 2026 - 20 Kas 2026" ve gün sayısı */
export function rangeLong(r: DateRange) {
  return `${short(r.from, true)} - ${short(r.to, true)}`;
}

export function rangeDays(r: DateRange) {
  return Math.round((fromDateKey(r.to).getTime() - fromDateKey(r.from).getTime()) / 864e5) + 1;
}

// ----------------------------------------------------------------------------
// Veri
// ----------------------------------------------------------------------------
export type PaymentRow = {
  id: string;
  paidOn: string;
  createdAt: string;
  amount: number;
  method: PaymentMethod;
  patientId: string;
  patientName: string;
  receivedByName: string;
};

export type CompletedTreatment = {
  id: string;
  doneOn: string;
  completedAt?: string;
  procedure: string;
  tooth?: string;
  doctorId: string;
  doctorName: string;
  patientId: string;
  patientName: string;
  amount: number;
};

export type CommissionBasis = 'odeme_tedavi' | 'tedavi' | 'nakit';

export const basisInfo: Record<CommissionBasis, { title: string; hint: string }> = {
  odeme_tedavi: {
    title: 'Ödeme ve Tedavi Bazlı Hakediş',
    hint: 'Tamamlanan tedavinin hastanın ödediği kısmı × prim oranı. Ödenmemiş kısmın primi bekleyen olarak görünür.',
  },
  tedavi: {
    title: 'Tedavi Bazlı Hakediş',
    hint: 'Dönemde tamamlanan tedavinin ücreti × prim oranı (ödeme beklenmez).',
  },
  nakit: {
    title: 'Nakit (Gelir) Bazlı Hakediş',
    hint: 'Dönemde alınan ödemeler, hastanın tedavilerindeki hekim payına göre bölünür × prim oranı.',
  },
};

export type CommissionItem = {
  doctorId: string;
  doctorName: string;
  rate: number;
  patientId: string;
  patientName: string;
  label: string;
  tooth?: string;
  date: string;
  amount: number;
  paidAmount: number;
  prim: number;
  primPending: number;
};

/** Yarım kalan tedavi planı (uygulanan planda tamamlanmamış işlem var) */
export type UnfinishedPlan = {
  planId: string;
  planTitle: string;
  planCreatedAt: string;
  locked: boolean;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  doctorId: string;
  doctorName: string;
  totalItems: number;
  doneItems: number;
  startedItems: number;
  totalAmount: number;
  doneAmount: number;
  kinds: string[];
  lastDoneAt?: string;
  nextAppointment?: string;
};

export const reportsRepository = {
  async unfinishedPlans(clinicId: string, r: DateRange): Promise<UnfinishedPlan[]> {
    const { data, error } = await supabase.rpc('report_unfinished_plans', {
      p_clinic: clinicId,
      p_from: r.from,
      p_to: r.to,
    });
    if (error) throw toAppError(error, 'Rapor yüklenemedi.');
    return (data ?? []).map((x) => ({
      planId: x.plan_id,
      planTitle: x.plan_title,
      planCreatedAt: x.plan_created_at,
      locked: x.locked,
      patientId: x.patient_id,
      patientName: x.patient_name,
      patientPhone: x.patient_phone ?? undefined,
      doctorId: x.doctor_member_id,
      doctorName: x.doctor_name,
      totalItems: x.total_items,
      doneItems: x.done_items,
      startedItems: x.started_items,
      totalAmount: Number(x.total_amount),
      doneAmount: Number(x.done_amount),
      kinds: x.kinds ?? [],
      lastDoneAt: x.last_done_at ?? undefined,
      nextAppointment: x.next_appointment ?? undefined,
    }));
  },

  async payments(clinicId: string, r: DateRange): Promise<PaymentRow[]> {
    const { data, error } = await supabase.rpc('report_payments', {
      p_clinic: clinicId,
      p_from: r.from,
      p_to: r.to,
    });
    if (error) throw toAppError(error, 'Rapor yüklenemedi.');
    return (data ?? []).map((x) => ({
      id: x.id,
      paidOn: x.paid_on,
      createdAt: x.created_at,
      amount: x.amount,
      method: x.method,
      patientId: x.patient_id,
      patientName: x.patient_name,
      receivedByName: x.received_by_name,
    }));
  },

  async completedTreatments(clinicId: string, r: DateRange): Promise<CompletedTreatment[]> {
    const { data, error } = await supabase.rpc('report_completed_treatments', {
      p_clinic: clinicId,
      p_from: r.from,
      p_to: r.to,
    });
    if (error) throw toAppError(error, 'Rapor yüklenemedi.');
    return (data ?? []).map((x) => ({
      id: x.treatment_id,
      doneOn: x.done_on,
      completedAt: x.completed_at ?? undefined,
      procedure: x.procedure,
      tooth: x.tooth ?? undefined,
      doctorId: x.doctor_member_id,
      doctorName: x.doctor_name,
      patientId: x.patient_id,
      patientName: x.patient_name,
      amount: Number(x.amount),
    }));
  },

  async commissionItems(
    clinicId: string,
    r: DateRange,
    basis: CommissionBasis,
  ): Promise<CommissionItem[]> {
    const { data, error } = await supabase.rpc('report_commission_items', {
      p_clinic: clinicId,
      p_from: r.from,
      p_to: r.to,
      p_basis: basis,
    });
    if (error) throw toAppError(error, 'Rapor yüklenemedi.');
    return (data ?? []).map((x) => ({
      doctorId: x.doctor_member_id,
      doctorName: x.doctor_name,
      rate: Number(x.rate),
      patientId: x.patient_id,
      patientName: x.patient_name,
      label: x.label,
      tooth: x.tooth ?? undefined,
      date: x.item_date,
      amount: Number(x.amount),
      paidAmount: Number(x.paid_amount),
      prim: Number(x.prim),
      primPending: Number(x.prim_pending),
    }));
  },

  async rates(clinicId: string): Promise<Map<string, number>> {
    const { data, error } = await supabase
      .from('doctor_commissions')
      .select('member_id, rate')
      .eq('clinic_id', clinicId);
    if (error) throw toAppError(error, 'Prim oranları yüklenemedi.');
    return new Map((data ?? []).map((r) => [r.member_id, Number(r.rate)]));
  },

  async setRate(memberId: string, rate: number) {
    const { error } = await supabase.rpc('set_commission_rate', {
      p_member: memberId,
      p_rate: rate,
    });
    if (error) throw toAppError(error, 'Prim oranı kaydedilemedi.');
  },
};

export function useReport<T>(
  fetcher: (clinicId: string, r: DateRange) => Promise<T[]>,
  range: DateRange,
) {
  const { clinic } = useClinicSession();
  const load = useCallback(() => fetcher(clinic.id, range), [fetcher, clinic.id, range]);
  return useFocusLoad<T[]>(load, [], 'Rapor yüklenemedi.');
}

export function useCommissionRates(enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () =>
      enabled ? reportsRepository.rates(clinic.id) : Promise.resolve(new Map<string, number>()),
    [clinic.id, enabled],
  );
  return useFocusLoad<Map<string, number>>(load, new Map(), 'Prim oranları yüklenemedi.');
}
