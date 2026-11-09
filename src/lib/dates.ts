/**
 * Tarih yardımcıları. Uygulama klinik saatiyle (cihazın yerel saati) çalışır.
 * - "Gün anahtarı": 'YYYY-AA-GG' (ör. 2026-11-09)
 * - "Yerel tarih-saat": 'YYYY-AA-GGTSS:DD' (ör. 2026-11-09T09:30), saat dilimi içermez.
 */

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return dateKey(new Date());
}

export function addDays(key: string, days: number) {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Haftanın pazartesisi. */
export function startOfWeek(key: string) {
  const d = fromDateKey(key);
  const diff = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - diff);
  return dateKey(d);
}

export function isSunday(key: string) {
  return fromDateKey(key).getDay() === 0;
}

export function localDateTime(key: string, time: string) {
  return `${key}T${time}`;
}

/** Şu an, yerel tarih-saat olarak ('YYYY-AA-GGTSS:DD'). */
export function nowLocalDateTime(now = new Date()) {
  return `${dateKey(now)}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function parseLocalDateTime(value: string) {
  const [key, time = '00:00'] = value.split('T');
  const [h, mi] = time.split(':').map(Number);
  const d = fromDateKey(key);
  d.setHours(h, mi, 0, 0);
  return d;
}

/** '09:30' → 570 */
export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 570 → '09:30' */
export function minutesToTime(min: number) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

/** GG.AA.YYYY → gün anahtarı. Geçersizse `null`. */
export function parseDateInput(text: string) {
  const m = text.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return dateKey(date);
}

/** Gün anahtarı → GG.AA.YYYY */
export function formatDateInput(key: string) {
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}

export const weekDayShort = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/** "Pzt 9 Kas" */
export function formatDayShort(key: string) {
  const d = fromDateKey(key);
  const month = d.toLocaleDateString('tr-TR', { month: 'short' });
  return `${weekDayShort[(d.getDay() + 6) % 7]} ${d.getDate()} ${month}`;
}

/** "9 Kasım Pazartesi" */
export function formatDayLong(key: string) {
  return fromDateKey(key).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });
}

/** "9 – 14 Kasım 2026" ya da ay değişiyorsa "30 Kasım – 5 Aralık 2026" */
export function formatRange(fromKey: string, toKey: string) {
  const a = fromDateKey(fromKey);
  const b = fromDateKey(toKey);
  const end = b.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} – ${end}`;
  }
  return `${a.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} – ${end}`;
}
