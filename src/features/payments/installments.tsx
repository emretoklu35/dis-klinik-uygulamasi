/**
 * Ödeme planı (taksit) bölümü: Hasta Kartı → Ödemeler.
 * Taksitin "ödendi" durumu elle işaretlenmez; hastadan alınan tahsilatlar taksitlere sırayla
 * dağıtılır (veritabanı hesaplar). Resepsiyon her zamanki gibi "Ödeme al" ile tahsilat girer.
 */

import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Divider, TextField, type BadgeTone } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { printProforma } from '@/features/patients/proforma';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';
import { formatTL, kurusToInput, parseTL } from '@/lib/money';

import {
  installmentStatusLabels,
  paymentRepository,
  type Installment,
  type InstallmentStatus,
  type PaymentPlan,
} from './payments';

const MONTHS = ['OCA', 'ŞUB', 'MAR', 'NİS', 'MAY', 'HAZ', 'TEM', 'AĞU', 'EYL', 'EKİ', 'KAS', 'ARA'];
const tone: Record<InstallmentStatus, BadgeTone> = {
  odendi: 'success',
  kismi: 'warning',
  gecikti: 'danger',
  bekliyor: 'primary',
};

/** "2026-11-30" + 1 ay → "2026-12-30" (ay sonu taşarsa ayın son günü) */
function addMonths(key: string, months: number) {
  const [y, m, d] = key.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** Taksitin yanında gösterilen kısa durum metni */
export function dueText(i: Installment, today = todayKey()) {
  if (i.status === 'odendi') return 'Ödendi';
  const diff = daysBetween(today, i.dueDate);
  const when = diff === 0 ? 'Bugün' : diff > 0 ? `${diff} gün kaldı` : `${-diff} gün gecikti`;
  return i.status === 'kismi' ? `${when} · ${formatTL(i.paid)} ödendi` : when;
}

export function DateTile({ dayKey }: { dayKey: string }) {
  const [y, m, d] = dayKey.split('-');
  return (
    <View style={styles.tile}>
      <Text style={styles.tileDay}>{d}</Text>
      <Text style={styles.tileMonth}>{MONTHS[Number(m) - 1]}</Text>
      <Text style={styles.tileYear}>{y}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Plan oluşturma
// ----------------------------------------------------------------------------
type Row = { date: string; amount: string };

function split(total: number, count: number, first: string): Row[] {
  const base = Math.floor(total / count / 100) * 100; // tam lira
  return Array.from({ length: count }, (_, i) => ({
    date: formatDateInput(addMonths(first, i)),
    amount: kurusToInput(i === count - 1 ? total - base * (count - 1) : base),
  }));
}

function PlanForm({
  patientId,
  remaining,
  onDone,
  onCancel,
}: {
  patientId: string;
  remaining: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('Ödeme planı');
  const [totalText, setTotalText] = useState(remaining > 0 ? kurusToInput(remaining) : '');
  const [countText, setCountText] = useState('3');
  const [firstText, setFirstText] = useState(formatDateInput(todayKey()));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const generate = () => {
    const total = parseTL(totalText);
    const count = Number(countText);
    const first = parseDateInput(firstText);
    if (!total || total <= 0) return setError('Geçerli bir toplam tutar girin.');
    if (!Number.isInteger(count) || count < 1 || count > 60)
      return setError('Taksit sayısı 1 ile 60 arasında olmalı.');
    if (!first) return setError('İlk ödeme tarihini GG.AA.YYYY biçiminde girin.');
    setError(null);
    setRows(split(total, count, first));
  };

  const parsed = (rows ?? []).map((r) => ({
    dueDate: parseDateInput(r.date),
    amount: parseTL(r.amount),
  }));
  const sum = parsed.reduce((s, r) => s + (r.amount ?? 0), 0);
  const invalid = parsed.some((r) => !r.dueDate || !r.amount || r.amount <= 0);

  const save = async () => {
    if (!rows || invalid) return setError('Her taksitin tarihi ve tutarı geçerli olmalı.');
    setBusy(true);
    setError(null);
    try {
      await paymentRepository.createPaymentPlan(
        patientId,
        title,
        note.trim() || undefined,
        parsed.map((r) => ({ dueDate: r.dueDate!, amount: r.amount! })),
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ödeme planı oluşturulamadı.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Ödeme planı oluştur</Text>
      <TextField label="Plan adı" value={title} onChangeText={setTitle} />
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Toplam (₺)"
            value={totalText}
            onChangeText={setTotalText}
            keyboardType="decimal-pad"
            hint={remaining > 0 ? `Kalan borç: ${formatTL(remaining)}` : undefined}
          />
        </View>
        <View style={styles.col}>
          <TextField
            label="Taksit sayısı"
            value={countText}
            onChangeText={(t) => setCountText(t.replace(/[^0-9]/g, '').slice(0, 2))}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.col}>
          <TextField
            label="İlk ödeme"
            value={firstText}
            onChangeText={setFirstText}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            hint="Sonrakiler her ay aynı gün."
          />
        </View>
      </View>
      <View style={styles.actionsLeft}>
        <Button
          label={rows ? 'Taksitleri yeniden oluştur' : 'Taksitleri oluştur'}
          icon="calendar-outline"
          variant="secondary"
          onPress={generate}
        />
      </View>

      {rows ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.hint}>Tarih ve tutarları tek tek değiştirebilirsiniz.</Text>
          {rows.map((r, i) => (
            <View key={i} style={styles.editRow}>
              <Text style={styles.editNo}>
                {i + 1}/{rows.length}
              </Text>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Vade"
                  value={r.date}
                  onChangeText={(v) =>
                    setRows((all) => all!.map((x, j) => (j === i ? { ...x, date: v } : x)))
                  }
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Tutar (₺)"
                  value={r.amount}
                  onChangeText={(v) =>
                    setRows((all) => all!.map((x, j) => (j === i ? { ...x, amount: v } : x)))
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          ))}
          <Text style={styles.sum}>Plan toplamı: {formatTL(sum)}</Text>
          <TextField
            label="Not"
            value={note}
            onChangeText={setNote}
            placeholder="İsteğe bağlı (ör. kredi kartına 3 taksit)"
          />
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        <Button
          label={busy ? 'Kaydediliyor…' : 'Planı kaydet'}
          icon="checkmark"
          onPress={save}
          disabled={busy || !rows || invalid}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Plan görünümü
// ----------------------------------------------------------------------------
function planHtml(clinicName: string, patientName: string, plan: PaymentPlan) {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const paid = plan.installments.reduce((s, i) => s + i.paid, 0);
  const rows = plan.installments
    .map(
      (i) =>
        `<tr><td>${i.seq}/${i.count}</td><td>${esc(formatDateInput(i.dueDate))}</td><td class="num">${formatTL(i.amount)}</td><td>${installmentStatusLabels[i.status]}</td><td class="num">${formatTL(i.paid)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${esc(plan.title)} · ${esc(patientName)}</title>
<style>@page{size:A4;margin:16mm}body{font-family:Helvetica,Arial,sans-serif;color:#0F1E2C;font-size:12px;margin:0}
.head{display:flex;justify-content:space-between;border-bottom:2px solid #0F1E2C;padding-bottom:10px}
h1{margin:0;font-size:18px;letter-spacing:1px}.muted{color:#56636F}table{width:100%;border-collapse:collapse;margin-top:14px}
th{text-align:left;font-size:10px;color:#6B7781;text-transform:uppercase;border-bottom:1px solid #C9D2D8;padding:6px 4px}
td{padding:7px 4px;border-bottom:1px solid #EEF1F0}.num{text-align:right}.tot{display:flex;justify-content:flex-end;gap:32px;margin-top:10px;font-weight:700}
.sign{display:flex;justify-content:space-between;margin-top:48px}.sign div{width:42%;border-top:1px solid #0F1E2C;padding-top:4px;font-size:10px;color:#56636F;text-align:center}
.foot{margin-top:24px;text-align:center;font-size:9px;color:#9AA8B2}</style></head><body>
<div class="head"><div><b style="font-size:16px">${esc(clinicName)}</b><div class="muted">Hasta: ${esc(patientName)}</div></div>
<div style="text-align:right"><h1>ÖDEME PLANI</h1><div class="muted">${esc(plan.title)} · ${new Date(plan.createdAt).toLocaleDateString('tr-TR')}</div></div></div>
<table><thead><tr><th>Taksit</th><th>Vade</th><th class="num">Tutar</th><th>Durum</th><th class="num">Ödenen</th></tr></thead><tbody>${rows}</tbody></table>
<div class="tot"><span>Toplam ${formatTL(plan.total)}</span><span>Ödenen ${formatTL(paid)}</span><span>Kalan ${formatTL(plan.total - paid)}</span></div>
${plan.note ? `<p class="muted">Not: ${esc(plan.note)}</p>` : ''}
<div class="sign"><div>Hasta imzası</div><div>Klinik</div></div>
<div class="foot">Dentumi ile hazırlanmıştır.</div></body></html>`;
}

function PlanView({
  plan,
  patientName,
  canWrite,
  onChanged,
}: {
  plan: PaymentPlan;
  patientName: string;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const { clinic } = useClinicSession();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paid = plan.installments.reduce((s, i) => s + i.paid, 0);
  const done = plan.installments.filter((i) => i.status === 'odendi').length;
  const pct = plan.total ? Math.round((paid / plan.total) * 100) : 0;

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await paymentRepository.cancelPaymentPlan(plan.id, reason);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Plan iptal edilemedi.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.plan}>
      <View style={styles.planHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.planTitle}>{plan.title}</Text>
          <Text style={styles.muted}>
            {new Date(plan.createdAt).toLocaleDateString('tr-TR')}
            {plan.createdByName ? ` · ${plan.createdByName}` : ''}
            {plan.note ? ` · ${plan.note}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => printProforma(planHtml(clinic.name, patientName, plan)).catch(() => {})}
          accessibilityRole="button"
          hitSlop={6}>
          <Text style={styles.link}>Yazdır</Text>
        </Pressable>
        {canWrite && !cancelling ? (
          <Pressable onPress={() => setCancelling(true)} accessibilityRole="button" hitSlop={6}>
            <Text style={[styles.link, { color: Colors.danger }]}>İptal et</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat
          label="Taksit"
          value={`${done} / ${plan.installments.length}`}
          sub="ödendi"
          pct={plan.installments.length ? done / plan.installments.length : 0}
        />
        <Stat
          label="Toplam"
          value={formatTL(plan.total)}
          sub={`Ödenen ${formatTL(paid)} · Kalan ${formatTL(plan.total - paid)}`}
          pct={pct / 100}
        />
      </View>

      {plan.installments.map((i, k) => (
        <Fragment key={i.id}>
          {k > 0 ? <Divider /> : null}
          <View style={styles.inst}>
            <DateTile dayKey={i.dueDate} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.instTitle}>
                Taksit {i.seq}/{i.count}
              </Text>
              <Text
                style={[
                  styles.muted,
                  i.status === 'gecikti' && { color: Colors.danger },
                  i.status === 'odendi' && { color: Colors.success },
                ]}>
                {dueText(i)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.instAmount}>{formatTL(i.amount)}</Text>
              <Badge label={installmentStatusLabels[i.status]} tone={tone[i.status]} />
            </View>
          </View>
        </Fragment>
      ))}

      {cancelling ? (
        <View style={styles.cancelBox}>
          <TextField
            label="İptal sebebi"
            value={reason}
            onChangeText={setReason}
            placeholder="Ör. Hasta kalan borcu peşin ödeyecek"
            hint="Plan silinmez; iptal edilen plan geçmişte kayıtlı kalır, tahsilatlar etkilenmez."
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              label="Vazgeç"
              variant="secondary"
              onPress={() => setCancelling(false)}
              disabled={busy}
            />
            <Button label="Planı iptal et" onPress={cancel} disabled={busy || !reason.trim()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  sub,
  pct,
}: {
  label: string;
  value: string;
  sub: string;
  pct: number;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{sub}</Text>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${Math.min(100, Math.round(pct * 100))}%` }]} />
      </View>
    </View>
  );
}

export function InstallmentsSection({
  patientId,
  patientName,
  plans,
  remaining,
  onChanged,
}: {
  patientId: string;
  patientName: string;
  plans: PaymentPlan[];
  remaining: number;
  onChanged: () => void;
}) {
  const { can } = useClinicSession();
  const canWrite = can('odeme.yaz');
  const [creating, setCreating] = useState(false);

  return (
    <View style={{ gap: Spacing.md }}>
      <View style={styles.sectionHead}>
        <Text style={styles.section}>Ödeme planı (taksit)</Text>
        {canWrite && !creating ? (
          <Pressable onPress={() => setCreating(true)} accessibilityRole="button" hitSlop={6}>
            <Text style={styles.link}>+ Ödeme planı oluştur</Text>
          </Pressable>
        ) : null}
      </View>
      {creating ? (
        <PlanForm
          patientId={patientId}
          remaining={remaining}
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            onChanged();
          }}
        />
      ) : null}
      {plans.length === 0 && !creating ? (
        <Text style={styles.muted}>
          Taksitli ödeme yok. Hasta taksitle ödeyecekse ödeme planı oluşturun; aldığınız tahsilatlar
          taksitlere kendiliğinden dağıtılır.
        </Text>
      ) : null}
      {plans.map((p) => (
        <PlanView
          key={p.id}
          plan={p}
          patientName={patientName}
          canWrite={canWrite}
          onChanged={onChanged}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  link: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.primary },
  muted: { fontSize: 12, color: Colors.textSecondary },
  hint: { fontSize: 12, color: Colors.textMuted },
  error: { fontSize: 13, color: Colors.danger },
  form: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  col: { flexGrow: 1, flexBasis: 160 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  actionsLeft: { flexDirection: 'row', gap: Spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  editNo: { width: 40, paddingBottom: 14, fontSize: 13, color: Colors.textSecondary },
  sum: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.text, textAlign: 'right' },
  plan: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  planHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  planTitle: { fontSize: 15, fontFamily: Fonts.bodySemi, color: Colors.text },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  stat: {
    flexGrow: 1,
    flexBasis: 200,
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  statLabel: { fontSize: 11, fontFamily: Fonts.bodySemi, color: Colors.textMuted },
  statValue: { fontSize: 20, fontFamily: Fonts.heading, color: Colors.text },
  bar: { height: 6, borderRadius: 3, backgroundColor: '#E2E7E5', overflow: 'hidden', marginTop: 4 },
  barFill: { height: 6, backgroundColor: Colors.primary },
  inst: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  instTitle: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.text },
  instAmount: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  tile: {
    width: 56,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
  },
  tileDay: { fontSize: 18, fontFamily: Fonts.heading, color: Colors.primaryDeep },
  tileMonth: { fontSize: 10, fontFamily: Fonts.bodySemi, color: Colors.primaryDeep },
  tileYear: { fontSize: 10, color: Colors.primaryDeep },
  cancelBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
});
