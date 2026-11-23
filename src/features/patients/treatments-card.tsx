import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Chip, Divider, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { needsCompletionRadiograph, type Radiograph } from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';

import { patientRepository } from './repository';
import type { Patient, Treatment, TreatmentInput, TreatmentKind, TreatmentStatus } from './types';
import {
  formatDate,
  guessTreatmentKind,
  treatmentKindLabels,
  treatmentStatusLabels,
} from './utils';

const statusTone: Record<TreatmentStatus, 'primary' | 'warning' | 'success'> = {
  planlandi: 'primary',
  devam: 'warning',
  tamamlandi: 'success',
};

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

type Editor = { mode: 'new' } | { mode: 'edit'; treatment: Treatment };

function TreatmentForm({
  editor,
  patientId,
  hasCompletionRadiograph,
  onDone,
  onCancel,
}: {
  editor: Editor;
  patientId: string;
  /** Bu tedaviye bağlı geçerli bir bitim röntgeni var mı? */
  hasCompletionRadiograph: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic, member } = useClinicSession();
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
  const [status, setStatus] = useState<TreatmentStatus>(t?.status ?? 'tamamlandi');
  const [note, setNote] = useState(t?.note ?? '');
  const [errors, setErrors] = useState<Partial<Record<'date' | 'kind' | 'tooth' | 'form', string>>>(
    {},
  );
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
    setErrors(e);
    if (Object.keys(e).length > 0 || !date || !kind) return;
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

    const input: TreatmentInput = {
      date,
      procedure: name,
      kind,
      tooth: teeth.value,
      status,
      note: note.trim() || undefined,
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
        {t ? 'Tedaviyi düzenle' : 'Yeni tedavi kaydı'} · {t ? t.doctorName : member.name}
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
      </View>
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

/** Tedavi geçmişi: yalnızca hekim yetkisiyle gösterilir (patient.treatments null değilse). */
export function TreatmentsCard({
  patient,
  radiographs = [],
  onSaved,
}: {
  patient: Patient;
  /** Hekimse bu hastanın röntgenleri (öncesi/bitim durumunu göstermek için). */
  radiographs?: Radiograph[];
  onSaved: () => void;
}) {
  const { can } = useClinicSession();
  const canWrite = can('tedavi.yaz');
  const [editor, setEditor] = useState<Editor | null>(null);
  const treatments = patient.treatments;
  if (!treatments) return null;

  const radiographFor = (treatmentId: string, purpose: Radiograph['purpose']) =>
    radiographs.some((r) => !r.invalid && r.treatmentId === treatmentId && r.purpose === purpose);

  return (
    <Card
      title="Tedavi geçmişi"
      action={
        canWrite && !editor ? (
          <Button
            label="Tedavi ekle"
            icon="add"
            variant="secondary"
            onPress={() => setEditor({ mode: 'new' })}
          />
        ) : null
      }>
      {editor ? (
        <TreatmentForm
          // Başka bir kaydı düzenlemeye geçince form sıfırlansın
          key={editor.mode === 'edit' ? editor.treatment.id : 'yeni'}
          editor={editor}
          patientId={patient.id}
          hasCompletionRadiograph={
            editor.mode === 'edit' && radiographFor(editor.treatment.id, 'tedavi_sonrasi')
          }
          onCancel={() => setEditor(null)}
          onDone={() => {
            setEditor(null);
            onSaved();
          }}
        />
      ) : null}

      {treatments.length === 0 ? (
        <Text style={styles.empty}>Henüz tedavi kaydı yok.</Text>
      ) : (
        treatments.map((t, i) => (
          <Fragment key={t.id}>
            {i > 0 && <Divider />}
            <Pressable
              onPress={canWrite ? () => setEditor({ mode: 'edit', treatment: t }) : undefined}
              disabled={!canWrite}
              accessibilityRole={canWrite ? 'button' : undefined}
              accessibilityHint={canWrite ? 'Tedaviyi düzenle' : undefined}
              style={({ pressed }) => [styles.treatment, pressed && { opacity: 0.6 }]}>
              <View style={styles.treatmentDate}>
                <Text style={styles.sub}>{formatDate(t.date)}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.treatmentTitle}>
                  {t.procedure}
                  {t.tooth ? <Text style={styles.tooth}> · Diş {t.tooth}</Text> : null}
                </Text>
                <Text style={styles.sub}>
                  {treatmentKindLabels[t.kind]} · {t.doctorName}
                  {t.note ? ` · ${t.note}` : ''}
                </Text>
                {needsCompletionRadiograph(t.procedure) ||
                radiographs.some((r) => r.treatmentId === t.id) ? (
                  <Text style={styles.xray}>
                    Röntgen: öncesi {radiographFor(t.id, 'tedavi_oncesi') ? '✓' : '—'} · bitim{' '}
                    {radiographFor(t.id, 'tedavi_sonrasi') ? '✓' : '—'}
                  </Text>
                ) : null}
              </View>
              <Badge label={treatmentStatusLabels[t.status]} tone={statusTone[t.status]} />
            </Pressable>
          </Fragment>
        ))
      )}
    </Card>
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
  xray: { fontSize: 12, color: Colors.textMuted },
  empty: { fontSize: 14, color: Colors.textMuted },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treatmentDate: { width: 92 },
  treatmentTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  sub: { fontSize: 13, color: Colors.textSecondary },
});
