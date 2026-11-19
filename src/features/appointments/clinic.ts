/**
 * Kliniğin çalışma düzenine bağlı yardımcılar. Klinik bilgisi (saatler, günler)
 * veritabanındaki `clinics` kaydından gelir (bkz. session-context).
 */

import type { ClinicInfo } from '@/features/session/session-context';
import { addDays, isoWeekday, minutesToTime, todayKey } from '@/lib/dates';

import type { VisitType } from './types';

export const durationOptions = [15, 30, 45, 60, 90];

export const visitTypeLabels: Record<VisitType, string> = {
  muayene: 'Muayene',
  tedavi: 'Tedavi',
  kontrol: 'Kontrol',
  cerrahi: 'Cerrahi',
  diger: 'Diğer',
};

/** Seçim listesinde ve takvimde türün rengi */
export const visitTypeColors: Record<VisitType, string> = {
  muayene: '#38BDF8',
  tedavi: '#10B981',
  kontrol: '#F59E0B',
  cerrahi: '#E11D48',
  diger: '#64748B',
};

export const VISIT_TYPE_ORDER: VisitType[] = ['muayene', 'tedavi', 'kontrol', 'cerrahi', 'diger'];

/** Hastası henüz bağlanmamış randevunun görünen adı */
export const NO_PATIENT_LABEL = 'Hastasız randevu';

/** Hekimin işlem ayrıntısı için hızlı öneriler. */
export const procedureSuggestions = [
  'Kontrol muayenesi',
  'Diş taşı temizliği',
  'Dolgu',
  'Kanal tedavisi',
  'Diş çekimi',
  'Panoramik röntgen',
  'İmplant kontrolü',
  'Ortodonti kontrolü',
];

/** Açılıştan kapanışa slot aralıklarıyla: 09:00, 09:30 … 17:30 */
export function timeSlots(clinic: ClinicInfo) {
  const out: string[] = [];
  for (let m = clinic.openMin; m < clinic.closeMin; m += clinic.slotMin) out.push(minutesToTime(m));
  return out;
}

export function isWorkingDay(key: string, clinic: ClinicInfo) {
  return clinic.workingDays.includes(isoWeekday(key));
}

/** Verilen günden (dahil) itibaren ilk çalışma günü. */
export function nextWorkingDay(key: string, clinic: ClinicInfo) {
  let d = key;
  for (let i = 0; i < 7 && !isWorkingDay(d, clinic); i++) d = addDays(d, 1);
  return d;
}

/** Bugünden itibaren sıradaki `count` çalışma günü. */
export function nextWorkingDays(count: number, clinic: ClinicInfo) {
  const out: string[] = [];
  let d = todayKey();
  for (let guard = 0; out.length < count && guard < 60; guard++) {
    if (isWorkingDay(d, clinic)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}
