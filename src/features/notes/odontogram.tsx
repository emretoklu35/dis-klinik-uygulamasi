/**
 * Diş şeması (FDI), kök ve kronuyla gerçekçi diş çizimleriyle. İki kullanım:
 *  - Görüntüleme: tedavilerden ve notlardan dişlerin durumu renkle gösterilir, dişe basınca seçilir.
 *  - Seçim: not yazarken ilgili dişler işaretlenir (multiple).
 * Genişlik yeterliyse üst/alt çene tek satırda (16 diş); dar ekranda sağ ve sol yarı alt alta.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { Colors, Fonts, Spacing } from '@/constants/theme';

import { QUADRANTS, toothName, type ToothState } from './teeth';

const IMPLANT = '#2563EB';
const IMPLANT_SOFT = '#DBE7FD';
const TREATED = '#5B6B78';
const PLANNED = '#DC2626';
const OUTLINE = '#7C8790';
const CROWN_FILL = '#F4F5F5';
const ROOT_FILL = '#F0E8BF';
const NOTE = Colors.warning;

/**
 * Önden görünüş, 0..1 kutusunda: kök(ler) üstte (y=0 apeks), kron altta (y=1 kesici kenar).
 * Alt çene dişleri dikey olarak aynalanır. Kök sayıları anatomiye göre:
 * üst büyük azı 3, alt büyük azı 2, üst 1. küçük azı 2, diğerleri tek kök.
 * (Dentumi'ye özgün çizim.)
 */
type Shape = { crown: string; roots: string[] };

const R_SINGLE = 'M0.29,0.64 C0.29,0.38 0.40,0.07 0.50,0.03 C0.60,0.07 0.71,0.38 0.71,0.64 Z';
const R_CANINE = 'M0.30,0.64 C0.31,0.34 0.42,0.02 0.50,0.00 C0.58,0.02 0.69,0.34 0.70,0.64 Z';
const R_NARROW = 'M0.33,0.64 C0.33,0.40 0.42,0.08 0.50,0.04 C0.58,0.08 0.67,0.40 0.67,0.64 Z';
const R_PM_B = 'M0.25,0.64 C0.23,0.42 0.28,0.13 0.36,0.06 C0.43,0.14 0.47,0.40 0.49,0.64 Z';
const R_PM_L = 'M0.51,0.64 C0.53,0.40 0.57,0.14 0.64,0.06 C0.72,0.13 0.77,0.42 0.75,0.64 Z';
const R_M_MESIAL = 'M0.13,0.64 C0.09,0.42 0.13,0.13 0.23,0.05 C0.33,0.11 0.39,0.36 0.44,0.64 Z';
const R_M_DISTAL = 'M0.56,0.64 C0.61,0.36 0.67,0.11 0.77,0.05 C0.87,0.13 0.91,0.42 0.87,0.64 Z';
const R_M_PALATAL = 'M0.35,0.64 C0.37,0.36 0.44,0.05 0.50,0.02 C0.56,0.05 0.63,0.36 0.65,0.64 Z';

const C_INCISOR =
  'M0.24,0.62 Q0.50,0.57 0.76,0.62 C0.84,0.74 0.85,0.90 0.81,0.97 Q0.50,1.01 0.19,0.97 C0.15,0.90 0.16,0.74 0.24,0.62 Z';
const C_CANINE =
  'M0.24,0.62 Q0.50,0.57 0.76,0.62 C0.88,0.73 0.87,0.86 0.68,0.94 L0.50,1.00 L0.32,0.94 C0.13,0.86 0.12,0.73 0.24,0.62 Z';
const C_PREMOLAR =
  'M0.20,0.62 Q0.50,0.57 0.80,0.62 C0.92,0.72 0.90,0.86 0.74,0.94 Q0.62,0.99 0.50,1.00 Q0.38,0.99 0.26,0.94 C0.10,0.86 0.08,0.72 0.20,0.62 Z';
const C_MOLAR =
  'M0.09,0.62 Q0.50,0.56 0.91,0.62 C0.99,0.72 0.99,0.86 0.91,0.94 Q0.80,1.00 0.69,0.96 Q0.60,0.92 0.50,0.97 Q0.40,0.92 0.31,0.96 Q0.20,1.00 0.09,0.94 C0.01,0.86 0.01,0.72 0.09,0.62 Z';

function shapeOf(n: number): Shape {
  const q = Math.floor(n / 10);
  const d = n % 10;
  const upper = q === 1 || q === 2;
  if (d <= 2) return { crown: C_INCISOR, roots: [upper ? R_SINGLE : R_NARROW] };
  if (d === 3) return { crown: C_CANINE, roots: [R_CANINE] };
  if (d <= 5) return { crown: C_PREMOLAR, roots: upper && d === 4 ? [R_PM_B, R_PM_L] : [R_SINGLE] };
  // Büyük azılar: üstte damak kökü arkada görünür
  return {
    crown: C_MOLAR,
    roots: upper ? [R_M_PALATAL, R_M_MESIAL, R_M_DISTAL] : [R_M_MESIAL, R_M_DISTAL],
  };
}

