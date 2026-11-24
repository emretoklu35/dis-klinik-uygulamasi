/**
 * Plan detayındaki maliyet bileşenleri:
 *  - ItemExpenses: işlemin laboratuvar giderleri ve "+ Gider" formu (maliyet.yaz)
 *  - ProfitPanel: işlem bazında gelir, laboratuvar, malzeme, prim, kâr ve marj (maliyet.oku)
 *  - usePlanCosts: planın giderleri, laboratuvar listesi ve kârlılığı
 */

import { Fragment, useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, Divider, Segmented, TextField } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL, parseTL } from '@/lib/money';
import { useFocusLoad } from '@/lib/use-focus-load';

import {
  costRepository,
  currencyLabels,
  formatMoney,
  marginPct,
  type Currency,
  type Lab,
  type ProfitRow,
  type TreatmentExpense,
} from './costs';

type PlanCosts = { labs: Lab[]; expenses: TreatmentExpense[]; profit: ProfitRow[] };
const EMPTY: PlanCosts = { labs: [], expenses: [], profit: [] };

export function usePlanCosts(planId: string | undefined, treatmentIds: string[]) {
  const { clinic, can } = useClinicSession();
  const canRead = can('maliyet.oku');
  const canWrite = can('maliyet.yaz');
  const key = treatmentIds.join(',');
  const load = useCallback(async (): Promise<PlanCosts> => {
    if (!planId || (!canRead && !canWrite)) return EMPTY;
    const ids = key ? key.split(',') : [];
    const [labs, expenses, profit] = await Promise.all([
      costRepository.listLabs(clinic.id),
      costRepository.listExpenses(ids),
      canRead ? costRepository.planProfitability(planId) : Promise.resolve([] as ProfitRow[]),
    ]);
    return { labs, expenses, profit };
  }, [planId, key, canRead, canWrite, clinic.id]);
  const state = useFocusLoad<PlanCosts>(load, EMPTY, 'Maliyetler yüklenemedi.');
  return { ...state, canRead, canWrite };
}

