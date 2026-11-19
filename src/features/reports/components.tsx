/** Raporların ortak parçaları: tarih aralığı seçici, özet kutucukları, halka grafik. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { BottomSheet } from '@/components/bottom-sheet';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { addDays, dateKey, fromDateKey, todayKey } from '@/lib/dates';

import {
  matchPreset,
  PRESET_ORDER,
  presetLabels,
  presetRange,
  rangeDays,
  rangeLabel,
  rangeLong,
  type DateRange,
} from './reports';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ----------------------------------------------------------------------------
// Tarih aralığı
// ----------------------------------------------------------------------------
export function RangeButton({
  range,
  onChange,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Tarih aralığı: ${rangeLong(range)}. Değiştir`}
        style={({ pressed }) => [styles.rangeBtn, pressed && { opacity: 0.6 }]}>
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        <Text style={styles.rangeText}>{rangeLabel(range)}</Text>
        <Ionicons name="chevron-down" size={18} color={Colors.primary} />
      </Pressable>
      {open ? (
        <DateRangeSheet
          value={range}
          onClose={() => setOpen(false)}
          onApply={(r) => {
            onChange(r);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

const WEEK = ['PZT', 'SAL', 'ÇAR', 'PER', 'CUM', 'CMT', 'PAZ'];

function MonthCalendar({
  range,
  onPick,
}: {
  range: { from: string; to: string | null };
  onPick: (key: string) => void;
}) {
  const [month, setMonth] = useState(range.from.slice(0, 7));
  const first = fromDateKey(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  const today = todayKey();
  const shift = (d: number) => {
    const x = new Date(first.getFullYear(), first.getMonth() + d, 1);
    setMonth(dateKey(x).slice(0, 7));
  };
  const title = first.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const to = range.to ?? range.from;

  return (
    <View style={styles.cal}>
      <View style={styles.calHead}>
        <Text style={styles.calTitle}>
          {title.charAt(0).toLocaleUpperCase('tr-TR') + title.slice(1)}
        </Text>
        <Pressable
          onPress={() => shift(-1)}
          accessibilityRole="button"
          accessibilityLabel="Önceki ay"
          hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={Colors.primary} />
        </Pressable>
        <Pressable
          onPress={() => shift(1)}
          disabled={`${month}-01` > today}
          accessibilityRole="button"
          accessibilityLabel="Sonraki ay"
          hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
        </Pressable>
      </View>
      <View style={styles.calRow}>
        {WEEK.map((w) => (
          <Text key={w} style={styles.calWeek}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((k, i) => {
          if (!k) return <View key={`e${i}`} style={styles.calCell} />;
          const edge = k === range.from || k === to;
          const inside = k > range.from && k < to;
          const future = k > today;
          return (
            <Pressable
              key={k}
              onPress={() => onPick(k)}
              disabled={future}
              accessibilityRole="button"
              accessibilityLabel={fromDateKey(k).toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
              })}
              accessibilityState={{ selected: edge || inside }}
              style={[styles.calCell, inside && styles.calInside]}>
              <View style={[styles.calDay, edge && styles.calEdge]}>
                <Text
                  style={[
                    styles.calDayText,
                    edge && { color: '#FFFFFF', fontWeight: '700' },
                    future && { color: '#C5CBD3' },
                  ]}>
                  {Number(k.slice(8))}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function DateRangeSheet({
  value,
  onApply,
  onClose,
}: {
  value: DateRange;
  onApply: (r: DateRange) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<{ from: string; to: string | null }>(value);
  const [custom, setCustom] = useState(false);
  const complete: DateRange = { from: draft.from, to: draft.to ?? draft.from };
  const preset = matchPreset(complete);

  // İlk dokunuş başlangıç, ikincisi bitiş (önceyse yer değiştirir)
  const pick = (k: string) => {
    if (draft.to === null) {
      setDraft(k < draft.from ? { from: k, to: draft.from } : { from: draft.from, to: k });
    } else {
      setDraft({ from: k, to: null });
    }
  };

  return (
    <BottomSheet title="Tarih aralığı seçin" onClose={onClose}>
      <View style={styles.summary}>
        <View style={styles.summaryIcon}>
          <Ionicons name="calendar-outline" size={26} color={Colors.primary} />
        </View>
        <View style={{ gap: 2 }}>
          <Text style={styles.summaryTitle}>{rangeLong(complete)}</Text>
          <Text style={styles.summarySub}>
            {draft.to === null ? 'Bitiş gününü seçin' : `${rangeDays(complete)} gün`}
          </Text>
        </View>
      </View>

      <Text style={styles.quickLabel}>HIZLI SEÇİM</Text>
      <View style={styles.quick}>
        {PRESET_ORDER.map((p) => {
          const on = preset === p && draft.to !== null;
          return (
            <Pressable
              key={p}
              onPress={() => {
                setDraft(presetRange(p));
                setCustom(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.quickChip, on && styles.quickChipOn]}>
              {on ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
              <Text style={[styles.quickText, on && { color: '#FFFFFF' }]}>{presetLabels[p]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => setCustom((c) => !c)}
        accessibilityRole="button"
        accessibilityState={{ expanded: custom }}
        style={[styles.customBtn, custom && styles.customBtnOn]}>
        <Ionicons
          name="calendar-number-outline"
          size={22}
          color={custom ? '#7C3AED' : Colors.text}
        />
        <Text style={[styles.customText, custom && { color: '#7C3AED' }]}>Özel Aralık</Text>
        <Ionicons
          name={custom ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={custom ? '#7C3AED' : Colors.textSecondary}
        />
      </Pressable>
      {custom ? <MonthCalendar range={draft} onPick={pick} /> : null}

      <Pressable
        onPress={() => onApply(complete)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.apply, pressed && { opacity: 0.8 }]}>
        <Text style={styles.applyText}>Uygula</Text>
      </Pressable>
    </BottomSheet>
  );
}

// ----------------------------------------------------------------------------
// Özet kutucukları
// ----------------------------------------------------------------------------
export function StatTile({
  icon,
  label,
  value,
  tone = 'plain',
  iconBg = Colors.primarySoft,
  iconColor = Colors.primary,
}: {
  icon: IconName;
  label: string;
  value: string;
  tone?: 'plain' | 'orange' | 'green';
  iconBg?: string;
  iconColor?: string;
}) {
  const filled = tone !== 'plain';
  const bg = tone === 'orange' ? '#E0992E' : tone === 'green' ? '#2E9A7E' : Colors.surface;
  return (
    <View style={[styles.tile, { backgroundColor: bg }, filled && styles.tileFilled]}>
      <View
        style={[styles.tileIcon, { backgroundColor: filled ? 'rgba(255,255,255,0.22)' : iconBg }]}>
        <Ionicons name={icon} size={24} color={filled ? '#FFFFFF' : iconColor} />
      </View>
      <Text style={[styles.tileLabel, filled && { color: 'rgba(255,255,255,0.85)' }]}>{label}</Text>
      <Text
        style={[styles.tileValue, filled && { color: '#FFFFFF' }]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.tiles}>{children}</View>;
}

// ----------------------------------------------------------------------------
// Halka grafik
// ----------------------------------------------------------------------------
export const CHART_COLORS = ['#2A6FC9', '#1B4566', '#4FA3E0', '#7C9CC4', '#9FC2E8', '#5B6B82'];

export function Donut({
  parts,
  size = 150,
  centerTop,
  centerBottom,
}: {
  parts: { value: number; color: string }[];
  size?: number;
  centerTop: string;
  centerBottom: string;
}) {
  const stroke = size * 0.22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  const gap = parts.length > 1 ? 2 : 0;
  // Her dilimin başlangıcı (önceki dilimlerin toplam uzunluğu)
  const lens = parts.map((p) => (p.value / total) * c);
  const starts = lens.map((_, i) => lens.slice(0, i).reduce((s, l) => s + l, 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Dilimler saat 12'den başlasın: döndürme SVG'ye değil dış kutuya (web'de uyarısız) */}
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#E3EAF3"
            strokeWidth={stroke}
            fill="none"
          />
          {parts.map((p, i) => {
            const dash = Math.max(0, lens[i] - gap);
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={p.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-starts[i]}
              />
            );
          })}
        </Svg>
      </View>
      <View
        style={[
          styles.donutCenter,
          { width: size - stroke * 2 - 8, height: size - stroke * 2 - 8 },
        ]}>
        <Text style={styles.donutTop}>{centerTop}</Text>
        <Text style={styles.donutBottom}>{centerBottom}</Text>
      </View>
    </View>
  );
}

