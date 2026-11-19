import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

import { patientRepository } from './repository';
import type { Patient, PatientSummary, Treatment } from './types';

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

/**
 * Yönetici ve sahip için tedavi ÖZETİ (tarih, işlem, diş, hekim, durum; tedavi notu yok).
 * Tedavileri doğrudan görebilen hekimler için çalışmaz (onlar patient.treatments kullanır).
 */
export function useTreatmentSummaries(patientId: string | undefined) {
  const { can } = useClinicSession();
  const enabled = !!patientId && !can('tedavi.oku') && can('tedavi.ozet.oku');
  const load = useCallback(async (): Promise<Treatment[] | null> => {
    if (!enabled) return null;
    const { data, error } = await supabase.rpc('treatment_summaries', { p_patient: patientId! });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      date: r.performed_on,
      procedure: r.procedure,
      tooth: r.tooth ?? undefined,
      doctorMemberId: '',
      doctorName: r.doctor_name,
      status: r.status,
    }));
  }, [enabled, patientId]);
  return useFocusLoad<Treatment[] | null>(load, null, 'Tedaviler yüklenemedi.');
}
