/**
 * Diş şeması (FDI), gerçek diş silüetleriyle. İki kullanım:
 *  - Görüntüleme: tedavilerden ve notlardan dişlerin durumu renkle gösterilir, dişe basınca seçilir.
 *  - Seçim: not yazarken ilgili dişler işaretlenir (multiple).
 * Genişlik yeterliyse üst/alt çene tek satırda (16 diş); dar ekranda sağ ve sol yarı alt alta.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Colors, Fonts, Spacing } from '@/constants/theme';

import { QUADRANTS, type ToothState } from './teeth';

const IMPLANT = '#2563EB';
const IMPLANT_SOFT = '#DBE7FD';
const TREATED = '#5B6B78';
const TREATED_SOFT = '#E4E8EB';
const PLANNED = '#DC2626';
const OUTLINE = '#9AA8B2';
const CEJ = '#C9D2D8';
const NOTE = Colors.warning;

type Kind = 'kesici' | 'kopek' | 'kucukAzi' | 'buyukAzi';

/**
 * Önden görünüş silüetleri, 0..1 kutusunda; kök üstte (y=0), kron altta (y=1).
 * Alt çene için dikey olarak aynalanır.
 */
const SHAPES: Record<Kind, string> = {
  kesici:
    'M0.40,0.03 Q0.50,-0.01 0.60,0.03 L0.80,0.50 Q0.93,0.62 0.88,0.96 Q0.50,1.02 0.12,0.96 Q0.07,0.62 0.20,0.50 Z',
  kopek: 'M0.42,0.00 Q0.50,-0.02 0.58,0.00 L0.82,0.52 Q0.94,0.70 0.50,1.00 Q0.06,0.70 0.18,0.52 Z',
  kucukAzi:
    'M0.38,0.04 Q0.50,0.00 0.62,0.04 L0.84,0.52 Q0.98,0.66 0.88,0.92 Q0.70,1.00 0.50,0.93 Q0.30,1.00 0.12,0.92 Q0.02,0.66 0.16,0.52 Z',
  buyukAzi:
    'M0.12,0.52 L0.20,0.06 Q0.27,0.00 0.33,0.07 L0.45,0.36 Q0.50,0.31 0.55,0.36 L0.67,0.07 Q0.73,0.00 0.80,0.06 L0.88,0.52 Q1.00,0.64 0.93,0.90 Q0.82,1.00 0.67,0.93 Q0.50,1.00 0.33,0.93 Q0.18,1.00 0.07,0.90 Q0.00,0.64 0.12,0.52 Z',
};
/** Kron bölgesi (tedavi/implant dolgusu için) */
const CROWN = 'M0.10,0.54 Q0.50,0.47 0.90,0.54 L0.92,0.92 Q0.50,1.00 0.08,0.92 Z';
/** Mine-sement sınırı çizgisi */
const CEJ_LINE = 'M0.14,0.53 Q0.50,0.47 0.86,0.53';
/** İmplant gövdesi (kök yerine) */
const FIXTURE = 'M0.43,0.05 Q0.50,0.01 0.57,0.05 L0.66,0.47 L0.34,0.47 Z';
/** İmplant üstü kron (yuvarlatılmış) */
const IMPLANT_CROWN =
  'M0.14,0.53 Q0.50,0.47 0.86,0.53 Q0.97,0.66 0.90,0.94 Q0.50,1.02 0.10,0.94 Q0.03,0.66 0.14,0.53 Z';
/** Kron ile vida arasındaki bağlantı parçası */
const ABUTMENT = 'M0.36,0.46 L0.64,0.46 L0.62,0.53 L0.38,0.53 Z';

/** Orta hattan sayılan diş numarasına (1–8) göre göreli genişlik */
const WIDTH = [0, 1, 0.86, 0.9, 0.84, 0.84, 1.24, 1.2, 1.12];
const HALF_UNITS = WIDTH.reduce((a, b) => a + b, 0);
const GAP = 2;
const MID_GAP = 12;

