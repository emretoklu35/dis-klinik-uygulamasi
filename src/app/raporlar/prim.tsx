import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
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
  basisInfo,
  reportsRepository,
  useReport,
  type CommissionBasis,
  type CommissionItem,
  type DateRange,
} from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL } from '@/lib/money';

type DoctorSum = {
  id: string;
  name: string;
  rate: number;
  amount: number;
  paid: number;
  prim: number;
  pending: number;
  count: number;
};

function ItemRow({ it, basis }: { it: CommissionItem; basis: CommissionBasis }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={rs.card}>
      <View style={[rs.row, { alignItems: 'flex-start' }]}>
        <View>
          <Initials name={it.doctorName} size={48} />
          <View style={styles.rateDot}>
            <Text style={styles.rateDotText}>%</Text>
          </View>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[rs.title, { fontSize: 17 }]} numberOfLines={1}>
            {it.patientName}
          </Text>
          <Text style={rs.muted}>
            {it.label}
            {it.tooth ? ` (#${it.tooth})` : ''}
          </Text>
          <View style={rs.row}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
            <Text style={rs.small}>{stamp(undefined, it.date)}</Text>
          </View>
        </View>
        <View style={styles.primChip}>
          <Text style={styles.primChipText}>{formatTL(it.prim)}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.text} />
      </View>
      {open ? (
        <View style={styles.detail}>
          <Line label="Hekim" value={`${it.doctorName} · %${it.rate}`} />
          <Line
            label={basis === 'nakit' ? 'Hekime düşen tahsilat' : 'Tedavi ücreti'}
            value={formatTL(it.amount)}
          />
          {basis !== 'nakit' ? (
            <Line label="Hastanın ödediği kısım" value={formatTL(it.paidAmount)} />
          ) : null}
          <Line label="Prim" value={formatTL(it.prim)} strong />
          {basis === 'odeme_tedavi' && it.primPending > 0 ? (
            <Line label="Bekleyen prim (ödeme gelince)" value={formatTL(it.primPending)} />
          ) : null}
          {it.amount === 0 ? (
            <Text style={rs.small}>Bu tedaviye bağlı ücret yok; prim hesaplanmaz.</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={rs.row}>
      <Text style={[rs.muted, { flex: 1 }]}>{label}</Text>
      <Text style={[rs.muted, { color: Colors.text }, strong && { fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

export default function CommissionReport() {
  const router = useRouter();
  const { yontem } = useLocalSearchParams<{ yontem?: CommissionBasis }>();
  const basis: CommissionBasis =
    yontem === 'tedavi' || yontem === 'nakit' ? yontem : 'odeme_tedavi';
  const { can } = useClinicSession();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  // Raporlar ana ekranından gelinirse oradaki dönem; yoksa son 30 gün
  const [range, setRange] = useState<DateRange>(() =>
    params.from &&
    params.to &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.to)
      ? { from: params.from, to: params.to }
      : defaultRange(),
  );
  const [tab, setTab] = useState<'ozet' | 'detay'>('ozet');
  const fetcher = useCallback(
    (clinicId: string, r: DateRange) => reportsRepository.commissionItems(clinicId, r, basis),
    [basis],
  );
  const { data, loading, error } = useReport<CommissionItem>(fetcher, range);

  const doctors = [
    ...data
      .reduce((m, it) => {
        const d = m.get(it.doctorId) ?? {
          id: it.doctorId,
          name: it.doctorName,
          rate: it.rate,
          amount: 0,
          paid: 0,
          prim: 0,
          pending: 0,
          count: 0,
        };
        d.amount += it.amount;
        d.paid += it.paidAmount;
        d.prim += it.prim;
        d.pending += it.primPending;
        d.count += 1;
        m.set(it.doctorId, d);
        return m;
      }, new Map<string, DoctorSum>())
      .values(),
  ];
  const sum = (k: keyof Pick<DoctorSum, 'amount' | 'paid' | 'prim' | 'pending'>) =>
    doctors.reduce((s, d) => s + d[k], 0);

  return (
    <Screen inStack>
      <Stack.Screen
        options={{
          title: basisInfo[basis].title,
          headerRight: can('prim.yonet')
            ? () => (
                <Pressable
                  onPress={() => router.push('/ayarlar/prim-oranlari', { withAnchor: true })}
                  accessibilityRole="button"
                  accessibilityLabel="Prim oranları"
                  hitSlop={10}>
                  <Ionicons name="options-outline" size={24} color={Colors.text} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <RangeButton range={range} onChange={setRange} />
      <Text style={rs.small}>{basisInfo[basis].hint}</Text>

      <View style={styles.tabs}>
        {(['ozet', 'detay'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t && { color: Colors.primary }]}>
              {t === 'ozet' ? 'Özet' : 'Detaylar'}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? (
        <Text style={rs.empty}>{error}</Text>
      ) : loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : tab === 'ozet' ? (
        <>
          <TileGrid>
            {basis === 'odeme_tedavi' ? (
              <>
                <StatTile
                  icon="checkmark-circle-outline"
                  label="Ödenen Kısım"
                  value={formatTL(sum('paid'))}
                />
                <StatTile
                  icon="time-outline"
                  label="Kalan Miktar"
                  value={formatTL(sum('amount') - sum('paid'))}
                  iconBg="#FDF0E1"
                  iconColor="#B45309"
                />
              </>
            ) : (
              <>
                <StatTile
                  icon={basis === 'nakit' ? 'wallet-outline' : 'medical-outline'}
                  label={basis === 'nakit' ? 'Hekimlere düşen tahsilat' : 'Tedavi Tutarı'}
                  value={formatTL(sum('amount'))}
                />
                <StatTile
                  icon="list-outline"
                  label={basis === 'nakit' ? 'Ödeme Kalemi' : 'Tedavi Sayısı'}
                  value={String(data.length)}
                  iconBg="#FDF0E1"
                  iconColor="#B45309"
                />
              </>
            )}
            <StatTile icon="people-outline" label="Doktorlar" value={String(doctors.length)} />
            <StatTile icon="cash" label="Net Prim" value={formatTL(sum('prim'))} tone="green" />
          </TileGrid>
          {basis === 'odeme_tedavi' && sum('pending') > 0 ? (
            <Text style={rs.small}>
              Bekleyen prim (kalan ödemeler gelince): {formatTL(sum('pending'))}
            </Text>
          ) : null}

          <ListHeader title="Doktorlar" count={doctors.length} />
          {doctors.length === 0 ? (
            <Text style={rs.empty}>Bu dönemde prim kalemi yok.</Text>
          ) : (
            doctors.map((d) => {
              const pct = d.amount ? Math.round((d.paid / d.amount) * 100) : 0;
              return (
                <View key={d.id} style={rs.card}>
                  <View style={rs.row}>
                    <Initials name={d.name} size={56} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={rs.title}>{d.name}</Text>
                      <Text style={[rs.title, { color: '#0B6E69', fontSize: 22 }]}>
                        {formatTL(d.prim)}
                      </Text>
                    </View>
                    <View style={rs.badge}>
                      <Text style={rs.badgeText}>%{d.rate}</Text>
                    </View>
                  </View>
                  {basis === 'odeme_tedavi' ? (
                    <>
                      <View style={rs.row}>
                        <Text style={[rs.small, { color: Colors.primary, flex: 1 }]}>%{pct}</Text>
                        <Text style={[rs.small, { color: '#B45309' }]}>%100</Text>
                      </View>
                      <View style={styles.bar}>
                        <View style={[styles.barFill, { width: `${pct}%` }]} />
                      </View>
                      <View style={styles.split}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={rs.small}>Ödenen Kısım</Text>
                          <Text style={[rs.muted, { color: Colors.primary }]}>
                            {formatTL(d.paid)}
                          </Text>
                        </View>
                        <View style={styles.vline} />
                        <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
                          <Text style={rs.small}>Kalan Miktar</Text>
                          <Text style={[rs.muted, { color: '#B45309' }]}>
                            {formatTL(d.amount - d.paid)}
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    <Text style={rs.muted}>
                      {d.count} kalem · {basis === 'nakit' ? 'tahsilat' : 'tedavi tutarı'}{' '}
                      {formatTL(d.amount)}
                    </Text>
                  )}
                  {d.rate === 0 ? (
                    <Text style={rs.small}>
                      Prim oranı girilmemiş (%0). Oranı klinik sahibi Ayarlar’dan girer.
                    </Text>
                  ) : null}
                </View>
              );
            })
          )}
        </>
      ) : (
        <>
          <ListHeader title={basis === 'nakit' ? 'Ödemeler' : 'Tedaviler'} count={data.length} />
          {data.length === 0 ? (
            <Text style={rs.empty}>Bu dönemde kalem yok.</Text>
          ) : (
            data.map((it, i) => <ItemRow key={`${it.doctorId}-${i}`} it={it} basis={basis} />)
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E7E5' },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 16, color: Colors.textMuted },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#FDF0E1', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 5 },
  split: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  vline: { width: 1, height: 36, backgroundColor: '#E2E7E5' },
  rateDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#B45309',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateDotText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  primChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#DDF1EE',
  },
  primChipText: { fontSize: 15, color: '#0B6E69' },
  detail: { gap: 6, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: '#EEF1F0' },
});
