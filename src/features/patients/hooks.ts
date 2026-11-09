import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { patientRepository } from './repository';
import type { Patient, PatientSummary } from './types';

type AsyncState<T> = { data: T; loading: boolean; error: string | null };

/**
 * Hasta listesini getirir. Ekran her odaklandığında yenilenir
 * (ör. yeni hasta ekleyip geri dönünce liste güncel olur).
 */
export function usePatientList(query: string) {
  const [state, setState] = useState<AsyncState<PatientSummary[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((s) => ({ ...s, loading: true }));
      patientRepository
        .list(query)
        .then((data) => active && setState({ data, loading: false, error: null }))
        .catch(() => active && setState((s) => ({ ...s, loading: false, error: 'Hastalar yüklenemedi.' })));
      return () => {
        active = false;
      };
    }, [query]),
  );

  return state;
}

export function usePatient(id: string | undefined) {
  const [state, setState] = useState<AsyncState<Patient | null>>({
    data: null,
    loading: true,
    error: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!id) {
        setState({ data: null, loading: false, error: null });
        return;
      }
      patientRepository
        .get(id)
        .then((data) => active && setState({ data, loading: false, error: null }))
        .catch(() => active && setState({ data: null, loading: false, error: 'Hasta yüklenemedi.' }));
      return () => {
        active = false;
      };
    }, [id]),
  );

  return state;
}