export function initialsOf(name: string) {
  return name
    .replace(/^(Dr\.|Dt\.)\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr-TR'))
    .join('');
}

export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initialsText, { fontSize: size * 0.32 }]}>
        {initialsOf(name) || '·'}
      </Text>
    </View>
  );
}

export function ListHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.listHead}>
      <Text style={styles.listTitle}>{title}</Text>
      <Text style={styles.listCount}>{count} kalem</Text>
    </View>
  );
}

/** "13 Kas 2026, 15:52" ya da yalnızca gün */
export function stamp(iso?: string, dayKey?: string) {
  if (iso) {
    return new Date(iso).toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return dayKey
    ? fromDateKey(dayKey).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}

export const defaultRange = (): DateRange => ({ from: addDays(todayKey(), -29), to: todayKey() });

const styles = StyleSheet.create({
  rangeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  rangeText: { fontSize: 17, color: Colors.primary },

  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D6E2F2',
    backgroundColor: '#F4F8FD',
  },
  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#E2ECF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: { fontSize: 18, color: Colors.text },
  summarySub: { fontSize: 14, color: Colors.textMuted },
  quickLabel: { fontSize: 13, letterSpacing: 1, color: Colors.textMuted, marginTop: Spacing.sm },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D5DAE1',
    backgroundColor: '#E6E8EE',
  },
  quickChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickText: { fontSize: 16, color: Colors.text },
  customBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 56,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D5DAE1',
    backgroundColor: '#F4F5F7',
    marginTop: Spacing.sm,
  },
  customBtnOn: { borderColor: '#8B5CF6', borderWidth: 2, backgroundColor: '#F5F0FF' },
  customText: { flex: 1, fontSize: 17, color: Colors.text },
  apply: {
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  applyText: { fontSize: 18, color: '#FFFFFF' },

  cal: {
    padding: Spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E3E8F0',
    backgroundColor: '#F7F8FA',
    gap: Spacing.sm,
  },
  calHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  calTitle: { flex: 1, fontSize: 18, color: Colors.primary },
  calRow: { flexDirection: 'row' },
  calWeek: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, color: Colors.textMuted },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' },
  calInside: { backgroundColor: '#E2ECF8' },
  calDay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calEdge: { backgroundColor: Colors.primary },
  calDayText: { fontSize: 16, color: Colors.text },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 150,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
  },
  tileFilled: { borderWidth: 0 },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  tileLabel: { fontSize: 14, color: Colors.textMuted },
  tileValue: { fontSize: 24, fontWeight: '600', color: Colors.text },

  donutCenter: {
    borderRadius: 999,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutTop: { fontSize: 22, fontWeight: '600', color: Colors.text },
  donutBottom: { fontSize: 13, color: Colors.textSecondary },

  initials: { backgroundColor: '#E6EDF6', alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontWeight: '600', color: Colors.primary },
  listHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  listTitle: { fontSize: 18, color: Colors.text },
  listCount: { fontSize: 14, color: Colors.textMuted },
});

export const reportStyles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6EAF0',
    backgroundColor: Colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  muted: { fontSize: 14, color: Colors.textSecondary },
  small: { fontSize: 13, color: Colors.textMuted },
  title: { fontSize: 18, color: Colors.text },
  amount: { fontSize: 18, color: '#1F8A6E' },
  link: { fontSize: 17, color: Colors.primary },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  badgeText: { fontSize: 13, color: Colors.primary },
  empty: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', padding: Spacing.xl },
});
