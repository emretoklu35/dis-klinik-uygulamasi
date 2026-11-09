import { Fragment, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { AppointmentRow } from '@/components/appointment-row';
import { Card, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { demoAppointments, weekDays, weekDaysLong } from '@/data/demo';

export default function CalendarScreen() {
  const [day, setDay] = useState(0);
  const items = demoAppointments.filter((a) => a.day === day);

  return (
    <Screen title="Takvim" subtitle="Haftalık randevu görünümü (örnek hafta).">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
        {weekDays.map((label, i) => {
          const selected = i === day;
          const count = demoAppointments.filter((a) => a.day === i).length;
          return (
            <Pressable
              key={label}
              onPress={() => setDay(i)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[styles.day, selected && styles.daySelected]}>
              <Text style={[styles.dayLabel, selected && styles.dayLabelSelected]}>{label}</Text>
              <Text style={[styles.dayCount, selected && styles.dayLabelSelected]}>
                {count} randevu
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card title={weekDaysLong[day]}>
        {items.length === 0 ? (
          <Text style={styles.empty}>Bu gün için randevu yok.</Text>
        ) : (
          items.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Divider />}
              <AppointmentRow item={a} />
            </Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { gap: Spacing.sm },
  day: {
    minWidth: 92,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 2,
  },
  daySelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayLabel: { fontSize: 15, fontWeight: '700', color: Colors.text },
  dayLabelSelected: { color: '#FFFFFF' },
  dayCount: { fontSize: 12, color: Colors.textSecondary },
  empty: { fontSize: 14, color: Colors.textSecondary },
});
