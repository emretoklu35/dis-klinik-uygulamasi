/**
 * Randevu kuralları: çalışma saatleri ve çakışma kontrolü.
 * Hem form (anlık uyarı için) hem de veri katmanı (son kontrol için) kullanır.
 */

import { isSunday, parseLocalDateTime, timeToMinutes } from '@/lib/dates';

import { clinicConfig } from './clinic';
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
  input: Pick<AppointmentInput, 'start' | 'durationMin' | 'doctor' | 'chair'>,
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
    if (a.doctor === input.doctor) out.push({ appointment: a, reason: 'hekim' });
    else if (a.chair === input.chair) out.push({ appointment: a, reason: 'koltuk' });
  }
  return out;
}

export function conflictMessage(c: Conflict) {
  const t = c.appointment.start.split('T')[1];
  return c.reason === 'hekim'
    ? `${c.appointment.doctor} saat ${t}'de ${c.appointment.patientName} ile meşgul.`
    : `${c.appointment.chair} saat ${t}'de dolu (${c.appointment.patientName}).`;
}

/** Çalışma günü/saati ve geçmiş zaman kontrolü. Sorun yoksa `null`. */
export function scheduleError(
  input: Pick<AppointmentInput, 'start' | 'durationMin'>,
  { allowPast = false } = {},
): string | null {
  const [day, time] = input.start.split('T');
  if (isSunday(day)) return 'Pazar günü klinik kapalı.';
  const s = timeToMinutes(time);
  if (s < clinicConfig.openMin) return 'Klinik 09:00’da açılıyor.';
  if (s + input.durationMin > clinicConfig.closeMin) return 'Randevu 18:00’den önce bitmeli.';
  if (!allowPast && parseLocalDateTime(input.start) < new Date()) {
    return 'Geçmiş bir saate randevu verilemez.';
  }
  return null;
}
