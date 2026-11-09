import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PatientAvatar } from '@/features/patients/components';
import { usePatientList } from '@/features/patients/hooks';
import { fullName } from '@/features/patients/utils';
import {
  useClinicSession,
  type ClinicInfo,
  type StaffRef,
} from '@/features/session/session-context';
import {
  formatDateInput,
  formatDayLong,
  formatDayShort,
  localDateTime,
  parseDateInput,
  todayKey,
} from '@/lib/dates';

import {
  durationOptions,
  isWorkingDay,
  nextWorkingDay,
  nextWorkingDays,
  procedureSuggestions,
  timeSlots,
  visitTypeLabels,
} from './clinic';
import { useAppointmentsRange } from './hooks';
import { conflictMessage, findConflicts, scheduleError } from './rules';
import type { AppointmentInput, VisitType } from './types';

export type AppointmentFormValues = {
  patient: { id: string; name: string } | null;
  date: string; // gün anahtarı
  time: string | null;
  durationMin: number;
  visitType: VisitType;
  doctorMemberId: string;
  chairId: string;
  deskNote: string;
  /** Yalnızca hekim */
  procedure: string;
  /** Yalnızca hekim */
  clinicalNote: string;
};

export function emptyAppointmentForm(
  ctx: { clinic: ClinicInfo; doctors: StaffRef[]; chairs: StaffRef[]; member: StaffRef },
  overrides: Partial<AppointmentFormValues> = {},
): AppointmentFormValues {
  // Formu açan kişi hekimse varsayılan hekim kendisi olsun.
  const me = ctx.doctors.find((d) => d.id === ctx.member.id);
  return {
    patient: null,
    date: nextWorkingDay(todayKey(), ctx.clinic),
    time: null,
    durationMin: 30,
    visitType: 'muayene',
    doctorMemberId: (me ?? ctx.doctors[0])?.id ?? '',
    chairId: ctx.chairs[0]?.id ?? '',
    deskNote: '',
    procedure: '',
    clinicalNote: '',
    ...overrides,
  };
}

