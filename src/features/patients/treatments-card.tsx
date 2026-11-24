import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, SheetOption } from '@/components/bottom-sheet';
import { Button, Chip, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { usePriceList, type PriceItem } from '@/features/payments/payments';
import { needsCompletionRadiograph } from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';
import { formatTL, kurusToInput, parseTL } from '@/lib/money';

import { patientRepository } from './repository';
import type { Treatment, TreatmentInput, TreatmentKind, TreatmentStatus } from './types';
import {
  guessTreatmentKind,
  normalizeForSearch,
  treatmentKindLabels,
  treatmentStatusLabels,
} from './utils';

/** FDI diş numarası: kalıcı 11–48, süt dişi 51–85. Birden fazla diş virgülle. */
const FDI = /^([1-4][1-8]|[5-8][1-5])$/;
export function validateTeeth(text: string) {
  const parts = text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  if (parts.length === 0) return { value: undefined, error: null };
  const bad = parts.filter((t) => !FDI.test(t));
  if (bad.length)
    return {
      value: undefined,
      error: `Geçersiz diş numarası: ${bad.join(', ')} (FDI: 11–48, süt dişi 51–85).`,
    };
  return { value: parts.join(', '), error: null };
}

export type TreatmentEditor = { mode: 'new' } | { mode: 'edit'; treatment: Treatment };

/** Tedavi planındaki bir işlemi ekler ya da düzenler. */
export function TreatmentForm({
  editor,
  patientId,
  planId,
  locked = false,
  hasCompletionRadiograph,
  onDone,
  onCancel,
}: {
  editor: TreatmentEditor;
  patientId: string;
  /** Yeni işlemin ekleneceği plan */
  planId?: string;
  /** Plan kilitliyse yalnızca durum, tarih ve not değişir (anlaşılan bilgiler sabit) */
  locked?: boolean;
  /** Bu tedaviye bağlı geçerli bir bitim röntgeni var mı? */
  hasCompletionRadiograph: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic, member, can } = useClinicSession();
  const canPrice = can('odeme.oku');
  const { data: prices } = usePriceList(canPrice);
  const t = editor.mode === 'edit' ? editor.treatment : null;
  const [dateText, setDateText] = useState(formatDateInput(t?.date ?? todayKey()));
  const [procedure, setProcedureText] = useState(t?.procedure ?? '');
  const [kind, setKindValue] = useState<TreatmentKind | undefined>(t?.kind);
  const labels = Object.values(treatmentKindLabels);
  /** Tür seçilince açıklama boşsa (ya da başka bir türün adıysa) türün adıyla dolar. */
  const setKind = (k: TreatmentKind) => {
    setKindValue(k);
    if (!procedure.trim() || labels.includes(procedure.trim())) {
      setProcedureText(treatmentKindLabels[k]);
    }
  };
  /** Tür seçilmeden açıklama yazılırsa tür tahmin edilir. */
  const setProcedure = (text: string) => {
    setProcedureText(text);
    if (!kind) {
      const guess = guessTreatmentKind(text);
      if (guess) setKindValue(guess);
    }
  };
  const [tooth, setTooth] = useState(t?.tooth ?? '');
  // Plana eklenen işlem varsayılan olarak "planlandı"dır.
  const [status, setStatus] = useState<TreatmentStatus>(t?.status ?? 'planlandi');
  const [amountText, setAmountText] = useState(t?.amount != null ? kurusToInput(t.amount) : '');
  const [priceItemId, setPriceItemId] = useState(t?.priceItemId);
  const [pickPrice, setPickPrice] = useState(false);
  const [priceQuery, setPriceQuery] = useState('');
  const choosePrice = (item: PriceItem) => {
    setPriceItemId(item.id);
    setAmountText(kurusToInput(item.amount));
    if (!procedure.trim() || labels.includes(procedure.trim())) setProcedureText(item.name);
    if (!kind) {
      const guess = guessTreatmentKind(item.name);
      if (guess) setKindValue(guess);
    }
    setPickPrice(false);
    setPriceQuery('');
  };
  const [note, setNote] = useState(t?.note ?? '');
  const [errors, setErrors] = useState<
    Partial<Record<'date' | 'kind' | 'tooth' | 'amount' | 'form', string>>
  >({});
  const [saving, setSaving] = useState(false);
  // Bitim röntgeni uyarısı: engellemez, bir kez onay ister.
  const [radiographWarning, setRadiographWarning] = useState(false);

  const save = async (confirmed = false) => {
    const e: typeof errors = {};
    const date = parseDateInput(dateText);
    if (!date) e.date = 'GG.AA.YYYY biçiminde geçerli bir tarih girin.';
    else if (status === 'tamamlandi' && date > todayKey())
      e.date = 'Tamamlanan tedavi ileri tarihli olamaz.';
    if (!kind) e.kind = 'Yapılan ya da planlanan işlemi seçin.';
    const teeth = validateTeeth(tooth);
    if (teeth.error) e.tooth = teeth.error;
    const amount = amountText.trim() ? parseTL(amountText) : undefined;
    if (amount === null) e.amount = 'Geçerli bir tutar girin (ör. 2.500 ya da 2.500,50).';
    setErrors(e);
    if (Object.keys(e).length > 0 || !date || !kind || amount === null) return;
    // Açıklama boşsa türün adı kaydedilir.
    const name = procedure.trim() || treatmentKindLabels[kind];
    if (
      !confirmed &&
      status === 'tamamlandi' &&
      needsCompletionRadiograph(name) &&
      !hasCompletionRadiograph
    ) {
      setRadiographWarning(true);
      return;
    }

    // Kilitli planda anlaşılan bilgiler olduğu gibi gönderilir (veritabanı da denetler)
    const fixed =
      locked && t
        ? {
            procedure: t.procedure,
            kind: t.kind,
            tooth: t.tooth,
            amount: t.amount,
            priceItemId: t.priceItemId,
          }
        : null;
    const input: TreatmentInput = {
      date,
      procedure: name,
      kind,
      tooth: teeth.value,
      status,
      note: note.trim() || undefined,
      planId: t ? undefined : planId,
      amount,
      // Elle değiştirilen tutar yine de fiyat kalemine bağlı kalır (borçta fark notu düşülür)
      priceItemId: amount != null ? priceItemId : undefined,
      ...fixed,
    };
    setSaving(true);
    try {
      if (t) await patientRepository.updateTreatment(t.id, input);
      // Yeni kaydın hekimi, kaydı giren hekimdir.
      else await patientRepository.addTreatment(clinic.id, patientId, member.id, input);
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Tedavi kaydedilemedi.' });
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>
        {t ? 'İşlemi düzenle' : 'Plana işlem ekle'} · {t ? t.doctorName : member.name}
      </Text>
      <Segmented
        label="Durum"
        value={status}
        options={(Object.keys(treatmentStatusLabels) as TreatmentStatus[]).map((s) => ({
          value: s,
          label: treatmentStatusLabels[s],
        }))}
        onChange={setStatus}
      />
      {locked && t ? (
        <View style={styles.lockedBox}>
          <Text style={styles.lockedTitle}>
            {t.tooth ? `${t.tooth} · ` : ''}
            {t.procedure}
            {t.amount != null && canPrice ? ` · ${formatTL(t.amount)}` : ''}
          </Text>
          <Text style={styles.lockedText}>
            Plan kilitli: işlem, diş ve ücret değiştirilemez. Durumu, tarihi ve notu
            güncelleyebilirsiniz.
          </Text>
        </View>
      ) : (
        <>
          <View style={{ gap: Spacing.sm }}>
            <Text style={styles.kindLabel}>
              Yapılan işlem <Text style={{ color: Colors.danger }}>*</Text>
            </Text>
            <View style={styles.chips}>
              {(Object.keys(treatmentKindLabels) as TreatmentKind[]).map((k) => (
                <Chip
                  key={k}
                  label={treatmentKindLabels[k]}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </View>
            {errors.kind ? <Text style={styles.error}>{errors.kind}</Text> : null}
          </View>
          <TextField
            label="Açıklama"
            value={procedure}
            onChangeText={setProcedure}
            placeholder="Ör. İmplant 4.0×10 mm, Panoramik röntgen"
            hint="Seçtiğiniz işlemin adıyla dolar; gerekirse ayrıntı ekleyin."
          />
        </>
      )}
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Tarih"
            value={dateText}
            onChangeText={setDateText}
            error={errors.date}
            placeholder="GG.AA.YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>
        {locked ? null : (
          <View style={styles.col}>
            <TextField
              label="Diş (FDI)"
              value={tooth}
              onChangeText={setTooth}
              error={errors.tooth}
              placeholder="Ör. 36 veya 11, 21"
              hint="Genel işlemlerde boş bırakın."
              keyboardType="numbers-and-punctuation"
            />
          </View>
        )}
      </View>
      {canPrice && !locked ? (
        <View style={{ gap: Spacing.sm }}>
          <TextField
            label="Ücret (₺)"
            value={amountText}
            onChangeText={(v) => {
              setAmountText(v);
              if (!v.trim()) setPriceItemId(undefined);
            }}
            error={errors.amount}
            placeholder="Ör. 2.500"
            keyboardType="decimal-pad"
            hint="İşlem tamamlanınca bu tutar hastanın borcuna eklenir."
          />
          {prices.some((p) => p.active) ? (
            <Pressable
              onPress={() => setPickPrice(true)}
              accessibilityRole="button"
              hitSlop={6}
              style={{ alignSelf: 'flex-start' }}>
              <Text style={styles.link}>Fiyat listesinden seç</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <TextField
        label="Not"
        value={note}
        onChangeText={setNote}
        placeholder="İsteğe bağlı"
        multiline
      />
      {radiographWarning ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnText}>
            Bitim röntgeni yüklenmedi. {procedure.trim() || (kind ? treatmentKindLabels[kind] : '')}{' '}
            için tedavi sonrası röntgen önerilir. Yine de “Tamamlandı” olarak kaydedilsin mi?
            (Röntgeni sonra Röntgenler bölümünden ekleyip bu tedaviye bağlayabilirsiniz.)
          </Text>
          <View style={styles.actions}>
            <Button
              label="Vazgeç"
              variant="secondary"
              onPress={() => setRadiographWarning(false)}
            />
            <Button label="Yine de kaydet" onPress={() => save(true)} disabled={saving} />
          </View>
        </View>
      ) : null}
      {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
      {pickPrice ? (
        <BottomSheet
          title="Fiyat listesi"
          onClose={() => setPickPrice(false)}
          header={
            <TextField
              label="Ara"
              value={priceQuery}
              onChangeText={setPriceQuery}
              placeholder="Ör. implant"
            />
          }>
          {prices
            .filter(
              (p) =>
                p.active &&
                normalizeForSearch(p.name).includes(normalizeForSearch(priceQuery.trim())),
            )
            .map((p) => (
              <SheetOption
                key={p.id}
                label={p.name}
                sublabel={formatTL(p.amount)}
                selected={p.id === priceItemId}
                onPress={() => choosePrice(p)}
              />
            ))}
        </BottomSheet>
      ) : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Kaydet'}
          icon="checkmark"
          onPress={() => save()}
          disabled={saving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 220 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  error: { fontSize: 13, color: Colors.danger },
  kindLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  warnBox: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.warningSoft,
  },
  warnText: { fontSize: 13, color: Colors.warning },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  lockedBox: {
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  lockedTitle: { fontSize: 14, fontWeight: '600', color: Colors.text },
  lockedText: { fontSize: 12, color: Colors.primaryDeep },
});
