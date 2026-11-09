/**
 * Klinik ayarları (SAHTE DEMO). İleride Ayarlar ekranından düzenlenecek.
 */

import { minutesToTime } from '@/lib/dates';

export const clinicConfig = {
  name: 'Örnek Diş Polikliniği',
  doctors: ['Dr. Demo A', 'Dr. Demo B'],
  chairs: ['Koltuk 1', 'Koltuk 2', 'Koltuk 3'],
  /** Dakika cinsinden: 09:00 – 18:00 */
  openMin: 9 * 60,
  closeMin: 18 * 60,
  slotMin: 30,
  /** Pazartesi–Cumartesi açık, pazar kapalı. */
  workingDays: 6,
};

export const durationOptions = [15, 30, 45, 60, 90];

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

/** 09:00, 09:30 … 17:30 */
export function timeSlots() {
  const out: string[] = [];
  for (let m = clinicConfig.openMin; m < clinicConfig.closeMin; m += clinicConfig.slotMin) {
    out.push(minutesToTime(m));
  }
  return out;
}
