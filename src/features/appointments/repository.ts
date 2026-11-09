/**
 * Randevu veri erişim katmanı. Ekranlar yalnızca `appointmentRepository` kullanır.
 * Şimdilik bellekte sahte veriyle çalışır; Supabase geldiğinde aynı arayüzü
 * uygulayan yeni bir sınıf yazılacak.
 */

import { createDemoAppointments } from './demo-data';
import { conflictMessage, findConflicts, scheduleError } from './rules';
import type { Appointment, AppointmentInput, AppointmentStatus } from './types';

/** Kullanıcıya gösterilebilecek iş kuralı hatası (çakışma, kapalı saat vb.). */
export class AppointmentRuleError extends Error {}

export interface AppointmentRepository {
  /** `fromKey` ile `toKey` (dahil) arasındaki günlerin randevuları, saate göre sıralı. */
  listRange(fromKey: string, toKey: string): Promise<Appointment[]>;
  listForPatient(patientId: string): Promise<Appointment[]>;
  get(id: string): Promise<Appointment | null>;
  create(input: AppointmentInput): Promise<Appointment>;
  update(id: string, input: AppointmentInput): Promise<Appointment>;
  setStatus(id: string, status: AppointmentStatus): Promise<Appointment>;
}

const byStart = (a: Appointment, b: Appointment) => a.start.localeCompare(b.start);

class InMemoryAppointmentRepository implements AppointmentRepository {
  private items: Appointment[] = createDemoAppointments();

  async listRange(fromKey: string, toKey: string) {
    return this.items
      .filter((a) => {
        const day = a.start.slice(0, 10);
        return day >= fromKey && day <= toKey;
      })
      .sort(byStart);
  }

  async listForPatient(patientId: string) {
    return this.items.filter((a) => a.patientId === patientId).sort(byStart);
  }

  async get(id: string) {
    return this.items.find((a) => a.id === id) ?? null;
  }

  private check(input: AppointmentInput, ignoreId?: string, allowPast = false) {
    const err = scheduleError(input, { allowPast });
    if (err) throw new AppointmentRuleError(err);
    const conflicts = findConflicts(input, this.items, ignoreId);
    if (conflicts.length > 0) throw new AppointmentRuleError(conflictMessage(conflicts[0]));
  }

  async create(input: AppointmentInput) {
    this.check(input);
    const appointment: Appointment = {
      ...input,
      id: `r${Date.now()}`,
      status: 'bekliyor',
      createdAt: new Date().toISOString(),
    };
    this.items.push(appointment);
    return appointment;
  }

  async update(id: string, input: AppointmentInput) {
    const current = await this.get(id);
    if (!current) throw new AppointmentRuleError('Randevu bulunamadı.');
    // Saati değişmeyen geçmiş randevuda (ör. not düzeltme) geçmiş kontrolü yapılmaz.
    this.check(input, id, input.start === current.start);
    Object.assign(current, input);
    return current;
  }

  async setStatus(id: string, status: AppointmentStatus) {
    const current = await this.get(id);
    if (!current) throw new AppointmentRuleError('Randevu bulunamadı.');
    if (current.status === 'iptal' && status !== 'iptal') {
      // İptalden geri alırken saat bu arada başkasına verilmiş olabilir.
      const conflicts = findConflicts(current, this.items, id);
      if (conflicts.length > 0) throw new AppointmentRuleError(conflictMessage(conflicts[0]));
    }
    current.status = status;
    return current;
  }
}

export const appointmentRepository: AppointmentRepository = new InMemoryAppointmentRepository();
