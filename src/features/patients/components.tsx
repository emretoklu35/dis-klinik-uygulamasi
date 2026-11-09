import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';

import type { PatientSummary } from './types';
import { formatDate, formatDateTime, fullName, initials } from './utils';

export function PatientAvatar({
  patient,
  size = 40,
}: {
  patient: { firstName: string; lastName: string };
  size?: number;
}) {
  return (
    <View style={[styles.avatar, { width: size, height: size }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials(patient)}</Text>
    </View>
  );
}

export function PatientListItem({ patient }: { patient: PatientSummary }) {
  return (
    <Link href={{ pathname: '/hastalar/[id]', params: { id: patient.id } }} asChild>
      <Pressable accessibilityRole="link">
        {({ pressed }) => (
          <View style={[styles.row, pressed && styles.rowPressed]}>
            <PatientAvatar patient={patient} />
            <View style={styles.body}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {fullName(patient)}
                </Text>
                {patient.hasAllergy ? (
                  <Ionicons
                    name="warning"
                    size={14}
                    color={Colors.danger}
                    accessibilityLabel="Alerjisi var"
                  />
                ) : null}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {patient.phone} · Son ziyaret: {formatDate(patient.lastVisit)}
              </Text>
              {patient.nextAppointment ? (
                <Badge label={`Randevu: ${formatDateTime(patient.nextAppointment)}`} tone="primary" />
              ) : patient.activeTreatments > 0 ? (
                <Badge label={`${patient.activeTreatments} açık tedavi`} tone="warning" />
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  rowPressed: { opacity: 0.6 },
  body: { flex: 1, gap: 4, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  meta: { fontSize: 13, color: Colors.textSecondary },
});
