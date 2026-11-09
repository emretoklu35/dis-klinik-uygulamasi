import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PatientAvatar } from '@/features/patients/components';
import { usePatientList } from '@/features/patients/hooks';
import { fullName } from '@/features/patients/utils';
import {
  addDays,
  formatDateInput,
  formatDayLong,
  formatDayShort,
  isSunday,
  localDateTime,
  parseDateInput,
  todayKey,
} from '@/lib/dates';

import { clinicConfig, durationOptions, procedureSuggestions, timeSlots } from './clinic';
import { useAppointmentsRange } from './hooks';
import { conflictMessage, findConflicts, scheduleError } from './rules';
import type { AppointmentInput } from './types';

export type AppointmentFormValues = {
  patient: { id: string; name: string } | null;
  date: string; // gün anahtarı
  time: string | null;
  durationMin: number;
  doctor: string;
  chair: string;
  procedure: string;
  note: string;
};

export function emptyAppointmentForm(overrides: Partial<AppointmentFormValues> = {}): AppointmentFormValues {
  const t = todayKey();
  return {
    patient: null,
    date: isSunday(t) ? addDays(t, 1) : t,
    time: null,
    durationMin: 30,
    doctor: clinicConfig.doctors[0],
    chair: clinicConfig.chairs[0],
    procedure: '',
    note: '',
    ...overrides,
  };
}

/** Bugünden itibaren sıradaki çalışma günleri (pazar hariç). */
function nextWorkingDays(count: number) {
  const out: string[] = [];
  let d = todayKey();
  while (out.length < count) {
    if (!isSunday(d)) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

type Errors = Partial<Record<'patient' | 'date' | 'time' | 'procedure' | 'form', string>>;

function PatientPicker({
  value,
  onChange,
  error,
}: {
  value: AppointmentFormValues['patient'];
  onChange: (p: AppointmentFormValues['patient']) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const { data } = usePatientList(query);

  if (value) {
    const [firstName, ...rest] = value.name.split(' ');
    return (
      <View style={styles.selectedPatient}>
        <PatientAvatar patient={{ firstName, lastName: rest.join(' ') }} size={36} />
        <Text style={styles.selectedName}>{value.name}</Text>
        <Button label="Değiştir" variant="secondary" onPress={() => onChange(null)} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={[styles.search, !!error && { borderColor: Colors.danger }]}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Hasta adı veya telefon"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          accessibilityLabel="Hasta ara"
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.results}>
        {data.slice(0, 6).map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onChange({ id: p.id, name: fullName(p) })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.result, pressed && { opacity: 0.6 }]}>
            <PatientAvatar patient={p} size={28} />
            <Text style={styles.resultName}>{fullName(p)}</Text>
            <Text style={styles.resultPhone}>{p.phone}</Text>
          </Pressable>
        ))}
        {data.length === 0 ? <Text style={styles.hint}>Eşleşen hasta yok.</Text> : null}
      </View>
    </View>
  );
}

