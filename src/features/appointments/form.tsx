/**
 * Randevu formu (yeni ve düzenleme). Tam ekran çalışır: içerik kayar, altta İptal/Kaydet
 * sabit kalır. Seçimler (hasta, hekim, koltuk, tarih, saat, tür) alttan açılan pencereyle yapılır.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet, SheetOption } from '@/components/bottom-sheet';
import { Card, Chip } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { PatientAvatar } from '@/features/patients/components';
import { usePatientList } from '@/features/patients/hooks';
import { fullName } from '@/features/patients/utils';
import {
  useClinicSession,
  type ClinicInfo,
  type StaffRef,
} from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
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
  NO_PATIENT_LABEL,
  procedureSuggestions,
  timeSlots,
  visitTypeColors,
  visitTypeLabels,
  VISIT_TYPE_ORDER,
} from './clinic';
import { useAppointmentsRange } from './hooks';
import { conflictMessage, findConflicts, scheduleError } from './rules';
import type { AppointmentInput, VisitType } from './types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type AppointmentFormValues = {
  patient: { id: string; name: string; phone?: string } | null;
  /** Hasta seçmeden devam (hasta sonra bağlanır) */
  noPatient: boolean;
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
    noPatient: false,
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
type Sheet = 'patient' | 'doctor' | 'chair' | 'date' | 'time' | 'type' | null;

const MIN_DURATION = 15;
const MAX_DURATION = 240;

/** "0500 000 00 01" → "0500 *** ** 01" (ekranda tam numara gösterilmez) */
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return phone;
  return `${digits.slice(0, 4)} *** ** ${digits.slice(-2)}`;
}

function initialsOf(name: string) {
  return name
    .replace(/^(Dr\.|Dt\.)\s*/i, '')
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr-TR'))
    .join('');
}

