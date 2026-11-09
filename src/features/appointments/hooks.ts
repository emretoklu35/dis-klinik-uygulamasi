import { useCallback } from 'react';

import { useFocusLoad } from '@/lib/use-focus-load';

import { appointmentRepository } from './repository';
import type { Appointment } from './types';

export function useAppointmentsRange(fromKey: string, toKey: string) {
  const load = useCallback(() => appointmentRepository.listRange(fromKey, toKey), [fromKey, toKey]);
  return useFocusLoad<Appointment[]>(load, [], 'Randevular yüklenemedi.');
}

export function usePatientAppointments(patientId: string | undefined) {
  const load = useCallback(
    () => (patientId ? appointmentRepository.listForPatient(patientId) : Promise.resolve([])),
    [patientId],
  );
  return useFocusLoad<Appointment[]>(load, [], 'Randevular yüklenemedi.');
}

export function useAppointment(id: string | undefined) {
  const load = useCallback(() => (id ? appointmentRepository.get(id) : Promise.resolve(null)), [id]);
  return useFocusLoad<Appointment | null>(load, null, 'Randevu yüklenemedi.');
}
