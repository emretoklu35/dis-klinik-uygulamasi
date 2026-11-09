import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAppointmentsRange } from '@/features/appointments/hooks';
import type { Appointment } from '@/features/appointments/types';
import {
  appointmentTitle,
  startTime,
  statusLabels,
  statusTone,
} from '@/features/appointments/utils';
import { MediaHomeCard } from '@/features/radiographs/media-home-card';
import { useClinicSession, type Permission } from '@/features/session/session-context';
import { StockHomeCard } from '@/features/stock/stock-home-card';
import { useTasks } from '@/features/tasks/tasks';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import {
  addDays,
  formatDayLong,
  fromDateKey,
  isoWeekday,
  nowLocalDateTime,
  startOfWeek,
  todayKey,
  weekDayShort,
} from '@/lib/dates';

type IconName = ComponentProps<typeof Ionicons>['name'];

function initialsOf(name: string) {
  const parts = name
    .replace(/^(Dr\.|Dt\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toLocaleUpperCase('tr-TR') || '?';
}

/** Klinik saatine göre selamlama */
function greeting() {
  const h = Number(nowLocalDateTime().slice(11, 13));
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

// ----------------------------------------------------------------------------
// Parçalar
// ----------------------------------------------------------------------------
function Stat({
  icon,
  color,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  value: number;
  label: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={color} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function AppointmentTile({ a }: { a: Appointment }) {
  const cancelled = a.status === 'iptal';
  return (
    <Link href={{ pathname: '/takvim/[id]', params: { id: a.id } }} withAnchor asChild>
      <Pressable accessibilityRole="link">
        {({ pressed }) => (
          <View style={[styles.tile, pressed && { opacity: 0.7 }]}>
            <View style={styles.tileTop}>
              <View style={styles.tileTime}>
                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                <Text style={styles.tileTimeText}>{startTime(a)}</Text>
              </View>
              <Badge label={statusLabels[a.status]} tone={statusTone[a.status]} />
            </View>
            <Text style={[styles.tilePatient, cancelled && styles.strike]} numberOfLines={1}>
              {a.patientName}
            </Text>
            <View style={styles.tileType}>
              {/* Hekim işlem adını, diğer roller yalnızca genel türü görür */}
              <Text style={styles.tileTypeText} numberOfLines={1}>
                {appointmentTitle(a)} · {a.durationMin} dk
              </Text>
            </View>
            <View style={styles.tileDoctor}>
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>{initialsOf(a.doctorName)}</Text>
              </View>
              <Text style={styles.tileDoctorText} numberOfLines={1}>
                {a.doctorName} · {a.chairName}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

type QuickActionDef = {
  icon: IconName;
  label: string;
  href: Href;
  permission: Permission;
  tint: string;
  soft: string;
};

/** Yalnızca uygulamada gerçekten olan işlemler; her biri yetkiye bağlı. */
const QUICK_ACTIONS: QuickActionDef[] = [
  {
    icon: 'calendar-outline',
    label: 'Yeni Randevu',
    href: '/takvim/yeni',
    permission: 'randevu.yaz',
    tint: Colors.primary,
    soft: Colors.primarySoft,
  },
  {
    icon: 'person-add-outline',
    label: 'Yeni Hasta',
    href: '/hastalar/yeni',
    permission: 'hasta.temel.yaz',
    tint: Colors.success,
    soft: Colors.successSoft,
  },
  {
    icon: 'checkbox-outline',
    label: 'Görev Oluştur',
    href: '/gorevler',
    permission: 'gorev.yaz',
    tint: Colors.success,
    soft: Colors.successSoft,
  },
  {
    icon: 'people-outline',
    label: 'Hasta Bul',
    href: '/hastalar',
    permission: 'hasta.temel.oku',
    tint: Colors.primary,
    soft: Colors.primarySoft,
  },
  {
    icon: 'cube-outline',
    label: 'Stok',
    href: '/stok',
    permission: 'stok.oku',
    tint: Colors.warning,
    soft: Colors.warningSoft,
  },
  {
    icon: 'pricetags-outline',
    label: 'Fiyat Listesi',
    href: '/ayarlar/fiyatlar',
    permission: 'odeme.oku',
    tint: Colors.warning,
    soft: Colors.warningSoft,
  },
];

function QuickAction({ def, wide }: { def: QuickActionDef; wide: boolean }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(def.href, { withAnchor: true })}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        wide && styles.actionWide,
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.actionIcon, { backgroundColor: def.soft }]}>
        <Ionicons name={def.icon} size={24} color={def.tint} />
      </View>
      <Text style={styles.actionLabel}>{def.label}</Text>
    </Pressable>
  );
}

// ----------------------------------------------------------------------------
// Ekran
// ----------------------------------------------------------------------------
export default function HomeScreen() {
  const isWide = useIsWideLayout();
  const { clinic, member, doctors, can } = useClinicSession();
  const today = todayKey();
  const weekStart = startOfWeek(today);
  const weekDays = clinic.workingDays.map((d) => addDays(weekStart, d - 1));
  const [selected, setSelected] = useState(
    clinic.workingDays.includes(isoWeekday(today)) ? today : weekDays[0],
  );

  const { data: weekAppointments, loading } = useAppointmentsRange(
    weekDays[0],
    weekDays[weekDays.length - 1],
  );
  const { data: tasks } = useTasks();

  // Hekim kendi randevularını, diğer roller kliniğin tamamını görür
  const isDoctor = doctors.some((d) => d.id === member.id);
  const mine = (a: Appointment) => !isDoctor || a.doctorMemberId === member.id;
  const dayList = weekAppointments.filter((a) => a.start.startsWith(selected) && mine(a));
  const active = dayList.filter((a) => a.status !== 'iptal');
  const completed = dayList.filter((a) => a.status === 'tamamlandi').length;
  const openTasks = tasks.filter((t) => !t.done).length;
  const now = nowLocalDateTime();
  const remaining = active.filter(
    (a) => (a.status === 'bekliyor' || a.status === 'onaylandi') && a.start >= now,
  ).length;
  const countFor = (day: string) =>
    weekAppointments.filter((a) => a.start.startsWith(day) && a.status !== 'iptal' && mine(a))
      .length;

  const whose = isDoctor ? 'randevunuz' : 'randevu';
  const banner =
    selected === today
      ? remaining > 0
        ? `Bugün ${remaining} ${whose} kaldı.`
        : active.length > 0
          ? 'Bugünün randevuları tamamlandı.'
          : 'Bugün randevu yok.'
      : `${formatDayLong(selected)}: ${active.length} ${whose}.`;
  const actions = QUICK_ACTIONS.filter((q) => can(q.permission));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* Karşılama + hafta şeridi + özet */}
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(member.name)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.greet}>{greeting()}!</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {member.name}
                </Text>
                <Text style={styles.clinic} numberOfLines={1}>
                  {clinic.name}
                </Text>
              </View>
            </View>

            <View style={styles.week}>
              {weekDays.map((d) => {
                const isSel = d === selected;
                const n = countFor(d);
                return (
                  <Pressable
                    key={d}
                    onPress={() => setSelected(d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={`${formatDayLong(d)}, ${n} randevu`}
                    style={[styles.day, isSel && styles.daySelected]}>
                    <Text style={[styles.dayName, isSel && styles.onPrimary]}>
                      {weekDayShort[isoWeekday(d) - 1]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        isSel && styles.onPrimary,
                        d === today && !isSel && { color: Colors.primary },
                      ]}>
                      {fromDateKey(d).getDate()}
                    </Text>
                    {/* O gün randevu varsa küçük nokta */}
                    <View
                      style={[
                        styles.dot,
                        n > 0 && (isSel ? styles.dotOnPrimary : styles.dotActive),
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.stats}>
              <Stat
                icon="calendar-outline"
                color={Colors.primary}
                value={active.length}
                label="Randevu"
              />
              <View style={styles.statDivider} />
              <Stat
                icon="checkmark-circle-outline"
                color={Colors.success}
                value={completed}
                label="Tamamlanan"
              />
              <View style={styles.statDivider} />
              <Stat
                icon="checkbox-outline"
                color={Colors.warning}
                value={openTasks}
                label="Açık görev"
              />
            </View>
          </View>

          <View style={styles.banner}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.primary} />
            <Text style={styles.bannerText}>{banner}</Text>
          </View>

          {/* Randevular */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{isDoctor ? 'Randevularım' : 'Randevular'}</Text>
            <Link href="/takvim" style={styles.link}>
              Tümünü gör
            </Link>
          </View>
          {loading && weekAppointments.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : dayList.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Bu gün için randevu yok.</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tiles}>
              {dayList.map((a) => (
                <AppointmentTile key={a.id} a={a} />
              ))}
            </ScrollView>
          )}

          {/* Hızlı işlemler (role göre) */}
          {actions.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
              <View style={styles.actions}>
                {actions.map((q) => (
                  <QuickAction key={q.label} def={q} wide={isWide} />
                ))}
              </View>
            </>
          ) : null}

          {/* Dikkat gerektirenler: yalnızca yetkisi olan rollerde görünür */}
          <View style={styles.alerts}>
            <MediaHomeCard />
            <StockHomeCard />
          </View>

          <Text style={styles.demo}>Bu ekrandaki tüm bilgiler sahte demo verisidir.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  scrollWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },

  hero: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, padding: Spacing.xl },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: '#C9DBF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '600', color: Colors.primary },
  greet: { fontSize: 14, color: Colors.textSecondary },
  name: { fontSize: 22, fontWeight: '700', color: Colors.text },
  clinic: { fontSize: 14, fontWeight: '500', color: Colors.primary },

  week: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    padding: Spacing.xs,
    borderRadius: Radius.lg,
    backgroundColor: Colors.background,
    gap: 4,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    gap: 2,
  },
  daySelected: { backgroundColor: Colors.primary },
  dayName: { fontSize: 12, color: Colors.textMuted },
  dayNum: { fontSize: 17, fontWeight: '600', color: Colors.text },
  onPrimary: { color: '#FFFFFF' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: Colors.primary },
  dotOnPrimary: { backgroundColor: '#FFFFFF' },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F8FAFD',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textSecondary },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: '#C9DBF9',
  },
  bannerText: { fontSize: 15, color: Colors.primary, flexShrink: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },

  tiles: { gap: Spacing.md, paddingRight: Spacing.lg },
  tile: {
    width: 230,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tileTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileTimeText: { fontSize: 17, fontWeight: '600', color: Colors.primary },
  tilePatient: { fontSize: 17, fontWeight: '600', color: Colors.text },
  strike: { textDecorationLine: 'line-through', color: Colors.textMuted },
  tileType: {
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    maxWidth: '100%',
  },
  tileTypeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  tileDoctor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: { fontSize: 10, fontWeight: '700', color: Colors.primary },
  tileDoctorText: { fontSize: 13, color: Colors.textSecondary, flexShrink: 1 },
  empty: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  action: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionWide: { flexBasis: '15%' },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: '500', color: Colors.text, textAlign: 'center' },

  alerts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  demo: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
