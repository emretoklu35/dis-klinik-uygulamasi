/**
 * Proforma: tedavi planından hazırlanan, hastanın imzaladığı fiyat teklifi belgesi.
 *  - buildProformaHtml: yazdırma / PDF için bağımsız HTML sayfası
 *  - printProforma: telefonda yazdırma penceresi; web'de ayrı pencerede yazdırır
 *    (web'de expo-print yalnızca açık sayfayı yazdırabildiği için)
 *  - shareProforma: telefonda PDF oluşturup paylaşma menüsünü açar
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { odontogramSvg } from '@/features/notes/odontogram';
import type { ToothState } from '@/features/notes/teeth';
import { formatTL } from '@/lib/money';

import type { PlanApproval, Treatment } from './types';
import { formatDate, treatmentStatusLabels } from './utils';

export type ProformaData = {
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  patientName: string;
  patientBirthDate?: string;
  planTitle: string;
  doctorName: string;
  date: string;
  items: Treatment[];
  states: Map<number, ToothState>;
  approval?: PlanApproval;
};

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

export function proformaTotal(items: Treatment[]) {
  return items.reduce((s, t) => s + (t.amount ?? 0), 0);
}

export function proformaListTotal(items: Treatment[]) {
  return items.reduce((s, t) => s + (t.listAmount ?? t.amount ?? 0), 0);
}

/** Proformadaki satır: aynı işlem, aynı durum ve aynı fiyattaki işlemler tek satırda (ör. "×9") */
export type ProformaRow = {
  key: string;
  ids: string[];
  procedure: string;
  count: number;
  teeth: string;
  status: Treatment['status'];
  completedOn?: string;
  unit?: number;
  unitList?: number;
  total?: number;
  totalList?: number;
};

export function groupProformaRows(items: Treatment[]): ProformaRow[] {
  const rows = new Map<string, ProformaRow>();
  for (const t of items) {
    const key = [t.procedure, t.status, t.amount ?? '', t.listAmount ?? ''].join('|');
    const r = rows.get(key);
    if (r) {
      r.ids.push(t.id);
      r.count += 1;
      if (t.tooth) r.teeth = r.teeth ? `${r.teeth}, ${t.tooth}` : t.tooth;
      if (t.status === 'tamamlandi' && (!r.completedOn || t.date > r.completedOn))
        r.completedOn = t.date;
    } else {
      rows.set(key, {
        key,
        ids: [t.id],
        procedure: t.procedure,
        count: 1,
        teeth: t.tooth ?? '',
        status: t.status,
        completedOn: t.status === 'tamamlandi' ? t.date : undefined,
        unit: t.amount,
        unitList: t.listAmount ?? t.amount,
      });
    }
  }
  return [...rows.values()].map((r) => ({
    ...r,
    teeth: r.teeth || 'Tüm ağız',
    total: r.unit != null ? r.unit * r.count : undefined,
    totalList: r.unitList != null ? r.unitList * r.count : undefined,
  }));
}

const money = (now?: number, list?: number) =>
  now == null
    ? '—'
    : list != null && list > now
      ? `<s>${formatTL(list)}</s><br>${formatTL(now)}`
      : formatTL(now);

