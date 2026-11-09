import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import { useFocusLoad } from '@/lib/use-focus-load';

import { patientRepository } from './repository';
import type { Patient, PatientSummary } from './types';

/** Hasta listesi; ekran her odaklandığında yenilenir. */
export function usePatientList(query: string) {
  const { clinic } = useClinicSession();
  const load = useCallback(() => patientRepository.list(clinic.id, query), [clinic.id, query]);
  return useFocusLoad<PatientSummary[]>(load, [], 'Hastalar yüklenemedi.');
}

export function usePatient(id: string | undefined) {
  const { clinic, can } = useClinicSession();
  const canSeeMedical = can('saglik.detay.oku');
  const load = useCallback(
    () => (id ? patientRepository.get(clinic.id, id, canSeeMedical) : Promise.resolve(null)),
    [clinic.id, id, canSeeMedical],
  );
  return useFocusLoad<Patient | null>(load, null, 'Hasta yüklenemedi.');
}
