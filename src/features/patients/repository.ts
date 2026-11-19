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
            'id, performed_on, procedure, tooth, status, note, doctor_member_id, clinic_members(display_name)',
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
        tooth: nn(r.tooth),
        doctorMemberId: r.doctor_member_id,
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
          tooth: input.tooth ?? null,
          status: input.status,
          note: input.note ?? null,
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
          tooth: input.tooth ?? null,
          status: input.status,
          note: input.note ?? null,
        })
        .eq('id', id)
        .select('id')
        .single(),
      'Tedavi güncellenemedi.',
    );
  }
}

export const patientRepository: PatientRepository = new SupabasePatientRepository();