function shortDate(key: string) {
  return new Date(`${key}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ----------------------------------------------------------------------------
// Küçük yapı taşları
// ----------------------------------------------------------------------------
function FieldLabel({
  icon,
  label,
  required,
}: {
  icon?: IconName;
  label: string;
  required?: boolean;
}) {
  return (
    <View style={styles.fieldLabel}>
      {icon ? <Ionicons name={icon} size={18} color={Colors.textSecondary} /> : null}
      <Text style={styles.fieldLabelText}>
        {label}
        {required ? <Text style={{ color: Colors.danger }}> *</Text> : null}
      </Text>
    </View>
  );
}

function SelectBox({
  children,
  onPress,
  accessibilityLabel,
  error,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  error?: boolean;
  style?: object;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.selectBox,
        error && { borderColor: Colors.danger },
        pressed && { opacity: 0.7 },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

function Initials({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initialsText}>{initialsOf(name) || '·'}</Text>
    </View>
  );
}

function Section({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: IconName;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color={Colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.primary} />
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Hasta seçme penceresi
// ----------------------------------------------------------------------------
export function PatientSheet({
  onPick,
  onClose,
}: {
  onPick: (p: { id: string; name: string; phone?: string }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const { data, loading } = usePatientList(query);
  return (
    <BottomSheet
      title="Hasta Seçin"
      onClose={onClose}
      header={
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="İsim veya telefon ile ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            autoFocus
            accessibilityLabel="Hasta ara"
          />
        </View>
      }>
      {data.slice(0, 40).map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPick({ id: p.id, name: fullName(p), phone: p.phone })}
          accessibilityRole="button"
          accessibilityLabel={fullName(p)}
          style={({ pressed }) => [styles.patientCard, pressed && { opacity: 0.7 }]}>
          <PatientAvatar patient={p} size={48} />
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={styles.patientName} numberOfLines={1}>
              {fullName(p)}
            </Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.phone}>{maskPhone(p.phone)}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </Pressable>
      ))}
      {!loading && data.length === 0 ? (
        <Text style={styles.hint}>
          Eşleşen hasta yok. Yeni hastayı Hastalar sekmesinden ekleyin.
        </Text>
      ) : null}
    </BottomSheet>
  );
}

// ----------------------------------------------------------------------------
// Form
// ----------------------------------------------------------------------------
export function AppointmentForm({
  initial,
  editingId,
  originalStart,
  submitLabel = 'Kaydet',
  onSubmit,
  onCancel,
  /** Düzenlemede hasta değiştirilemez (bağlanmışsa) */
  lockPatient = false,
}: {
  initial: AppointmentFormValues;
  /** Düzenlenen randevu (kendi saatiyle çakışmasın diye). */
  editingId?: string;
  /** Düzenlemede eski başlangıç; aynı kalırsa geçmiş saat kontrolü yapılmaz. */
  originalStart?: string;
  submitLabel?: string;
  onSubmit: (input: AppointmentInput) => Promise<void>;
  onCancel: () => void;
  lockPatient?: boolean;
}) {
  const { clinic, doctors, chairs, can } = useClinicSession();
  const insets = useSafeAreaInsets();
  const isWide = useIsWideLayout();
  const isClinician = can('tedavi.yaz');
  const [v, setV] = useState(initial);
  const [dateText, setDateText] = useState(formatDateInput(initial.date));
  const [durationText, setDurationText] = useState(String(initial.durationMin));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [openBasics, setOpenBasics] = useState(true);
  const [openClinical, setOpenClinical] = useState(!!(initial.procedure || initial.clinicalNote));
  const { data: dayAppointments } = useAppointmentsRange(v.date, v.date);
  const slots = useMemo(() => timeSlots(clinic), [clinic]);

  const set = <K extends keyof AppointmentFormValues>(key: K, value: AppointmentFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };
  const setDuration = (m: number) => {
    const clamped = Math.min(MAX_DURATION, Math.max(MIN_DURATION, m));
    set('durationMin', clamped);
    setDurationText(String(clamped));
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
  const doctor = doctors.find((d) => d.id === v.doctorMemberId);
  const chair = chairs.find((c) => c.id === v.chairId);

  const submit = async () => {
    const e: Errors = {};
    if (!v.patient && !v.noPatient)
      e.patient = 'Hasta seçin ya da “Hasta seçmeden devam et”e basın.';
    if (!isWorkingDay(v.date, clinic)) e.date = 'Klinik bu gün kapalı.';
    if (!v.doctorMemberId) e.doctor = 'Hekim seçin.';
    if (!v.time) e.time = 'Saat seçin.';
    else if (selectedProblem) e.time = selectedProblem;
    setErrors(e);
    if (Object.keys(e).length > 0 || !v.time) {
      setOpenBasics(true);
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        patientId: v.patient?.id ?? null,
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
      <View style={{ padding: Spacing.lg }}>
        <Card>
          <Text style={styles.error}>
            Randevu verebilmek için klinikte en az bir aktif hekim ve bir koltuk tanımlı olmalı.
          </Text>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          <Section
            icon="calendar-outline"
            title="Temel Bilgiler"
            open={openBasics}
            onToggle={() => setOpenBasics((o) => !o)}>
            {/* -------------------------- Hasta -------------------------- */}
            <View style={styles.field}>
              <FieldLabel icon="person-outline" label="Hasta" required />
              {v.patient ? (
                <View style={styles.selectBox}>
                  <PatientAvatar
                    patient={{
                      firstName: v.patient.name.split(' ')[0],
                      lastName: v.patient.name.split(' ').slice(1).join(' '),
                    }}
                    size={48}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.boxTitle}>{v.patient.name}</Text>
                    {v.patient.phone ? (
                      <Text style={styles.boxSub}>{maskPhone(v.patient.phone)}</Text>
                    ) : null}
                  </View>
                  {!lockPatient ? (
                    <Pressable
                      onPress={() => set('patient', null)}
                      accessibilityRole="button"
                      accessibilityLabel="Hastayı değiştir"
                      hitSlop={8}
                      style={styles.smallBtn}>
                      <Ionicons name="swap-horizontal" size={20} color={Colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              ) : v.noPatient ? (
                <View style={styles.selectBox}>
                  <View style={styles.noPatientIcon}>
                    <Ionicons name="remove" size={24} color={Colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.boxTitle}>{NO_PATIENT_LABEL}</Text>
                    <Text style={styles.boxSub}>Hasta sonra eklenebilir.</Text>
                  </View>
                  <Pressable
                    onPress={() => setSheet('patient')}
                    accessibilityRole="button"
                    accessibilityLabel="Hasta seç"
                    hitSlop={8}
                    style={styles.smallBtn}>
                    <Ionicons name="person-add-outline" size={20} color={Colors.primary} />
                  </Pressable>
                </View>
              ) : (
                <View
                  style={[
                    styles.patientChoice,
                    !!errors.patient && { borderColor: Colors.danger },
                  ]}>
                  <Pressable
                    onPress={() => setSheet('patient')}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.choiceBtn, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="person-add-outline" size={24} color={Colors.primary} />
                    <Text style={styles.choicePrimary}>Hasta Seçin</Text>
                  </Pressable>
                  <View style={styles.or}>
                    <View style={styles.orLine} />
                    <Text style={styles.orText}>veya</Text>
                    <View style={styles.orLine} />
                  </View>
                  <Pressable
                    onPress={() => set('noPatient', true)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.choiceBtn, pressed && { opacity: 0.6 }]}>
                    <Ionicons name="calendar-outline" size={22} color={Colors.textSecondary} />
                    <Text style={styles.choiceSecondary}>Hasta Seçmeden Devam Et</Text>
                  </Pressable>
                </View>
              )}
              {errors.patient ? <Text style={styles.error}>{errors.patient}</Text> : null}
            </View>

            {/* -------------------------- Hekim / Koltuk -------------------------- */}
            <View style={styles.field}>
              <FieldLabel icon="medkit-outline" label="Doktor" required />
              <SelectBox
                onPress={() => setSheet('doctor')}
                accessibilityLabel={`Doktor: ${doctor?.name ?? 'seçilmedi'}`}
                error={!!errors.doctor}>
                {doctor ? <Initials name={doctor.name} /> : null}
                <Text style={[styles.boxTitle, { flex: 1 }]}>{doctor?.name ?? 'Hekim seçin'}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
              </SelectBox>
              {errors.doctor ? <Text style={styles.error}>{errors.doctor}</Text> : null}
            </View>

            {chairs.length > 1 ? (
              <View style={styles.field}>
                <FieldLabel icon="easel-outline" label="Koltuk" />
                <SelectBox
                  onPress={() => setSheet('chair')}
                  accessibilityLabel={`Koltuk: ${chair?.name ?? 'seçilmedi'}`}>
                  <Text style={[styles.boxTitle, { flex: 1 }]}>
                    {chair?.name ?? 'Koltuk seçin'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                </SelectBox>
              </View>
            ) : null}

            {/* -------------------------- Tarih & Saat -------------------------- */}
            <View style={styles.field}>
              <FieldLabel icon="calendar-number-outline" label="Tarih & Saat" required />
              <View style={styles.twoCols}>
                <SelectBox
                  onPress={() => setSheet('date')}
                  accessibilityLabel={`Tarih: ${formatDayLong(v.date)}`}
                  error={!!errors.date}
                  style={styles.halfBox}>
                  <Ionicons name="calendar-outline" size={22} color={Colors.primary} />
                  <Text style={styles.boxValue} numberOfLines={1}>
                    {shortDate(v.date)}
                  </Text>
                </SelectBox>
                <SelectBox
                  onPress={() => setSheet('time')}
                  accessibilityLabel={`Saat: ${v.time ?? 'seçilmedi'}`}
                  error={!!errors.time || !!selectedProblem}
                  style={styles.halfBox}>
                  <Ionicons name="time-outline" size={22} color={Colors.primary} />
                  <Text
                    style={[styles.boxValue, !v.time && { color: Colors.textMuted }]}
                    numberOfLines={1}>
                    {v.time ?? 'Saat seçin'}
                  </Text>
                </SelectBox>
              </View>
              {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
              {errors.time || selectedProblem ? (
                <Text style={styles.error}>{errors.time ?? selectedProblem}</Text>
              ) : (
                <Text style={styles.hint}>
                  {formatDayLong(v.date)} · {freeCount} uygun saat
                </Text>
              )}
            </View>

            {/* -------------------------- Süre -------------------------- */}
            <View style={styles.field}>
              <FieldLabel icon="time-outline" label="Süre" />
              <View style={styles.stepper}>
                <Pressable
                  onPress={() => setDuration(v.durationMin - 15)}
                  disabled={v.durationMin <= MIN_DURATION}
                  accessibilityRole="button"
                  accessibilityLabel="Süreyi 15 dakika azalt"
                  style={[styles.stepBtn, v.durationMin <= MIN_DURATION && { opacity: 0.4 }]}>
                  <Ionicons name="remove" size={24} color={Colors.primary} />
                </Pressable>
                <View style={styles.stepValue}>
                  <TextInput
                    value={durationText}
                    onChangeText={(t) => setDurationText(t.replace(/\D/g, '').slice(0, 3))}
                    onBlur={() => setDuration(Number(durationText) || v.durationMin)}
                    keyboardType="number-pad"
                    accessibilityLabel="Süre (dakika)"
                    style={styles.stepInput}
                  />
                  <Text style={styles.stepUnit}>dk</Text>
                </View>
                <Pressable
                  onPress={() => setDuration(v.durationMin + 15)}
                  disabled={v.durationMin >= MAX_DURATION}
                  accessibilityRole="button"
                  accessibilityLabel="Süreyi 15 dakika artır"
                  style={[styles.stepBtn, v.durationMin >= MAX_DURATION && { opacity: 0.4 }]}>
                  <Ionicons name="add" size={24} color={Colors.primary} />
                </Pressable>
              </View>
              <View style={styles.durationChips}>
                {durationOptions.map((m) => {
                  const on = v.durationMin === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setDuration(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.durationChip, on && styles.durationChipOn]}>
                      <Text style={[styles.durationText, on && { color: '#FFFFFF' }]}>{m} dk</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* -------------------------- Tür -------------------------- */}
            <View style={styles.field}>
              <FieldLabel label="Tür" required />
              <SelectBox
                onPress={() => setSheet('type')}
                accessibilityLabel={`Tür: ${visitTypeLabels[v.visitType]}`}>
                <View style={[styles.dot, { backgroundColor: visitTypeColors[v.visitType] }]} />
                <Text style={[styles.boxTitle, { flex: 1 }]}>{visitTypeLabels[v.visitType]}</Text>
                <Ionicons name="chevron-down" size={20} color={Colors.primary} />
              </SelectBox>
            </View>

            {/* -------------------------- Açıklama -------------------------- */}
            <View style={styles.field}>
              <FieldLabel icon="reorder-three-outline" label="Açıklama" />
              <TextInput
                value={v.deskNote}
                onChangeText={(t) => set('deskNote', t)}
                placeholder="Açıklama Ekle"
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Açıklama"
                style={styles.textarea}
              />
              <Text style={styles.hint}>Tüm personel görür. Sağlıkla ilgili bilgi yazmayın.</Text>
            </View>

            {/* -------------------------- SMS (henüz bağlı değil) -------------------------- */}
            <View style={styles.smsBox}>
              <Ionicons name="chatbubble-outline" size={24} color={Colors.textMuted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.boxTitle, { color: Colors.textSecondary }]}>
                  Randevu SMS&apos;i Gönder
                </Text>
                <Text style={styles.boxSub}>
                  Yakında: SMS servisi bağlandığında hasta hatırlatma alacak.
                </Text>
              </View>
              <Switch
                value={false}
                disabled
                accessibilityLabel="Randevu SMS'i gönder, henüz kullanılamaz"
                trackColor={{ true: Colors.primary, false: Colors.border }}
                thumbColor="#FFFFFF"
              />
            </View>
          </Section>

          {isClinician ? (
            <Section
              icon="medical-outline"
              title="İşlem ayrıntısı (yalnızca hekim)"
              open={openClinical}
              onToggle={() => setOpenClinical((o) => !o)}>
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
              <TextInput
                value={v.procedure}
                onChangeText={(t) => set('procedure', t)}
                placeholder="İşlem (öneriden seçin ya da yazın)"
                placeholderTextColor={Colors.textMuted}
                accessibilityLabel="İşlem"
                style={styles.input}
              />
              <TextInput
                value={v.clinicalNote}
                onChangeText={(t) => set('clinicalNote', t)}
                placeholder="Klinik not (yalnızca hekimler görür)"
                placeholderTextColor={Colors.textMuted}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Klinik not"
                style={styles.textarea}
              />
            </Section>
          ) : null}

          {errors.form ? (
            <View style={styles.formError}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.formErrorText}>{errors.form}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Altta sabit: İptal / Kaydet */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <View style={[styles.footerInner, isWide && { maxWidth: 760 }]}>
          <Pressable
            onPress={onCancel}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cancelText}>İptal</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [styles.saveBtn, (pressed || saving) && { opacity: 0.7 }]}>
            <Text style={styles.saveText}>{saving ? 'Kaydediliyor…' : submitLabel}</Text>
          </Pressable>
        </View>
      </View>

      {/* -------------------------- Seçim pencereleri -------------------------- */}
      {sheet === 'patient' ? (
        <PatientSheet
          onClose={() => setSheet(null)}
          onPick={(p) => {
            setV((prev) => ({ ...prev, patient: p, noPatient: false }));
            setErrors((er) => ({ ...er, patient: undefined }));
            setSheet(null);
          }}
        />
      ) : null}

      {sheet === 'doctor' ? (
        <BottomSheet title="Doktor" onClose={() => setSheet(null)}>
          {doctors.map((d) => (
            <SheetOption
              key={d.id}
              label={d.name}
              left={<Initials name={d.name} size={40} />}
              selected={v.doctorMemberId === d.id}
              onPress={() => {
                set('doctorMemberId', d.id);
                setSheet(null);
              }}
            />
          ))}
        </BottomSheet>
      ) : null}

      {sheet === 'chair' ? (
        <BottomSheet title="Koltuk" onClose={() => setSheet(null)}>
          {chairs.map((c) => (
            <SheetOption
              key={c.id}
              label={c.name}
              selected={v.chairId === c.id}
              onPress={() => {
                set('chairId', c.id);
                setSheet(null);
              }}
            />
          ))}
        </BottomSheet>
      ) : null}

      {sheet === 'type' ? (
        <BottomSheet title="Tür" onClose={() => setSheet(null)}>
          {VISIT_TYPE_ORDER.map((t) => (
            <SheetOption
              key={t}
              label={visitTypeLabels[t]}
              left={<View style={[styles.dot, { backgroundColor: visitTypeColors[t] }]} />}
              selected={v.visitType === t}
              onPress={() => {
                set('visitType', t);
                setSheet(null);
              }}
            />
          ))}
        </BottomSheet>
      ) : null}

      {sheet === 'date' ? (
        <BottomSheet title="Tarih" onClose={() => setSheet(null)}>
          <Text style={styles.sheetLabel}>Yakın günler</Text>
          <View style={styles.chips}>
            {nextWorkingDays(12, clinic).map((d) => (
              <Chip
                key={d}
                label={d === todayKey() ? 'Bugün' : formatDayShort(d)}
                selected={v.date === d}
                onPress={() => {
                  set('date', d);
                  setDateText(formatDateInput(d));
                  setSheet(null);
                }}
              />
            ))}
          </View>
          <Text style={styles.sheetLabel}>Başka bir gün</Text>
          <TextInput
            value={dateText}
            onChangeText={(t) => {
              setDateText(t);
              const key = parseDateInput(t);
              if (key) set('date', key);
            }}
            placeholder="GG.AA.YYYY"
            placeholderTextColor={Colors.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            accessibilityLabel="Tarih (GG.AA.YYYY)"
            style={styles.input}
          />
          <Text style={styles.hint}>
            {parseDateInput(dateText)
              ? `${formatDayLong(v.date)}${isWorkingDay(v.date, clinic) ? '' : ' · klinik kapalı'}`
              : 'GG.AA.YYYY biçiminde yazın.'}
          </Text>
        </BottomSheet>
      ) : null}

      {sheet === 'time' ? (
        <BottomSheet title={`Saat · ${formatDayLong(v.date)}`} onClose={() => setSheet(null)}>
          <Text style={styles.hint}>
            {freeCount} uygun saat · {doctor?.name ?? ''} · {v.durationMin} dk. Soluk saatler dolu
            ya da uygun değil.
          </Text>
          <View style={styles.slots}>
            {slots.map((t) => {
              const problem = slotProblems.get(t);
              const on = v.time === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => {
                    if (problem) return;
                    set('time', t);
                    setSheet(null);
                  }}
                  disabled={!!problem && !on}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: !!problem }}
                  accessibilityHint={problem}
                  style={[styles.slot, on && styles.slotOn, !!problem && !on && styles.slotOff]}>
                  <Text
                    style={[
                      styles.slotText,
                      on && { color: '#FFFFFF' },
                      !!problem && !on && styles.slotTextOff,
                    ]}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const BORDER = '#D3DDD9';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F5F4' },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  scrollWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: Spacing.lg },

  section: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: '#F7F9F8',
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E7E5',
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { flex: 1, fontSize: 17, fontFamily: Fonts.headingSemi, color: Colors.text },
  sectionBody: { padding: Spacing.lg, gap: Spacing.lg },

  field: { gap: Spacing.sm },
  fieldLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fieldLabelText: { fontSize: 15, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },

  selectBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: '#F7F9F8',
  },
  boxTitle: { fontSize: 16, fontFamily: Fonts.bodySemi, color: Colors.text },
  boxSub: { fontSize: 14, color: Colors.textSecondary },
  boxValue: { fontSize: 16, fontFamily: Fonts.bodySemi, color: Colors.text },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2F7',
  },
  initials: { backgroundColor: '#DDF1EE', alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.primaryDeep },
  noPatientIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DDF1EE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  patientChoice: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.sm,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 56,
  },
  choicePrimary: { fontSize: 17, fontFamily: Fonts.bodySemi, color: Colors.primary },
  choiceSecondary: { fontSize: 16, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  or: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: '#D3DDD9' },
  orText: { fontSize: 14, color: Colors.textMuted },

  twoCols: { flexDirection: 'row', gap: Spacing.md },
  halfBox: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.md, gap: Spacing.sm },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
  },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F1F5FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepInput: {
    minWidth: 84,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#D3DDD9',
    textAlign: 'center',
    fontSize: 24,
    color: Colors.text,
  },
  stepUnit: { fontSize: 15, color: Colors.textMuted },
  // Beş süre düğmesi telefonda tek satıra sığsın
  durationChips: { flexDirection: 'row', gap: Spacing.sm },
  durationChip: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  durationText: { fontSize: 15, color: Colors.text },

  dot: { width: 16, height: 16, borderRadius: 8 },
  textarea: {
    minHeight: 110,
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
    fontSize: 16,
    color: Colors.text,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
    fontSize: 16,
    color: Colors.text,
  },
  smsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: Colors.surface,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  hint: { fontSize: 13, color: Colors.textMuted },
  error: { fontSize: 13, color: Colors.danger },
  formError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerSoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  formErrorText: { fontSize: 14, color: Colors.danger, flexShrink: 1 },

  footer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E2E7E5',
  },
  footerInner: { flexDirection: 'row', gap: Spacing.md, width: '100%', alignSelf: 'center' },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 16, fontFamily: Fonts.bodySemi, color: Colors.primary },
  saveBtn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 16, fontFamily: Fonts.bodyBold, color: '#FFFFFF' },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D3DDD9',
    backgroundColor: '#F7F9F8',
  },
  searchInput: { flex: 1, minHeight: 52, fontSize: 16, color: Colors.text },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E7E5',
    backgroundColor: '#F7F9F8',
  },
  patientName: { fontSize: 16, fontFamily: Fonts.bodySemi, color: Colors.text },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phone: { fontSize: 14, color: Colors.textSecondary },
  sheetLabel: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.textSecondary },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  slot: {
    width: 76,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F7F9F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotOff: { backgroundColor: '#EEF1F0', borderColor: '#ECEEF1' },
  slotText: { fontSize: 15, fontFamily: Fonts.bodySemi, color: Colors.text },
  slotTextOff: { color: '#B5BCC6', textDecorationLine: 'line-through' },
});
