import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, CenteredMessage, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { StatusBadge } from '@/features/appointments/components';
import { AppointmentForm } from '@/features/appointments/form';
import { useAppointment } from '@/features/appointments/hooks';
import { appointmentRepository } from '@/features/appointments/repository';
import { visitTypeLabels } from '@/features/appointments/clinic';
import type { Appointment, AppointmentStatus } from '@/features/appointments/types';
import { isActive, timeRange } from '@/features/appointments/utils';
import { useClinicSession } from '@/features/session/session-context';
import { formatDayLong } from '@/lib/dates';

type Action = {
  label: string;
  status: AppointmentStatus;
  icon: 'checkmark' | 'checkmark-done' | 'close' | 'refresh' | 'person-remove-outline';
  variant: 'primary' | 'secondary';
};

function actionsFor(status: AppointmentStatus): Action[] {
  switch (status) {
    case 'bekliyor':
      return [{ label: 'Onayla', status: 'onaylandi', icon: 'checkmark', variant: 'primary' }];
    case 'onaylandi':
      return [
        { label: 'Tamamlandı', status: 'tamamlandi', icon: 'checkmark-done', variant: 'primary' },
        {
          label: 'Gelmedi',
          status: 'gelmedi',
          icon: 'person-remove-outline',
          variant: 'secondary',
        },
      ];
    default:
      return [{ label: 'Yeniden aç', status: 'bekliyor', icon: 'refresh', variant: 'secondary' }];
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Details({ a, isClinician }: { a: Appointment; isClinician: boolean }) {
  return (
    <>
      <Card title="Randevu bilgileri">
        <Row label="Tür" value={visitTypeLabels[a.visitType]} />
        <Divider />
        <Row label="Hekim" value={a.doctorName} />
        <Divider />
        <Row label="Koltuk" value={a.chairName} />
        <Divider />
        <Row label="Süre" value={`${a.durationMin} dakika`} />
        {a.deskNote ? (
          <>
            <Divider />
            <Row label="İdari not" value={a.deskNote} />
          </>
        ) : null}
      </Card>
      {isClinician ? (
        <Card title="İşlem ayrıntısı (yalnızca hekim)">
          <Row label="İşlem" value={a.clinical?.procedure || '—'} />
          {a.clinical?.tooth ? (
            <>
              <Divider />
              <Row label="Diş" value={a.clinical.tooth} />
            </>
          ) : null}
          {a.clinical?.clinicalNote ? (
            <>
              <Divider />
              <Row label="Klinik not" value={a.clinical.clinicalNote} />
            </>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const session = useClinicSession();
  const isClinician = session.can('tedavi.yaz');
  const canWrite = session.can('randevu.yaz');
  const { data: a, loading, error, reload } = useAppointment(id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !a) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }

  if (error || !a) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="calendar-clear-outline" title={error ?? 'Randevu bulunamadı'}>
            <Button
              label="Takvime dön"
              variant="secondary"
              onPress={() => router.replace('/takvim')}
            />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const changeStatus = async (status: AppointmentStatus) => {
    setBusy(true);
    setActionError(null);
    try {
      await appointmentRepository.setStatus(a.id, status);
      setConfirmCancel(false);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const [firstName, ...rest] = a.patientName.split(' ');

  return (
    <Screen inStack>
      {/* Özet ve durum */}
      <Card>
        <View style={styles.summary}>
          <View style={styles.when}>
            <Text style={styles.time}>{timeRange(a)}</Text>
            <Text style={styles.day}>{formatDayLong(a.start.slice(0, 10))}</Text>
          </View>
          <StatusBadge appointment={a} />
        </View>
        <Divider />
        <Link
          href={{ pathname: '/hastalar/[id]', params: { id: a.patientId } }}
          withAnchor
          style={styles.patientLink}>
          <Ionicons name="person-circle-outline" size={18} color={Colors.primary} /> {firstName}{' '}
          {rest.join(' ')} · Hasta kartını aç
        </Link>

        <View style={styles.actions}>
          {(canWrite ? actionsFor(a.status) : []).map((act) => (
            <Button
              key={act.status}
              label={act.label}
              icon={act.icon}
              variant={act.variant}
              disabled={busy}
              onPress={() => changeStatus(act.status)}
            />
          ))}
          {canWrite && isActive(a) && !editing ? (
            <Button
              label="Düzenle"
              icon="create-outline"
              variant="secondary"
              disabled={busy}
              onPress={() => setEditing(true)}
            />
          ) : null}
          {canWrite && isActive(a) && !confirmCancel ? (
            <Button
              label="İptal et"
              icon="close"
              variant="secondary"
              disabled={busy}
              onPress={() => setConfirmCancel(true)}
            />
          ) : null}
        </View>

        {confirmCancel ? (
          <View style={styles.confirm}>
            <Text style={styles.confirmText}>
              Randevu iptal edilsin mi? Saat başka hastalara açılır; kayıt silinmez.
            </Text>
            <View style={styles.actions}>
              <Button
                label="Vazgeç"
                variant="secondary"
                onPress={() => setConfirmCancel(false)}
                disabled={busy}
              />
              <Button
                label="Evet, iptal et"
                icon="close"
                variant="danger"
                onPress={() => changeStatus('iptal')}
                disabled={busy}
              />
            </View>
          </View>
        ) : null}

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </Card>

      {editing ? (
        <AppointmentForm
          initial={{
            patient: { id: a.patientId, name: a.patientName },
            date: a.start.slice(0, 10),
            time: a.start.slice(11, 16),
            durationMin: a.durationMin,
            visitType: a.visitType,
            doctorMemberId: a.doctorMemberId,
            chairId: a.chairId,
            deskNote: a.deskNote ?? '',
            procedure: a.clinical?.procedure ?? '',
            clinicalNote: a.clinical?.clinicalNote ?? '',
          }}
          editingId={a.id}
          originalStart={a.start}
          submitLabel="Değişiklikleri kaydet"
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await appointmentRepository.update(session.clinic.id, a.id, input, isClinician);
            setEditing(false);
            reload();
          }}
        />
      ) : (
        <Details a={a} isClinician={isClinician} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  when: { gap: 2, flexShrink: 1 },
  time: { fontSize: 24, fontWeight: '700', color: Colors.text },
  day: { fontSize: 15, color: Colors.textSecondary },
  patientLink: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  confirm: {
    gap: Spacing.md,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  confirmText: { fontSize: 14, color: Colors.danger },
  error: { fontSize: 14, color: Colors.danger },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  rowLabel: { fontSize: 14, color: Colors.textSecondary },
  rowValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },
});
