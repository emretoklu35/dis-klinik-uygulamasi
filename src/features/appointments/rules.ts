/**
 * Randevu kuralları: çalışma saatleri ve çakışma kontrolü.
 * Form bunları anlık uyarı için kullanır. Asıl çakışma koruması veritabanındadır
 * (exclusion constraint); iki kişi aynı anda kaydederse veritabanı birini reddeder.
 */

import type { ClinicInfo } from '@/features/session/session-context';
import { minutesToTime, nowLocalDateTime, timeToMinutes } from '@/lib/dates';

import { isWorkingDay } from './clinic';
import type { Appointment, AppointmentInput } from './types';

export function endMinutes(a: Pick<Appointment, 'start' | 'durationMin'>) {
  return timeToMinutes(a.start.split('T')[1]) + a.durationMin;
}

/** İptal edilen randevular saati boşaltır. */
export function blocksTime(a: Appointment) {
  return a.status !== 'iptal';
}

export type Conflict = { appointment: Appointment; reason: 'hekim' | 'koltuk' };

/** Aynı gün, saatleri kesişen ve aynı hekim veya koltuğu kullanan randevular. */
export function findConflicts(
  input: Pick<AppointmentInput, 'start' | 'durationMin' | 'doctorMemberId' | 'chairId'>,
  existing: Appointment[],
  ignoreId?: string,
): Conflict[] {
  const [day, time] = input.start.split('T');
  const s = timeToMinutes(time);
  const e = s + input.durationMin;
  const out: Conflict[] = [];
  for (const a of existing) {
    if (a.id === ignoreId || !blocksTime(a) || !a.start.startsWith(day)) continue;
    const as = timeToMinutes(a.start.split('T')[1]);
    const ae = as + a.durationMin;
    if (s >= ae || e <= as) continue;
    if (a.doctorMemberId === input.doctorMemberId) out.push({ appointment: a, reason: 'hekim' });
    else if (a.chairId === input.chairId) out.push({ appointment: a, reason: 'koltuk' });
  }
  return out;
}

export function conflictMessage(c: Conflict) {
  const t = c.appointment.start.split('T')[1];
  return c.reason === 'hekim'
    ? `${c.appointment.doctorName} saat ${t}'de ${c.appointment.patientName} ile meşgul.`
    : `${c.appointment.chairName} saat ${t}'de dolu (${c.appointment.patientName}).`;
}

/** Çalışma günü/saati ve geçmiş zaman kontrolü. Sorun yoksa `null`. */
export function scheduleError(
  input: Pick<AppointmentInput, 'start' | 'durationMin'>,
  clinic: ClinicInfo,
  { allowPast = false } = {},
): string | null {
  const [day, time] = input.start.split('T');
  if (!isWorkingDay(day, clinic)) return 'Klinik bu gün kapalı.';
  const s = timeToMinutes(time);
  if (s < clinic.openMin) return `Klinik ${minutesToTime(clinic.openMin)}’da açılıyor.`;
  if (s + input.durationMin > clinic.closeMin) {
    return `Randevu ${minutesToTime(clinic.closeMin)}’den önce bitmeli.`;
  }
  if (!allowPast && input.start < nowLocalDateTime()) return 'Geçmiş bir saate randevu verilemez.';
  return null;
}
