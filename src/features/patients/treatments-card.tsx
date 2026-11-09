import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Chip, Divider, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { procedureSuggestions } from '@/features/appointments/clinic';
import { useClinicSession } from '@/features/session/session-context';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';

import { patientRepository } from './repository';
import type { Patient, Treatment, TreatmentInput, TreatmentStatus } from './types';
import { formatDate, treatmentStatusLabels } from './utils';

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
  onDone,
  onCancel,
}: {
  editor: Editor;
  patientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic, member } = useClinicSession();
  const t = editor.mode === 'edit' ? editor.treatment : null;
  const [dateText, setDateText] = useState(formatDateInput(t?.date ?? todayKey()));
  const [procedure, setProcedure] = useState(t?.procedure ?? '');
  const [tooth, setTooth] = useState(t?.tooth ?? '');
  const [status, setStatus] = useState<TreatmentStatus>(t?.status ?? 'tamamlandi');
  const [note, setNote] = useState(t?.note ?? '');
  const [errors, setErrors] = useState<
    Partial<Record<'date' | 'procedure' | 'tooth' | 'form', string>>
  >({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: typeof errors = {};
    const date = parseDateInput(dateText);
    if (!date) e.date = 'GG.AA.YYYY biçiminde geçerli bir tarih girin.';
    else if (status === 'tamamlandi' && date > todayKey())
      e.date = 'Tamamlanan tedavi ileri tarihli olamaz.';
    if (!procedure.trim()) e.procedure = 'Yapılan ya da planlanan işlemi yazın.';
    const teeth = validateTeeth(tooth);
    if (teeth.error) e.tooth = teeth.error;
    setErrors(e);
    if (Object.keys(e).length > 0 || !date) return;

    const input: TreatmentInput = {
      date,
      procedure: procedure.trim(),
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
      <View style={styles.chips}>
        {procedureSuggestions.map((p) => (
          <Chip key={p} label={p} selected={procedure === p} onPress={() => setProcedure(p)} />
        ))}
      </View>
      <TextField
        label="İşlem"
        required
        value={procedure}
        onChangeText={setProcedure}
        error={errors.procedure}
        placeholder="Öneriden seçin ya da yazın"
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
      {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Kaydet'}
          icon="checkmark"
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

/** Tedavi geçmişi: yalnızca hekim yetkisiyle gösterilir (patient.treatments null değilse). */
export function TreatmentsCard({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const { can } = useClinicSession();
  const canWrite = can('tedavi.yaz');
  const [editor, setEditor] = useState<Editor | null>(null);
  const treatments = patient.treatments;
  if (!treatments) return null;

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
                  {t.doctorName}
                  {t.note ? ` · ${t.note}` : ''}
                </Text>
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
  empty: { fontSize: 14, color: Colors.textMuted },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treatmentDate: { width: 92 },
  treatmentTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  sub: { fontSize: 13, color: Colors.textSecondary },
});