export function buildProformaHtml(d: ProformaData) {
  const rows = groupProformaRows(d.items)
    .map(
      (r) => `<tr>
  <td>${esc(r.procedure)}${r.count > 1 ? ` ×${r.count}` : ''}</td>
  <td>${esc(r.teeth)}</td>
  <td><span class="st st-${r.status}">${treatmentStatusLabels[r.status]}</span></td>
  <td>${r.completedOn ? esc(formatDate(r.completedOn)) : ''}</td>
  <td class="num">${money(r.unit, r.unitList)}</td>
  <td class="num">${money(r.total, r.totalList)}</td>
</tr>`,
    )
    .join('');
  const total = proformaTotal(d.items);
  const listTotal = proformaListTotal(d.items);
  const contact = [d.clinicAddress, d.clinicPhone, d.clinicEmail]
    .filter(Boolean)
    .map((x) => esc(x!));
  const sig = d.approval
    ? `<div class="sign">
  <svg viewBox="0 0 ${d.approval.signature.w} ${d.approval.signature.h}" preserveAspectRatio="xMidYMid meet">
    <path d="${esc(d.approval.signature.d)}" fill="none" stroke="#0F1E2C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <div class="signmeta">Hasta onayı · ${esc(new Date(d.approval.signedAt).toLocaleString('tr-TR'))}
  · Toplam ${formatTL(d.approval.total)}${d.approval.recordedByName ? ` · Kaydeden: ${esc(d.approval.recordedByName)}` : ''}</div>
</div>`
    : `<div class="sign empty"><div class="signline"></div><div class="signmeta">Hasta imzası</div></div>`;

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proforma · ${esc(d.patientName)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #0F1E2C; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F1E2C; padding-bottom: 10px; }
  .clinic { font-size: 18px; font-weight: 700; }
  .muted { color: #56636F; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 20px; letter-spacing: 2px; }
  .info { display: flex; gap: 32px; margin: 14px 0; }
  .info b { display: block; font-size: 10px; color: #6B7781; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 2px; }
  .chart { margin: 8px 0 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; color: #6B7781; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #C9D2D8; padding: 6px 4px; }
  td { padding: 7px 4px; border-bottom: 1px solid #EEF1F0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .st { font-size: 10px; padding: 2px 6px; border-radius: 6px; background: #EEF1F0; }
  .st-tamamlandi { background: #E3F4EA; color: #15803D; }
  .st-devam { background: #FDF0E1; color: #B45309; }
  s { color: #9AA8B2; }
  .sub { display: flex; justify-content: flex-end; gap: 40px; margin-top: 6px; color: #56636F; }
  .disc { color: #15803D; }
  .total { display: flex; justify-content: flex-end; gap: 40px; margin-top: 10px; font-size: 15px; font-weight: 700; }
  .sign { margin: 28px auto 0; width: 280px; text-align: center; }
  .sign svg { width: 280px; height: 110px; background: #F6F8F7; border-radius: 8px; }
  .signline { height: 90px; border-bottom: 1px solid #0F1E2C; }
  .signmeta { font-size: 10px; color: #56636F; margin-top: 6px; }
  .note { font-size: 10px; color: #6B7781; margin-top: 18px; }
  .foot { margin-top: 24px; text-align: center; font-size: 9px; color: #9AA8B2; }
</style></head>
<body>
  <div class="head">
    <div><div class="clinic">${esc(d.clinicName)}</div>${contact.length ? `<div class="muted">${contact.join(' · ')}</div>` : ''}<div class="muted">${esc(d.doctorName)}</div></div>
    <div class="title"><h1>PROFORMA</h1><div class="muted">Tarih: ${esc(d.date)}</div></div>
  </div>
  <div class="info">
    <div><b>Hasta</b>${esc(d.patientName)}</div>
    ${d.patientBirthDate ? `<div><b>Doğum tarihi</b>${esc(formatDate(d.patientBirthDate))}</div>` : ''}
    <div><b>Tedavi planı</b>${esc(d.planTitle)}</div>
  </div>
  <div class="chart">${odontogramSvg(d.states)}</div>
  <table>
    <thead><tr><th>Tedavi</th><th>Diş</th><th>Durum</th><th>Tamamlanma</th><th class="num">Birim</th><th class="num">Toplam</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${listTotal > total ? `<div class="sub"><span>Liste fiyatı</span><span>${formatTL(listTotal)}</span></div><div class="sub disc"><span>İndirim</span><span>−${formatTL(listTotal - total)}</span></div>` : ''}
  <div class="total"><span>Toplam</span><span>${formatTL(total)}</span></div>
  ${sig}
  <div class="note">Bu belge bir fiyat teklifidir, fatura yerine geçmez. Hasta imzasıyla onaylanan fiyatlar tedavi bitene kadar değişmez.</div>
  <div class="foot">Dentumi ile hazırlanmıştır.</div>
</body></html>`;
}

/** Yazdır / PDF olarak kaydet (yazdırma penceresinden). */
export async function printProforma(html: string) {
  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win)
      throw new Error(
        'Yazdırma penceresi açılamadı; tarayıcının açılır pencere iznini kontrol edin.',
      );
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Yazı tipleri ve SVG yerleşsin diye kısa bekleme
    setTimeout(() => win.print(), 300);
    return;
  }
  await Print.printAsync({ html });
}

/** Telefonda PDF oluşturup paylaş (WhatsApp, e-posta…). Web'de yazdırma penceresine düşer. */
export async function shareProforma(html: string, fileTitle: string) {
  if (Platform.OS === 'web') return printProforma(html);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Bu cihazda paylaşma kullanılamıyor.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: fileTitle,
  });
}
