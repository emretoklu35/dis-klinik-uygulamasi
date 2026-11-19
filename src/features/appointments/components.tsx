import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

import { visitTypeColors } from './clinic';
import type { Appointment } from './types';
import { appointmentTitle, startTime, statusLabels, statusTone, timeRange } from './utils';

export function StatusBadge({ appointment }: { appointment: Appointment }) {
  return <Badge label={statusLabels[appointment.status]} tone={statusTone[appointment.status]} />;
}

/** Listede bir randevu satırı; dokununca randevu detayını açar. */
export function AppointmentCard({
  appointment: a,
  showDoctor = true,
}: {
  appointment: Appointment;
  showDoctor?: boolean;
}) {
  const cancelled = a.status === 'iptal';
  return (
    <Link href={{ pathname: '/takvim/[id]', params: { id: a.id } }} withAnchor asChild>
      <Pressable accessibilityRole="link">
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.pressed, cancelled && styles.cancelled]}>
            <View style={styles.time}>
              <Text style={styles.timeText}>{startTime(a)}</Text>
              <Text style={styles.duration}>{a.durationMin} dk</Text>
            </View>
            <View style={styles.body}>
              <Text style={[styles.patient, cancelled && styles.strike]} numberOfLines={1}>
                {a.patientName}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                <Text style={{ color: visitTypeColors[a.visitType] }}>● </Text>
                {appointmentTitle(a)}
                {showDoctor ? ` · ${a.doctorName}` : ''} · {a.chairName}
              </Text>
            </View>
            <StatusBadge appointment={a} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

/** Geniş ekrandaki haftalık sütunlar için sıkı görünüm. */
export function AppointmentChip({ appointment: a }: { appointment: Appointment }) {
  const cancelled = a.status === 'iptal';
  const tone = {
    bekliyor: Colors.warning,
    onaylandi: Colors.primary,
    tamamlandi: Colors.success,
    gelmedi: Colors.danger,
    iptal: Colors.textMuted,
  }[a.status];
  return (
    <Link href={{ pathname: '/takvim/[id]', params: { id: a.id } }} withAnchor asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${timeRange(a)} ${a.patientName}, ${statusLabels[a.status]}`}>
        {({ pressed }) => (
          <View
            style={[
              styles.chip,
              { borderLeftColor: tone },
              pressed && styles.pressed,
              cancelled && styles.cancelled,
            ]}>
            <Text style={styles.chipTime}>{timeRange(a)}</Text>
            <Text style={[styles.chipName, cancelled && styles.strike]} numberOfLines={1}>
              {a.patientName}
            </Text>
            <Text style={styles.chipMeta} numberOfLines={1}>
              <Text style={{ color: visitTypeColors[a.visitType] }}>● </Text>
              {appointmentTitle(a)}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  pressed: { opacity: 0.6 },
  cancelled: { opacity: 0.55 },
  strike: { textDecorationLine: 'line-through' },
  time: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    width: 64,
    alignItems: 'center',
  },
  timeText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  duration: { fontSize: 11, color: Colors.primary },
  body: { flex: 1, gap: 2, minWidth: 0 },
  patient: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary },
  chip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderRadius: Radius.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    gap: 1,
  },
  chipTime: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  chipName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  chipMeta: { fontSize: 11, color: Colors.textMuted },
});
