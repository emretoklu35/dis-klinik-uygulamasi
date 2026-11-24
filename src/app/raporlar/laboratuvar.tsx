/**
 * Laboratuvar Faturaları (muhasebe, yönetici, klinik sahibi).
 * Laboratuvar ay sonunda faturasını gönderir: hangi hekimin hangi işi, ne tutar. Fatura bir kez
 * girilir; kalemleri dönemdeki işlere dağıtılır ve her tedavinin kârlılığına laboratuvar gideri
 * olarak yansır. Hekimler gider girmez.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  Button,
  Card,
  CenteredMessage,
  Chip,
  Divider,
  Screen,
  Segmented,
  TextField,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  costRepository,
  currencyLabels,
  formatMoney,
  labRepository,
  type Currency,
  type Lab,
  type LabCandidate,
  type LabStatement,
} from '@/features/costs/costs';
import { treatmentKindLabels } from '@/features/patients/utils';
import type { TreatmentKind } from '@/features/patients/types';
import { RangeButton } from '@/features/reports/components';
import type { DateRange } from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';
import { formatTL, parseTL } from '@/lib/money';
import { useFocusLoad } from '@/lib/use-focus-load';

/** Laboratuvar işi gerektiren türler (varsayılan filtre) */
const LAB_KINDS = ['kron_kopru', 'protez', 'implant', 'ortodonti', 'beyazlatma', 'diger'];