/** İmplant gövdesi (kök yerine) ve bağlantı parçası */
const FIXTURE = 'M0.43,0.08 Q0.50,0.04 0.57,0.08 L0.65,0.58 L0.35,0.58 Z';
const ABUTMENT = 'M0.37,0.57 L0.63,0.57 L0.61,0.63 L0.39,0.63 Z';

/** Orta hattan sayılan diş numarasına (1–8) göre göreli genişlik */
const WIDTH = [0, 1, 0.86, 0.9, 0.84, 0.84, 1.24, 1.2, 1.12];
const HALF_UNITS = WIDTH.reduce((a, b) => a + b, 0);
const GAP = 2;
const MID_GAP = 12;

/** Dişin çizim genişliği (alt kesiciler üsttekilerden dar) */
function toothWidth(n: number, unit: number) {
  const d = n % 10;
  const narrow = n >= 30 && n < 50 && d <= 2 ? 0.86 : 1;
  return WIDTH[d] * unit * narrow;
}

type Group = 'buyuk' | 'kucuk' | 'kopek' | 'kesici';
const GROUP_LABELS: Record<Group, string> = {
  buyuk: 'Büyük azılar',
  kucuk: 'Küçük azılar',
  kopek: 'Köpek',
  kesici: 'Kesiciler',
};
const groupOf = (n: number): Group => {
  const d = n % 10;
  return d >= 6 ? 'buyuk' : d >= 4 ? 'kucuk' : d === 3 ? 'kopek' : 'kesici';
};

/** Diş gruplarının etiketleri: dişlerin tam üstünde (üst çene) ya da altında (alt çene) */
function GroupLabels({ teeth, unit, lower }: { teeth: number[]; unit: number; lower: boolean }) {
  const groups: { group: Group; width: number }[] = [];
  for (const n of teeth) {
    const w = toothWidth(n, unit) + 3;
    const last = groups.at(-1);
    if (last && last.group === groupOf(n)) last.width += w + GAP;
    else groups.push({ group: groupOf(n), width: w });
  }
  return (
    <View style={styles.row}>
      {groups.map((g, i) => (
        <View key={i} style={[styles.group, { width: g.width }]}>
          {lower ? <View style={styles.groupLine} /> : null}
          <Text style={styles.groupText} numberOfLines={1}>
            {GROUP_LABELS[g.group]}
          </Text>
          {lower ? null : <View style={styles.groupLine} />}
        </View>
      ))}
    </View>
  );
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
  const shape = shapeOf(n);
  const stroke = state?.planned ? PLANNED : selected ? Colors.primary : OUTLINE;
  const strokeWidth = state?.planned || selected ? 1.8 : 0.9;

  if (state?.implant) {
    // Vida dişleri: apeksten krona doğru genişleyen gövde boyunca
    const threads = [0.16, 0.24, 0.32, 0.4, 0.48].map((t) => {
      const half = 0.08 + (t - 0.08) * 0.2;
      const y1 = (lower ? 1 - t : t) * h;
      const y2 = (lower ? 1 - (t + 0.03) : t + 0.03) * h;
      return (
        <Line
          key={t}
          x1={w * (0.5 - half)}
          x2={w * (0.5 + half)}
          y1={y1}
          y2={y2}
          stroke={IMPLANT}
          strokeWidth={1.3}
          strokeLinecap="round"
        />
      );
    });
    return (
      <Svg {...box} viewBox={vb}>
        <Path d={p(FIXTURE)} fill={IMPLANT_SOFT} stroke={IMPLANT} strokeWidth={0.9} />
        {threads}
        <Path d={p(ABUTMENT)} fill="#8FA9E8" />
        <Path
          d={p(shape.crown)}
          fill={selected ? '#3B74F0' : IMPLANT}
          stroke={state.planned ? PLANNED : selected ? Colors.primary : '#1E4FBF'}
          strokeWidth={strokeWidth}
        />
      </Svg>
    );
  }

  return (
    <Svg {...box} viewBox={vb}>
      {shape.roots.map((r, i) => (
        <Path
          key={i}
          d={p(r)}
          fill={selected ? '#E7F2E9' : ROOT_FILL}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ))}
      <Path
        d={p(shape.crown)}
        fill={state?.treated ? TREATED : selected ? Colors.primarySoft : CROWN_FILL}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
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
  const w = toothWidth(n, unit);
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
      style={({ pressed }) => [styles.tooth, { width: w + 3 }, pressed && { opacity: 0.6 }]}>
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
  // Kök ve kron birlikte: dişler eninden yaklaşık 2,4 kat uzun
  const height = unit * (compact ? 2.0 : 2.45);

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
            {!compact ? (
              <View style={styles.jawRow}>
                <GroupLabels teeth={q(1)} unit={unit} lower={false} />
                <View style={{ width: MID_GAP }} />
                <GroupLabels teeth={q(2)} unit={unit} lower={false} />
              </View>
            ) : null}
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
            {!compact ? (
              <View style={styles.jawRow}>
                <GroupLabels teeth={q(4)} unit={unit} lower />
                <View style={{ width: MID_GAP }} />
                <GroupLabels teeth={q(3)} unit={unit} lower />
              </View>
            ) : null}
            <Text style={[styles.sideLabel, { textAlign: 'center' }]}>Alt çene</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.lg }}>
            {half('Sağ (üst / alt)', q(1), q(4), 'sag')}
            {half('Sol (üst / alt)', q(2), q(3), 'sol')}
          </View>
        )}
      </View>
      {selected.length === 1 && toothName(selected[0]) ? (
        <Text style={styles.toothName}>
          <Text style={styles.toothNameNo}>{selected[0]}</Text> · {toothName(selected[0])}
        </Text>
      ) : null}
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
  group: { alignItems: 'center', gap: 3 },
  groupLine: {
    alignSelf: 'stretch',
    height: 2,
    marginHorizontal: 4,
    borderRadius: 1,
    backgroundColor: '#D3DAD8',
  },
  groupText: { fontSize: 10, fontFamily: Fonts.bodyMedium, color: Colors.textMuted },
  toothName: { fontSize: 13, fontFamily: Fonts.bodyMedium, color: Colors.text },
  toothNameNo: { fontFamily: Fonts.bodyBold, color: Colors.primary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendBox: { width: 14, height: 14, borderRadius: 4, borderWidth: 1 },
  legendDot: { position: 'relative', right: 0 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
});

