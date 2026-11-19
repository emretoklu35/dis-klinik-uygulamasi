import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Chip, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import {
  CHART_COLORS,
  defaultRange,
  Donut,
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
  type CompletedTreatment,
  type DateRange,
} from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL } from '@/lib/money';

export default function CompletedTreatmentsReport() {
  const { can } = useClinicSession();
  const all = can('rapor.oku');
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, loading, error } = useReport<CompletedTreatment>(
    reportsRepository.completedTreatments,
    range,
  );
  const [doctor, setDoctor] = useState<string | null>(null);

  const doctors = [...new Map(data.map((t) => [t.doctorId, t.doctorName])).entries()];
  const rows = data.filter((t) => !doctor || t.doctorId === doctor);
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const patients = new Set(rows.map((t) => t.patientId)).size;

  // İşlem dağılımı: en çok 5 kalem + "Diğer"
  const byProc = [
    ...rows.reduce((m, t) => {
      const x = m.get(t.procedure) ?? { count: 0, amount: 0 };
      m.set(t.procedure, { count: x.count + 1, amount: x.amount + t.amount });
      return m;
    }, new Map<string, { count: number; amount: number }>()),
  ]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
  const top = byProc.slice(0, 5);
  const rest = byProc.slice(5);
  const legend = rest.length
    ? [
        ...top,
        {
          name: 'Diğer',
          count: rest.reduce((s, x) => s + x.count, 0),
          amount: rest.reduce((s, x) => s + x.amount, 0),
        },
      ]
    : top;

  return (
    <Screen inStack>
      <RangeButton range={range} onChange={setRange} />
      {!all ? <Text style={rs.small}>Yalnızca kendi tamamladığınız tedaviler.</Text> : null}
      {all && doctors.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Tüm hekimler" selected={!doctor} onPress={() => setDoctor(null)} />
          {doctors.map(([id, name]) => (
            <Chip key={id} label={name} selected={doctor === id} onPress={() => setDoctor(id)} />
          ))}
        </View>
      ) : null}

      <TileGrid>
        <StatTile icon="people-outline" label="Hastalar" value={String(patients)} />
        <StatTile
          icon="trending-up-outline"
          label="Ortalama Değer"
          value={formatTL(rows.length ? Math.round(total / rows.length) : 0)}
          tone="orange"
        />
        <StatTile icon="medical-outline" label="Toplam Tedavi" value={String(rows.length)} />
        <StatTile icon="cash" label="Toplam Gelir" value={formatTL(total)} tone="green" />
      </TileGrid>

      <View style={styles.dist}>
        <View style={rs.row}>
          <View style={styles.distIcon}>
            <Ionicons name="bar-chart-outline" size={24} color={Colors.primary} />
          </View>
          <Text style={rs.title}>Operasyon Dağılımı</Text>
        </View>
        {rows.length === 0 ? (
          <Text style={rs.muted}>Bu dönemde tamamlanan tedavi yok.</Text>
        ) : (
          <View style={styles.distBody}>
            <Donut
              parts={legend.map((l, i) => ({
                value: l.count,
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              centerTop={String(rows.length)}
              centerBottom="kalem"
            />
            <View style={styles.legend}>
              {legend.map((l, i) => (
                <View key={l.name} style={styles.legendRow}>
                  <View
                    style={[
                      styles.legendBar,
                      { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] },
                    ]}
                  />
                  <Text style={[rs.muted, { flex: 1, color: Colors.text }]} numberOfLines={1}>
                    {l.name}
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{l.count}×</Text>
                  </View>
                  <Text style={styles.legendAmount}>{formatTL(l.amount)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <ListHeader title="Tedaviler" count={rows.length} />
      {error ? (
        <Text style={rs.empty}>{error}</Text>
      ) : loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : (
        rows.map((t) => (
          <View key={t.id} style={rs.card}>
            <View style={rs.row}>
              <Text style={[rs.title, { flexShrink: 1 }]}>{t.procedure}</Text>
              <View style={rs.badge}>
                <Text style={rs.badgeText}>🦷 {t.tooth ? t.tooth : 'Tüm Ağız'}</Text>
              </View>
              <Text style={[rs.title, { marginLeft: 'auto', color: Colors.primary }]}>
                {formatTL(t.amount)}
              </Text>
            </View>
            <View style={rs.row}>
              <Ionicons name="medkit-outline" size={16} color={Colors.textMuted} />
              <Text style={rs.muted}>{t.doctorName}</Text>
            </View>
            <View style={rs.row}>
              <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
              <Link
                href={{ pathname: '/hastalar/[id]', params: { id: t.patientId, sekme: 'tedavi' } }}
                withAnchor
                style={[rs.muted, { color: Colors.primary }]}>
                {t.patientName}
              </Link>
            </View>
            <View style={rs.row}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
              <Text style={[rs.small, { flex: 1 }]}>{stamp(t.completedAt, t.doneOn)}</Text>
              <View style={[rs.badge, { backgroundColor: Colors.successSoft }]}>
                <Text style={[rs.badgeText, { color: Colors.success }]}>✓ Tamamlandı</Text>
              </View>
            </View>
            {t.amount === 0 ? (
              <Text style={rs.small}>Bu tedaviye bağlı ücret yok (gelire yansımaz).</Text>
            ) : null}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  dist: {
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 20,
    backgroundColor: '#DCE7F5',
  },
  distIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distBody: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.lg },
  legend: { flex: 1, minWidth: 180, gap: Spacing.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  legendBar: { width: 4, height: 28, borderRadius: 2 },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(42,111,201,0.15)',
  },
  countText: { fontSize: 12, color: Colors.primary },
  legendAmount: { fontSize: 15, color: Colors.text, minWidth: 90, textAlign: 'right' },
});
