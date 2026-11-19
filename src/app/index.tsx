/**
 * Ana Sayfa.
 * Yerleşim: karşılama kartı (hafta şeridi + özet), bilgi bandı, randevu kartları, hızlı işlemler.
 * Veri mevcut kancalardan gelir (randevu, görev); burada kopyalanmaz.
 * Telefonda alt sekme çubuğu, geniş webde sol menü aynen korunur (_layout.tsx).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { visitTypeLabels } from '@/features/appointments/clinic';
import { useAppointmentsRange } from '@/features/appointments/hooks';
import type { Appointment } from '@/features/appointments/types';
import { startTime, statusLabels, statusTone } from '@/features/appointments/utils';
import { MediaHomeCard } from '@/features/radiographs/media-home-card';
import { useClinicSession, type Permission } from '@/features/session/session-context';
import { useStockItems } from '@/features/stock/stock';
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

/** Görseldeki yumuşak kart gölgesi (iOS/web: shadow*, Android: elevation) */
const softShadow: ViewStyle = Platform.select<ViewStyle>({
  android: { elevation: 2 },
  default: {
    shadowColor: '#1B2A4A',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
});

function initialsOf(name: string) {
  const parts = name
    .replace(/^(Dr\.|Dt\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toLocaleUpperCase('tr-TR') || '?';
}

/** Klinik saatine göre: sabah "Günaydın", öğleden sonra "İyi günler", akşam "İyi akşamlar" */
function greeting() {
  const h = Number(nowLocalDateTime().slice(11, 13));
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

// ----------------------------------------------------------------------------
// Karşılama kartı parçaları
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
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={24} color={color} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Randevu kartı
// ----------------------------------------------------------------------------
function AppointmentTile({ a }: { a: Appointment }) {
  const cancelled = a.status === 'iptal';
  return (
    <Link href={{ pathname: '/takvim/[id]', params: { id: a.id } }} withAnchor asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${startTime(a)} ${a.patientName}, ${visitTypeLabels[a.visitType]}, ${statusLabels[a.status]}`}>
        {({ pressed }) => (
          <View
            style={[
              styles.tile,
              softShadow,
              cancelled && styles.tileCancelled,
              pressed && { opacity: 0.7 },
            ]}>
            <View style={styles.tileTop}>
              <View style={styles.tileTime}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={[styles.tileTimeText, cancelled && styles.strike]}>
                  {startTime(a)}
                </Text>
              </View>
              <Badge
                label={statusLabels[a.status]}
                tone={cancelled ? 'danger' : statusTone[a.status]}
              />
            </View>
            <Text style={[styles.tilePatient, cancelled && styles.strike]} numberOfLines={1}>
              {a.patientName}
            </Text>
            {/* Ana Sayfa'da herkes için yalnızca genel tür (işlem ayrıntısı randevu sayfasında) */}
            <View style={styles.tileType}>
              <Text style={styles.tileTypeText}>{visitTypeLabels[a.visitType]}</Text>
            </View>
            <View style={styles.tileDoctor}>
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>{initialsOf(a.doctorName)}</Text>
              </View>
              <Text style={styles.tileDoctorText} numberOfLines={1}>
                {a.doctorName}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

// ----------------------------------------------------------------------------
// Hızlı işlemler
// ----------------------------------------------------------------------------
type QuickActionDef = {
  icon: IconName;
  label: string;
  tint: string;
  soft: string;
} &
  /** Birden fazla yetki verilirse herhangi biri yeterli */
  (
    | { href: Href; permission: Permission | Permission[]; soon?: false }
    /** Henüz modülü olmayan işlem: "Yakında" olarak gösterilir, hiçbir yere gitmez */
    | { soon: true; href?: undefined; permission?: undefined }
  );

const QUICK_ACTIONS: QuickActionDef[] = [
  {
    icon: 'calendar-outline',
    label: 'Yeni Randevu',
    href: '/takvim/yeni',
    permission: 'randevu.yaz',
    tint: '#1E8A6E',
    soft: '#E4F4EE',
  },
  {
    icon: 'person-add-outline',
    label: 'Yeni Hasta',
    href: '/hastalar/yeni',
    permission: 'hasta.temel.yaz',
    tint: '#1E8A6E',
    soft: '#E4F4EE',
  },
  {
    icon: 'list-outline',
    label: 'Görev Oluştur',
    href: '/gorevler',
    permission: 'gorev.yaz',
    tint: '#1E8A6E',
    soft: '#E4F4EE',
  },
  {
    icon: 'globe-outline',
    label: 'Online Randevu',
    soon: true,
    tint: Colors.primary,
    soft: Colors.primarySoft,
  },
  {
    icon: 'bar-chart-outline',
    label: 'Raporlar',
    href: '/raporlar',
    permission: ['rapor.oku', 'rapor.kendi'],
    tint: '#C99A06',
    soft: '#FFF6DA',
  },
  {
    icon: 'time-outline',
    label: 'Aktivite Akışı',
    href: '/aktivite',
    permission: 'klinik.oku',
    tint: Colors.primary,
    soft: Colors.primarySoft,
  },
  {
    icon: 'cube-outline',
    label: 'Stok Yönetimi',
    href: '/stok',
    permission: 'stok.oku',
    tint: '#C99A06',
    soft: '#FFF6DA',
  },
  {
    icon: 'stopwatch-outline',
    label: 'Mesai Takibi',
    href: '/mesai',
    permission: 'mesai.kendi',
    tint: Colors.primary,
    soft: Colors.primarySoft,
  },
];

function QuickAction({
  def,
  wide,
  count = 0,
}: {
  def: QuickActionDef;
  wide: boolean;
  /** Köşede kırmızı sayı (ör. stokta sorunlu malzeme); 0 ise gösterilmez */
  count?: number;
}) {
  const router = useRouter();
  const soon = def.soon === true;
  return (
    // Hücre: tam 1/3 (genişte 1/4) genişlik + iç boşluk → her ekranda hizalı ızgara
    <View style={[styles.actionCell, wide && styles.actionCellWide]}>
      <Pressable
        onPress={soon ? undefined : () => router.push(def.href!, { withAnchor: true })}
        disabled={soon}
        accessibilityRole="button"
        accessibilityState={{ disabled: soon }}
        accessibilityLabel={
          soon ? `${def.label}, yakında` : count > 0 ? `${def.label}, ${count} uyarı` : def.label
        }
        style={({ pressed }) => [styles.action, softShadow, pressed && { opacity: 0.7 }]}>
        <View style={[styles.actionIcon, { backgroundColor: def.soft }, soon && { opacity: 0.6 }]}>
          <Ionicons name={def.icon} size={26} color={def.tint} />
          {count > 0 ? (
            <View style={styles.count}>
              <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.actionLabel, soon && { color: Colors.textSecondary }]}>
          {def.label}
        </Text>
        {soon ? (
          <View style={styles.soon}>
            <Text style={styles.soonText}>Yakında</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
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
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)); // Pzt–Paz
  const [selected, setSelected] = useState(today);
  const [notice, setNotice] = useState(false);

  const { data: weekAppointments, loading } = useAppointmentsRange(weekDays[0], weekDays[6]);
  const { data: tasks } = useTasks();
  // Stok Yönetimi düğmesindeki sayı: kritik seviyede ya da son kullanma tarihi yaklaşan malzemeler
  const { data: stockItems } = useStockItems(can('stok.oku'));
  const stockAlerts = stockItems.filter((i) => i.active && (i.isCritical || i.expiringLot)).length;

  // Hekim kendi randevularını, diğer roller kliniğin tamamını görür
  const isDoctor = doctors.some((d) => d.id === member.id);
  const mine = (a: Appointment) => !isDoctor || a.doctorMemberId === member.id;
  const dayList = weekAppointments.filter((a) => a.start.startsWith(selected) && mine(a));
  const active = dayList.filter((a) => a.status !== 'iptal');
  const completed = dayList.filter((a) => a.status === 'tamamlandi').length;
  const dayTasks = tasks.filter((t) => !t.done && t.dueDate === selected).length;
  const now = nowLocalDateTime();
  const remaining = active.filter(
    (a) => (a.status === 'bekliyor' || a.status === 'onaylandi') && a.start >= now,
  ).length;
  const hasAppointments = (day: string) =>
    weekAppointments.some((a) => a.start.startsWith(day) && a.status !== 'iptal' && mine(a));

  const whose = isDoctor ? 'randevunuz' : 'randevu';
  const closed = !clinic.workingDays.includes(isoWeekday(selected));
  const banner = closed
    ? `${formatDayLong(selected)}: klinik kapalı.`
    : selected === today
      ? remaining > 0
        ? `Bugün ${remaining} ${whose} kaldı.`
        : active.length > 0
          ? 'Bugünün randevuları tamamlandı.'
          : 'Bugün randevu yok.'
      : `${formatDayLong(selected)}: ${active.length} ${whose}.`;

  // Gerçek işlemler yalnızca yetkisi olana; "Yakında" olanlar herkese görünür
  const actions = QUICK_ACTIONS.filter(
    (q) => q.soon || ([] as Permission[]).concat(q.permission).some((p) => can(p)),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {/* 1–3. Karşılama kartı: profil, hafta şeridi, özet */}
          <View style={[styles.hero, softShadow]}>
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
              <Pressable
                onPress={() => setNotice((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Bildirimler"
                style={({ pressed }) => [styles.bell, pressed && { opacity: 0.7 }]}>
                <Ionicons name="notifications-outline" size={24} color={Colors.primary} />
              </Pressable>
            </View>
            {notice ? (
              <Text style={styles.notice}>Bildirimler yakında burada görünecek.</Text>
            ) : null}

            <View style={styles.week}>
              {weekDays.map((d) => {
                const isSel = d === selected;
                const isToday = d === today;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setSelected(d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={formatDayLong(d)}
                    style={[styles.day, isSel && styles.daySelected]}>
                    <Text style={[styles.dayName, isSel && styles.onPrimary]}>
                      {weekDayShort[isoWeekday(d) - 1]}
                    </Text>
                    <Text
                      style={[
                        styles.dayNum,
                        isSel && styles.onPrimary,
                        isToday && !isSel && { color: Colors.primary },
                      ]}>
                      {fromDateKey(d).getDate()}
                    </Text>
                    <View
                      style={[
                        styles.dot,
                        hasAppointments(d) && (isSel ? styles.dotOnPrimary : styles.dotActive),
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
                label="Randevular"
              />
              <View style={styles.statDivider} />
              <Stat
                icon="checkmark-circle-outline"
                color={Colors.success}
                value={completed}
                label="Tamamlanan"
              />
              <View style={styles.statDivider} />
              <Stat icon="clipboard-outline" color="#E0A800" value={dayTasks} label="Görevler" />
            </View>
          </View>

          {/* 4. Bilgi bandı */}
          <View style={styles.banner}>
            <Ionicons name="information-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.bannerText}>{banner}</Text>
          </View>

          {/* 5. Randevular */}
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Randevular</Text>
            <Link href="/takvim" style={styles.link}>
              Tümünü Gör
            </Link>
          </View>
          {loading && weekAppointments.length === 0 ? (
            <ActivityIndicator color={Colors.primary} />
          ) : dayList.length === 0 ? (
            <View style={[styles.empty, softShadow]}>
              <Text style={styles.emptyText}>
                {closed ? 'Klinik bu gün kapalı.' : 'Bu gün için randevu yok.'}
              </Text>
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

          {/* 6. Hızlı işlemler */}
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.actions}>
            {actions.map((q) => (
              <QuickAction
                key={q.label}
                def={q}
                wide={isWide}
                count={q.href === '/stok' ? stockAlerts : 0}
              />
            ))}
          </View>

          {/* Yalnızca dikkat gerektiren bir şey varsa görünür (inceleme, tekrar çekim) */}
          <View style={styles.alerts}>
            <MediaHomeCard />
          </View>

          <Text style={styles.demo}>Bu ekrandaki tüm bilgiler sahte demo verisidir.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F5F7' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  scrollWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },

  // Karşılama kartı
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    overflow: 'hidden',
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF3FB',
    borderWidth: 2,
    borderColor: '#C9DBF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '500', color: Colors.primary },
  greet: { fontSize: 14, color: Colors.textMuted },
  name: { fontSize: 22, fontWeight: '600', color: Colors.text },
  clinic: { fontSize: 15, color: Colors.primary },
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EEF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  week: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    padding: Spacing.xs,
    borderRadius: 20,
    backgroundColor: '#F4F5F7',
    gap: 2,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: 14,
    gap: 4,
  },
  daySelected: { backgroundColor: Colors.primary },
  dayName: { fontSize: 12, color: Colors.textMuted },
  dayNum: { fontSize: 18, fontWeight: '500', color: Colors.text },
  onPrimary: { color: '#FFFFFF' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: Colors.primary },
  dotOnPrimary: { backgroundColor: '#FFFFFF' },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    backgroundColor: '#F7F8FA',
    borderTopWidth: 1,
    borderTopColor: '#EDF0F4',
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  statValue: { fontSize: 20, fontWeight: '600', color: Colors.text },
  statLabel: { fontSize: 12, color: Colors.textMuted },
  statDivider: { width: 1, height: 36, backgroundColor: '#E1E5EB' },

  // Bilgi bandı
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: 18,
    backgroundColor: '#E5EEFB',
    borderWidth: 1,
    borderColor: '#B9D0F5',
  },
  bannerText: { fontSize: 15, color: Colors.primary, flexShrink: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: Colors.primary },
  link: { color: Colors.primary, fontSize: 14 },

  // Randevu kartları
  tiles: { gap: Spacing.md, paddingRight: Spacing.lg, paddingBottom: Spacing.sm },
  tile: {
    width: 240,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  tileCancelled: { opacity: 0.55 },
  tileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  tileTime: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileTimeText: { fontSize: 18, fontWeight: '500', color: Colors.primary },
  tilePatient: { fontSize: 18, fontWeight: '500', color: Colors.text },
  strike: { textDecorationLine: 'line-through' },
  tileType: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: '#EEF5FD',
  },
  tileTypeText: { fontSize: 13, color: '#7FAEE8' },
  tileDoctor: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  miniAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EEF3FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  tileDoctorText: { fontSize: 14, color: Colors.textSecondary, flexShrink: 1 },
  empty: {
    padding: Spacing.lg,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  emptyText: { fontSize: 14, color: Colors.textSecondary },

  // Hızlı işlemler
  actions: { flexDirection: 'row', flexWrap: 'wrap', margin: -Spacing.xs - 2 },
  actionCell: { width: '33.333%', padding: Spacing.xs + 2 },
  actionCellWide: { width: '25%' },
  action: {
    flex: 1,
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 14, color: Colors.text, textAlign: 'center' },
  soon: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.pill,
    backgroundColor: '#F1F3F6',
  },
  soonText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  count: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },

  alerts: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  demo: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
