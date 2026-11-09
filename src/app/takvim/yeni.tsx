import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AppointmentForm, emptyAppointmentForm } from '@/features/appointments/form';
import { appointmentRepository } from '@/features/appointments/repository';
import { usePatient } from '@/features/patients/hooks';
import { fullName } from '@/features/patients/utils';
import { isSunday, parseDateInput, formatDateInput, todayKey } from '@/lib/dates';

/** Adresten gelen tarih geçerli, bugün veya sonrası ve pazar değilse kullanılır. */
function validDateParam(date?: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const key = parseDateInput(formatDateInput(date));
  return key && key >= todayKey() && !isSunday(key) ? key : undefined;
}

export default function NewAppointmentScreen() {
  const router = useRouter();
  const { date, patientId } = useLocalSearchParams<{ date?: string; patientId?: string }>();
  const { data: patient, loading } = usePatient(patientId);

  if (patientId && loading) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }

  const initial = emptyAppointmentForm({
    ...(validDateParam(date) ? { date: validDateParam(date) } : {}),
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
          const created = await appointmentRepository.create(input);
          router.replace({ pathname: '/takvim/[id]', params: { id: created.id } });
        }}
      />
    </Screen>
  );
}
