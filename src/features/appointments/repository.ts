/**
 * Randevu veri erişim katmanı (Supabase). Ekranlar yalnızca `appointmentRepository` kullanır.
 * İşlem ayrıntısı (appointment_clinical) RLS ile yalnızca hekime döner; diğer roller için null.
 */

import { addDays, fromClinicLocal, toClinicLocal } from '@/lib/dates';
import { unwrap, unwrapMaybe } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';

import type {
  Appointment,
  AppointmentClinical,
  AppointmentInput,
  AppointmentStatus,
} from './types';

export interface AppointmentRepository {
  /** `fromKey` ile `toKey` (dahil) günleri arasındaki randevular, saate göre sıralı. */
  listRange(clinicId: string, fromKey: string, toKey: string): Promise<Appointment[]>;
  listForPatient(clinicId: string, patientId: string): Promise<Appointment[]>;
  get(clinicId: string, id: string): Promise<Appointment | null>;
  /** canWriteClinical: hekim yetkisi; yoksa işlem ayrıntısı gönderilmez. */
  create(clinicId: string, input: AppointmentInput, canWriteClinical: boolean): Promise<string>;
  update(
    clinicId: string,
    id: string,
    input: AppointmentInput,
    canWriteClinical: boolean,
  ): Promise<void>;
  setStatus(id: string, status: AppointmentStatus): Promise<void>;
}

const SELECT =
  'id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type, status, desk_note, created_at, ' +
  'patients(first_name, last_name), clinic_members(display_name), chairs(name), ' +
  'appointment_clinical(procedure, tooth, clinical_note)';

type ClinicalRow = { procedure: string | null; tooth: string | null; clinical_note: string | null };
type Row = {
  id: string;
  patient_id: string;
  doctor_member_id: string;
  chair_id: string;
  starts_at: string;
  ends_at: string;
  visit_type: Appointment['visitType'];
  status: AppointmentStatus;
  desk_note: string | null;
  created_at: string;
  patients: { first_name: string; last_name: string } | null;
  clinic_members: { display_name: string } | null;
  chairs: { name: string } | null;
  appointment_clinical: ClinicalRow | ClinicalRow[] | null;
};

function toAppointment(r: Row): Appointment {
  const c = Array.isArray(r.appointment_clinical)
    ? r.appointment_clinical[0]
    : r.appointment_clinical;
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : '—',
    start: toClinicLocal(r.starts_at),
    durationMin: Math.round((Date.parse(r.ends_at) - Date.parse(r.starts_at)) / 60000),
    visitType: r.visit_type,
    doctorMemberId: r.doctor_member_id,
    doctorName: r.clinic_members?.display_name ?? '—',
    chairId: r.chair_id,
    chairName: r.chairs?.name ?? '—',
    status: r.status,
    deskNote: r.desk_note ?? undefined,
    clinical: c
      ? {
          procedure: c.procedure ?? undefined,
          tooth: c.tooth ?? undefined,
          clinicalNote: c.clinical_note ?? undefined,
        }
      : null,
    createdAt: r.created_at,
  };
}

function toRow(clinicId: string, input: AppointmentInput) {
  const startIso = fromClinicLocal(input.start);
  return {
    clinic_id: clinicId,
    patient_id: input.patientId,
    doctor_member_id: input.doctorMemberId,
    chair_id: input.chairId,
    starts_at: startIso,
    ends_at: new Date(Date.parse(startIso) + input.durationMin * 60000).toISOString(),
    visit_type: input.visitType,
    desk_note: input.deskNote ?? null,
  };
}

const hasClinical = (c?: AppointmentClinical) =>
  !!(c && (c.procedure || c.tooth || c.clinicalNote));

class SupabaseAppointmentRepository implements AppointmentRepository {
  async listRange(clinicId: string, fromKey: string, toKey: string) {
    const rows = unwrap(
      await supabase
        .from('appointments')
        .select(SELECT)
        .eq('clinic_id', clinicId)
        .gte('starts_at', fromClinicLocal(`${fromKey}T00:00`))
        .lt('starts_at', fromClinicLocal(`${addDays(toKey, 1)}T00:00`))
        .order('starts_at'),
      'Randevular yüklenemedi.',
    );
    return (rows as unknown as Row[]).map(toAppointment);
  }

  async listForPatient(clinicId: string, patientId: string) {
    const rows = unwrap(
      await supabase
        .from('appointments')
        .select(SELECT)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('starts_at'),
      'Randevular yüklenemedi.',
    );
    return (rows as unknown as Row[]).map(toAppointment);
  }

  async get(clinicId: string, id: string) {
    const row = unwrapMaybe(
      await supabase
        .from('appointments')
        .select(SELECT)
        .eq('clinic_id', clinicId)
        .eq('id', id)
        .maybeSingle(),
      'Randevu yüklenemedi.',
    );
    return row ? toAppointment(row as unknown as Row) : null;
  }

  async create(clinicId: string, input: AppointmentInput, canWriteClinical: boolean) {
    const created = unwrap(
      await supabase.from('appointments').insert(toRow(clinicId, input)).select('id').single(),
      'Randevu kaydedilemedi.',
    );
    if (canWriteClinical && hasClinical(input.clinical)) {
      await this.saveClinical(clinicId, created.id, input.clinical!);
    }
    return created.id;
  }

  async update(clinicId: string, id: string, input: AppointmentInput, canWriteClinical: boolean) {
    const { clinic_id: _clinic, patient_id: _patient, ...changes } = toRow(clinicId, input);
    unwrap(
      await supabase.from('appointments').update(changes).eq('id', id).select('id').single(),
      'Randevu güncellenemedi.',
    );
    if (canWriteClinical && input.clinical) {
      await this.saveClinical(clinicId, id, input.clinical);
    }
  }

  async setStatus(id: string, status: AppointmentStatus) {
    unwrap(
      await supabase.from('appointments').update({ status }).eq('id', id).select('id').single(),
      'Durum değiştirilemedi.',
    );
  }

  /** İşlem ayrıntısını ekler ya da günceller (yalnızca hekim; RLS ayrıca denetler). */
  private async saveClinical(clinicId: string, appointmentId: string, c: AppointmentClinical) {
    const values = {
      procedure: c.procedure ?? null,
      tooth: c.tooth ?? null,
      clinical_note: c.clinicalNote ?? null,
    };
    const existing = unwrapMaybe(
      await supabase
        .from('appointment_clinical')
        .select('appointment_id')
        .eq('appointment_id', appointmentId)
        .maybeSingle(),
    );
    if (existing) {
      unwrap(
        await supabase
          .from('appointment_clinical')
          .update(values)
          .eq('appointment_id', appointmentId)
          .select('appointment_id')
          .single(),
        'Randevu kaydedildi ama işlem ayrıntısı kaydedilemedi.',
      );
    } else {
      unwrap(
        await supabase
          .from('appointment_clinical')
          .insert({ appointment_id: appointmentId, clinic_id: clinicId, ...values })
          .select('appointment_id')
          .single(),
        'Randevu kaydedildi ama işlem ayrıntısı kaydedilemedi.',
      );
    }
  }
}

export const appointmentRepository: AppointmentRepository = new SupabaseAppointmentRepository();
