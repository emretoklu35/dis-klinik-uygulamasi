import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import { useFocusLoad } from '@/lib/use-focus-load';

import { appointmentRepository } from './repository';
import type { Appointment } from './types';

export function useAppointmentsRange(fromKey: string, toKey: string) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => appointmentRepository.listRange(clinic.id, fromKey, toKey),
    [clinic.id, fromKey, toKey],
  );
  return useFocusLoad<Appointment[]>(load, [], 'Randevular yüklenemedi.');
}

export function usePatientAppointments(patientId: string | undefined) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () =>
      patientId ? appointmentRepository.listForPatient(clinic.id, patientId) : Promise.resolve([]),
    [clinic.id, patientId],
  );
  return useFocusLoad<Appointment[]>(load, [], 'Randevular yüklenemedi.');
}

export function useAppointment(id: string | undefined) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (id ? appointmentRepository.get(clinic.id, id) : Promise.resolve(null)),
    [clinic.id, id],
  );
  return useFocusLoad<Appointment | null>(load, null, 'Randevu yüklenemedi.');
}