function kindOf(n: number): Kind {
  const d = n % 10;
  if (d <= 2) return 'kesici';
  if (d === 3) return 'kopek';
  if (d <= 5) return 'kucukAzi';
  return 'buyukAzi';
}

/** Normalize yolu w×h kutusuna ölçekler; flip ile dikey aynalar (transform kullanmadan). */
function scalePath(d: string, w: number, h: number, flip: boolean) {
  return d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (_, x: string, y: string) => {
    const yy = flip ? 1 - Number(y) : Number(y);
    return `${(Number(x) * w).toFixed(1)},${(yy * h).toFixed(1)}`;
  });
}

function ToothShape({
  n,
  w,
  h,
  lower,
  state,
  selected,
}: {
  n: number;
  w: number;
  h: number;
  lower: boolean;
  state?: ToothState;
  selected: boolean;
}) {
  const p = (d: string) => scalePath(d, w, h, lower);
  const pad = 1.5;
  const box = { width: w + pad * 2, height: h + pad * 2 };
  const vb = `${-pad} ${-pad} ${box.width} ${box.height}`;

  if (state?.implant) {
    // Vida dişleri: yukarıdan (apeks) aşağıya genişleyen gövde boyunca
    const threads = [0.12, 0.19, 0.26, 0.33, 0.4].map((t) => {
      const half = 0.07 + (t - 0.05) * 0.24 + 0.04;
      const y1 = (lower ? 1 - t : t) * h;
      const y2 = (lower ? 1 - (t + 0.035) : t + 0.035) * h;
      return (
        <Line
          key={t}
          x1={w * (0.5 - half)}
          x2={w * (0.5 + half)}
          y1={y1}
          y2={y2}
          stroke={IMPLANT}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      );
    });
    return (
      <Svg {...box} viewBox={vb}>
        <Path d={p(FIXTURE)} fill={IMPLANT_SOFT} stroke={IMPLANT} strokeWidth={1} />
        {threads}
        <Path d={p(ABUTMENT)} fill="#8FA9E8" />
        <Path
          d={p(IMPLANT_CROWN)}
          fill={selected ? '#3B74F0' : IMPLANT}
          stroke={state.planned ? PLANNED : selected ? Colors.primary : '#1E4FBF'}
          strokeWidth={state.planned || selected ? 2 : 1}
        />
      </Svg>
    );
  }

  const fill = state?.treated ? TREATED_SOFT : selected ? Colors.primarySoft : Colors.surface;
  const stroke = state?.planned ? PLANNED : selected ? Colors.primary : OUTLINE;
  return (
    <Svg {...box} viewBox={vb}>
      <Path
        d={p(SHAPES[kindOf(n)])}
        fill={fill}
        stroke={stroke}
        strokeWidth={state?.planned || selected ? 2 : 1.1}
      />
      {state?.treated ? <Path d={p(CROWN)} fill={TREATED} opacity={0.9} /> : null}
      <Path d={p(CEJ_LINE)} fill="none" stroke={CEJ} strokeWidth={1} />
    </Svg>
  );
}

