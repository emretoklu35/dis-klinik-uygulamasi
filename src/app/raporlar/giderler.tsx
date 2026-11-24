/**
 * Giderler (muhasebe, yönetici, klinik sahibi): laboratuvar faturaları ve stok alımları.
 * Laboratuvar giderleri hekim ve laboratuvar bazında da özetlenir.
 */

import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Chip, Screen } from '@/components/ui';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { labRepository, type ExpenseRow } from '@/features/costs/costs';
import {
  ListHeader,
  RangeButton,
  reportStyles as rs,
  StatTile,
  TileGrid,
} from '@/features/reports/components';
import type { DateRange } from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, todayKey } from '@/lib/dates';
import { formatTL } from '@/lib/money';
import { useFocusLoad } from '@/lib/use-focus-load';

const thisMonth = (): DateRange => {
  const t = todayKey();
  return { from: `${t.slice(0, 8)}01`, to: t };
};

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <View style={rs.card}>
      <Text style={rs.title}>{title}</Text>
      {rows.map(([name, amount]) => (
        <View key={name} style={{ gap: 4 }}>
          <View style={rs.row}>
            <Text style={[rs.muted, { flex: 1, color: Colors.text }]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.amount}>{formatTL(amount)}</Text>
          </View>
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round((amount / max) * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function ExpensesReport() {
  const { clinic, can } = useClinicSession();
  const [range, setRange] = useState<DateRange>(thisMonth);
  const [kind, setKind] = useState<'tumu' | ExpenseRow['kind']>('tumu');
  const load = useCallback(
    () =>
      can('maliyet.oku')
        ? labRepository.expenses(clinic.id, range.from, range.to)
        : Promise.resolve([] as ExpenseRow[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clinic.id, range.from, range.to],
  );
  const { data, loading, error } = useFocusLoad<ExpenseRow[]>(load, [], 'Giderler yüklenemedi.');

  if (!can('maliyet.oku')) {
    return (
      <Screen inStack>
        <Text style={rs.muted}>Giderleri muhasebe, yönetici ve klinik sahibi görür.</Text>
      </Screen>
    );
  }

  const lab = data.filter((r) => r.kind === 'laboratuvar');
  const stock = data.filter((r) => r.kind === 'stok');
  const sum = (list: ExpenseRow[]) => list.reduce((s, r) => s + r.amount, 0);
  const group = (list: ExpenseRow[], key: (r: ExpenseRow) => string): [string, number][] =>
    [
      ...list.reduce(
        (m, r) => m.set(key(r), (m.get(key(r)) ?? 0) + r.amount),
        new Map<string, number>(),
      ),
    ].sort((a, b) => b[1] - a[1]);
  const rows = data.filter((r) => kind === 'tumu' || r.kind === kind);

  return (
    <Screen inStack>
      <RangeButton range={range} onChange={setRange} />
      <TileGrid>
        <StatTile icon="cash" label="Toplam gider" value={formatTL(sum(data))} tone="orange" />
        <StatTile icon="flask-outline" label="Laboratuvar" value={formatTL(sum(lab))} />
        <StatTile icon="cube-outline" label="Stok alımları" value={formatTL(sum(stock))} />
        <StatTile icon="receipt-outline" label="Kalem" value={String(data.length)} />
      </TileGrid>

      <Breakdown title="Laboratuvarlara göre" rows={group(lab, (r) => r.label)} />
      <Breakdown
        title="Hekimlere göre (laboratuvar)"
        rows={group(lab, (r) => r.doctorName ?? '—')}
      />
      <Breakdown
        title="Malzemelere göre (stok alımı)"
        rows={group(stock, (r) => r.label).slice(0, 8)}
      />

      <View style={styles.chips}>
        <Chip label="Tümü" selected={kind === 'tumu'} onPress={() => setKind('tumu')} />
        <Chip
          label="Laboratuvar"
          selected={kind === 'laboratuvar'}
          onPress={() => setKind('laboratuvar')}
        />
        <Chip label="Stok alımları" selected={kind === 'stok'} onPress={() => setKind('stok')} />
      </View>
      <ListHeader title="Gider kalemleri" count={rows.length} />
      {error ? (
        <Text style={rs.empty}>{error}</Text>
      ) : loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : rows.length === 0 ? (
        <Text style={rs.empty}>Bu dönemde gider yok.</Text>
      ) : (
        rows.map((r) => (
          <View key={`${r.kind}-${r.ref}-${r.detail}`} style={rs.card}>
            <View style={rs.row}>
              <View
                style={[rs.badge, r.kind === 'stok' && { backgroundColor: Colors.warningSoft }]}>
                <Text style={[rs.badgeText, r.kind === 'stok' && { color: Colors.warning }]}>
                  {r.kind === 'stok' ? 'Stok alımı' : 'Laboratuvar'}
                </Text>
              </View>
              <Text style={[rs.title, { flex: 1 }]} numberOfLines={1}>
                {r.label}
              </Text>
              <Text style={styles.amount}>{formatTL(r.amount)}</Text>
            </View>
            <Text style={rs.muted}>
              {formatDateInput(r.day)} · {r.detail}
              {r.doctorName ? ` · ${r.doctorName}` : ''}
            </Text>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  amount: { fontSize: 14, fontFamily: Fonts.bodyBold, color: Colors.text },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#E6EBE9', overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: Colors.primary },
});
