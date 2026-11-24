/**
 * Hasta veri erişim katmanı (Supabase).
 * Ekranlar yalnızca bu dosyadaki `patientRepository` üzerinden veri okur/yazar.
 * Hangi satırın görüneceğine veritabanındaki RLS kuralları karar verir.
 */

import { toClinicLocal } from '@/lib/dates';
import { unwrap, unwrapMaybe } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';

import type {
  NewPatientInput,
  Patient,
  PatientMedical,
  PatientSummary,
  TreatmentInput,
  PlanApproval,
  Signature,
  TreatmentPlan,
} from './types';
import { fullName, normalizeForSearch } from './utils';

export interface PatientRepository {
  list(clinicId: string, query?: string): Promise<PatientSummary[]>;
  /** canSeeMedical: sağlık ayrıntısı/tedavi yetkisi (yoksa bu alanlar null döner). */
  get(clinicId: string, id: string, canSeeMedical: boolean): Promise<Patient | null>;
  create(clinicId: string, input: NewPatientInput): Promise<string>;
  /** Sağlık bilgisini kaydeder (yoksa ekler). Yalnızca hekim; RLS ayrıca denetler. */
  saveMedical(clinicId: string, patientId: string, medical: PatientMedical): Promise<void>;
  /** Tedavi kaydı ekler. doctorMemberId aktif hekim olmalı (veritabanı denetler). */
  addTreatment(
    clinicId: string,
    patientId: string,
    doctorMemberId: string,
    input: TreatmentInput,
  ): Promise<void>;
  updateTreatment(id: string, input: TreatmentInput): Promise<void>;
  listPlans(patientId: string): Promise<TreatmentPlan[]>;
  /** Yeni plan; hastanın uygulanan planı yoksa bu plan uygulanır. Kimliğini döner. */
  createPlan(
    clinicId: string,
    patientId: string,
    doctorMemberId: string,
    title: string,
    activate: boolean,
  ): Promise<string>;
  renamePlan(id: string, title: string): Promise<void>;
  setActivePlan(id: string): Promise<void>;
  copyPlan(id: string, title: string): Promise<string>;
  deletePlan(id: string): Promise<void>;
  /** Hasta onayı: plan kilitlenir (fiyatlar ve işlemler değişmez) */
  lockPlan(id: string): Promise<void>;
  /** Yalnızca plan.kilit.ac yetkisi (klinik sahibi) */
  unlockPlan(id: string): Promise<void>;
  /**
   * İndirim: yüzde (0–100) ya da tutar (kuruş). ids boşsa planın tamamlanmamış ücretli tüm
   * işlemleri. Sınırı veritabanı denetler. 0 indirimi kaldırır.
   */
  applyDiscount(
    planId: string,
    treatmentIds: string[] | null,
    mode: 'yuzde' | 'tutar',
    value: number,
  ): Promise<void>;
  /** Planın imzalı onayları, en yenisi önce */
  listApprovals(planId: string): Promise<PlanApproval[]>;
  /** Hastanın imzası; plan kilitlenir. Onay kimliğini döner. */
  signPlan(planId: string, signature: Signature): Promise<string>;
}

const nn = <T>(v: T | null | undefined) => v ?? undefined;

