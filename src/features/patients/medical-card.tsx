import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Divider, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useClinicSession } from '@/features/session/session-context';

import { patientRepository } from './repository';
import type { Patient, PatientMedical } from './types';
import { splitList } from './utils';

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, danger && styles.valueDanger]}>{value}</Text>
    </View>
  );
}

/**
 * Sağlık bilgileri kartı: yalnızca hekim yetkisiyle gösterilir (patient.medical null değilse).
 * Alerji kaydı değişince diğer personelin gördüğü "Alerji kaydı var" uyarısını
 * veritabanındaki tetikleyici günceller.
 */
export function MedicalCard({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const { clinic, can } = useClinicSession();
  const medical = patient.medical;
  const [editing, setEditing] = useState(false);
  const [allergies, setAllergies] = useState('');
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!medical) return null;

  const startEdit = () => {
    setAllergies(medical.allergies.join(', '));
    setConditions(medical.conditions.join(', '));
    setNotes(medical.clinicalNotes ?? '');
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const next: PatientMedical = {
      allergies: splitList(allergies),
      conditions: splitList(conditions),
      clinicalNotes: notes.trim() || undefined,
    };
    setSaving(true);
    setError(null);
    try {
      await patientRepository.saveMedical(clinic.id, patient.id, next);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sağlık bilgisi kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const removingAllergies =
    editing && medical.allergies.length > 0 && splitList(allergies).length === 0;

  return (
    <Card
      title="Sağlık bilgileri (yalnızca hekim)"
      action={
        can('saglik.detay.yaz') && !editing ? (
          <Button label="Düzenle" icon="create-outline" variant="secondary" onPress={startEdit} />
        ) : null
      }>
      {editing ? (
        <>
          <TextField
            label="Alerjiler"
            value={allergies}
            onChangeText={setAllergies}
            placeholder="Ör. Penisilin, Lateks"
            hint="Birden fazlaysa virgülle ayırın. Diğer personel yalnızca “Alerji kaydı var” uyarısını görür."
          />
          {removingAllergies ? (
            <Text style={styles.warn}>
              Tüm alerjileri siliyorsunuz: diğer personel artık alerji uyarısını görmeyecek.
            </Text>
          ) : null}
          <TextField
            label="Kronik hastalıklar / ilaçlar"
            value={conditions}
            onChangeText={setConditions}
            placeholder="Ör. Hipertansiyon, Kan sulandırıcı"
            hint="Birden fazlaysa virgülle ayırın."
          />
          <TextField
            label="Klinik not"
            value={notes}
            onChangeText={setNotes}
            placeholder="Yalnızca hekimlerin göreceği not"
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <Button
              label="Vazgeç"
              variant="secondary"
              onPress={() => setEditing(false)}
              disabled={saving}
            />
            <Button
              label={saving ? 'Kaydediliyor…' : 'Kaydet'}
              icon="checkmark"
              onPress={save}
              disabled={saving}
            />
          </View>
        </>
      ) : (
        <>
          <Row
            label="Alerjiler"
            value={medical.allergies.join(', ') || 'Kayıt yok'}
            danger={medical.allergies.length > 0}
          />
          <Divider />
          <Row
            label="Kronik hastalıklar / ilaçlar"
            value={medical.conditions.join(', ') || 'Kayıt yok'}
          />
          <Divider />
          <Row label="Klinik not" value={medical.clinicalNotes || '—'} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  label: { fontSize: 14, color: Colors.textSecondary },
  value: { fontSize: 14, color: Colors.text, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  valueDanger: { color: Colors.danger, fontWeight: '700' },
  warn: { fontSize: 13, color: Colors.warning },
  error: { fontSize: 13, color: Colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
