import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { methodLabels, type PaymentMethod } from '@/features/payments/payments';
import {
  defaultRange,
  Initials,
  ListHeader,
  RangeButton,
  reportStyles as rs,
  stamp,
  StatTile,
  TileGrid,
} from '@/features/reports/components';
import {
  reportsRepository,
  useReport,
  type DateRange,
  type PaymentRow,
} from '@/features/reports/reports';
import { formatTL } from '@/lib/money';

const METHOD_ORDER: PaymentMethod[] = ['nakit', 'kredi_karti', 'havale', 'diger'];
const METHOD_COLORS: Record<PaymentMethod, string> = {
  nakit: '#E0992E',
  kredi_karti: Colors.primary,
  havale: '#2E9A7E',
  diger: '#64748B',
};

export default function DayEndReport() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, loading, error } = useReport<PaymentRow>(reportsRepository.payments, range);
  const [showDist, setShowDist] = useState(false);

  const total = data.reduce((s, p) => s + p.amount, 0);
  const by = (m: PaymentMethod) =>
    data.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);

  return (
    <Screen inStack>
      <RangeButton range={range} onChange={setRange} />

      <TileGrid>
        <StatTile
          icon="cash-outline"
          label="Nakit"
          value={formatTL(by('nakit'))}
          iconBg="#FFF3DC"
          iconColor="#E0992E"
        />
        <StatTile icon="card-outline" label="Kredi Kartı" value={formatTL(by('kredi_karti'))} />
        <StatTile
          icon="receipt-outline"
          label="Toplam Ödeme"
          value={String(data.length)}
          tone="orange"
        />
        <StatTile icon="cash" label="Toplam Tutar" value={formatTL(total)} tone="green" />
      </TileGrid>

      <View style={rs.card}>
        <Pressable
          onPress={() => setShowDist((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showDist }}
          style={styles.collapse}>
          <Text style={rs.title}>Gelir Dağılımı</Text>
          <Ionicons
            name={showDist ? 'chevron-up' : 'chevron-down'}
            size={22}
            color={Colors.textSecondary}
          />
        </Pressable>
        {showDist
          ? METHOD_ORDER.map((m) => {
              const v = by(m);
              const pct = total ? Math.round((v / total) * 100) : 0;
              return (
                <View key={m} style={{ gap: 4 }}>
                  <View style={rs.row}>
                    <Text style={[rs.muted, { flex: 1 }]}>{methodLabels[m]}</Text>
                    <Text style={rs.muted}>%{pct}</Text>
                    <Text
                      style={[rs.muted, { minWidth: 110, textAlign: 'right', color: Colors.text }]}>
                      {formatTL(v)}
                    </Text>
                  </View>
                  <View style={styles.bar}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${pct}%`, backgroundColor: METHOD_COLORS[m] },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          : null}
      </View>

      <ListHeader title="Ödemeler" count={data.length} />
      {error ? (
        <Text style={rs.empty}>{error}</Text>
      ) : loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : data.length === 0 ? (
        <Text style={rs.empty}>Bu dönemde ödeme yok.</Text>
      ) : (
        data.map((p) => (
          <View key={p.id} style={rs.card}>
            <View style={[rs.row, { alignItems: 'flex-start' }]}>
              <Initials name={p.patientName} size={36} />
              <View style={{ flex: 1, gap: 6 }}>
                <Link
                  href={{ pathname: '/hastalar/[id]', params: { id: p.patientId, sekme: 'odeme' } }}
                  withAnchor
                  style={rs.link}>
                  {p.patientName}
                </Link>
                <View style={rs.row}>
                  <Ionicons name="person-outline" size={15} color={Colors.textMuted} />
                  <Text style={rs.muted}>Alan: {p.receivedByName}</Text>
                </View>
                <View style={rs.row}>
                  <Ionicons name="card-outline" size={15} color={Colors.textMuted} />
                  <Text style={rs.muted}>{methodLabels[p.method]}</Text>
                </View>
                <View style={rs.row}>
                  <Ionicons name="calendar-outline" size={15} color={Colors.textMuted} />
                  <Text style={rs.small}>{stamp(undefined, p.paidOn)}</Text>
                </View>
              </View>
              <Text style={rs.amount}>{formatTL(p.amount)}</Text>
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  collapse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#EEF1F5', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
