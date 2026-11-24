/**
 * Tedavi maliyetleri: laboratuvar giderleri, seans malzemesinin tedaviye bağlanması ve
 * plan kârlılığı (gelir − laboratuvar − malzeme − hekim primi).
 * Kârlılığı yalnızca "maliyet.oku" görür; gider girme "maliyet.yaz".
 */

import { unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';

export type Currency = 'TRY' | 'USD' | 'EUR';
export const currencyLabels: Record<Currency, string> = { TRY: '₺ TL', USD: '$ USD', EUR: '€ EUR' };

export type Lab = { id: string; name: string };

export type TreatmentExpense = {
  id: string;
  treatmentId: string;
  labName?: string;
  description?: string;
  currency: Currency;
  amountOriginal: number;
  rate: number;
  /** TL karşılığı (kuruş) */
  amount: number;
  createdByName?: string;
  createdAt: string;
};

export type ProfitRow = {
  treatmentId: string;
  procedure: string;
  tooth?: string;
  revenue: number;
  lab: number;
  material: number;
  commission: number;
  commissionRate: number;
  profit: number;
  /** Malzemenin alış fiyatı girilmemiş (maliyet eksik olabilir) */
  materialUnpriced: boolean;
};

/** 5000 USD-cent → "$50,00" */
export function formatMoney(minor: number, currency: Currency) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export const costRepository = {
  async listLabs(clinicId: string): Promise<Lab[]> {
    const rows = unwrap(
      await supabase
        .from('labs')
        .select('id, name')
        .eq('clinic_id', clinicId)
        .eq('active', true)
        .order('name'),
      'Laboratuvarlar yüklenemedi.',
    );
    return rows;
  },

  async listExpenses(treatmentIds: string[]): Promise<TreatmentExpense[]> {
    if (treatmentIds.length === 0) return [];
    const rows = unwrap(
      await supabase
        .from('treatment_expenses')
        .select(
          'id, treatment_id, description, currency, amount_original, rate, amount, created_by_name, created_at, labs(name)',
        )
        .in('treatment_id', treatmentIds)
        .is('cancelled_at', null)
        .order('created_at'),
      'Giderler yüklenemedi.',
    );
    return rows.map((r) => ({
      id: r.id,
      treatmentId: r.treatment_id,
      labName: r.labs?.name ?? undefined,
      description: r.description ?? undefined,
      currency: r.currency as Currency,
      amountOriginal: r.amount_original,
      rate: Number(r.rate),
      amount: r.amount,
      createdByName: r.created_by_name ?? undefined,
      createdAt: r.created_at,
    }));
  },

  async addExpense(input: {
    treatmentId: string;
    labId?: string;
    labName?: string;
    description?: string;
    currency: Currency;
    amountOriginal: number;
    rate?: number;
  }) {
    const { error } = await supabase.rpc('add_treatment_expense', {
      p_treatment: input.treatmentId,
      // Boş değer de açıkça gönderilmeli; yoksa veritabanı fonksiyonu eşleşmez
      p_lab: (input.labId ?? null) as string,
      p_lab_name: input.labName ?? '',
      p_description: input.description ?? '',
      p_currency: input.currency,
      p_amount_original: input.amountOriginal,
      p_rate: (input.rate ?? 1) as number,
    });
    if (error) throw new Error(error.message || 'Gider kaydedilemedi.');
  },

  async cancelExpense(id: string, reason: string) {
    const { error } = await supabase.rpc('cancel_treatment_expense', {
      p_expense: id,
      p_reason: reason,
    });
    if (error) throw new Error(error.message || 'Gider iptal edilemedi.');
  },

  async planProfitability(planId: string): Promise<ProfitRow[]> {
    const { data, error } = await supabase.rpc('plan_profitability', { p_plan: planId });
    if (error) throw new Error(error.message || 'Kârlılık hesaplanamadı.');
    return (data ?? []).map((r) => ({
      treatmentId: r.treatment_id,
      procedure: r.procedure,
      tooth: r.tooth ?? undefined,
      revenue: Number(r.revenue),
      lab: Number(r.lab),
      material: Number(r.material),
      commission: Number(r.commission),
      commissionRate: Number(r.commission_rate),
      profit: Number(r.profit),
      materialUnpriced: r.material_unpriced,
    }));
  },

  /** Seansta kullanılan malzemeleri o seansta yapılan tedavilere bağlar */
  async linkVisitMaterials(
    appointmentId: string,
    links: { itemId: string; treatmentId: string }[],
  ) {
    if (links.length === 0) return;
    const { error } = await supabase.rpc('link_visit_materials', {
      p_appointment: appointmentId,
      p_links: links.map((l) => ({ item_id: l.itemId, treatment_id: l.treatmentId })),
    });
    if (error) throw new Error(error.message || 'Malzemeler tedaviye bağlanamadı.');
  },
};

/** Laboratuvar faturasına eklenebilecek iş */
export type LabCandidate = {
  treatmentId: string;
  day: string;
  status: string;
  procedure: string;
  kind: string;
  tooth?: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  /** Bu işe daha önce yazılmış gider (TL, kuruş) */
  expensed: number;
};

export type LabStatement = {
  id: string;
  labName: string;
  periodStart: string;
  periodEnd: string;
  invoiceNo?: string;
  invoiceDate: string;
  currency: Currency;
  rate: number;
  totalOriginal: number;
  itemCount: number;
  itemsTotal: number;
  note?: string;
  createdByName?: string;
};

export type ExpenseRow = {
  kind: 'laboratuvar' | 'stok';
  day: string;
  label: string;
  detail: string;
  doctorName?: string;
  amount: number;
  ref: string;
};

export const labRepository = {
  async candidates(clinicId: string, from: string, to: string): Promise<LabCandidate[]> {
    const { data, error } = await supabase.rpc('lab_candidates', {
      p_clinic: clinicId,
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message || 'İşler yüklenemedi.');
    return (data ?? []).map((r) => ({
      treatmentId: r.treatment_id,
      day: r.performed_on,
      status: r.status,
      procedure: r.procedure,
      kind: r.kind,
      tooth: r.tooth ?? undefined,
      patientName: r.patient_name,
      doctorId: r.doctor_member_id,
      doctorName: r.doctor_name,
      expensed: Number(r.expensed),
    }));
  },

  async statements(clinicId: string): Promise<LabStatement[]> {
    const rows = unwrap(
      await supabase
        .from('lab_statements')
        .select(
          'id, period_start, period_end, invoice_no, invoice_date, currency, rate, total_original, note, created_by_name, labs(name), treatment_expenses(amount_original, cancelled_at)',
        )
        .eq('clinic_id', clinicId)
        .is('cancelled_at', null)
        .order('invoice_date', { ascending: false }),
      'Laboratuvar faturaları yüklenemedi.',
    );
    return rows.map((r) => {
      const items = (r.treatment_expenses ?? []).filter((e) => !e.cancelled_at);
      return {
        id: r.id,
        labName: r.labs?.name ?? 'Laboratuvar',
        periodStart: r.period_start,
        periodEnd: r.period_end,
        invoiceNo: r.invoice_no ?? undefined,
        invoiceDate: r.invoice_date,
        currency: r.currency as Currency,
        rate: Number(r.rate),
        totalOriginal: r.total_original,
        itemCount: items.length,
        itemsTotal: items.reduce((s, e) => s + e.amount_original, 0),
        note: r.note ?? undefined,
        createdByName: r.created_by_name ?? undefined,
      };
    });
  },

  async create(input: {
    clinicId: string;
    labId?: string;
    labName?: string;
    from: string;
    to: string;
    invoiceNo?: string;
    invoiceDate: string;
    currency: Currency;
    rate: number;
    total: number;
    note?: string;
    items: { treatmentId: string; amount: number; description?: string }[];
  }) {
    const { error } = await supabase.rpc('create_lab_statement', {
      p_clinic: input.clinicId,
      p_lab: (input.labId ?? null) as string,
      p_lab_name: input.labName ?? '',
      p_from: input.from,
      p_to: input.to,
      p_invoice_no: input.invoiceNo ?? '',
      p_invoice_date: input.invoiceDate,
      p_currency: input.currency,
      p_rate: input.rate,
      p_total: input.total,
      p_note: input.note ?? '',
      p_items: input.items.map((i) => ({
        treatment_id: i.treatmentId,
        amount: i.amount,
        description: i.description ?? '',
      })),
    });
    if (error) throw new Error(error.message || 'Fatura kaydedilemedi.');
  },

  async cancel(id: string, reason: string) {
    const { error } = await supabase.rpc('cancel_lab_statement', {
      p_statement: id,
      p_reason: reason,
    });
    if (error) throw new Error(error.message || 'Fatura iptal edilemedi.');
  },

  async expenses(clinicId: string, from: string, to: string): Promise<ExpenseRow[]> {
    const { data, error } = await supabase.rpc('report_expenses', {
      p_clinic: clinicId,
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message || 'Giderler yüklenemedi.');
    return (data ?? []).map((r) => ({
      kind: r.kind as ExpenseRow['kind'],
      day: r.day,
      label: r.label,
      detail: r.detail,
      doctorName: r.doctor_name ?? undefined,
      amount: Number(r.amount),
      ref: r.ref,
    }));
  },
};

/** Marj yüzdesi (gelir 0 ise null) */
export function marginPct(revenue: number, profit: number) {
  return revenue > 0 ? (profit / revenue) * 100 : null;
}
