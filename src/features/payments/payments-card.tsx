import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, Divider, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { validateTeeth } from '@/features/patients/treatments-card';
import type { Patient } from '@/features/patients/types';
import { formatDate, formatDateTime, fullName } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';
import { formatTL, kurusToInput, parseTL } from '@/lib/money';

import { InstallmentsSection } from './installments';

import {
  methodLabels,
  paymentRepository,
  usePatientAccount,
  usePriceList,
  type AmountChange,
  type Cancellation,
  type Charge,
  type Payment,
  type PaymentMethod,
} from './payments';

// ----------------------------------------------------------------------------
// Ortak küçük parçalar
// ----------------------------------------------------------------------------
function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger' | 'success';
}) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          tone === 'danger' && { color: Colors.danger },
          tone === 'success' && { color: Colors.success },
        ]}>
        {formatTL(value)}
      </Text>
    </View>
  );
}

function CancelledNote({ c }: { c: Cancellation }) {
  return (
    <Text style={styles.cancelled}>
      İptal edildi: {c.reason} · {c.byName} · {formatDateTime(c.at)}
    </Text>
  );
}

function ChangeHistory({ changes }: { changes: AmountChange[] }) {
  if (changes.length === 0) return null;
  return (
    <View style={styles.history}>
      {changes.map((h, i) => (
        <Text key={i} style={styles.historyText}>
          {formatDateTime(h.changedAt)} · {h.changedByName}: {formatTL(h.oldAmount)} →{' '}
          {formatTL(h.newAmount)}
          {h.note ? ` (${h.note})` : ''}
        </Text>
      ))}
    </View>
  );
}

