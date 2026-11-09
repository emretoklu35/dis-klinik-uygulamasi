import { minutesToTime } from '@/lib/dates';

import { endMinutes } from './rules';
import type { Appointment, AppointmentStatus } from './types';

export const statusLabels: Record<AppointmentStatus, string> = {
  bekliyor: 'Onay bekliyor',
  onaylandi: 'Onaylandı',
  tamamlandi: 'Tamamlandı',
  gelmedi: 'Gelmedi',
  iptal: 'İptal edildi',
};

export const statusTone: Record<AppointmentStatus, 'primary' | 'success' | 'warning' | 'muted' | 'danger'> = {
  bekliyor: 'warning',
  onaylandi: 'primary',
  tamamlandi: 'success',
  gelmedi: 'danger',
  iptal: 'muted',
};

export function startTime(a: Pick<Appointment, 'start'>) {
  return a.start.split('T')[1];
}

/** "09:30 – 10:15" */
export function timeRange(a: Pick<Appointment, 'start' | 'durationMin'>) {
  return `${startTime(a)} – ${minutesToTime(endMinutes(a))}`;
}

export function isActive(a: Appointment) {
  return a.status === 'bekliyor' || a.status === 'onaylandi';
}
