import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  CenteredMessage,
  Divider,
  Screen,
  Segmented,
  TextField,
} from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useClinicSession } from '@/features/session/session-context';
import {
  dueLabel,
  taskRepository,
  useTasks,
  type Task,
  type TaskPriority,
} from '@/features/tasks/tasks';
import { addDays, todayKey } from '@/lib/dates';

type DueChoice = 'bugun' | 'yarin' | 'hafta' | 'yok';
const dueOptions: { value: DueChoice; label: string }[] = [
  { value: 'bugun', label: 'Bugün' },
  { value: 'yarin', label: 'Yarın' },
  { value: 'hafta', label: '1 hafta' },
  { value: 'yok', label: 'Tarihsiz' },
];

function dueFromChoice(c: DueChoice) {
  const t = todayKey();
  return c === 'bugun'
    ? t
    : c === 'yarin'
      ? addDays(t, 1)
      : c === 'hafta'
        ? addDays(t, 7)
        : undefined;
}

function NewTask({ onCreated }: { onCreated: () => void }) {
  const { clinic } = useClinicSession();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<DueChoice>('bugun');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!title.trim()) {
      setError('Görev başlığı yazın.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await taskRepository.create(clinic.id, {
        title: title.trim(),
        dueDate: dueFromChoice(due),
        priority,
      });
      setTitle('');
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Görev eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Yeni görev">
      <TextField
        label="Başlık"
        value={title}
        onChangeText={setTitle}
        placeholder="Ör. Sterilizasyon kayıtlarını kontrol et"
        hint="Hasta sağlık bilgisi yazmayın; görevleri tüm personel görür."
        error={error ?? undefined}
        onSubmitEditing={add}
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <Segmented label="Son tarih" value={due} options={dueOptions} onChange={setDue} />
        </View>
        <View style={styles.col}>
          <Segmented
            label="Öncelik"
            value={priority}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'yuksek', label: 'Yüksek' },
            ]}
            onChange={setPriority}
          />
        </View>
      </View>
      <View style={styles.actions}>
        <Button
          label={busy ? 'Ekleniyor…' : 'Görevi ekle'}
          icon="add"
          onPress={add}
          disabled={busy}
        />
      </View>
    </Card>
  );
}

export default function TasksScreen() {
  const { can } = useClinicSession();
  const { data, loading, error, reload } = useTasks();
  // Dokununca anında değişsin; sunucu yanıtı gelince liste yeniden yüklenir.
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const tasks: Task[] = data.map((t) => (t.id in pending ? { ...t, done: pending[t.id] } : t));
  const open = tasks.filter((t) => !t.done).length;

  const toggle = async (t: Task) => {
    setActionError(null);
    setPending((p) => ({ ...p, [t.id]: !t.done }));
    try {
      await taskRepository.setDone(t.id, !t.done);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Görev güncellenemedi.');
    } finally {
      setPending(({ [t.id]: _done, ...rest }) => rest);
      reload();
    }
  };

  return (
    <Screen
      title="Görevler"
      subtitle={loading && data.length === 0 ? 'Yükleniyor…' : `${open} açık görev`}>
      {can('gorev.yaz') ? <NewTask onCreated={reload} /> : null}

      <Card title="Klinik görevleri">
        {error ? (
          <CenteredMessage icon="alert-circle-outline" title={error} />
        ) : loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} />
        ) : tasks.length === 0 ? (
          <Text style={styles.meta}>Henüz görev yok.</Text>
        ) : (
          tasks.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={() => toggle(t)}
                disabled={!can('gorev.yaz')}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: t.done }}
                style={styles.task}>
                <Ionicons
                  name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={t.done ? Colors.success : Colors.textMuted}
                />
                <View style={styles.body}>
                  <Text style={[styles.title, t.done && styles.titleDone]}>{t.title}</Text>
                  <Text style={styles.meta}>Son tarih: {dueLabel(t.dueDate)}</Text>
                </View>
                {t.priority === 'yuksek' && !t.done ? (
                  <Badge label="Öncelikli" tone="warning" />
                ) : null}
              </Pressable>
            </Fragment>
          ))
        )}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 260 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  task: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 15, color: Colors.text },
  titleDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  meta: { fontSize: 13, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
});
