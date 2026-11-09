/**
 * Hasta veri erişim katmanı (Supabase).
 * Ekranlar yalnızca bu dosyadaki `patientRepository` üzerinden veri okur/yazar.
 * Hangi satırın görüneceğine veritabanındaki RLS kuralları karar verir.
 */

import { toClinicLocal } from '@/lib/dates';
import { unwrap, unwrapMaybe } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';

import type { NewPatientInput, Patient, PatientSummary } from './types';
import { fullName, normalizeForSearch } from './utils';

export interface PatientRepository {
  list(clinicId: string, query?: string): Promise<PatientSummary[]>;
  /** canSeeMedical: sağlık ayrıntısı/tedavi yetkisi (yoksa bu alanlar null döner). */
  get(clinicId: string, id: string, canSeeMedical: boolean): Promise<Patient | null>;
  create(clinicId: string, input: NewPatientInput): Promise<string>;
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
      if (!next.has(a.patient_id)) next.set(a.patient_id, toClinicLocal(a.starts_at));
    }
    const last = new Map<string, string>();
    for (const a of unwrap(past, 'Randevular yüklenemedi.')) {
      if (!last.has(a.patient_id)) last.set(a.patient_id, toClinicLocal(a.starts_at).slice(0, 10));
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
          .select('id, performed_on, procedure, tooth, status, note, clinic_members(display_name)')
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
        tooth: nn(r.tooth),
        doctorName: r.clinic_members?.display_name ?? '—',
        status: r.status,
        note: nn(r.note),
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
}

export const patientRepository: PatientRepository = new SupabasePatientRepository();