export function AppointmentForm({
  initial,
  editingId,
  originalStart,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: AppointmentFormValues;
  /** Düzenlenen randevu (kendi saatiyle çakışmasın diye). */
  editingId?: string;
  /** Düzenlemede eski başlangıç; aynı kalırsa geçmiş saat kontrolü yapılmaz. */
  originalStart?: string;
  submitLabel: string;
  onSubmit: (input: AppointmentInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial);
  const [dateText, setDateText] = useState(formatDateInput(initial.date));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const { data: dayAppointments } = useAppointmentsRange(v.date, v.date);

  const set = <K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const pickDate = (key: string) => {
    set('date', key);
    setDateText(formatDateInput(key));
  };

  // Her saat için: seçili hekim/koltuk/süreyle uygun mu?
  const slotProblems = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of timeSlots()) {
      const start = localDateTime(v.date, t);
      const schedule = scheduleError({ start, durationMin: v.durationMin }, { allowPast: start === originalStart });
      if (schedule) {
        map.set(t, schedule);
        continue;
      }
      const conflicts = findConflicts(
        { start, durationMin: v.durationMin, doctor: v.doctor, chair: v.chair },
        dayAppointments,
        editingId,
      );
      if (conflicts.length > 0) map.set(t, conflictMessage(conflicts[0]));
    }
    return map;
  }, [v.date, v.durationMin, v.doctor, v.chair, dayAppointments, editingId, originalStart]);

  const selectedProblem = v.time ? slotProblems.get(v.time) : undefined;
  const freeCount = timeSlots().length - slotProblems.size;
  const quickDays = nextWorkingDays(6);

  const submit = async () => {
    const e: Errors = {};
    if (!v.patient) e.patient = 'Hasta seçin.';
    const parsed = parseDateInput(dateText);
    if (!parsed) e.date = 'GG.AA.YYYY biçiminde geçerli bir tarih girin.';
    else if (isSunday(parsed)) e.date = 'Pazar günü klinik kapalı.';
    if (!v.time) e.time = 'Saat seçin.';
    else if (selectedProblem) e.time = selectedProblem;
    if (!v.procedure.trim()) e.procedure = 'Yapılacak işlemi yazın.';
    setErrors(e);
    if (Object.keys(e).length > 0 || !v.patient || !v.time) return;

    setSaving(true);
    try {
      await onSubmit({
        patientId: v.patient.id,
        patientName: v.patient.name,
        start: localDateTime(v.date, v.time),
        durationMin: v.durationMin,
        doctor: v.doctor,
        chair: v.chair,
        procedure: v.procedure.trim(),
        note: v.note.trim() || undefined,
      });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Randevu kaydedilemedi.' });
      setSaving(false);
    }
  };

  return (
    <>
      <Card title="Hasta">
        <PatientPicker value={v.patient} onChange={(p) => set('patient', p)} error={errors.patient} />
      </Card>

      <Card title="Tarih ve saat">
        <View style={styles.chips}>
          {quickDays.map((d, i) => (
            <Chip
              key={d}
              label={i === 0 && d === todayKey() ? 'Bugün' : formatDayShort(d)}
              selected={v.date === d}
              onPress={() => pickDate(d)}
            />
          ))}
        </View>
        <TextField
          label="Tarih"
          value={dateText}
          onChangeText={(t) => {
            setDateText(t);
            const key = parseDateInput(t);
            if (key) set('date', key);
            else setErrors((er) => ({ ...er, date: undefined }));
          }}
          error={errors.date}
          hint={parseDateInput(dateText) ? formatDayLong(v.date) : 'GG.AA.YYYY'}
          placeholder="GG.AA.YYYY"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        <View style={styles.row}>
          <View style={styles.col}>
            <Segmented
              label="Hekim"
              value={v.doctor}
              options={clinicConfig.doctors.map((d) => ({ value: d, label: d }))}
              onChange={(d) => set('doctor', d)}
            />
          </View>
          <View style={styles.col}>
            <Segmented
              label="Koltuk"
              value={v.chair}
              options={clinicConfig.chairs.map((c) => ({ value: c, label: c }))}
              onChange={(c) => set('chair', c)}
            />
          </View>
        </View>

        <Segmented
          label="Süre"
          value={String(v.durationMin)}
          options={durationOptions.map((m) => ({ value: String(m), label: `${m} dk` }))}
          onChange={(m) => set('durationMin', Number(m))}
        />

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            Saat <Text style={styles.labelHint}>· {freeCount} uygun saat</Text>
          </Text>
          <View style={styles.chips}>
            {timeSlots().map((t) => {
              const problem = slotProblems.get(t);
              return (
                <Chip
                  key={t}
                  label={t}
                  selected={v.time === t}
                  disabled={!!problem && v.time !== t}
                  accessibilityHint={problem}
                  onPress={() => set('time', t)}
                />
              );
            })}
          </View>
          {errors.time || selectedProblem ? (
            <Text style={styles.error}>{errors.time ?? selectedProblem}</Text>
          ) : (
            <Text style={styles.hint}>Üstü çizili saatler seçili hekim veya koltuk için dolu.</Text>
          )}
        </View>
      </Card>

      <Card title="İşlem">
        <View style={styles.chips}>
          {procedureSuggestions.map((p) => (
            <Chip key={p} label={p} selected={v.procedure === p} onPress={() => set('procedure', p)} />
          ))}
        </View>
        <TextField
          label="Yapılacak işlem"
          required
          value={v.procedure}
          onChangeText={(t) => set('procedure', t)}
          error={errors.procedure}
          placeholder="Öneriden seçin ya da yazın"
        />
        <TextField
          label="Not"
          value={v.note}
          onChangeText={(t) => set('note', t)}
          placeholder="Ör. Hasta sabah saatlerini tercih ediyor"
          multiline
        />
      </Card>

      {errors.form ? (
        <View style={styles.formError}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.formErrorText}>{errors.form}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button label={saving ? 'Kaydediliyor…' : submitLabel} icon="checkmark" onPress={submit} disabled={saving} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 260 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  labelHint: { fontWeight: '400', color: Colors.textMuted },
  hint: { fontSize: 12, color: Colors.textMuted },
  error: { fontSize: 13, color: Colors.danger },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: Spacing.md, fontSize: 15, color: Colors.text, minHeight: 44 },
  results: { gap: 2 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
  },
  resultName: { fontSize: 15, fontWeight: '500', color: Colors.text, flex: 1 },
  resultPhone: { fontSize: 13, color: Colors.textMuted },
  selectedPatient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  selectedName: { fontSize: 16, fontWeight: '600', color: Colors.text, flex: 1 },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  formErrorText: { fontSize: 14, color: Colors.danger, flexShrink: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, flexWrap: 'wrap' },
});
