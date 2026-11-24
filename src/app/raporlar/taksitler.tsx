/**
 * Taksit takibi: tüm hastaların geciken ve vadesi yaklaşan taksitleri.
 * Resepsiyon kimi arayacağını tek ekranda görür; satıra basınca hastanın Ödemeler'i açılır.
 */

import { useRouter } from 'expo-router';
import { Fragment, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, CenteredMessage, Chip, Divider, Screen } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { DateTile, dueText } from '@/features/payments/installments';
import { paymentRepository, type DueInstallment } from '@/features/payments/payments';
import { useClinicSession } from '@/features/session/session-context';
import { addDays, todayKey } from '@/lib/dates';
import { formatTL } from '@/lib/money';
import { useFocusLoad } from '@/lib/use-focus-load';

const RANGES = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '3 ay' },
];

export default function InstallmentsReportScreen() {
  const router = useRouter();
  const { clinic, can } = useClinicSession();
  const [days, setDays] = useState(7);
  const today = todayKey();
  const load = useCallback(
    () =>
      can('odeme.oku')
        ? paymentRepository.listDueInstallments(clinic.id, addDays(today, days))
        : Promise.resolve([] as DueInstallment[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clinic.id, days, today],
  );
  const { data, loading, error } = useFocusLoad<DueInstallment[]>(
    load,
    [],
    'Taksitler yüklenemedi.',
  );

  if (!can('odeme.oku')) {
    return (
      <Screen inStack>
        <Text style={styles.muted}>Taksitleri görme yetkiniz yok.</Text>
      </Screen>
    );
  }

  const overdue = data.filter((i) => i.dueDate < today);
  const dueToday = data.filter((i) => i.dueDate === today);
  const upcoming = data.filter((i) => i.dueDate > today);
  const open = (list: DueInstallment[]) => list.reduce((s, i) => s + i.amount - i.paid, 0);

  const group = (title: string, list: DueInstallment[], color: string) =>
    list.length === 0 ? null : (
      <Card title={`${title} · ${list.length}`}>
        <Text style={[styles.groupTotal, { color }]}>Bekleyen tutar {formatTL(open(list))}</Text>
        {list.map((i, k) => (
          <Fragment key={i.id}>
            {k > 0 ? <Divider /> : null}
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/hastalar/[id]',
                  params: { id: i.patientId, sekme: 'odeme' },
                })
              }
              accessibilityRole="link"
              accessibilityHint="Hastanın ödemelerini aç"
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
              <DateTile dayKey={i.dueDate} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{i.patientName}</Text>
                <Text style={styles.muted}>
                  Taksit {i.seq}/{i.count} · {i.planTitle}
                </Text>
                <Text style={[styles.muted, i.dueDate < today && { color: Colors.danger }]}>
                  {dueText(i, today)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatTL(i.amount - i.paid)}</Text>
            </Pressable>
          </Fragment>
        ))}
      </Card>
    );

  return (
    <Screen inStack>
      <View style={styles.filters}>
        <Text style={styles.muted}>Geciken taksitler ve önümüzdeki</Text>
        {RANGES.map((r) => (
          <Chip
            key={r.days}
            label={r.label}
            selected={days === r.days}
            onPress={() => setDays(r.days)}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xl }} />
      ) : data.length === 0 ? (
        <Card>
          <CenteredMessage
            icon="checkmark-done-outline"
            title="Bekleyen taksit yok"
            text="Geciken ya da bu dönemde vadesi gelen taksit bulunmuyor."
          />
        </Card>
      ) : (
        <>
          {group('Geciken', overdue, Colors.danger)}
          {group('Bugün', dueToday, Colors.warning)}
          {group('Yaklaşan', upcoming, Colors.primary)}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
  muted: { fontSize: 12, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
  groupTotal: { fontSize: 13, fontFamily: Fonts.bodySemi },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  name: { fontSize: 15, fontFamily: Fonts.bodySemi, color: Colors.text },
  amount: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
});