/** Satır altında açılan küçük form: tutar değiştir ya da iptal et (ikisi de sebep ister). */
function RowAction({
  mode,
  initialAmount,
  onSubmit,
  onCancel,
}: {
  mode: 'tutar' | 'iptal';
  initialAmount?: number;
  onSubmit: (amount: number | null, reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [amountText, setAmountText] = useState(
    initialAmount !== undefined ? kurusToInput(initialAmount) : '',
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const amount = mode === 'tutar' ? parseTL(amountText) : null;
    if (mode === 'tutar' && amount === null)
      return setError('Geçerli bir tutar girin (ör. 4.000 veya 4.000,50).');
    if (mode === 'tutar' && amount === initialAmount) return setError('Tutar aynı.');
    if (!reason.trim())
      return setError(mode === 'tutar' ? 'Değişiklik sebebini yazın.' : 'İptal sebebini yazın.');
    setBusy(true);
    setError(null);
    try {
      await onSubmit(amount, reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı.');
      setBusy(false);
    }
  };

  return (
    <View style={[styles.inlineForm, mode === 'iptal' && { backgroundColor: Colors.dangerSoft }]}>
      {mode === 'tutar' ? (
        <TextField
          label="Yeni tutar (TL)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
        />
      ) : (
        <Text style={styles.warn}>
          Kayıt silinmez; iptal edilir ve kimin, neden iptal ettiği görünür.
        </Text>
      )}
      <TextField
        label={mode === 'tutar' ? 'Değişiklik sebebi' : 'İptal sebebi'}
        value={reason}
        onChangeText={setReason}
        placeholder={
          mode === 'tutar' ? 'Ör. Hekimle görüşülen indirim' : 'Ör. Yanlış hastaya girilmiş'
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        <Button
          label={mode === 'tutar' ? 'Tutarı kaydet' : 'Evet, iptal et'}
          variant={mode === 'iptal' ? 'danger' : 'primary'}
          onPress={submit}
          disabled={busy}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Borç ekleme
// ----------------------------------------------------------------------------
function ChargeForm({
  patientId,
  onDone,
  onCancel,
}: {
  patientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic } = useClinicSession();
  const { data: items } = usePriceList();
  const active = items.filter((i) => i.active);
  const [itemId, setItemId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [tooth, setTooth] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const item = active.find((i) => i.id === itemId);
  const amount = parseTL(amountText);
  const differs = !!item && amount !== null && amount !== item.amount;

  const pick = (id: string) => {
    const it = active.find((i) => i.id === id)!;
    setItemId(id);
    setDescription(it.name);
    setAmountText(kurusToInput(it.amount));
    setError(null);
  };

  const save = async () => {
    if (!description.trim()) return setError('Kalem açıklamasını yazın ya da listeden seçin.');
    if (amount === null) return setError('Geçerli bir tutar girin (ör. 4.000 veya 4.000,50).');
    if (differs && !note.trim()) return setError('Liste fiyatından farklı tutar için sebep yazın.');
    const teeth = validateTeeth(tooth);
    if (teeth.error) return setError(teeth.error);
    setSaving(true);
    setError(null);
    try {
      await paymentRepository.addCharge(clinic.id, patientId, {
        priceItemId: item?.id,
        description: description.trim(),
        tooth: teeth.value,
        amount,
        adjustNote: differs ? note.trim() : undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Borç kalemi eklenemedi.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Borç ekle</Text>
      <Text style={styles.label}>Fiyat listesi</Text>
      <View style={styles.chips}>
        {active.map((i) => (
          <Chip
            key={i.id}
            label={`${i.name} · ${formatTL(i.amount)}`}
            selected={itemId === i.id}
            onPress={() => pick(i.id)}
          />
        ))}
        <Chip
          label="Listede yok"
          selected={itemId === null && description !== ''}
          onPress={() => {
            setItemId(null);
            setDescription('');
            setAmountText('');
          }}
        />
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Açıklama"
            required
            value={description}
            onChangeText={(t) => {
              setDescription(t);
              if (item && t !== item.name) setItemId(null);
            }}
            placeholder="Ör. Kanal tedavisi"
          />
        </View>
        <View style={styles.col}>
          <TextField
            label="Tutar (TL)"
            required
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="Ör. 4.000"
            hint={item ? `Liste fiyatı: ${formatTL(item.amount)}` : undefined}
          />
        </View>
        <View style={[styles.col, { flexBasis: 140 }]}>
          <TextField
            label="Diş"
            value={tooth}
            onChangeText={setTooth}
            placeholder="Ör. 36"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      {differs ? (
        <TextField
          label="Liste fiyatından farklı: sebep"
          required
          value={note}
          onChangeText={setNote}
          placeholder="Ör. Kanal tedavisiyle birlikte indirim"
          hint="Kim, ne kadar değiştirdi ve neden: kayıtta görünür."
        />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Borcu ekle'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Ödeme alma
// ----------------------------------------------------------------------------
function PaymentForm({
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
  const { clinic } = useClinicSession();
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('nakit');
  const [dateText, setDateText] = useState(formatDateInput(todayKey()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const amount = parseTL(amountText);
    const date = parseDateInput(dateText);
    if (!amount) return setError('Geçerli bir tutar girin (ör. 2.000 veya 2.000,50).');
    if (!date) return setError('GG.AA.YYYY biçiminde geçerli bir tarih girin.');
    if (date > todayKey()) return setError('Ödeme tarihi ileri bir tarih olamaz.');
    setSaving(true);
    setError(null);
    try {
      await paymentRepository.addPayment(clinic.id, patientId, {
        amount,
        method,
        paidOn: date,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tahsilat kaydedilemedi.');
      setSaving(false);
    }
  };

  const amount = parseTL(amountText);
  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Ödeme al</Text>
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Tutar (TL)"
            required
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="Ör. 2.000"
          />
          {remaining > 0 ? (
            <Pressable
              onPress={() => setAmountText(kurusToInput(remaining))}
              accessibilityRole="button">
              <Text style={styles.link}>Kalanın tamamı: {formatTL(remaining)}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.col}>
          <TextField
            label="Ödeme tarihi"
            value={dateText}
            onChangeText={setDateText}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
      </View>
      <Segmented
        label="Ödeme yöntemi"
        value={method}
        options={(Object.keys(methodLabels) as PaymentMethod[]).map((m) => ({
          value: m,
          label: methodLabels[m],
        }))}
        onChange={setMethod}
      />
      <TextField
        label="Not"
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı (ör. 2. taksit)"
      />
      {amount && remaining >= 0 && amount > remaining ? (
        <Text style={styles.warn}>
          Tutar kalan borçtan fazla; fark hastanın hesabında alacak olarak görünür.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Ödemeyi kaydet'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Kart
// ----------------------------------------------------------------------------
type Open = { id: string; mode: 'tutar' | 'iptal' } | null;

/** Ödemeler: sahip, yönetici, hekim ve resepsiyon görür. Asistan için hiç çizilmez. */
export function PaymentsCard({ patient }: { patient: Patient }) {
  const { can } = useClinicSession();
  const { data: account, loading, error, reload } = usePatientAccount(patient.id);
  const [form, setForm] = useState<'borc' | 'odeme' | null>(null);
  const [open, setOpen] = useState<Open>(null);
  if (!can('odeme.oku')) return null;

  const canWrite = can('odeme.yaz');
  const canCancel = can('odeme.iptal');
  const done = () => {
    setForm(null);
    setOpen(null);
    reload();
  };

  const rowActions = (id: string, cancelled: boolean, amount?: number) =>
    cancelled ? null : open?.id === id ? (
      <RowAction
        mode={open.mode}
        initialAmount={amount}
        onCancel={() => setOpen(null)}
        onSubmit={async (newAmount, reason) => {
          if (open.mode === 'tutar')
            await paymentRepository.changeChargeAmount(id, newAmount!, reason);
          else
            await paymentRepository.cancel(amount !== undefined ? 'charge' : 'payment', id, reason);
          done();
        }}
      />
    ) : (
      <View style={styles.rowLinks}>
        {amount !== undefined && canWrite ? (
          <Pressable onPress={() => setOpen({ id, mode: 'tutar' })} accessibilityRole="button">
            <Text style={styles.link}>Tutarı değiştir</Text>
          </Pressable>
        ) : null}
        {canCancel ? (
          <Pressable onPress={() => setOpen({ id, mode: 'iptal' })} accessibilityRole="button">
            <Text style={[styles.link, { color: Colors.danger }]}>İptal et</Text>
          </Pressable>
        ) : null}
      </View>
    );

  return (
    <Card
      title="Ödemeler"
      action={
        canWrite && !form ? (
          <View style={styles.headerActions}>
            <Button
              label="Borç ekle"
              icon="add"
              variant="secondary"
              onPress={() => setForm('borc')}
            />
            <Button label="Ödeme al" icon="cash-outline" onPress={() => setForm('odeme')} />
          </View>
        ) : null
      }>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !account && loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : account ? (
        <>
          <View style={styles.summary}>
            <Summary label="Toplam borç" value={account.totalCharged} />
            <Summary label="Ödenen" value={account.totalPaid} tone="success" />
            <Summary
              label={account.remaining < 0 ? 'Fazla ödeme (alacak)' : 'Kalan'}
              value={Math.abs(account.remaining)}
              tone={account.remaining > 0 ? 'danger' : 'success'}
            />
          </View>

          {form === 'borc' ? (
            <ChargeForm patientId={patient.id} onDone={done} onCancel={() => setForm(null)} />
          ) : null}
          {form === 'odeme' ? (
            <PaymentForm
              patientId={patient.id}
              remaining={account.remaining}
              onDone={done}
              onCancel={() => setForm(null)}
            />
          ) : null}

          <InstallmentsSection
            patientId={patient.id}
            patientName={fullName(patient)}
            plans={account.plans}
            remaining={account.remaining}
            onChanged={done}
          />

          <Text style={styles.section}>Borç kalemleri</Text>
          {account.charges.length === 0 ? (
            <Text style={styles.muted}>Borç kaydı yok.</Text>
          ) : (
            account.charges.map((c: Charge, i) => (
              <Fragment key={c.id}>
                {i > 0 && <Divider />}
                <View style={[styles.item, c.cancelled && styles.itemCancelled]}>
                  <View style={styles.itemRow}>
                    <Text style={[styles.itemTitle, c.cancelled && styles.strike]}>
                      {c.description}
                      {c.tooth ? ` · Diş ${c.tooth}` : ''}
                    </Text>
                    <Text style={[styles.itemAmount, c.cancelled && styles.strike]}>
                      {formatTL(c.amount)}
                    </Text>
                  </View>
                  <Text style={styles.muted}>
                    Ekleyen: {c.createdByName} · {formatDateTime(c.createdAt)}
                  </Text>
                  {c.listAmount !== undefined && c.listAmount !== c.amount ? (
                    <Text style={styles.adjust}>
                      Liste fiyatı {formatTL(c.listAmount)}
                      {c.adjustNote ? ` · Sebep: ${c.adjustNote}` : ''}
                    </Text>
                  ) : null}
                  <ChangeHistory changes={c.changes} />
                  {c.cancelled ? <CancelledNote c={c.cancelled} /> : null}
                  {rowActions(c.id, !!c.cancelled, c.amount)}
                </View>
              </Fragment>
            ))
          )}

          <Text style={styles.section}>Tahsilatlar</Text>
          {account.payments.length === 0 ? (
            <Text style={styles.muted}>Tahsilat yok.</Text>
          ) : (
            account.payments.map((p: Payment, i) => (
              <Fragment key={p.id}>
                {i > 0 && <Divider />}
                <View style={[styles.item, p.cancelled && styles.itemCancelled]}>
                  <View style={styles.itemRow}>
                    <Text style={[styles.itemTitle, p.cancelled && styles.strike]}>
                      <Ionicons name="cash-outline" size={14} color={Colors.success} />{' '}
                      {methodLabels[p.method]}
                      {p.note ? ` · ${p.note}` : ''}
                    </Text>
                    <Text
                      style={[
                        styles.itemAmount,
                        { color: Colors.success },
                        p.cancelled && styles.strike,
                      ]}>
                      {formatTL(p.amount)}
                    </Text>
                  </View>
                  <Text style={styles.muted}>
                    {formatDate(p.paidOn)} · Alan: {p.receivedByName}
                  </Text>
                  {p.cancelled ? <CancelledNote c={p.cancelled} /> : null}
                  {rowActions(p.id, !!p.cancelled)}
                </View>
              </Fragment>
            ))
          )}
          {!canCancel ? (
            <Text style={styles.hint}>Hatalı kayıtları yalnızca klinik sahibi iptal edebilir.</Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  summaryBox: {
    flexGrow: 1,
    flexBasis: 140,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    gap: 2,
  },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary },
  summaryValue: { fontSize: 20, fontWeight: '700', color: Colors.text },
  section: { fontSize: 15, fontWeight: '700', color: Colors.text, marginTop: Spacing.sm },
  item: { gap: 3 },
  itemCancelled: { opacity: 0.6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  itemTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, flexShrink: 1 },
  itemAmount: { fontSize: 15, fontWeight: '700', color: Colors.text },
  strike: { textDecorationLine: 'line-through' },
  muted: { fontSize: 12, color: Colors.textSecondary },
  adjust: { fontSize: 12, color: Colors.warning },
  history: { gap: 2, paddingLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: Colors.border },
  historyText: { fontSize: 12, color: Colors.textSecondary },
  cancelled: { fontSize: 12, color: Colors.danger },
  rowLinks: { flexDirection: 'row', gap: Spacing.lg },
  link: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  inlineForm: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    marginTop: Spacing.xs,
  },
  form: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 220, gap: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  error: { fontSize: 13, color: Colors.danger },
  warn: { fontSize: 13, color: Colors.warning },
  hint: { fontSize: 12, color: Colors.textMuted },
});
