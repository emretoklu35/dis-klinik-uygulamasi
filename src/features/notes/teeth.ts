/**
 * Diş numaraları FDI sistemindedir: ilk rakam çeyrek (1 sağ üst, 2 sol üst, 3 sol alt, 4 sağ alt),
 * ikinci rakam orta hattan sayılan diş (1 orta kesici … 8 yirmi yaş).
 * "Sağ/sol" hastanın sağı/soludur; şema hekimin baktığı yönden çizilir.
 */

import type { Treatment } from '@/features/patients/types';

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

const IMPLANT = /implant/i;
const NOT_A_PROCEDURE = /değerlendirme|kontrol|muayene/i;

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
        if (IMPLANT.test(t.procedure) && !NOT_A_PROCEDURE.test(t.procedure)) s.implant = true;
        else if (!NOT_A_PROCEDURE.test(t.procedure)) s.treated = true;
      } else {
        s.planned = true;
      }
    }
  }
  for (const teeth of noteTeeth) for (const n of teeth) get(n).hasNotes = true;
  return map;
}