function lastMonth(today = todayKey()): DateRange {
  const [y, m] = today.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function StatementForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { clinic } = useClinicSession();
  const [range, setRange] = useState<DateRange>(() => lastMonth());
  const [labs, setLabs] = useState<Lab[] | null>(null);
  const [labId, setLabId] = useState<string | undefined>();
  const [labName, setLabName] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(formatDateInput(todayKey()));
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [rateText, setRateText] = useState('');
  const [totalText, setTotalText] = useState('');
  const [note, setNote] = useState('');
  const [doctor, setDoctor] = useState<string | null>(null);
  const [labOnly, setLabOnly] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cands, labList] = await Promise.all([
      labRepository.candidates(clinic.id, range.from, range.to),
      costRepository.listLabs(clinic.id),
    ]);
    setLabs(labList);
    return cands;
  }, [clinic.id, range.from, range.to]);
  const { data: candidates, loading } = useFocusLoad<LabCandidate[]>(
    load,
    [],
    'İşler yüklenemedi.',
  );

  const doctors = [...new Map(candidates.map((c) => [c.doctorId, c.doctorName])).entries()];
  const visible = candidates
    .filter((c) => !doctor || c.doctorId === doctor)
    .filter((c) => !labOnly || LAB_KINDS.includes(c.kind) || amounts[c.treatmentId] !== undefined);
  const selected = Object.entries(amounts).map(([id, text]) => ({ id, value: parseTL(text) }));
  const itemsTotal = selected.reduce((s, x) => s + (x.value ?? 0), 0);
  const total = parseTL(totalText);
  const rate = currency === 'TRY' ? 1 : Number(rateText.replace(',', '.'));
  const diff = total != null ? total - itemsTotal : null;
  const sym = currency === 'TRY' ? '₺' : currency;

  const toggle = (id: string) =>
    setAmounts((a) => {
      const n = { ...a };
      if (id in n) delete n[id];
      else n[id] = '';
      return n;
    });

  const save = async () => {
    const date = parseDateInput(invoiceDate);
    if (!labId && !labName.trim()) return setError('Laboratuvarı seçin ya da adını yazın.');
    if (!date) return setError('Fatura tarihini GG.AA.YYYY biçiminde girin.');
    if (!total || total <= 0) return setError('Fatura toplamını girin.');
    if (currency !== 'TRY' && !(rate > 0)) return setError('Fatura tarihindeki kuru yazın.');
    if (selected.length === 0) return setError('Faturadaki en az bir işi seçin.');
    if (selected.some((x) => !x.value || x.value <= 0))
      return setError('Seçilen her iş için faturadaki tutarı yazın.');
    setBusy(true);
    setError(null);
    try {
      await labRepository.create({
        clinicId: clinic.id,
        labId,
        labName: labId ? undefined : labName.trim(),
        from: range.from,
        to: range.to,
        invoiceNo: invoiceNo.trim() || undefined,
        invoiceDate: date,
        currency,
        rate,
        total,
        note: note.trim() || undefined,
        items: selected.map((x) => ({
          treatmentId: x.id,
          amount: x.value!,
          description: candidates.find((c) => c.treatmentId === x.id)?.procedure,
        })),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fatura kaydedilemedi.');
      setBusy(false);
    }
  };

  return (
    <Card title="Yeni laboratuvar faturası">
      <Text style={styles.step}>1. Fatura bilgileri</Text>
      {labs && labs.length ? (
        <View style={styles.chips}>
          {labs.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              selected={labId === l.id}
              onPress={() => {
                setLabId(labId === l.id ? undefined : l.id);
                setLabName('');
              }}
            />
          ))}
        </View>
      ) : null}
      {!labId ? (
        <TextField
          label={labs && labs.length ? 'Ya da yeni laboratuvar' : 'Laboratuvar'}
          value={labName}
          onChangeText={setLabName}
          placeholder="Ör. Örnek Dental Lab"
        />
      ) : null}
      <View style={{ gap: 4 }}>
        <Text style={styles.label}>Faturanın kapsadığı dönem</Text>
        <RangeButton range={range} onChange={setRange} />
      </View>
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Fatura no"
            value={invoiceNo}
            onChangeText={setInvoiceNo}
            placeholder="İsteğe bağlı"
          />
        </View>
        <View style={styles.col}>
          <TextField
            label="Fatura tarihi"
            value={invoiceDate}
            onChangeText={setInvoiceDate}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
      </View>
      <Segmented
        label="Para birimi"
        value={currency}
        options={(Object.keys(currencyLabels) as Currency[]).map((c) => ({
          value: c,
          label: currencyLabels[c],
        }))}
        onChange={setCurrency}
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label={`Fatura toplamı (${sym})`}
            value={totalText}
            onChangeText={setTotalText}
            keyboardType="decimal-pad"
            placeholder="Ör. 18.000"
          />
        </View>
        {currency !== 'TRY' ? (
          <View style={styles.col}>
            <TextField
              label={`Kur (1 ${currency} = ? ₺)`}
              value={rateText}
              onChangeText={setRateText}
              keyboardType="decimal-pad"
              placeholder="Ör. 34,50"
              hint="Fatura tarihindeki kur; TL karşılıkları bununla sabitlenir."
            />
          </View>
        ) : null}
      </View>

      <Text style={styles.step}>2. Faturadaki işler</Text>
      <Text style={styles.muted}>
        Dönemde yapılmış ya da devam eden işler. Faturadaki her iş için kutuyu işaretleyip tutarını
        yazın.
      </Text>
      <View style={styles.chips}>
        <Chip label="Tüm hekimler" selected={!doctor} onPress={() => setDoctor(null)} />
        {doctors.map(([id, name]) => (
          <Chip key={id} label={name} selected={doctor === id} onPress={() => setDoctor(id)} />
        ))}
        <Chip
          label={labOnly ? 'Laboratuvarlık işler' : 'Tüm işler'}
          selected={labOnly}
          onPress={() => setLabOnly((v) => !v)}
        />
      </View>
      {loading && candidates.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : visible.length === 0 ? (
        <Text style={styles.muted}>Bu dönemde iş yok. Dönemi ya da filtreyi değiştirin.</Text>
      ) : (
        visible.map((c, i) => {
          const on = c.treatmentId in amounts;
          return (
            <Fragment key={c.treatmentId}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.cand}>
                <Pressable
                  onPress={() => toggle(c.treatmentId)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${c.procedure}, ${c.patientName}`}
                  style={styles.candMain}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? Colors.primary : Colors.textMuted}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.candTitle}>
                      {c.tooth ? `${c.tooth} · ` : ''}
                      {c.procedure}
                    </Text>
                    <Text style={styles.muted}>
                      {c.patientName} · {c.doctorName} · {formatDateInput(c.day)} ·{' '}
                      {treatmentKindLabels[c.kind as TreatmentKind] ?? c.kind}
                    </Text>
                    {c.expensed > 0 ? (
                      <Text style={[styles.muted, { color: Colors.warning }]}>
                        Bu işe daha önce {formatTL(c.expensed)} gider yazılmış
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                {on ? (
                  <View style={styles.amountBox}>
                    <Text style={styles.sym}>{sym}</Text>
                    <TextInput
                      value={amounts[c.treatmentId]}
                      onChangeText={(t) => setAmounts((a) => ({ ...a, [c.treatmentId]: t }))}
                      keyboardType="decimal-pad"
                      placeholder="Tutar"
                      placeholderTextColor={Colors.textMuted}
                      accessibilityLabel={`${c.procedure} tutarı`}
                      style={styles.amountInput}
                    />
                  </View>
                ) : null}
              </View>
            </Fragment>
          );
        })
      )}

      <View style={styles.totals}>
        <Text style={styles.label}>
          Seçilen {selected.length} iş:{' '}
          {currency === 'TRY' ? formatTL(itemsTotal) : formatMoney(itemsTotal, currency)}
        </Text>
        {diff != null ? (
          <Text style={[styles.label, { color: diff === 0 ? Colors.success : Colors.warning }]}>
            {diff === 0
              ? 'Fatura toplamıyla eşleşiyor ✓'
              : `Fatura toplamından fark: ${currency === 'TRY' ? formatTL(diff) : formatMoney(diff, currency)}`}
          </Text>
        ) : null}
        {currency !== 'TRY' && rate > 0 && total ? (
          <Text style={styles.muted}>TL karşılığı: {formatTL(Math.round(total * rate))}</Text>
        ) : null}
      </View>
      <TextField
        label="Not"
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı (ör. 2 iş bir sonraki faturada)"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        <Button
          label={busy ? 'Kaydediliyor…' : 'Faturayı kaydet'}
          icon="checkmark"
          onPress={save}
          disabled={busy}
        />
      </View>
    </Card>
  );
}

function StatementCard({ s, onChanged }: { s: LabStatement; onChanged: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const money = (n: number) => (s.currency === 'TRY' ? formatTL(n) : formatMoney(n, s.currency));
  const diff = s.totalOriginal - s.itemsTotal;
  return (
    <View style={styles.statement}>
      <View style={styles.stHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.candTitle}>{s.labName}</Text>
          <Text style={styles.muted}>
            {formatDateInput(s.periodStart)} – {formatDateInput(s.periodEnd)}
            {s.invoiceNo ? ` · Fatura ${s.invoiceNo}` : ''} · {formatDateInput(s.invoiceDate)}
            {s.createdByName ? ` · ${s.createdByName}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.stTotal}>{money(s.totalOriginal)}</Text>
          {s.currency !== 'TRY' ? (
            <Text style={styles.muted}>{formatTL(Math.round(s.totalOriginal * s.rate))}</Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.muted, diff !== 0 && { color: Colors.warning }]}>
        {s.itemCount} iş · {money(s.itemsTotal)}
        {diff !== 0 ? ` · faturadan fark ${money(diff)}` : ''}
        {s.note ? ` · ${s.note}` : ''}
      </Text>
      {cancelling ? (
        <View style={styles.cancelRow}>
          <View style={{ flex: 1 }}>
            <TextField label="İptal sebebi" value={reason} onChangeText={setReason} />
          </View>
          <Button
            label="İptal et"
            variant="secondary"
            disabled={!reason.trim()}
            onPress={async () => {
              try {
                await labRepository.cancel(s.id, reason);
                onChanged();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'İptal edilemedi.');
              }
            }}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setCancelling(true)}
          accessibilityRole="button"
          style={{ alignSelf: 'flex-start' }}>
          <Text style={[styles.link, { color: Colors.danger }]}>Faturayı iptal et</Text>
        </Pressable>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export default function LabStatementsScreen() {
  const { clinic, can } = useClinicSession();
  const [creating, setCreating] = useState(false);
  const load = useCallback(
    () =>
      can('maliyet.yaz')
        ? labRepository.statements(clinic.id)
        : Promise.resolve([] as LabStatement[]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clinic.id],
  );
  const { data, loading, error, reload } = useFocusLoad<LabStatement[]>(
    load,
    [],
    'Faturalar yüklenemedi.',
  );

  if (!can('maliyet.yaz')) {
    return (
      <Screen inStack>
        <Text style={styles.muted}>
          Laboratuvar faturalarını muhasebe, yönetici ve klinik sahibi girer.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen inStack>
      {creating ? (
        <StatementForm
          onCancel={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : (
        <View style={styles.actionsLeft}>
          <Button label="Yeni laboratuvar faturası" icon="add" onPress={() => setCreating(true)} />
        </View>
      )}

      <Card title="Girilen faturalar">
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} />
        ) : data.length === 0 ? (
          <CenteredMessage
            icon="flask-outline"
            title="Henüz fatura yok"
            text="Laboratuvar ay sonu faturası geldiğinde buradan girin; tutarlar işlere dağıtılır."
          />
        ) : (
          data.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 ? <Divider /> : null}
              <StatementCard s={s} onChanged={reload} />
            </Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { fontSize: 14, fontFamily: Fonts.bodyBold, color: Colors.text, marginTop: Spacing.sm },
  label: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.text },
  muted: { fontSize: 12, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
  link: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  col: { flexGrow: 1, flexBasis: 180 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  actionsLeft: { flexDirection: 'row', gap: Spacing.sm },
  cand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  candMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  candTitle: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.text },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 130,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  sym: { fontSize: 13, color: Colors.textSecondary },
  amountInput: { flex: 1, fontSize: 14, color: Colors.text },
  totals: {
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  statement: { gap: 6, paddingVertical: 4 },
  stHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  stTotal: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  cancelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
});
