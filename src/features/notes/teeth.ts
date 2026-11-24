/**
 * Diş numaraları FDI sistemindedir: ilk rakam çeyrek (1 sağ üst, 2 sol üst, 3 sol alt, 4 sağ alt),
 * ikinci rakam orta hattan sayılan diş (1 orta kesici … 8 yirmi yaş).
 * "Sağ/sol" hastanın sağı/soludur; şema hekimin baktığı yönden çizilir.
 */

import type { Treatment } from '@/features/patients/types';
import { DIAGNOSTIC_KINDS } from '@/features/patients/utils';

export type Quadrant = { key: 1 | 2 | 3 | 4; label: string; teeth: number[] };

export const QUADRANTS: Quadrant[] = [
  { key: 1, label: 'Sağ üst', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { key: 2, label: 'Sol üst', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { key: 4, label: 'Sağ alt', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { key: 3, label: 'Sol alt', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
];

export function isValidTooth(n: number) {
  const q = Math.floor(n / 10);
  const d = n % 10;
  return (q >= 1 && q <= 4 && d >= 1 && d <= 8) || (q >= 5 && q <= 8 && d >= 1 && d <= 5);
}

/** Serbest metindeki diş numaralarını bulur: "36", "45, 46", "36-37" → [36, 37, 45, 46] */
export function parseTeeth(text?: string | null): number[] {
  if (!text) return [];
  const found = new Set<number>();
  for (const m of text.matchAll(/\b(\d{2})\b/g)) {
    const n = Number(m[1]);
    if (isValidTooth(n)) found.add(n);
  }
  return [...found].sort((a, b) => a - b);
}

export function teethLabel(teeth: number[]) {
  return teeth.join(', ');
}

export type ToothState = {
  /** Tamamlanmış implant */
  implant: boolean;
  /** Tamamlanmış başka bir tedavi */
  treated: boolean;
  /** Planlanan ya da devam eden tedavi */
  planned: boolean;
  /** Bu dişe bağlı not var */
  hasNotes: boolean;
};

/** Tedavilerden ve notlardan her dişin durumunu çıkarır. */
export function toothStates(treatments: Treatment[] | null, noteTeeth: number[][]) {
  const map = new Map<number, ToothState>();
  const get = (n: number) => {
    let s = map.get(n);
    if (!s) {
      s = { implant: false, treated: false, planned: false, hasNotes: false };
      map.set(n, s);
    }
    return s;
  };
  for (const t of treatments ?? []) {
    for (const n of parseTeeth(t.tooth)) {
      const s = get(n);
      if (t.status === 'tamamlandi') {
        // Renk işlem adından değil, kayıttaki türden okunur; muayene/kontrol ve röntgen dişi işaretlemez.
        if (t.kind === 'implant') s.implant = true;
        else if (!DIAGNOSTIC_KINDS.includes(t.kind)) s.treated = true;
      } else {
        s.planned = true;
      }
    }
  }
  for (const teeth of noteTeeth) for (const n of teeth) get(n).hasNotes = true;
  return map;
}

const SIDES: Record<number, string> = {
  1: 'Sağ üst',
  2: 'Sol üst',
  3: 'Sol alt',
  4: 'Sağ alt',
  5: 'Sağ üst süt',
  6: 'Sol üst süt',
  7: 'Sol alt süt',
  8: 'Sağ alt süt',
};
const PERMANENT = [
  '',
  'orta kesici',
  'yan kesici',
  'köpek dişi',
  'birinci küçük azı',
  'ikinci küçük azı',
  'birinci büyük azı',
  'ikinci büyük azı',
  'yirmi yaş dişi',
];
const PRIMARY = ['', 'orta kesici', 'yan kesici', 'köpek dişi', 'birinci azı', 'ikinci azı'];

/** 36 → "Sol alt birinci büyük azı" (hastaya anlatırken ve dişe dokununca gösterilir) */
export function toothName(n: number) {
  if (!isValidTooth(n)) return '';
  const q = Math.floor(n / 10);
  const d = n % 10;
  return `${SIDES[q]} ${(q <= 4 ? PERMANENT : PRIMARY)[d]}`;
}
