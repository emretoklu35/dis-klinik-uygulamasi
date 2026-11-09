/**
 * Para yardımcıları. Tutarlar uygulamada ve veritabanında KURUŞ cinsinden tam sayıdır
 * (4.000,00 TL = 400000); böylece ondalık yuvarlama hatası olmaz.
 */

const formatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 400000 → "₺4.000,00" */
export function formatTL(kurus: number) {
  return formatter.format(kurus / 100);
}

/** 400000 → "4.000" ; 400050 → "4.000,50" (form alanında göstermek için) */
export function kurusToInput(kurus: number) {
  const lira = Math.trunc(kurus / 100);
  const rest = Math.abs(kurus % 100);
  const liraText = lira.toLocaleString('tr-TR');
  return rest ? `${liraText},${String(rest).padStart(2, '0')}` : liraText;
}

/**
 * Türkçe tutar girişini kuruşa çevirir. Geçersizse null.
 *  "4000" → 400000, "4.000" → 400000, "4.000,50" → 400050, "4000,5" → 400050,
 *  "4000.50" → 400050, "₺ 1.250" → 125000
 */
export function parseTL(text: string): number | null {
  let t = text.replace(/[\s₺]|TL/gi, '');
  if (!t) return null;
  if (t.includes(',')) {
    // Virgül ondalık; noktalar binlik ayırıcı
    if (!/^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(t)) return null;
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, ''); // "4.000" → binlik
  } else if (!/^\d+(\.\d{1,2})?$/.test(t)) {
    return null;
  }
  const value = Math.round(Number(t) * 100);
  return Number.isFinite(value) && value >= 0 && value < 1e12 ? value : null;
}
