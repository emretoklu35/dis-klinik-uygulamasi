import { Link } from 'expo-router';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppointmentRow } from '@/components/appointment-row';
import { Badge, Card, Divider, Grid, gridItem, Screen, StatCard } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { demoAppointments, demoClinic, demoTasks } from '@/data/demo';

export default function HomeScreen() {
  const today = demoAppointments.filter((a) => a.day === 0);
  const openTasks = demoTasks.filter((t) => !t.done);
  const dateText = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <Screen title="Günaydın 👋" subtitle={`${demoClinic.name} · ${dateText}`}>
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
        <StatCard label="Tedavi koltuğu" value={demoClinic.chairs} icon="medkit-outline" />
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
          {today.map((a, i) => (
            <Fragment key={a.id}>
              {i > 0 && <Divider />}
              <AppointmentRow item={a} />
            </Fragment>
          ))}
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
});
