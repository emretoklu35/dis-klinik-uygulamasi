import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, CenteredMessage, Divider, Grid, gridItem, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppointmentCard } from '@/features/appointments/components';
import { usePatientAppointments } from '@/features/appointments/hooks';
import { isActive } from '@/features/appointments/utils';
import { PatientAvatar } from '@/features/patients/components';
import { usePatient } from '@/features/patients/hooks';
import type { TreatmentStatus } from '@/features/patients/types';
import {
  ageFrom,
  formatDate,
  fullName,
  genderLabels,
  treatmentStatusLabels,
} from '@/features/patients/utils';
import { formatDayLong, nowLocalDateTime } from '@/lib/dates';

const statusTone: Record<TreatmentStatus, 'primary' | 'warning' | 'success'> = {
  planlandi: 'primary',
  devam: 'warning',
  tamamlandi: 'success',
};

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: patient, loading, error } = usePatient(id);
  const { data: appointments } = usePatientAppointments(id);

  if (loading) {
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
            <Button label="Hasta listesine dön" variant="secondary" onPress={() => router.replace('/hastalar')} />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const age = ageFrom(patient.birthDate);
  const now = nowLocalDateTime();
  const upcoming = appointments.filter((a) => isActive(a) && a.start >= now);
  const lastPast = appointments.filter((a) => a.start < now && a.status === 'tamamlandi').at(-1);
  const treatments = [...patient.treatments].sort((a, b) => b.date.localeCompare(a.date));

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

      {/* Tıbbi uyarılar: tedavi öncesi görünür olmalı */}
      {patient.allergies.length > 0 || patient.medicalNotes.length > 0 ? (
        <View style={styles.alert}>
          <Ionicons name="warning" size={20} color={Colors.danger} />
          <View style={{ flex: 1, gap: 4 }}>
            {patient.allergies.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Alerji: </Text>
                {patient.allergies.join(', ')}
              </Text>
            ) : null}
            {patient.medicalNotes.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Sağlık durumu: </Text>
                {patient.medicalNotes.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.alert, styles.alertOk]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
          <Text style={[styles.alertText, { color: Colors.success }]}>Kayıtlı alerji veya sağlık uyarısı yok.</Text>
        </View>
      )}

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
            <Button
              label="Randevu ver"
              icon="add"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/takvim/yeni', params: { patientId: patient.id } }, { withAnchor: true })
              }
            />
          }>
          <InfoRow
            icon="time-outline"
            label="Son ziyaret"
            value={formatDate(lastPast?.start.slice(0, 10) ?? patient.lastVisit)}
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

      <Card title="Tedavi geçmişi">
        {treatments.length === 0 ? (
          <Text style={styles.empty}>Henüz tedavi kaydı yok.</Text>
        ) : (
          treatments.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <Divider />}
              <View style={styles.treatment}>
                <View style={styles.treatmentDate}>
                  <Text style={styles.treatmentDateText}>{formatDate(t.date)}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.treatmentTitle}>
                    {t.procedure}
                    {t.tooth ? <Text style={styles.tooth}>  · Diş {t.tooth}</Text> : null}
                  </Text>
                  <Text style={styles.sub}>{t.doctor}</Text>
                </View>
                <Badge label={treatmentStatusLabels[t.status]} tone={statusTone[t.status]} />
              </View>
            </Fragment>
          ))
        )}
      </Card>

      <Card title="Notlar">
        <Text style={patient.notes ? styles.notes : styles.empty}>{patient.notes || 'Not eklenmemiş.'}</Text>
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
  alertText: { fontSize: 14, color: '#991B1B', flexShrink: 1 },
  alertStrong: { fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoValue: { fontSize: 14, color: Colors.text, fontWeight: '500', textAlign: 'right', flexShrink: 1 },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treatmentDate: { width: 92 },
  treatmentDateText: { fontSize: 13, color: Colors.textSecondary },
  treatmentTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  empty: { fontSize: 14, color: Colors.textMuted },
  notes: { fontSize: 15, color: Colors.text, lineHeight: 22 },
});
