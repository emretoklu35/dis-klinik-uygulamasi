import { Link } from 'expo-router';
import { Fragment } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Divider, Grid, gridItem, Screen, StatCard } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { demoTasks } from '@/data/demo';
import { clinicConfig } from '@/features/appointments/clinic';
import { AppointmentCard } from '@/features/appointments/components';
import { useAppointmentsRange } from '@/features/appointments/hooks';
import { todayKey } from '@/lib/dates';

export default function HomeScreen() {
  const day = todayKey();
  const { data: todays, loading } = useAppointmentsRange(day, day);
  const today = todays.filter((a) => a.status !== 'iptal');
  const openTasks = demoTasks.filter((t) => !t.done);
  const dateText = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen title="Günaydın 👋" subtitle={`${clinicConfig.name} · ${dateText}`}>
      <Grid>
        <StatCard label="Bugünkü randevu" value={today.length} icon="calendar-outline" />
        <StatCard
          label="Onay bekleyen"
          value={today.filter((a) => a.status === 'bekliyor').length}
          icon="time-outline"
          tint={Colors.warning}
          tintSoft={Colors.warningSoft}
        />
        <StatCard
          label="Açık görev"
          value={openTasks.length}
          icon="checkbox-outline"
          tint={Colors.success}
          tintSoft={Colors.successSoft}
        />
        <StatCard label="Tedavi koltuğu" value={clinicConfig.chairs.length} icon="medkit-outline" />
      </Grid>

      <Grid>
        <Card
          title="Bugünün programı"
          style={gridItem}
          action={
            <Link href="/takvim" style={styles.link}>
              Takvime git
            </Link>
          }>
          {loading && todays.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : today.length === 0 ? (
            <Text style={styles.empty}>Bugün için randevu yok.</Text>
          ) : (
            today.map((a, i) => (
              <Fragment key={a.id}>
                {i > 0 && <Divider />}
                <AppointmentCard appointment={a} />
              </Fragment>
            ))
          )}
        </Card>

        <Card
          title="Öncelikli görevler"
          style={gridItem}
          action={
            <Link href="/gorevler" style={styles.link}>
              Tümü
            </Link>
          }>
          {openTasks.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <Divider />}
              <View style={styles.task}>
                <Text style={styles.taskTitle}>{t.title}</Text>
                <Badge
                  label={t.due}
                  tone={t.priority === 'yuksek' ? 'warning' : 'muted'}
                />
              </View>
            </Fragment>
          ))}
        </Card>
      </Grid>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  task: { gap: Spacing.xs },
  taskTitle: { fontSize: 15, color: Colors.text },
  empty: { fontSize: 14, color: Colors.textSecondary },
});