/**
 * Yazdırılacak belgeler (proforma) için şemanın düz SVG metni: üst ve alt çene tek satırda,
 * aynı diş çizimleri ve durum renkleri.
 */
export function odontogramSvg(states?: Map<number, ToothState>) {
  const unit = 26;
  const h = unit * 2.45;
  const numH = 14;
  const rowGap = 8;
  const q = (k: 1 | 2 | 3 | 4) => QUADRANTS.find((x) => x.key === k)!.teeth;
  const rows: [number[], boolean][] = [
    [[...q(1), ...q(2)], false],
    [[...q(4), ...q(3)], true],
  ];
  const totalW = 2 * HALF_UNITS * unit + 15 * GAP + MID_GAP;
  const height = 2 * (h + numH) + rowGap;
  let out = '';
  rows.forEach(([teeth, lower], r) => {
    let x = 0;
    const top = r === 0 ? numH : numH + h + rowGap + 1;
    teeth.forEach((n, i) => {
      const w = toothWidth(n, unit);
      const s = states?.get(n);
      const shape = shapeOf(n);
      const p = (d: string) => scalePath(d, w, h, lower);
      const stroke = s?.planned ? PLANNED : OUTLINE;
      const sw = s?.planned ? 1.6 : 0.8;
      let g = '';
      if (s?.implant) {
        g += `<path d="${p(FIXTURE)}" fill="${IMPLANT_SOFT}" stroke="${IMPLANT}" stroke-width="0.8"/>`;
        g += `<path d="${p(shape.crown)}" fill="${IMPLANT}" stroke="${stroke}" stroke-width="${sw}"/>`;
      } else {
        for (const root of shape.roots)
          g += `<path d="${p(root)}" fill="${ROOT_FILL}" stroke="${stroke}" stroke-width="${sw}"/>`;
        g += `<path d="${p(shape.crown)}" fill="${s?.treated ? TREATED : CROWN_FILL}" stroke="${stroke}" stroke-width="${sw}"/>`;
      }
      out += `<g transform="translate(${x.toFixed(1)},${top.toFixed(1)})">${g}</g>`;
      const ny = lower ? top + h + 11 : top - 4;
      out += `<text x="${(x + w / 2).toFixed(1)}" y="${ny.toFixed(1)}" font-size="9" text-anchor="middle" fill="#56636F" font-family="Helvetica, Arial, sans-serif">${n}</text>`;
      x += w + GAP + (i === 7 ? MID_GAP : 0);
    });
  });
  const mid = 8 * GAP + HALF_UNITS * unit + MID_GAP / 2;
  out += `<line x1="${mid}" x2="${mid}" y1="0" y2="${height}" stroke="#E2E7E5" stroke-dasharray="3 3"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 ${(totalW + 4).toFixed(0)} ${(height + 4).toFixed(0)}" width="100%">${out}</svg>`;
}
