/** Hazır not şablonları. Seçilince metin kutusu dolar; hekim düzeltip kaydeder. */

import type { NoteKind } from './notes';

export type NoteTemplate = {
  key: string;
  label: string;
  kind: NoteKind;
  body: string;
  /** Metin yerine alanlarla doldurulan şablon */
  structured?: 'implant';
};

export const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    key: 'muayene',
    label: 'Genel Muayene',
    kind: 'klinik',
    body: 'Şikâyet: \nBulgu: \nDeğerlendirme: \nPlan/Yapılan: ',
  },
  {
    key: 'kanal',
    label: 'Kanal Tedavisi Seansı',
    kind: 'klinik',
    body: 'Seans: \nÇalışma boyu: \nYapılan: \nHassasiyet: \nSonraki seans: ',
  },
  {
    key: 'implant',
    label: 'İmplant Cerrahisi',
    kind: 'klinik',
    body: '',
    structured: 'implant',
  },
  {
    key: 'cekim',
    label: 'Diş Çekimi',
    kind: 'klinik',
    body: 'Anestezi: \nYapılan: \nKomplikasyon: Yok\nÖneriler sözlü ve yazılı verildi.',
  },
  {
    key: 'kontrol',
    label: 'Kontrol',
    kind: 'klinik',
    body: 'Kontrol: \nBulgu: \nÖneri: ',
  },
  {
    key: 'randevu_teyit',
    label: 'Randevu Teyidi',
    kind: 'randevu',
    body: 'Teyit için arandı. Durum: ',
  },
  {
    key: 'randevu_iptal',
    label: 'Gelemeyecek / Erteleme',
    kind: 'randevu',
    body: 'Randevuya gelemeyeceğini bildirdi. Sebep: \nYeni tarih tercihi: ',
  },
  {
    key: 'borc_bilgi',
    label: 'Borç Ödeme Bilgilendirme',
    kind: 'odeme',
    body: 'Kalan borç hakkında bilgi verildi.\nÖdeme planı: ',
  },
];

export function templateLabel(key?: string) {
  if (key === 'seans') return 'Seans kaydı';
  return NOTE_TEMPLATES.find((t) => t.key === key)?.label;
}

// --------------------------------------------------------------------------
// İmplant şablonu: her implant için yapılandırılmış satır
// --------------------------------------------------------------------------
export type ImplantRow = {
  tooth: string;
  brand: string;
  diameter: string;
  length: string;
  torque: string;
  lot: string;
};

export const emptyImplantRow = (): ImplantRow => ({
  tooth: '',
  brand: '',
  diameter: '',
  length: '',
  torque: '',
  lot: '',
});

export function implantRowText(r: ImplantRow) {
  const size = r.diameter || r.length ? ` ${r.diameter || '?'}×${r.length || '?'} mm` : '';
  const parts = [
    `${r.tooth || '?'}: ${r.brand || 'İmplant'}${size}`,
    r.torque ? `tork ${r.torque} N` : null,
    r.lot ? `parti ${r.lot}` : null,
  ].filter(Boolean);
  return parts.join(', ');
}

export function implantBody(rows: ImplantRow[], extra: string) {
  const lines = rows.filter((r) => r.tooth || r.brand || r.lot).map(implantRowText);
  return ['İmplant cerrahisi', ...lines, extra.trim()].filter(Boolean).join('\n');
}
