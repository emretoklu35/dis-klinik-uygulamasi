import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Screen } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { basisInfo, type CommissionBasis } from '@/features/reports/reports';
import { useClinicSession, type Permission } from '@/features/session/session-context';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Group = 'finansal' | 'tedavi';

type Report = {
  key: string;
  group: Group;
  title: string;
  sub: string;
  icon: IconName;
  href?: Href;
  /** Hekim (yalnızca kendi verisi) de görebilir */
  forDoctor: boolean;
  /** Ödemeleri görebilen herkes (resepsiyon dahil) görür */
  forPayments?: boolean;
  /** Yalnızca bu yetkiyle görünür (ör. maliyet ekranları) */
  perm?: Permission;
};

const REPORTS: Report[] = [
  {
    key: 'gun-sonu',
    group: 'finansal',
    title: 'Gün sonu Raporu',
    sub: 'Günlük gelir ve ödeme özeti',
    icon: 'calculator-outline',
    href: '/raporlar/gun-sonu',
    forDoctor: false,
  },
  {
    key: 'prim',
    group: 'finansal',
    title: 'Doktor Prim Raporu',
    sub: 'Doktor kazançları ve komisyonları',
    icon: 'wallet-outline',
    forDoctor: true,
  },
  {
    key: 'giderler',
    group: 'finansal',
    title: 'Giderler',
    sub: 'Laboratuvar faturaları ve stok alımları',
    icon: 'receipt-outline',
    href: '/raporlar/giderler',
    forDoctor: false,
    perm: 'maliyet.oku',
  },
  {
    key: 'laboratuvar',
    group: 'finansal',
    title: 'Laboratuvar Faturaları',
    sub: 'Ay sonu faturasını işlere ve hekimlere dağıtın',
    icon: 'flask-outline',
    href: '/raporlar/laboratuvar',
    forDoctor: false,
    perm: 'maliyet.yaz',
  },
  {
    key: 'taksit',
    group: 'finansal',
    title: 'Taksit Takibi',
    sub: 'Geciken ve vadesi yaklaşan taksitler',
    icon: 'calendar-outline',
    href: '/raporlar/taksitler',
    forDoctor: false,
    forPayments: true,
  },
  {
    key: 'yarim',
    group: 'tedavi',
    title: 'Yarım Kalan Tedaviler',
    sub: 'Bitmemiş planlar, kalan tutar ve randevusu olmayanlar',
    icon: 'hourglass-outline',
    href: '/raporlar/yarim-kalan',
    forDoctor: true,
  },
  {
    key: 'tedavi',
    group: 'tedavi',
    title: 'Tamamlanan Tedavi Raporu',
    sub: 'Tamamlanan tedaviler ve gelir',
    icon: 'checkmark-circle-outline',
    href: '/raporlar/tedavi',
    forDoctor: true,
  },
];

const groupInfo: Record<Group, { label: string; icon: IconName; color: string; soft: string }> = {
  finansal: { label: 'Finansal', icon: 'trending-up-outline', color: '#0B6E69', soft: '#DDF1EE' },
  tedavi: {
    label: 'Tedavi',
    icon: 'people-outline',
    color: Colors.ink,
    soft: '#E8ECEF',
  },
};

const BASIS_OPTIONS: { basis: CommissionBasis; icon: IconName; color: string; soft: string }[] = [
  { basis: 'odeme_tedavi', icon: 'card-outline', color: '#0B6E69', soft: '#DDF1EE' },
  { basis: 'tedavi', icon: 'medical-outline', color: Colors.primary, soft: Colors.primarySoft },
  { basis: 'nakit', icon: 'wallet-outline', color: '#B45309', soft: '#FDF0E1' },
];

