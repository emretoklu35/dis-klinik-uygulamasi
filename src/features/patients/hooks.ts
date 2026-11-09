import { useCallback } from 'react';

import { useFocusLoad } from '@/lib/use-focus-load';

import { patientRepository } from './repository';
import type { Patient, PatientSummary } from './types';

/** Hasta listesi; ekran her odaklandığında yenilenir. */
export function usePatientList(query: string) {
  const load = useCallback(() => patientRepository.list(query), [query]);
  return useFocusLoad<PatientSummary[]>(load, [], 'Hastalar yüklenemedi.');
}

export function usePatient(id: string | undefined) {
  const load = useCallback(() => (id ? patientRepository.get(id) : Promise.resolve(null)), [id]);
  return useFocusLoad<Patient | null>(load, null, 'Hasta yüklenemedi.');
}
