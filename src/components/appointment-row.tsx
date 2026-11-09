import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { DemoAppointment } from '@/data/demo';

export function AppointmentRow({ item }: { item: DemoAppointment }) {
  return (
    <View style={styles.row}>
      <View style={styles.time}>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.patient}>{item.patient}</Text>
        <Text style={styles.meta}>
          {item.procedure} · {item.doctor}
        </Text>
      </View>
      <Badge
        label={item.status === 'onaylandi' ? 'Onaylandı' : 'Bekliyor'}
        tone={item.status === 'onaylandi' ? 'success' : 'warning'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  time: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    width: 60,
    alignItems: 'center',
  },
  timeText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  body: { flex: 1, gap: 2 },
  patient: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary },
});
