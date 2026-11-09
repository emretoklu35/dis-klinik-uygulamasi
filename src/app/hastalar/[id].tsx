import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, CenteredMessage, Divider, Grid, gridItem, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppointmentCard } from '@/features/appointments/components';
import { usePatientAppointments } from '@/features/appointments/hooks';
import { isActive } from '@/features/appointments/utils';
import { PatientAvatar } from '@/features/patients/components';
import { usePatient } from '@/features/patients/hooks';
import { MedicalCard } from '@/features/patients/medical-card';
import { TreatmentsCard } from '@/features/patients/treatments-card';
import { PaymentsCard } from '@/features/payments/payments-card';
import { MediaCard } from '@/features/radiographs/media-card';
import { useOpenMediaRequests, usePatientRadiographs } from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import type { Patient } from '@/features/patients/types';
import { ageFrom, formatDate, fullName, genderLabels } from '@/features/patients/utils';
import { formatDayLong, nowLocalDateTime } from '@/lib/dates';

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/**
 * Hekim: alerji, kronik hastalık ve klinik notları görür.
 * Diğer roller: yalnızca "alerji kaydı var" uyarısını görür (ayrıntı veritabanından hiç gelmez).
 */
function HealthBlock({ patient }: { patient: Patient }) {
  const m = patient.medical;
  if (!m) {
    return patient.hasAllergyAlert ? (
      <View style={styles.alert}>
        <Ionicons name="warning" size={20} color={Colors.danger} />
        <Text style={[styles.alertText, styles.alertStrong]}>
          Alerji kaydı var — hekim kontrol etsin.
        </Text>
      </View>
    ) : (
      <View style={[styles.alert, styles.alertNeutral]}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
        <Text style={[styles.alertText, { color: Colors.textSecondary }]}>
          Alerji kaydı yok. Sağlık ayrıntılarını yalnızca hekimler görür.
        </Text>
      </View>
    );
  }
  const hasWarning = m.allergies.length > 0 || m.conditions.length > 0;
  return (
    <>
      {hasWarning ? (
        <View style={styles.alert}>
          <Ionicons name="warning" size={20} color={Colors.danger} />
          <View style={{ flex: 1, gap: 4 }}>
            {m.allergies.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Alerji: </Text>
                {m.allergies.join(', ')}
              </Text>
            ) : null}
            {m.conditions.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Sağlık durumu: </Text>
                {m.conditions.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.alert, styles.alertOk]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
          <Text style={[styles.alertText, { color: Colors.success }]}>
            Kayıtlı alerji veya sağlık uyarısı yok.
          </Text>
        </View>
      )}
    </>
  );
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, loading, error, reload } = usePatient(id);
  const { data: appointments } = usePatientAppointments(id);
  const { can } = useClinicSession();
  const { data: radiographs, reload: reloadRadiographs } = usePatientRadiographs(
    id,
    can('rontgen.oku'),
  );
  const { data: mediaRequests, reload: reloadRequests } = useOpenMediaRequests(
    id,
    can('medya.istek.oku'),
  );
  const reloadMedia = () => {
    reloadRadiographs();
    reloadRequests();
  };

  // Yalnızca ilk yüklemede tam ekran bekleme; kayıttan sonra yenilerken kart yerinde kalır.
  if (loading && !patient) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }

  if (error || !patient) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage
            icon="person-remove-outline"
            title={error ?? 'Hasta bulunamadı'}
            text="Kayıt silinmiş ya da bağlantı hatalı olabilir.">
            <Button
              label="Hasta listesine dön"
              variant="secondary"
              onPress={() => router.replace('/hastalar')}
            />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const age = ageFrom(patient.birthDate);
  const now = nowLocalDateTime();
  const upcoming = appointments.filter((a) => isActive(a) && a.start >= now);
  const lastPast = appointments.filter((a) => a.start < now && a.status === 'tamamlandi').at(-1);

  return (
    <Screen inStack>
      <Stack.Screen options={{ title: fullName(patient) }} />

      {/* Kimlik kartı */}
      <Card>
        <View style={styles.identity}>
          <PatientAvatar patient={patient} size={64} />
          <View style={styles.identityText}>
            <Text style={styles.name}>{fullName(patient)}</Text>
            <Text style={styles.sub}>
              {[age !== undefined ? `${age} yaş` : null, genderLabels[patient.gender]]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={styles.sub}>Kayıt: {formatDate(patient.createdAt)}</Text>
          </View>
        </View>
      </Card>

      {/* Sağlık uyarısı: tedavi öncesi görünür olmalı */}
      <HealthBlock patient={patient} />
      <MedicalCard patient={patient} onSaved={reload} />

      <Grid>
        <Card title="İletişim" style={gridItem}>
          <InfoRow icon="call-outline" label="Telefon" value={patient.phone} />
          <Divider />
          <InfoRow icon="mail-outline" label="E-posta" value={patient.email || '—'} />
          <Divider />
          <InfoRow icon="gift-outline" label="Doğum tarihi" value={formatDate(patient.birthDate)} />
        </Card>

        <Card
          title="Randevular"
          style={gridItem}
          action={
            can('randevu.yaz') ? (
              <Button
                label="Randevu ver"
                icon="add"
                variant="secondary"
                onPress={() =>
                  router.push(
                    { pathname: '/takvim/yeni', params: { patientId: patient.id } },
                    { withAnchor: true },
                  )
                }
              />
            ) : null
          }>
          <InfoRow
            icon="time-outline"
            label="Son ziyaret"
            value={formatDate(lastPast?.start.slice(0, 10))}
          />
          {upcoming.length === 0 ? (
            <>
              <Divider />
              <Text style={styles.empty}>Yaklaşan randevu yok.</Text>
            </>
          ) : (
            upcoming.slice(0, 3).map((a) => (
              <Fragment key={a.id}>
                <Divider />
                <Text style={styles.sub}>{formatDayLong(a.start.slice(0, 10))}</Text>
                <AppointmentCard appointment={a} />
              </Fragment>
            ))
          )}
        </Card>
      </Grid>

      {/* Yalnızca hekim: veritabanından gelmezse kartlar hiç çizilmez */}
      <TreatmentsCard patient={patient} radiographs={radiographs} onSaved={reload} />
      <MediaCard
        patient={patient}
        radiographs={radiographs}
        requests={mediaRequests}
        onChanged={reloadMedia}
      />
      {/* Sahip, yönetici, hekim ve resepsiyon görür; asistan için hiç çizilmez */}
      <PaymentsCard patient={patient} />

      <Card title="İdari not">
        <Text style={patient.adminNote ? styles.notes : styles.empty}>
          {patient.adminNote || 'Not eklenmemiş.'}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityText: { flex: 1, gap: 2 },
  name: { fontSize: 22, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: '#FDECEC',
    borderColor: '#F8C9C9',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  alertOk: { backgroundColor: Colors.successSoft, borderColor: '#BFE5CB', alignItems: 'center' },
  alertNeutral: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  alertText: { fontSize: 14, color: '#991B1B', flexShrink: 1 },
  alertStrong: { fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treatmentDate: { width: 92 },
  treatmentDateText: { fontSize: 13, color: Colors.textSecondary },
  treatmentTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  empty: { fontSize: 14, color: Colors.textMuted },
  notes: { fontSize: 15, color: Colors.text, lineHeight: 22 },
});