export const pctText = (n: number | null) =>
  n == null ? '—' : `%${n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;

// ----------------------------------------------------------------------------
// Gider girişi
// ----------------------------------------------------------------------------
function ExpenseForm({
  treatmentId,
  labs,
  onDone,
  onCancel,
}: {
  treatmentId: string;
  labs: Lab[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [labId, setLabId] = useState<string | undefined>();
  const [newLab, setNewLab] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [amountText, setAmountText] = useState('');
  const [rateText, setRateText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amount = parseTL(amountText);
  const rate = currency === 'TRY' ? 1 : Number(rateText.replace(',', '.'));
  const tl = amount && rate > 0 ? Math.round(amount * rate) : null;

  const save = async () => {
    if (!amount || amount <= 0) return setError('Sıfırdan büyük bir tutar girin.');
    if (currency !== 'TRY' && !(rate > 0)) return setError('Girildiği günün kurunu yazın.');
    setBusy(true);
    setError(null);
    try {
      await costRepository.addExpense({
        treatmentId,
        labId,
        labName: labId ? undefined : newLab.trim() || undefined,
        description: description.trim() || undefined,
        currency,
        amountOriginal: amount,
        rate: currency === 'TRY' ? 1 : rate,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gider kaydedilemedi.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Laboratuvar / dış gider</Text>
      {labs.length ? (
        <View style={styles.chips}>
          {labs.map((l) => (
            <Chip
              key={l.id}
              label={l.name}
              selected={labId === l.id}
              onPress={() => {
                setLabId(labId === l.id ? undefined : l.id);
                setNewLab('');
              }}
            />
          ))}
        </View>
      ) : null}
      {!labId ? (
        <TextField
          label={labs.length ? 'Ya da yeni laboratuvar' : 'Laboratuvar'}
          value={newLab}
          onChangeText={setNewLab}
          placeholder="Ör. Örnek Dental Lab (isteğe bağlı)"
        />
      ) : null}
      <TextField
        label="Açıklama"
        value={description}
        onChangeText={setDescription}
        placeholder="Ör. Zirkonyum kron"
      />
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
            label={`Tutar (${currency === 'TRY' ? '₺' : currency})`}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="Ör. 1.000"
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
              hint="Bugünün kuru; TL karşılığı bu kurla sabitlenir."
            />
          </View>
        ) : null}
      </View>
      {currency !== 'TRY' && tl ? (
        <Text style={styles.muted}>TL karşılığı: {formatTL(tl)}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        <Button label="Gideri kaydet" icon="checkmark" onPress={save} disabled={busy} />
      </View>
    </View>
  );
}

/** İşlemin altında: giderleri ve "+ Gider" */
export function ItemExpenses({
  treatmentId,
  expenses,
  labs,
  canWrite,
  onChanged,
}: {
  treatmentId: string;
  expenses: TreatmentExpense[];
  labs: Lab[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [cancelId, setCancelId] = useState<string | undefined>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mine = expenses.filter((e) => e.treatmentId === treatmentId);
  if (mine.length === 0 && !canWrite) return null;

  return (
    <View style={styles.expenses}>
      {mine.map((e) => (
        <View key={e.id} style={{ gap: 4 }}>
          <View style={styles.expenseRow}>
            <Text style={[styles.expenseText, { flex: 1 }]} numberOfLines={2}>
              {e.labName ?? 'Gider'}
              {e.description ? ` · ${e.description}` : ''}
            </Text>
            <Text style={styles.expenseAmount}>
              {e.currency === 'TRY'
                ? formatTL(e.amount)
                : `${formatMoney(e.amountOriginal, e.currency)} (${formatTL(e.amount)})`}
            </Text>
            {canWrite && cancelId !== e.id ? (
              <Pressable onPress={() => setCancelId(e.id)} accessibilityRole="button" hitSlop={6}>
                <Text style={[styles.link, { color: Colors.danger }]}>İptal</Text>
              </Pressable>
            ) : null}
          </View>
          {cancelId === e.id ? (
            <View style={styles.cancelRow}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="İptal sebebi"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Ör. Yanlış girildi"
                />
              </View>
              <Button
                label="İptal et"
                variant="secondary"
                disabled={!reason.trim()}
                onPress={async () => {
                  try {
                    await costRepository.cancelExpense(e.id, reason);
                    setCancelId(undefined);
                    setReason('');
                    onChanged();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'İptal edilemedi.');
                  }
                }}
              />
            </View>
          ) : null}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {adding ? (
        <ExpenseForm
          treatmentId={treatmentId}
          labs={labs}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            onChanged();
          }}
        />
      ) : canWrite ? (
        <Pressable
          onPress={() => setAdding(true)}
          accessibilityRole="button"
          hitSlop={6}
          style={{ alignSelf: 'flex-start' }}>
          <Text style={styles.link}>+ Gider ekle</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Kârlılık
// ----------------------------------------------------------------------------
export function ProfitPanel({ rows }: { rows: ProfitRow[] }) {
  if (rows.length === 0) return null;
  const sum = (k: keyof ProfitRow) => rows.reduce((s, r) => s + (r[k] as number), 0);
  const revenue = sum('revenue');
  const profit = sum('profit');
  const margin = marginPct(revenue, profit);
  const unpriced = rows.some((r) => r.materialUnpriced);

  return (
    <View style={styles.panel}>
      <View style={styles.panelHead}>
        <Text style={styles.formTitle}>Kârlılık</Text>
        <Text
          style={[
            styles.margin,
            {
              color:
                margin == null ? Colors.textMuted : margin < 20 ? Colors.danger : Colors.success,
            },
          ]}>
          Marj {pctText(margin)}
        </Text>
      </View>
      <View style={[styles.tr, styles.th]}>
        <Text style={[styles.thText, { flex: 2 }]}>İşlem</Text>
        <Text style={[styles.thText, styles.num]}>Gelir</Text>
        <Text style={[styles.thText, styles.num]}>Lab</Text>
        <Text style={[styles.thText, styles.num]}>Malzeme</Text>
        <Text style={[styles.thText, styles.num]}>Prim</Text>
        <Text style={[styles.thText, styles.num]}>Kâr</Text>
      </View>
      {rows.map((r, i) => (
        <Fragment key={r.treatmentId}>
          {i > 0 ? <Divider /> : null}
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 2 }]} numberOfLines={2}>
              {r.tooth ? `${r.tooth} · ` : ''}
              {r.procedure}
            </Text>
            <Text style={[styles.td, styles.num]}>{formatTL(r.revenue)}</Text>
            <Text style={[styles.td, styles.num]}>{r.lab ? `−${formatTL(r.lab)}` : '—'}</Text>
            <Text style={[styles.td, styles.num]}>
              {r.material ? `−${formatTL(r.material)}` : '—'}
            </Text>
            <Text style={[styles.td, styles.num]}>
              {r.commission ? `−${formatTL(r.commission)}` : '—'}
            </Text>
            <Text
              style={[
                styles.td,
                styles.num,
                { fontFamily: Fonts.bodySemi, color: r.profit < 0 ? Colors.danger : Colors.text },
              ]}>
              {formatTL(r.profit)}
            </Text>
          </View>
        </Fragment>
      ))}
      <View style={[styles.tr, styles.totalRow]}>
        <Text style={[styles.total, { flex: 2 }]}>Toplam</Text>
        <Text style={[styles.total, styles.num]}>{formatTL(revenue)}</Text>
        <Text style={[styles.total, styles.num]}>−{formatTL(sum('lab'))}</Text>
        <Text style={[styles.total, styles.num]}>−{formatTL(sum('material'))}</Text>
        <Text style={[styles.total, styles.num]}>−{formatTL(sum('commission'))}</Text>
        <Text style={[styles.total, styles.num, profit < 0 && { color: Colors.danger }]}>
          {formatTL(profit)}
        </Text>
      </View>
      <Text style={styles.muted}>
        Gelir indirimli fiyattır. Malzeme, seansta tedaviye bağlanan malzemenin ortalama alış
        fiyatıdır; prim, hekimin tedavi bazlı oranıyla hesaplanır.
        {unpriced ? ' Bazı malzemelerin alış fiyatı girilmemiş; maliyet eksik olabilir.' : ''}
      </Text>
    </View>
  );
}

/**
 * İndirim formu için: seçilen işlemlerde indirim sonrası marj.
 * Laboratuvar ve malzeme sabit kalır, prim yeni gelir üzerinden hesaplanır.
 */
export function marginAfterDiscount(rows: ProfitRow[], ids: string[], cut: number) {
  const chosen = rows.filter((r) => ids.includes(r.treatmentId));
  const revenue = chosen.reduce((s, r) => s + r.revenue, 0);
  if (revenue <= 0) return null;
  const fixed = chosen.reduce((s, r) => s + r.lab + r.material, 0);
  const rate = revenue ? chosen.reduce((s, r) => s + r.commission, 0) / revenue : 0;
  const before = marginPct(revenue, revenue - fixed - revenue * rate);
  const after = revenue - cut;
  const afterPct = marginPct(after, after - fixed - after * rate);
  return { before, after: afterPct };
}

const styles = StyleSheet.create({
  muted: { fontSize: 12, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
  link: { fontSize: 12, fontFamily: Fonts.bodySemi, color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  col: { flexGrow: 1, flexBasis: 160 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  form: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: { fontSize: 14, fontFamily: Fonts.bodyBold, color: Colors.text },
  expenses: { gap: 6, paddingLeft: Spacing.md, borderLeftWidth: 2, borderLeftColor: Colors.border },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  expenseText: { fontSize: 12, color: Colors.textSecondary },
  expenseAmount: { fontSize: 12, fontFamily: Fonts.bodySemi, color: Colors.text },
  cancelRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  panel: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  margin: { fontSize: 15, fontFamily: Fonts.heading },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  th: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  thText: { fontSize: 11, fontFamily: Fonts.bodySemi, color: Colors.textMuted },
  td: { fontSize: 12, color: Colors.text },
  num: { width: 92, textAlign: 'right' },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border },
  total: { fontSize: 12, fontFamily: Fonts.bodyBold, color: Colors.text },
});
