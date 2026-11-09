/**
 * SAHTE DEMO RANDEVULARI
 * Takvim boş görünmesin diye içinde bulunulan haftaya göre üretilir.
 */

import { demoPatients } from '@/features/patients/demo-data';
import { fullName } from '@/features/patients/utils';
import { addDays, localDateTime, parseLocalDateTime, startOfWeek, todayKey } from '@/lib/dates';

import type { Appointment, AppointmentStatus } from './types';

type Seed = [
  dayOffset: number, // bu haftanın pazartesisine göre
  time: string,
  patientId: string,
  procedure: string,
  doctor: 'Dr. Demo A' | 'Dr. Demo B',
  chair: 1 | 2 | 3,
  durationMin: number,
  status?: AppointmentStatus,
];

const seeds: Seed[] = [
  [-5, '10:00', 'h4', 'İmplant değerlendirmesi', 'Dr. Demo A', 1, 45],
  [-3, '14:30', 'h6', 'Ortodonti kontrolü', 'Dr. Demo B', 2, 30, 'gelmedi'],
  [0, '09:30', 'h1', 'Kontrol muayenesi', 'Dr. Demo A', 1, 30, 'onaylandi'],
  [0, '10:15', 'h2', 'Diş taşı temizliği', 'Dr. Demo B', 2, 45, 'onaylandi'],
  [0, '11:00', 'h3', 'Dolgu', 'Dr. Demo A', 1, 60],
  [0, '14:00', 'h5', 'Fissür örtücü kontrolü', 'Dr. Demo B', 3, 30, 'onaylandi'],
  [1, '09:00', 'h2', 'Panoramik röntgen', 'Dr. Demo B', 3, 15, 'onaylandi'],
  [1, '13:30', 'h4', 'İmplant kontrolü', 'Dr. Demo A', 1, 30],
  [2, '10:00', 'h6', 'Ortodonti kontrolü', 'Dr. Demo B', 2, 30, 'onaylandi'],
  [2, '15:00', 'h3', 'Kanal tedavisi (3. seans)', 'Dr. Demo A', 1, 60, 'onaylandi'],
  [3, '15:30', 'h1', 'Dolgu', 'Dr. Demo A', 2, 45],
  [4, '11:30', 'h5', 'Kontrol muayenesi', 'Dr. Demo B', 3, 30, 'onaylandi'],
  [5, '10:00', 'h4', 'İmplant cerrahisi', 'Dr. Demo A', 1, 90, 'onaylandi'],
  [9, '09:30', 'h3', 'Kron ölçüsü', 'Dr. Demo A', 1, 45],
  [10, '16:00', 'h2', 'Kontrol muayenesi', 'Dr. Demo B', 2, 30],
];

export function createDemoAppointments(): Appointment[] {
  const monday = startOfWeek(todayKey());
  const now = new Date();
  return seeds.map(([offset, time, patientId, procedure, doctor, chair, durationMin, status], i) => {
    const patient = demoPatients.find((p) => p.id === patientId)!;
    const start = localDateTime(addDays(monday, offset), time);
    const isPast = parseLocalDateTime(start) < now;
    return {
      id: `r${i + 1}`,
      patientId,
      patientName: fullName(patient),
      start,
      durationMin,
      procedure,
      doctor,
      chair: `Koltuk ${chair}`,
      // Geçmişte kalan ve özel durumu olmayanlar "tamamlandı" sayılır.
      status: status === 'gelmedi' ? status : isPast ? 'tamamlandi' : (status ?? 'bekliyor'),
      createdAt: now.toISOString(),
    };
  });
}