function Tooth({
  n,
  unit,
  height,
  lower,
  state,
  selected,
  onPress,
}: {
  n: number;
  unit: number;
  height: number;
  lower: boolean;
  state?: ToothState;
  selected: boolean;
  onPress?: (n: number) => void;
}) {
  const d = n % 10;
  const w = WIDTH[d] * unit;
  // Kemer etkisi: arka dişler orta hattan uzaklaştıkça hafifçe yukarı/aşağı kayar
  const lift = ((d - 1) / 7) ** 2 * height * 0.18;
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

  const number = (
    <Text
      style={[styles.num, selected && styles.numSelected]}
      numberOfLines={1}
      allowFontScaling={false}>
      {n}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress ? () => onPress(n) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tooth,
        { width: w + 3 },
        lower ? { marginTop: lift } : { marginBottom: lift },
        pressed && { opacity: 0.6 },
      ]}>
      {lower ? number : null}
      <View>
        <ToothShape n={n} w={w} h={height} lower={lower} state={state} selected={selected} />
        {state?.hasNotes ? (
          <View style={[styles.noteDot, lower ? { top: 3 } : { bottom: 3 }]} />
        ) : null}
      </View>
      {lower ? null : number}
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
  const [width, setWidth] = useState(0);
  const q = (k: 1 | 2 | 3 | 4) => QUADRANTS.find((x) => x.key === k)!.teeth;

  // Tooth genişliği + 3px svg payı, dişler arası GAP
  const toothExtra = 3 + GAP;
  const wide = width >= 560;
  const unit = wide
    ? Math.min(40, (width - MID_GAP - 16 * toothExtra) / (2 * HALF_UNITS))
    : Math.min(46, (width - 8 * toothExtra) / HALF_UNITS);
  const height = unit * (compact ? 1.75 : 2.05);

  const row = (teeth: number[], lower: boolean) => (
    <View style={[styles.row, { alignItems: lower ? 'flex-start' : 'flex-end' }]}>
      {teeth.map((n) => (
        <Tooth
          key={n}
          n={n}
          unit={unit}
          height={height}
          lower={lower}
          state={states?.get(n)}
          selected={selected.includes(n)}
          onPress={onPress}
        />
      ))}
    </View>
  );

  const half = (label: string, upper: number[], lower: number[], key: string) => (
    <View key={key} style={styles.half}>
      <Text style={styles.sideLabel}>{label}</Text>
      {row(upper, false)}
      <View style={styles.occlusal} />
      {row(lower, true)}
    </View>
  );

  return (
    <View style={{ gap: Spacing.md }}>
      <View onLayout={(e) => setWidth(Math.floor(e.nativeEvent.layout.width))}>
        {width === 0 ? null : wide ? (
          <View style={styles.full}>
            <View style={styles.sideLabels}>
              <Text style={styles.sideLabel}>Sağ</Text>
              <Text style={styles.sideLabel}>Üst çene</Text>
              <Text style={styles.sideLabel}>Sol</Text>
            </View>
            <View style={styles.jawRow}>
              {row(q(1), false)}
              <View style={styles.midline} />
              {row(q(2), false)}
            </View>
            <View style={styles.occlusal} />
            <View style={styles.jawRow}>
              {row(q(4), true)}
              <View style={styles.midline} />
              {row(q(3), true)}
            </View>
            <Text style={[styles.sideLabel, { textAlign: 'center' }]}>Alt çene</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.lg }}>
            {half('Sağ (üst / alt)', q(1), q(4), 'sag')}
            {half('Sol (üst / alt)', q(2), q(3), 'sol')}
          </View>
        )}
      </View>
      {showLegend ? (
        <View style={styles.legend}>
          <Legend color={TREATED} label="Tedavi edildi" filled />
          <Legend color={IMPLANT} label="İmplant" filled />
          <Legend color={PLANNED} label="Planlanan / devam eden" />
          <View style={styles.legendItem}>
            <View style={[styles.noteDot, styles.legendDot]} />
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
  full: { gap: 4, alignSelf: 'center' },
  half: { gap: 4, alignSelf: 'center' },
  sideLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  sideLabel: { fontSize: 11, fontFamily: Fonts.bodyMedium, color: Colors.textMuted },
  jawRow: { flexDirection: 'row', alignItems: 'stretch' },
  row: { flexDirection: 'row', gap: GAP },
  midline: {
    width: 1,
    marginHorizontal: (MID_GAP - 1) / 2,
    backgroundColor: Colors.border,
  },
  occlusal: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  tooth: { alignItems: 'center', gap: 2 },
  num: { fontSize: 11, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  numSelected: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  noteDot: {
    position: 'absolute',
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: NOTE,
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendDot: { position: 'relative', right: 0 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
});
