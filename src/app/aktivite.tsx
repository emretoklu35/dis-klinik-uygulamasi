import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  CATEGORY_ORDER,
  categoryInfo,
  relativeTime,
  useActivity,
  type Activity,
  type ActivityCategory,
} from '@/features/activity/activity';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import { addDays, formatDayLong, todayKey } from '@/lib/dates';

function initials(name: string) {
  return name
    .replace(/^(Dr\.|Dt\.)\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((p) => p[0]?.toLocaleUpperCase('tr-TR'))
    .join('');
}

function dayTitle(key: string) {
  const today = todayKey();
  if (key === today) return 'Bugün';
  if (key === addDays(today, -1)) return 'Dün';
  return formatDayLong(key);
}

function stamp(a: Activity) {
  const d = new Date(a.iso);
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ActivityCard({ a, last }: { a: Activity; last: boolean }) {
  const c = categoryInfo[a.category];
  return (
    <View style={styles.item}>
      {/* Zaman çizelgesi: simge + dikey çizgi */}
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: c.soft, borderColor: c.color }]}>
          <Ionicons name={c.icon} size={18} color={c.color} />
        </View>
        {!last ? <View style={styles.line} /> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sentence}>
          {a.patientId && a.patientName ? (
            <Link
              href={{ pathname: '/hastalar/[id]', params: { id: a.patientId } }}
              withAnchor
              style={styles.patient}>
              {a.patientName}
            </Link>
          ) : null}
          {a.lead ? <Text>{a.lead}</Text> : null}
          {a.sentence ? <Text> {a.sentence}</Text> : null}
        </Text>
        {a.details.filter(Boolean).map((d, i) => (
          <Text key={i} style={styles.detail} numberOfLines={3}>
            {d}
          </Text>
        ))}
        <View style={styles.footer}>
          <View style={styles.actor}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(a.actorName) || '·'}</Text>
            </View>
            <Text style={styles.actorName} numberOfLines={1}>
              {a.actorName}
            </Text>
          </View>
          <View style={styles.when}>
            <View style={styles.whenRow}>
              <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
              <Text style={styles.relative}>{relativeTime(a.iso)}</Text>
            </View>
            <Text style={styles.absolute}>{stamp(a)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function ActivityScreen() {
  const router = useRouter();
  const isWide = useIsWideLayout();
  const [days, setDays] = useState(7);
  const { data, loading, error, reload } = useActivity(days);
  const [showFilters, setShowFilters] = useState(false);
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [actor, setActor] = useState<string | null>(null);

  const categories = CATEGORY_ORDER.filter((c) => data.some((a) => a.category === c));
  const actors = [...new Set(data.map((a) => a.actorName))].sort((x, y) =>
    x.localeCompare(y, 'tr'),
  );
  const shown = data.filter(
    (a) => (!category || a.category === category) && (!actor || a.actorName === actor),
  );
  const groups: { key: string; items: Activity[] }[] = [];
  for (const a of shown) {
    const key = a.at.slice(0, 10);
    const g = groups.at(-1);
    if (g && g.key === key) g.items.push(a);
    else groups.push({ key, items: [a] });
  }
  const filtered = !!category || !!actor;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isWide && styles.headerInnerWide]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Aktivite Akışı
          </Text>
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Filtreler"
            accessibilityState={{ expanded: showFilters }}
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons
              name="options-outline"
              size={24}
              color={filtered || showFilters ? Colors.primary : Colors.text}
            />
          </Pressable>
          <Pressable
            onPress={reload}
            accessibilityRole="button"
            accessibilityLabel="Yenile"
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons name="refresh-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        refreshControl={
          <RefreshControl refreshing={loading && data.length > 0} onRefresh={reload} />
        }>
        <View style={styles.inner}>
          {showFilters ? (
            <View style={styles.filters}>
              <Text style={styles.filterLabel}>Tür</Text>
              <View style={styles.chips}>
                <Chip label="Tümü" selected={!category} onPress={() => setCategory(null)} />
                {categories.map((c) => (
                  <Chip
                    key={c}
                    label={categoryInfo[c].label}
                    selected={category === c}
                    onPress={() => setCategory((v) => (v === c ? null : c))}
                  />
                ))}
              </View>
              <Text style={styles.filterLabel}>Kim yaptı</Text>
              <View style={styles.chips}>
                <Chip label="Herkes" selected={!actor} onPress={() => setActor(null)} />
                {actors.map((n) => (
                  <Chip
                    key={n}
                    label={n}
                    selected={actor === n}
                    onPress={() => setActor((v) => (v === n ? null : n))}
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Text style={styles.scope}>
            Son {days} gün · yalnızca görmeye yetkili olduğunuz kayıtlar gösterilir.
          </Text>

          {error ? (
            <Text style={styles.empty}>{error}</Text>
          ) : loading && data.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
          ) : groups.length === 0 ? (
            <Text style={styles.empty}>
              {filtered ? 'Bu filtreye uyan kayıt yok.' : 'Bu dönemde kayıt yok.'}
            </Text>
          ) : (
            groups.map((g) => (
              <Fragment key={g.key}>
                <View style={styles.dayRow}>
                  <View style={styles.dayPill}>
                    <Text style={styles.dayText}>{dayTitle(g.key)}</Text>
                  </View>
                  <View style={styles.dayLine} />
                </View>
                {g.items.map((a, i) => (
                  <ActivityCard key={a.id} a={a} last={i === g.items.length - 1} />
                ))}
              </Fragment>
            ))
          )}

          {!loading && days < 90 ? (
            <View style={styles.more}>
              <Button
                label={`Daha eskisini göster (son ${days === 7 ? 30 : 90} gün)`}
                icon="time-outline"
                variant="secondary"
                onPress={() => setDays((d) => (d === 7 ? 30 : 90))}
              />
            </View>
          ) : null}
          <Text style={styles.demo}>Bu ekrandaki tüm bilgiler sahte demo verisidir.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerInnerWide: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: Colors.text, marginLeft: Spacing.xs },
  scroll: { flex: 1, backgroundColor: '#F4F5F7' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  contentWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: Spacing.md },

  filters: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  filterLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  scope: { fontSize: 12, color: Colors.textMuted },
  empty: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: Spacing.xl,
    textAlign: 'center',
  },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  dayPill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
  dayText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  dayLine: { flex: 1, height: 1, backgroundColor: '#E1E5EB' },

  item: { flexDirection: 'row', gap: Spacing.md },
  rail: { width: 36, alignItems: 'center' },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { flex: 1, width: 2, backgroundColor: '#E1E5EB', marginTop: 4, marginBottom: -Spacing.md },
  card: {
    flex: 1,
    minWidth: 0,
    gap: 6,
    padding: Spacing.lg,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  sentence: { fontSize: 16, lineHeight: 22, color: Colors.text },
  patient: { color: Colors.primary, fontWeight: '600' },
  detail: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F3',
  },
  actor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  actorName: { fontSize: 14, color: Colors.text, flexShrink: 1 },
  when: { alignItems: 'flex-end', gap: 2 },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  relative: { fontSize: 12, color: Colors.textSecondary },
  absolute: { fontSize: 11, color: Colors.textMuted },
  more: { alignItems: 'center', marginTop: Spacing.md },
  demo: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
