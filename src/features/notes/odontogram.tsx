/**
 * Diş şeması (FDI). İki kullanım:
 *  - Görüntüleme: tedavilerden ve notlardan dişlerin durumu renkle gösterilir, dişe basınca seçilir.
 *  - Seçim: not yazarken ilgili dişler işaretlenir (multiple).
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

import { QUADRANTS, type ToothState } from './teeth';

const IMPLANT = '#2563EB';
const TREATED = '#475569';
const PLANNED = '#DC2626';

function Tooth({
  n,
  state,
  selected,
  compact,
  onPress,
}: {
  n: number;
  state?: ToothState;
  selected: boolean;
  compact: boolean;
  onPress?: (n: number) => void;
}) {
  const fill = state?.implant ? IMPLANT : state?.treated ? TREATED : undefined;
  const label = [
    `Diş ${n}`,
    state?.implant ? 'implant' : null,
    state?.treated ? 'tedavi edilmiş' : null,
    state?.planned ? 'planlanan tedavi var' : null,
    state?.hasNotes ? 'not var' : null,
    selected ? 'seçili' : null,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={onPress ? () => onPress(n) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={2}
      style={({ pressed }) => [
        styles.tooth,
        compact && styles.toothCompact,
        fill && { backgroundColor: fill, borderColor: fill },
        state?.planned && { borderColor: PLANNED, borderWidth: 2 },
        selected && styles.toothSelected,
        pressed && { opacity: 0.6 },
      ]}>
      <Text
        style={[
          styles.toothText,
          compact && { fontSize: 12 },
          fill && { color: '#FFFFFF' },
          selected && !fill && { color: Colors.primary },
        ]}>
        {n}
      </Text>
      {state?.hasNotes ? (
        <View style={[styles.dot, fill && { backgroundColor: '#FFFFFF' }]} />
      ) : null}
    </Pressable>
  );
}

export function Odontogram({
  states,
  selected = [],
  onPress,
  compact = false,
  showLegend = true,
}: {
  states?: Map<number, ToothState>;
  selected?: number[];
  onPress?: (n: number) => void;
  compact?: boolean;
  showLegend?: boolean;
}) {
  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.jaws}>
        {QUADRANTS.map((q) => (
          <View
            key={q.key}
            style={[styles.quadrant, (q.key === 1 || q.key === 4) && styles.quadrantRight]}>
            <Text style={styles.qLabel}>{q.label}</Text>
            <View style={styles.row}>
              {q.teeth.map((n) => (
                <Tooth
                  key={n}
                  n={n}
                  state={states?.get(n)}
                  selected={selected.includes(n)}
                  compact={compact}
                  onPress={onPress}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      {showLegend ? (
        <View style={styles.legend}>
          <Legend color={IMPLANT} label="İmplant" filled />
          <Legend color={TREATED} label="Tedavi edildi" filled />
          <Legend color={PLANNED} label="Planlanan / devam eden" />
          <View style={styles.legendItem}>
            <View style={[styles.dot, styles.legendDot]} />
            <Text style={styles.legendText}>Not var</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label, filled }: { color: string; label: string; filled?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendBox,
          { borderColor: color },
          filled && { backgroundColor: color },
          !filled && { borderWidth: 2 },
        ]}
      />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dört çeyrek: genişte 2×2 (sağ üst | sol üst / sağ alt | sol alt), dar ekranda alt alta
  jaws: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.md },
  quadrant: { flexGrow: 1, flexBasis: 300, gap: 4, paddingHorizontal: 2 },
  quadrantRight: { alignItems: 'flex-end' },
  qLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  row: { flexDirection: 'row', gap: 4 },
  tooth: {
    width: 34,
    height: 40,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toothCompact: { width: 32, height: 34 },
  toothSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.primarySoft,
  },
  toothText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendDot: { position: 'relative', bottom: 0 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
});