export default function ReportsScreen() {
  const router = useRouter();
  const { can } = useClinicSession();
  const all = can('rapor.oku');
  const own = can('rapor.kendi');
  const pay = can('odeme.oku');
  const [filter, setFilter] = useState<Group | 'tumu'>('tumu');
  const [pickBasis, setPickBasis] = useState(false);

  const visible = REPORTS.filter((r) =>
    r.perm ? can(r.perm) : r.forPayments ? pay : all || (own && r.forDoctor),
  );
  const count = (g: Group) => visible.filter((r) => r.group === g).length;
  const groups = (['finansal', 'tedavi'] as Group[]).filter(
    (g) => count(g) > 0 && (filter === 'tumu' || filter === g),
  );

  if (visible.length === 0) {
    return (
      <Screen inStack>
        <Text style={styles.empty}>Raporları görme yetkiniz yok.</Text>
      </Screen>
    );
  }

  const open = (r: Report) => {
    if (r.key === 'prim') setPickBasis(true);
    else if (r.href) router.push(r.href);
  };

  return (
    <Screen inStack>
      <View style={styles.filters}>
        <FilterChip
          label="Tümü"
          icon="grid-outline"
          selected={filter === 'tumu'}
          onPress={() => setFilter('tumu')}
        />
        {(['finansal', 'tedavi'] as Group[])
          .filter((g) => count(g) > 0)
          .map((g) => (
            <FilterChip
              key={g}
              label={groupInfo[g].label}
              icon={groupInfo[g].icon}
              count={count(g)}
              color={groupInfo[g].color}
              soft={groupInfo[g].soft}
              selected={filter === g}
              onPress={() => setFilter(g)}
            />
          ))}
      </View>
      {!all ? (
        <Text style={styles.note}>Yalnızca kendi tedavileriniz ve priminiz gösterilir.</Text>
      ) : null}

      {groups.map((g) => (
        <View key={g} style={{ gap: Spacing.md }}>
          <View style={styles.groupHead}>
            <View style={[styles.groupIcon, { backgroundColor: groupInfo[g].soft }]}>
              <Ionicons name={groupInfo[g].icon} size={20} color={groupInfo[g].color} />
            </View>
            <Text style={styles.groupTitle}>{groupInfo[g].label}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{count(g)}</Text>
            </View>
          </View>
          {visible
            .filter((r) => r.group === g)
            .map((r) => (
              <Pressable
                key={r.key}
                onPress={() => open(r)}
                accessibilityRole="button"
                accessibilityLabel={r.title}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}>
                <View style={[styles.cardIcon, { backgroundColor: groupInfo[g].soft }]}>
                  <Ionicons name={r.icon} size={28} color={groupInfo[g].color} />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.cardTitle}>{r.title}</Text>
                  <Text style={styles.cardSub}>{r.sub}</Text>
                </View>
                <View style={styles.chevron}>
                  <Ionicons name="chevron-forward" size={22} color={Colors.textSecondary} />
                </View>
              </Pressable>
            ))}
        </View>
      ))}

      {pickBasis ? (
        <BottomSheet title="Rapor Tipini Seçin" onClose={() => setPickBasis(false)}>
          {BASIS_OPTIONS.map((o) => (
            <Pressable
              key={o.basis}
              onPress={() => {
                setPickBasis(false);
                router.push({ pathname: '/raporlar/prim', params: { yontem: o.basis } });
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.basis, pressed && { backgroundColor: '#EEF4F2' }]}>
              <View style={[styles.cardIcon, { backgroundColor: o.soft }]}>
                <Ionicons name={o.icon} size={26} color={o.color} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardTitle}>{basisInfo[o.basis].title}</Text>
                <Text style={styles.cardSub}>Doktor Prim Raporu</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </Pressable>
          ))}
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

function FilterChip({
  label,
  icon,
  count,
  selected,
  color = Colors.primary,
  soft = Colors.primarySoft,
  onPress,
}: {
  label: string;
  icon: IconName;
  count?: number;
  selected: boolean;
  color?: string;
  soft?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.filter, { backgroundColor: selected ? Colors.primary : soft }]}>
      <Ionicons name={icon} size={20} color={selected ? '#FFFFFF' : color} />
      <Text style={[styles.filterText, { color: selected ? '#FFFFFF' : color }]}>{label}</Text>
      {count ? (
        <View
          style={[styles.filterCount, selected && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
          <Text style={[styles.filterCountText, { color: selected ? '#FFFFFF' : color }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
  },
  filterText: { fontSize: 15, fontFamily: Fonts.bodyMedium },
  filterCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: { fontSize: 12, fontFamily: Fonts.bodySemi },
  note: { fontSize: 13, color: Colors.textSecondary },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitle: { fontSize: 18, fontFamily: Fonts.headingSemi, color: Colors.text },
  countPill: {
    minWidth: 28,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: '#DCE2E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 13, color: Colors.textSecondary },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 17, fontFamily: Fonts.bodySemi, color: Colors.text },
  cardSub: { fontSize: 14, color: Colors.textMuted },
  chevron: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E6EBE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  basis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: 14,
  },
  empty: { fontSize: 15, color: Colors.textSecondary },
});
