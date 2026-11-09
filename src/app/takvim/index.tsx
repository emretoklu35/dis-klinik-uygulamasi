import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card, CenteredMessage, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { nextWorkingDay } from '@/features/appointments/clinic';
import { AppointmentCard, AppointmentChip } from '@/features/appointments/components';
import { useAppointmentsRange } from '@/features/appointments/hooks';
import type { Appointment } from '@/features/appointments/types';
import { useClinicSession, type ClinicInfo } from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import {
  addDays,
  formatDayLong,
  formatDayShort,
  isoWeekday,
  formatRange,
  startOfWeek,
  todayKey,
} from '@/lib/dates';

/** Pazar günü açılırsa bir sonraki pazartesiyi göster. */
const weekdayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Seçili güne göre: "Bugüne…", "Yarına…", ya da "Perşembe gününe randevu ekle". */
function addButtonLabel(selected: string, today: string) {
  if (selected === today) return 'Bugüne randevu ekle';
  if (selected === addDays(today, 1)) return 'Yarına randevu ekle';
  return `${weekdayNames[isoWeekday(selected) - 1]} gününe randevu ekle`;
}

function initialDay(clinic: ClinicInfo) {
  return nextWorkingDay(todayKey(), clinic);
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
      hitSlop={6}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
    </Pressable>
  );
}

export default function CalendarScreen() {
  const router = useRouter();
  const isWide = useIsWideLayout();
  const { clinic, can } = useClinicSession();
  const canWrite = can('randevu.yaz');
  const [selected, setSelected] = useState(() => initialDay(clinic));
  const weekStart = startOfWeek(selected);
  const days = useMemo(
    () => clinic.workingDays.map((d) => addDays(weekStart, d - 1)),
    [weekStart, clinic.workingDays],
  );
  const weekEnd = days[days.length - 1];
  const { data, loading, error } = useAppointmentsRange(weekStart, weekEnd);

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>(days.map((d) => [d, []]));
    for (const a of data) map.get(a.start.slice(0, 10))?.push(a);
    return map;
  }, [data, days]);

  const today = todayKey();
  const active = data.filter((a) => a.status !== 'iptal');
  const waiting = data.filter((a) => a.status === 'bekliyor').length;
  const goWeek = (delta: number) => setSelected(addDays(weekStart, delta * 7));
  const newAppointment = (date?: string) =>
    router.push({ pathname: '/takvim/yeni', params: date ? { date } : {} });

  return (
    <Screen
      title="Takvim"
      subtitle={`${formatRange(weekStart, weekEnd)} · ${active.length} randevu${waiting ? ` · ${waiting} onay bekliyor` : ''}`}
      headerRight={
        canWrite ? (
          <Button label="Yeni randevu" icon="add" onPress={() => newAppointment(selected)} />
        ) : null
      }>
      <View style={styles.weekNav}>
        <IconButton icon="chevron-back" label="Önceki hafta" onPress={() => goWeek(-1)} />
        <Pressable
          onPress={() => setSelected(initialDay(clinic))}
          accessibilityRole="button"
          style={styles.todayButton}>
          <Text style={styles.todayText}>Bugün</Text>
        </Pressable>
        <IconButton icon="chevron-forward" label="Sonraki hafta" onPress={() => goWeek(1)} />
      </View>

      {error ? (
        <Card>
          <CenteredMessage icon="alert-circle-outline" title={error} />
        </Card>
      ) : isWide ? (
        /* Geniş ekran: haftanın tüm günleri yan yana */
        <Card style={styles.weekCard}>
          <View style={styles.columns}>
            {days.map((d) => {
              const items = byDay.get(d) ?? [];
              const isToday = d === today;
              return (
                <View key={d} style={styles.column}>
                  <View style={[styles.columnHeader, isToday && styles.columnHeaderToday]}>
                    <Text style={[styles.columnTitle, isToday && styles.columnTitleToday]}>
                      {formatDayShort(d)}
                    </Text>
                    <Text style={[styles.columnCount, isToday && styles.columnTitleToday]}>
                      {items.filter((a) => a.status !== 'iptal').length} randevu
                    </Text>
                  </View>
                  {loading && data.length === 0 ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    items.map((a) => <AppointmentChip key={a.id} appointment={a} />)
                  )}
                  {canWrite && d >= today ? (
                    <Pressable
                      onPress={() => newAppointment(d)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatDayLong(d)} için randevu ekle`}
                      style={({ pressed }) => [styles.addSlot, pressed && { opacity: 0.6 }]}>
                      <Ionicons name="add" size={16} color={Colors.primary} />
                      <Text style={styles.addSlotText}>Ekle</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Card>
      ) : (
        /* Dar ekran: gün seçici + seçili günün listesi */
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.days}>
            {days.map((d) => {
              const isSelected = d === selected;
              const count = (byDay.get(d) ?? []).filter((a) => a.status !== 'iptal').length;
              return (
                <Pressable
                  key={d}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.day,
                    isSelected && styles.daySelected,
                    d === today && !isSelected && styles.dayToday,
                  ]}>
                  <Text style={[styles.dayLabel, isSelected && styles.onPrimary]}>
                    {formatDayShort(d)}
                  </Text>
                  <Text style={[styles.dayCount, isSelected && styles.onPrimary]}>
                    {count} randevu
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Card title={formatDayLong(selected)}>
            {loading && data.length === 0 ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (byDay.get(selected) ?? []).length === 0 ? (
              <Text style={styles.empty}>Bu gün için randevu yok.</Text>
            ) : (
              (byDay.get(selected) ?? []).map((a, i) => (
                <Fragment key={a.id}>
                  {i > 0 && <Divider />}
                  <AppointmentCard appointment={a} />
                </Fragment>
              ))
            )}
            {canWrite && selected >= today ? (
              <Button
                label={addButtonLabel(selected, today)}
                icon="add"
                variant="secondary"
                onPress={() => newAppointment(selected)}
              />
            ) : null}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButton: {
    height: 40,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  todayText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  weekCard: { padding: Spacing.md },
  columns: { flexDirection: 'row', gap: Spacing.sm },
  column: { flex: 1, minWidth: 0, gap: Spacing.sm },
  columnHeader: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: Colors.background,
  },
  columnHeaderToday: { backgroundColor: Colors.primary },
  columnTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  columnTitleToday: { color: '#FFFFFF' },
  columnCount: { fontSize: 12, color: Colors.textSecondary },
  addSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  addSlotText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  days: { gap: Spacing.sm },
  day: {
    minWidth: 96,
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
  dayToday: { borderColor: Colors.primary },
  dayLabel: { fontSize: 14, fontWeight: '700', color: Colors.text },
  dayCount: { fontSize: 12, color: Colors.textSecondary },
  onPrimary: { color: '#FFFFFF' },
  empty: { fontSize: 14, color: Colors.textSecondary },
});
