import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Card, Divider, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { demoTasks } from '@/data/demo';

export default function TasksScreen() {
  // Yalnızca ekranda tutulur; uygulama yeniden açılınca sıfırlanır.
  const [tasks, setTasks] = useState(demoTasks);
  const open = tasks.filter((t) => !t.done).length;

  const toggle = (id: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  return (
    <Screen title="Görevler" subtitle={`${open} açık görev`}>
      <Card title="Klinik görevleri">
        {tasks.map((t, i) => (
          <Fragment key={t.id}>
            {i > 0 && <Divider />}
            <Pressable
              onPress={() => toggle(t.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: t.done }}
              style={styles.row}>
              <Ionicons
                name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={t.done ? Colors.success : Colors.textMuted}
              />
              <View style={styles.body}>
                <Text style={[styles.title, t.done && styles.titleDone]}>{t.title}</Text>
                <Text style={styles.meta}>Son tarih: {t.due}</Text>
              </View>
              {t.priority === 'yuksek' && !t.done ? <Badge label="Öncelikli" tone="warning" /> : null}
            </Pressable>
          </Fragment>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: Colors.text },
  titleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  meta: { fontSize: 13, color: Colors.textSecondary },
});
