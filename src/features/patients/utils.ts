import type { Gender, TreatmentKind, TreatmentStatus } from './types';

export function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`.trim();
}

export function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toLocaleUpperCase('tr-TR');
}

/** Türkçe karakterlere duyarlı, büyük/küçük harf farkını yok sayan arama metni. */
export function normalizeForSearch(text: string) {
  return text.trim().toLocaleLowerCase('tr-TR');
}

export function ageFrom(birthDate?: string, now = new Date()) {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return undefined;
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const genderLabels: Record<Gender, string> = {
  kadin: 'Kadın',
  erkek: 'Erkek',
  belirtilmedi: 'Belirtilmedi',
};

export const treatmentKindLabels: Record<TreatmentKind, string> = {
  muayene: 'Muayene / kontrol',
  rontgen: 'Röntgen',
  temizlik: 'Diş taşı temizliği',
  dolgu: 'Dolgu',
  kanal: 'Kanal tedavisi',
  cekim: 'Diş çekimi',
  implant: 'İmplant',
  kron_kopru: 'Kron / köprü',
  protez: 'Protez',
  dis_eti: 'Diş eti tedavisi',
  ortodonti: 'Ortodonti',
  beyazlatma: 'Beyazlatma',
  cerrahi: 'Cerrahi',
  diger: 'Diğer',
};

/** Diş şemasında dişi işaretlemeyen (teşhis amaçlı) türler */
export const DIAGNOSTIC_KINDS: TreatmentKind[] = ['muayene', 'rontgen'];

/**
 * İşlem adından tür tahmini (formda öneri olarak; veritabanındaki
 * private.guess_treatment_kind ile aynı kurallar). Sıra önemli:
 * "İmplant kontrolü" muayenedir.
 */
export function guessTreatmentKind(procedure: string): TreatmentKind | undefined {
  const p = procedure.toLocaleLowerCase('tr');
  if (!p.trim()) return undefined;
  if (/(röntgen|rontgen|panoramik|periapikal|tomografi|bitewing)/.test(p)) return 'rontgen';
  if (/(kontrol|muayene|değerlendirme|degerlendirme)/.test(p)) return 'muayene';
  if (/mplant/.test(p)) return 'implant';
  if (/(kanal|endodont)/.test(p)) return 'kanal';
  if (/(dolgu|fissür|fissur|kompozit|amalgam)/.test(p)) return 'dolgu';
  if (/(çekim|cekim|ekstraksiyon)/.test(p)) return 'cekim';
  if (/(kron|köprü|kopru|zirkon|lamina|veneer)/.test(p)) return 'kron_kopru';
  if (/protez/.test(p)) return 'protez';
  if (/(diş eti|dis eti|periodont|küretaj|kuretaj|gingiv)/.test(p)) return 'dis_eti';
  if (/(ortodont|braket|şeffaf plak|seffaf plak)/.test(p)) return 'ortodonti';
  if (/beyazlat/.test(p)) return 'beyazlatma';
  if (/(temizli|detertraj|polisaj)/.test(p)) return 'temizlik';
  if (/(cerrah|apse|kist|rezeksiyon|sinüs|sinus|greft)/.test(p)) return 'cerrahi';
  return undefined;
}

export const treatmentStatusLabels: Record<TreatmentStatus, string> = {
  planlandi: 'Planlandı',
  devam: 'Devam ediyor',
  tamamlandi: 'Tamamlandı',
};

/** "Penisilin, Lateks" → ["Penisilin", "Lateks"] */
export function splitList(text: string) {
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** GG.AA.YYYY → YYYY-AA-GG. Geçersizse `null`. */
export function parseTurkishDate(text: string) {
  const m = text.trim().match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  if (date > new Date()) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
