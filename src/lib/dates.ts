/**
 * Tarih yardımcıları. Uygulama KLİNİĞİN saat diliminde çalışır (varsayılan Europe/Istanbul);
 * cihazın saat dilimi farklı olsa bile randevu saatleri klinik saatine göre gösterilir.
 * - "Gün anahtarı": 'YYYY-AA-GG' (ör. 2026-11-09)
 * - "Klinik yerel tarih-saat": 'YYYY-AA-GGTSS:DD' (ör. 2026-11-09T09:30)
 * - Veritabanında zaman damgası (timestamptz, ISO) tutulur; dönüşüm aşağıdaki fonksiyonlarla.
 */

let clinicTimeZone = 'Europe/Istanbul';

/** Oturum açılınca kliniğin saat dilimi buradan ayarlanır. */
export function setClinicTimeZone(tz: string) {
  clinicTimeZone = tz;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/** ISO zaman damgası → klinik yerel tarih-saat ('YYYY-AA-GGTSS:DD'). */
export function toClinicLocal(iso: string | Date) {
  const p = zonedParts(typeof iso === 'string' ? new Date(iso) : iso, clinicTimeZone);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`;
}

/** Klinik yerel tarih-saat → ISO zaman damgası (veritabanına yazmak için). */
export function fromClinicLocal(local: string) {
  const [key, time = '00:00'] = local.split('T');
  const [y, mo, d] = key.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wanted = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wanted;
  // Saat dilimi farkını iki adımda bul (yaz saati geçişlerinde de doğru sonuç için).
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), clinicTimeZone);
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Klinik saatine göre bugün. */
export function todayKey() {
  return toClinicLocal(new Date()).slice(0, 10);
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

/** Şu an, klinik yerel tarih-saat olarak ('YYYY-AA-GGTSS:DD'). */
export function nowLocalDateTime(now = new Date()) {
  return toClinicLocal(now);
}

/** ISO gün numarası: 1 = Pazartesi … 7 = Pazar */
export function isoWeekday(key: string) {
  return ((fromDateKey(key).getDay() + 6) % 7) + 1;
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
