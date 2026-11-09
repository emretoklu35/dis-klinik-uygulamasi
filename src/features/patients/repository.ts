/**
 * Hasta veri erişim katmanı.
 *
 * Ekranlar YALNIZCA `patientRepository` üzerinden veri okur/yazar.
 * Şu an bellekte tutulan sahte veriyle çalışır; Supabase eklendiğinde
 * aynı arayüzü uygulayan yeni bir sınıf yazıp aşağıdaki satırı değiştirmek
 * yeterli olacak. Ekranlara dokunmak gerekmeyecek.
 */

import { demoPatients } from './demo-data';
import type { NewPatientInput, Patient, PatientSummary } from './types';
import { fullName, normalizeForSearch } from './utils';

export interface PatientRepository {
  list(query?: string): Promise<PatientSummary[]>;
  get(id: string): Promise<Patient | null>;
  create(input: NewPatientInput): Promise<Patient>;
}

function toSummary(p: Patient): PatientSummary {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    phone: p.phone,
    lastVisit: p.lastVisit,
    nextAppointment: p.nextAppointment,
    hasAllergy: p.allergies.length > 0,
    activeTreatments: p.treatments.filter((t) => t.status !== 'tamamlandi').length,
  };
}

/** Bellekte çalışan demo deposu. Uygulama yeniden açılınca sıfırlanır. */
class InMemoryPatientRepository implements PatientRepository {
  private patients: Patient[] = structuredClone(demoPatients);

  async list(query = '') {
    const q = normalizeForSearch(query);
    const digits = query.replace(/\D/g, '');
    return this.patients
      .filter((p) => {
        if (!q) return true;
        if (normalizeForSearch(fullName(p)).includes(q)) return true;
        return digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits);
      })
      .sort((a, b) => fullName(a).localeCompare(fullName(b), 'tr'))
      .map(toSummary);
  }

  async get(id: string) {
    return this.patients.find((p) => p.id === id) ?? null;
  }

  async create(input: NewPatientInput) {
    const patient: Patient = {
      ...input,
      id: `h${Date.now()}`,
      createdAt: new Date().toISOString(),
      treatments: [],
    };
    this.patients.push(patient);
    return patient;
  }
}

export const patientRepository: PatientRepository = new InMemoryPatientRepository();
