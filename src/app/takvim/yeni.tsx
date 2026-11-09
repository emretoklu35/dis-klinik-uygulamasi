import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AppointmentForm, emptyAppointmentForm } from '@/features/appointments/form';
import { isWorkingDay } from '@/features/appointments/clinic';
import { appointmentRepository } from '@/features/appointments/repository';
import { usePatient } from '@/features/patients/hooks';
import { fullName } from '@/features/patients/utils';
import { useClinicSession, type ClinicInfo } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';

/** Adresten gelen tarih geçerli, bugün veya sonrası ve çalışma günüyse kullanılır. */
function validDateParam(clinic: ClinicInfo, date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const key = parseDateInput(formatDateInput(date));
  return key && key >= todayKey() && isWorkingDay(key, clinic) ? key : undefined;
}

export default function NewAppointmentScreen() {
  const router = useRouter();
  const session = useClinicSession();
  const { date, patientId } = useLocalSearchParams<{ date?: string; patientId?: string }>();
  const { data: patient, loading } = usePatient(patientId);

  if (patientId && loading) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }

  const dateParam = validDateParam(session.clinic, date);
  const initial = emptyAppointmentForm(session, {
    ...(dateParam ? { date: dateParam } : {}),
    patient: patient ? { id: patient.id, name: fullName(patient) } : null,
  });

  return (
    <Screen inStack>
      <AppointmentForm
        // Hasta yüklendiğinde formun başlangıç değerleriyle yeniden kurulması için
        key={patient?.id ?? 'bos'}
        initial={initial}
        submitLabel="Randevuyu oluştur"
        onCancel={() => router.back()}
        onSubmit={async (input) => {
          const id = await appointmentRepository.create(
            session.clinic.id,
            input,
            session.can('tedavi.yaz'),
          );
          router.replace({ pathname: '/takvim/[id]', params: { id } });
        }}
      />
    </Screen>
  );
}