class SupabasePatientRepository implements PatientRepository {
  async list(clinicId: string, query = '') {
    const nowIso = new Date().toISOString();
    const [patients, upcoming, past] = await Promise.all([
      supabase
        .from('patients')
        .select('id, first_name, last_name, phone, has_allergy_alert')
        .eq('clinic_id', clinicId)
        .is('archived_at', null),
      supabase
        .from('appointments')
        .select('patient_id, starts_at')
        .eq('clinic_id', clinicId)
        .in('status', ['bekliyor', 'onaylandi'])
        .gte('starts_at', nowIso)
        .order('starts_at'),
      supabase
        .from('appointments')
        .select('patient_id, starts_at')
        .eq('clinic_id', clinicId)
        .eq('status', 'tamamlandi')
        .lt('starts_at', nowIso)
        .order('starts_at', { ascending: false }),
    ]);

    const rows = unwrap(patients, 'Hastalar yüklenemedi.');
    const next = new Map<string, string>();
    for (const a of unwrap(upcoming, 'Randevular yüklenemedi.')) {
      if (a.patient_id && !next.has(a.patient_id))
        next.set(a.patient_id, toClinicLocal(a.starts_at));
    }
    const last = new Map<string, string>();
    for (const a of unwrap(past, 'Randevular yüklenemedi.')) {
      if (a.patient_id && !last.has(a.patient_id))
        last.set(a.patient_id, toClinicLocal(a.starts_at).slice(0, 10));
    }

    // Türkçe harflerde doğru eşleşme için arama uygulamada yapılır.
    // Hasta sayısı büyüdüğünde veritabanı tarafında arama ve sayfalama eklenecek.
    const q = normalizeForSearch(query);
    const digits = query.replace(/\D/g, '');
    return rows
      .map((p): PatientSummary => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        phone: p.phone,
        hasAllergyAlert: p.has_allergy_alert,
        lastVisit: last.get(p.id),
        nextAppointment: next.get(p.id),
      }))
      .filter((p) => {
        if (!q) return true;
        if (normalizeForSearch(fullName(p)).includes(q)) return true;
        return digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits);
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'tr'));
  }

  async get(clinicId: string, id: string, canSeeMedical: boolean) {
    const p = unwrapMaybe(
      await supabase
        .from('patients')
        .select(
          'id, first_name, last_name, phone, email, birth_date, gender, admin_note, has_allergy_alert, created_at',
        )
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle(),
      'Hasta yüklenemedi.',
    );
    if (!p) return null;

    let medical: Patient['medical'] = null;
    let treatments: Patient['treatments'] = null;
    if (canSeeMedical) {
      const [m, t] = await Promise.all([
        supabase
          .from('patient_medical')
          .select('allergies, conditions, clinical_notes')
          .eq('patient_id', id)
          .maybeSingle(),
        supabase
          .from('treatments')
          .select(
            'id, performed_on, procedure, kind, tooth, status, note, plan_id, amount, list_amount, price_item_id, doctor_member_id, clinic_members(display_name)',
          )
          .eq('patient_id', id)
          .order('performed_on', { ascending: false }),
      ]);
      const med = unwrapMaybe(m, 'Sağlık bilgisi yüklenemedi.');
      medical = {
        allergies: med?.allergies ?? [],
        conditions: med?.conditions ?? [],
        clinicalNotes: nn(med?.clinical_notes),
      };
      treatments = unwrap(t, 'Tedaviler yüklenemedi.').map((r) => ({
        id: r.id,
        date: r.performed_on,
        procedure: r.procedure,
        kind: r.kind,
        tooth: nn(r.tooth),
        doctorMemberId: r.doctor_member_id,
        doctorName: r.clinic_members?.display_name ?? '—',
        status: r.status,
        note: nn(r.note),
        planId: r.plan_id,
        amount: nn(r.amount),
        listAmount: nn(r.list_amount),
        priceItemId: nn(r.price_item_id),
      }));
    }

    return {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      phone: p.phone,
      email: nn(p.email),
      birthDate: nn(p.birth_date),
      gender: p.gender,
      adminNote: nn(p.admin_note),
      hasAllergyAlert: p.has_allergy_alert,
      createdAt: p.created_at,
      medical,
      treatments,
    };
  }

  async create(clinicId: string, input: NewPatientInput) {
    const created = unwrap(
      await supabase
        .from('patients')
        .insert({
          clinic_id: clinicId,
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
          email: input.email ?? null,
          birth_date: input.birthDate ?? null,
          gender: input.gender,
          admin_note: input.adminNote ?? null,
        })
        .select('id')
        .single(),
      'Hasta kaydedilemedi.',
    );

    const m = input.medical;
    if (m && (m.allergies.length || m.conditions.length || m.clinicalNotes)) {
      // Sağlık bilgisi ayrı tabloda. Bu adım başarısız olursa hasta kaydı yine de oluşmuştur.
      // (İleride iki adım tek veritabanı işlemine alınacak.)
      unwrap(
        await supabase.from('patient_medical').insert({
          patient_id: created.id,
          clinic_id: clinicId,
          allergies: m.allergies,
          conditions: m.conditions,
          clinical_notes: m.clinicalNotes ?? null,
        }),
        'Hasta kaydedildi ama sağlık bilgisi kaydedilemedi.',
      );
    }
    return created.id;
  }

  async saveMedical(clinicId: string, patientId: string, medical: PatientMedical) {
    const values = {
      allergies: medical.allergies,
      conditions: medical.conditions,
      clinical_notes: medical.clinicalNotes ?? null,
    };
    const existing = unwrapMaybe(
      await supabase
        .from('patient_medical')
        .select('patient_id')
        .eq('patient_id', patientId)
        .maybeSingle(),
      'Sağlık bilgisi yüklenemedi.',
    );
    if (existing) {
      unwrap(
        await supabase
          .from('patient_medical')
          .update(values)
          .eq('patient_id', patientId)
          .select('patient_id')
          .single(),
        'Sağlık bilgisi kaydedilemedi.',
      );
    } else {
      unwrap(
        await supabase
          .from('patient_medical')
          .insert({ patient_id: patientId, clinic_id: clinicId, ...values })
          .select('patient_id')
          .single(),
        'Sağlık bilgisi kaydedilemedi.',
      );
    }
  }

  async addTreatment(
    clinicId: string,
    patientId: string,
    doctorMemberId: string,
    input: TreatmentInput,
  ) {
    unwrap(
      await supabase
        .from('treatments')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_member_id: doctorMemberId,
          performed_on: input.date,
          procedure: input.procedure,
          kind: input.kind,
          tooth: input.tooth ?? null,
          status: input.status,
          note: input.note ?? null,
          // Boşsa gönderilmez; veritabanı uygulanan plana bağlar (tetikleyici).
          plan_id: input.planId as string,
          amount: input.amount ?? null,
          price_item_id: input.priceItemId ?? null,
        })
        .select('id')
        .single(),
      'Tedavi kaydedilemedi.',
    );
  }

  async updateTreatment(id: string, input: TreatmentInput) {
    unwrap(
      await supabase
        .from('treatments')
        .update({
          performed_on: input.date,
          procedure: input.procedure,
          kind: input.kind,
          tooth: input.tooth ?? null,
          status: input.status,
          note: input.note ?? null,
          amount: input.amount ?? null,
          price_item_id: input.priceItemId ?? null,
        })
        .eq('id', id)
        .select('id')
        .single(),
      'Tedavi güncellenemedi.',
    );
  }

  async listPlans(patientId: string) {
    const rows = unwrap(
      await supabase
        .from('treatment_plans')
        .select(
          'id, title, is_active, created_at, locked_at, locked_by_name, clinic_members(display_name)',
        )
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true }),
      'Tedavi planları yüklenemedi.',
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      isActive: r.is_active,
      createdAt: r.created_at,
      doctorName: r.clinic_members?.display_name ?? '—',
      lockedAt: nn(r.locked_at),
      lockedByName: nn(r.locked_by_name),
    }));
  }

  async createPlan(
    clinicId: string,
    patientId: string,
    doctorMemberId: string,
    title: string,
    activate: boolean,
  ) {
    const row = unwrap(
      await supabase
        .from('treatment_plans')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          doctor_member_id: doctorMemberId,
          title: title.trim(),
          is_active: activate,
        })
        .select('id')
        .single(),
      'Tedavi planı oluşturulamadı.',
    );
    return row.id;
  }

  async renamePlan(id: string, title: string) {
    unwrap(
      await supabase
        .from('treatment_plans')
        .update({ title: title.trim() })
        .eq('id', id)
        .select('id')
        .single(),
      'Plan adı değiştirilemedi.',
    );
  }

  async setActivePlan(id: string) {
    const { error } = await supabase.rpc('set_active_treatment_plan', { p_plan: id });
    if (error) throw new Error(error.message || 'Plan uygulanamadı.');
  }

  async copyPlan(id: string, title: string) {
    const { data, error } = await supabase.rpc('copy_treatment_plan', {
      p_plan: id,
      p_title: title.trim(),
    });
    if (error || !data) throw new Error(error?.message || 'Plan kopyalanamadı.');
    return data;
  }

  async deletePlan(id: string) {
    const { error } = await supabase.rpc('delete_treatment_plan', { p_plan: id });
    if (error) throw new Error(error.message || 'Plan silinemedi.');
  }

  async lockPlan(id: string) {
    const { error } = await supabase.rpc('lock_treatment_plan', { p_plan: id });
    if (error) throw new Error(error.message || 'Plan kilitlenemedi.');
  }

  async applyDiscount(
    planId: string,
    treatmentIds: string[] | null,
    mode: 'yuzde' | 'tutar',
    value: number,
  ) {
    const { error } = await supabase.rpc('apply_plan_discount', {
      p_plan: planId,
      p_treatments: treatmentIds as string[],
      p_mode: mode,
      p_value: value,
    });
    if (error) throw new Error(error.message || 'İndirim uygulanamadı.');
  }

  async listApprovals(planId: string) {
    const rows = unwrap(
      await supabase
        .from('treatment_plan_approvals')
        .select('id, plan_id, signature, items, total, signed_at, recorded_by_name')
        .eq('plan_id', planId)
        .order('signed_at', { ascending: false }),
      'Plan onayları yüklenemedi.',
    );
    return rows.map((r) => ({
      id: r.id,
      planId: r.plan_id,
      signature: r.signature as Signature,
      items: r.items as PlanApproval['items'],
      total: r.total,
      signedAt: r.signed_at,
      recordedByName: nn(r.recorded_by_name),
    }));
  }

  async signPlan(planId: string, signature: Signature) {
    const { data, error } = await supabase.rpc('sign_treatment_plan', {
      p_plan: planId,
      p_signature: signature,
    });
    if (error || !data) throw new Error(error?.message || 'İmza kaydedilemedi.');
    return data;
  }

  async unlockPlan(id: string) {
    const { error } = await supabase.rpc('unlock_treatment_plan', { p_plan: id });
    if (error) throw new Error(error.message || 'Plan kilidi açılamadı.');
  }
}

export const patientRepository: PatientRepository = new SupabasePatientRepository();