type Errors = Partial<Record<'patient' | 'date' | 'time' | 'doctor' | 'form', string>>;

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
  const { clinic, doctors, chairs, can } = useClinicSession();
  const isClinician = can('tedavi.yaz');
  const [v, setV] = useState(initial);
  const [dateText, setDateText] = useState(formatDateInput(initial.date));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const { data: dayAppointments } = useAppointmentsRange(v.date, v.date);
  const slots = useMemo(() => timeSlots(clinic), [clinic]);

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
    for (const t of slots) {
      const start = localDateTime(v.date, t);
      const schedule = scheduleError({ start, durationMin: v.durationMin }, clinic, {
        allowPast: start === originalStart,
      });
      if (schedule) {
        map.set(t, schedule);
        continue;
      }
      const conflicts = findConflicts(
        { start, durationMin: v.durationMin, doctorMemberId: v.doctorMemberId, chairId: v.chairId },
        dayAppointments,
        editingId,
      );
      if (conflicts.length > 0) map.set(t, conflictMessage(conflicts[0]));
    }
    return map;
  }, [
    slots,
    v.date,
    v.durationMin,
    v.doctorMemberId,
    v.chairId,
    dayAppointments,
    editingId,
    originalStart,
    clinic,
  ]);

  const selectedProblem = v.time ? slotProblems.get(v.time) : undefined;
  const freeCount = slots.length - slotProblems.size;
  const quickDays = nextWorkingDays(6, clinic);

  const submit = async () => {
    const e: Errors = {};
    if (!v.patient) e.patient = 'Hasta seçin.';
    const parsed = parseDateInput(dateText);
    if (!parsed) e.date = 'GG.AA.YYYY biçiminde geçerli bir tarih girin.';
    else if (!isWorkingDay(parsed, clinic)) e.date = 'Klinik bu gün kapalı.';
    if (!v.doctorMemberId) e.doctor = 'Hekim seçin.';
    if (!v.time) e.time = 'Saat seçin.';
    else if (selectedProblem) e.time = selectedProblem;
    setErrors(e);
    if (Object.keys(e).length > 0 || !v.patient || !v.time) return;

    setSaving(true);
    try {
      await onSubmit({
        patientId: v.patient.id,
        start: localDateTime(v.date, v.time),
        durationMin: v.durationMin,
        visitType: v.visitType,
        doctorMemberId: v.doctorMemberId,
        chairId: v.chairId,
        deskNote: v.deskNote.trim() || undefined,
        clinical: isClinician
          ? {
              procedure: v.procedure.trim() || undefined,
              clinicalNote: v.clinicalNote.trim() || undefined,
            }
          : undefined,
      });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Randevu kaydedilemedi.' });
      setSaving(false);
    }
  };

  if (doctors.length === 0 || chairs.length === 0) {
    return (
      <Card>
        <Text style={styles.error}>
          Randevu verebilmek için klinikte en az bir aktif hekim ve bir koltuk tanımlı olmalı.
        </Text>
      </Card>
    );
  }

  return (
    <>
      <Card title="Hasta">
        <PatientPicker
          value={v.patient}
          onChange={(p) => set('patient', p)}
          error={errors.patient}
        />
      </Card>

      <Card title="Randevu">
        <Segmented
          label="Tür"
          value={v.visitType}
          options={(Object.keys(visitTypeLabels) as VisitType[]).map((t) => ({
            value: t,
            label: visitTypeLabels[t],
          }))}
          onChange={(t) => set('visitType', t)}
        />
        <View style={styles.row}>
          <View style={styles.col}>
            <Segmented
              label="Hekim"
              value={v.doctorMemberId}
              options={doctors.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(d) => set('doctorMemberId', d)}
            />
            {errors.doctor ? <Text style={styles.error}>{errors.doctor}</Text> : null}
          </View>
          <View style={styles.col}>
            <Segmented
              label="Koltuk"
              value={v.chairId}
              options={chairs.map((c) => ({ value: c.id, label: c.name }))}
              onChange={(c) => set('chairId', c)}
            />
          </View>
        </View>
        <Segmented
          label="Süre"
          value={String(v.durationMin)}
          options={durationOptions.map((m) => ({ value: String(m), label: `${m} dk` }))}
          onChange={(m) => set('durationMin', Number(m))}
        />
      </Card>

      <Card title="Tarih ve saat">
        <View style={styles.chips}>
          {quickDays.map((d) => (
            <Chip
              key={d}
              label={d === todayKey() ? 'Bugün' : formatDayShort(d)}
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

        <View style={{ gap: 6 }}>
          <Text style={styles.label}>
            Saat <Text style={styles.labelHint}>· {freeCount} uygun saat</Text>
          </Text>
          <View style={styles.chips}>
            {slots.map((t) => {
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

      <Card title="Notlar">
        <TextField
          label="İdari not"
          value={v.deskNote}
          onChangeText={(t) => set('deskNote', t)}
          placeholder="Ör. Hasta sabah saatlerini tercih ediyor"
          hint="Tüm personel görür. Sağlıkla ilgili bilgi yazmayın."
          multiline
        />
      </Card>

      {isClinician ? (
        <Card title="İşlem ayrıntısı (yalnızca hekim)">
          <View style={styles.chips}>
            {procedureSuggestions.map((p) => (
              <Chip
                key={p}
                label={p}
                selected={v.procedure === p}
                onPress={() => set('procedure', p)}
              />
            ))}
          </View>
          <TextField
            label="İşlem"
            value={v.procedure}
            onChangeText={(t) => set('procedure', t)}
            placeholder="Öneriden seçin ya da yazın"
          />
          <TextField
            label="Klinik not"
            value={v.clinicalNote}
            onChangeText={(t) => set('clinicalNote', t)}
            placeholder="Yalnızca hekimlerin göreceği not"
            multiline
          />
        </Card>
      ) : (
        <Text style={styles.hint}>
          İşlem ayrıntısını hekim girer; resepsiyon yalnızca genel türü görür.
        </Text>
      )}

      {errors.form ? (
        <View style={styles.formError}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.formErrorText}>{errors.form}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : submitLabel}
          icon="checkmark"
          onPress={submit}
          disabled={saving}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 260, gap: 4 },
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
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
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
