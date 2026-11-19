import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, Segmented, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { patientRepository } from '@/features/patients/repository';
import { useClinicSession } from '@/features/session/session-context';
import type { Gender } from '@/features/patients/types';
import { genderLabels, parseTurkishDate, splitList } from '@/features/patients/utils';

type Form = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  gender: Gender;
  allergies: string;
  conditions: string;
  clinicalNotes: string;
  adminNote: string;
};

type Errors = Partial<Record<keyof Form, string>>;

const empty: Form = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  birthDate: '',
  gender: 'belirtilmedi',
  allergies: '',
  conditions: '',
  clinicalNotes: '',
  adminNote: '',
};

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.firstName.trim()) e.firstName = 'Ad zorunludur.';
  if (!f.lastName.trim()) e.lastName = 'Soyad zorunludur.';
  const digits = f.phone.replace(/\D/g, '');
  if (!digits) e.phone = 'Telefon zorunludur.';
  else if (!/^0?5\d{9}$/.test(digits))
    e.phone = 'Geçerli bir cep telefonu girin (ör. 0500 000 00 00).';
  if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
    e.email = 'E-posta biçimi hatalı.';
  if (f.birthDate.trim() && !parseTurkishDate(f.birthDate))
    e.birthDate = 'GG.AA.YYYY biçiminde geçerli bir tarih girin.';
  return e;
}

/** "05000000001" → "0500 000 00 01" */
function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.length === 10) d = `0${d}`;
  if (d.length !== 11) return raw.trim();
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

export default function NewPatientScreen() {
  const router = useRouter();
  const { clinic, can } = useClinicSession();
  const canWriteMedical = can('saglik.detay.yaz');
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) => {
      const next = { ...form, [key]: value };
      setForm(next);
      // İlk kaydetme denemesinden sonra hatalar yazdıkça güncellenir.
      if (submitted) setErrors(validate(next));
    };

  const onSave = async () => {
    setSubmitted(true);
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const id = await patientRepository.create(clinic.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: formatPhone(form.phone),
        email: form.email.trim() || undefined,
        birthDate: form.birthDate.trim()
          ? (parseTurkishDate(form.birthDate) ?? undefined)
          : undefined,
        gender: form.gender,
        adminNote: form.adminNote.trim() || undefined,
        // Sağlık bilgisi yalnızca hekim yetkisiyle gönderilir (veritabanı da ayrıca denetler).
        medical: canWriteMedical
          ? {
              allergies: splitList(form.allergies),
              conditions: splitList(form.conditions),
              clinicalNotes: form.clinicalNotes.trim() || undefined,
            }
          : undefined,
      });
      router.replace({ pathname: '/hastalar/[id]', params: { id } });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Hasta kaydedilemedi. Lütfen tekrar deneyin.',
      );
      setSaving(false);
    }
  };

  const errorCount = Object.keys(errors).length;

  return (
    <Screen inStack>
      <Card title="Kişisel bilgiler">
        <View style={styles.row}>
          <View style={styles.col}>
            <TextField
              label="Ad"
              required
              value={form.firstName}
              onChangeText={set('firstName')}
              error={errors.firstName}
              autoCapitalize="words"
              autoComplete="off"
            />
          </View>
          <View style={styles.col}>
            <TextField
              label="Soyad"
              required
              value={form.lastName}
              onChangeText={set('lastName')}
              error={errors.lastName}
              autoCapitalize="words"
              autoComplete="off"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <TextField
              label="Doğum tarihi"
              value={form.birthDate}
              onChangeText={set('birthDate')}
              error={errors.birthDate}
              placeholder="GG.AA.YYYY"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
          </View>
          <View style={styles.col}>
            <Segmented
              label="Cinsiyet"
              value={form.gender}
              onChange={set('gender')}
              options={(Object.keys(genderLabels) as Gender[]).map((g) => ({
                value: g,
                label: genderLabels[g],
              }))}
            />
          </View>
        </View>
      </Card>

      <Card title="İletişim">
        <View style={styles.row}>
          <View style={styles.col}>
            <TextField
              label="Cep telefonu"
              required
              value={form.phone}
              onChangeText={set('phone')}
              error={errors.phone}
              placeholder="0500 000 00 00"
              keyboardType="phone-pad"
              autoComplete="off"
            />
          </View>
          <View style={styles.col}>
            <TextField
              label="E-posta"
              value={form.email}
              onChangeText={set('email')}
              error={errors.email}
              placeholder="ornek@ornek.test"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="off"
            />
          </View>
        </View>
      </Card>

      <Card title="İdari not">
        <TextField
          label="Not"
          value={form.adminNote}
          onChangeText={set('adminNote')}
          placeholder="Ör. Veli ile birlikte geliyor"
          hint="Tüm personel görür. Sağlıkla ilgili bilgi yazmayın."
          multiline
        />
      </Card>

      {canWriteMedical ? (
        <Card title="Sağlık bilgileri (yalnızca hekim)">
          <TextField
            label="Alerjiler"
            value={form.allergies}
            onChangeText={set('allergies')}
            placeholder="Ör. Penisilin, Lateks"
            hint="Birden fazlaysa virgülle ayırın. Diğer personel yalnızca “Alerji kaydı var” uyarısını görür."
          />
          <TextField
            label="Kronik hastalıklar / ilaçlar"
            value={form.conditions}
            onChangeText={set('conditions')}
            placeholder="Ör. Hipertansiyon, Kan sulandırıcı"
            hint="Birden fazlaysa virgülle ayırın."
          />
          <TextField
            label="Klinik not"
            value={form.clinicalNotes}
            onChangeText={set('clinicalNotes')}
            placeholder="Yalnızca hekimlerin göreceği not"
            multiline
          />
        </Card>
      ) : (
        <Text style={styles.footnote}>
          Alerji ve sağlık bilgilerini hekim, hasta kartından girer.
        </Text>
      )}

      {errorCount > 0 ? (
        <Text style={styles.formError}>Lütfen işaretli {errorCount} alanı düzeltin.</Text>
      ) : null}
      {saveError ? <Text style={styles.formError}>{saveError}</Text> : null}

      <View style={styles.actions}>
        <Button
          label="Vazgeç"
          variant="secondary"
          onPress={() => router.back()}
          disabled={saving}
        />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Hastayı kaydet'}
          icon="checkmark"
          onPress={onSave}
          disabled={saving}
        />
      </View>

      <Text style={styles.footnote}>
        Yerel geliştirme ortamı: yalnızca sahte veri girin. Gerçek hasta bilgisi girmeyin.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 260 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md, flexWrap: 'wrap' },
  formError: { fontSize: 14, color: Colors.danger, textAlign: 'right' },
  footnote: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
