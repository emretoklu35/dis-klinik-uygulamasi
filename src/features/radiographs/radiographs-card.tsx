import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Segmented, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { validateTeeth } from '@/features/patients/treatments-card';
import type { Patient } from '@/features/patients/types';
import { formatDate } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import { formatDateInput, parseDateInput, todayKey } from '@/lib/dates';

import {
  kindLabels,
  purposeLabels,
  radiographRepository,
  type Radiograph,
  type RadiographKind,
  type RadiographPurpose,
} from './radiographs';

const purposeTone: Record<RadiographPurpose, 'warning' | 'success' | 'primary' | 'muted'> = {
  tedavi_oncesi: 'warning',
  tedavi_sonrasi: 'success',
  kontrol: 'primary',
  teshis: 'muted',
};

type Picked = { uri: string; width?: number };

// ----------------------------------------------------------------------------
// Yükleme formu
// ----------------------------------------------------------------------------
function UploadForm({
  patient,
  onDone,
  onCancel,
}: {
  patient: Patient;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic } = useClinicSession();
  const treatments = patient.treatments ?? [];
  const [picked, setPicked] = useState<Picked | null>(null);
  const [purpose, setPurpose] = useState<RadiographPurpose>('tedavi_oncesi');
  const [kind, setKind] = useState<RadiographKind>('panoramik');
  const [treatmentId, setTreatmentId] = useState<string>(treatments[0]?.id ?? 'yok');
  const [tooth, setTooth] = useState('');
  const [dateText, setDateText] = useState(formatDateInput(todayKey()));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pick = async (from: 'galeri' | 'kamera') => {
    setError(null);
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    };
    if (from === 'kamera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Kamera izni verilmedi.');
        return;
      }
    }
    const res =
      from === 'kamera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    const type = a.mimeType ?? '';
    if (type && !['image/jpeg', 'image/png'].includes(type)) {
      setError('Yalnızca JPEG veya PNG görüntü yüklenebilir (DICOM bu sürümde yok).');
      return;
    }
    setPicked({ uri: a.uri, width: a.width });
  };

  const save = async () => {
    const date = parseDateInput(dateText);
    if (!picked) return setError('Önce görüntü seçin.');
    if (!date) return setError('GG.AA.YYYY biçiminde geçerli bir tarih girin.');
    if (date > todayKey()) return setError('Çekim tarihi ileri bir tarih olamaz.');
    const teeth = validateTeeth(tooth);
    if (teeth.error) return setError(teeth.error);

    setSaving(true);
    setError(null);
    try {
      await radiographRepository.upload(clinic.id, patient.id, {
        sourceUri: picked.uri,
        sourceWidth: picked.width,
        purpose,
        kind,
        treatmentId: treatmentId === 'yok' ? undefined : treatmentId,
        tooth: teeth.value,
        takenOn: date,
        note: note.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Röntgen yüklenemedi.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Yeni röntgen</Text>

      <View style={styles.pickRow}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="contain" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          </View>
        )}
        <View style={{ gap: Spacing.sm, flex: 1 }}>
          <Button
            label={picked ? 'Başka görüntü seç' : 'Görüntü seç'}
            icon="images-outline"
            variant="secondary"
            onPress={() => pick('galeri')}
          />
          {Platform.OS !== 'web' ? (
            <Button
              label="Kamera ile çek"
              icon="camera-outline"
              variant="secondary"
              onPress={() => pick('kamera')}
            />
          ) : null}
          <Text style={styles.hint}>
            JPEG/PNG. Görüntü küçültülür ve dosyaya gömülü bilgiler (konum, cihazın yazdığı ad vb.)
            silinir.
          </Text>
        </View>
      </View>

      <Segmented
        label="Amaç"
        value={purpose}
        options={(Object.keys(purposeLabels) as RadiographPurpose[]).map((p) => ({
          value: p,
          label: purposeLabels[p],
        }))}
        onChange={setPurpose}
      />
      <Segmented
        label="Tür"
        value={kind}
        options={(Object.keys(kindLabels) as RadiographKind[]).map((k) => ({
          value: k,
          label: kindLabels[k],
        }))}
        onChange={setKind}
      />
      {treatments.length > 0 ? (
        <Segmented
          label="Bağlı tedavi"
          value={treatmentId}
          options={[
            { value: 'yok', label: 'Bağlama' },
            ...treatments.map((t) => ({
              value: t.id,
              label: `${t.procedure}${t.tooth ? ` · ${t.tooth}` : ''} · ${formatDate(t.date)}`,
            })),
          ]}
          onChange={setTreatmentId}
        />
      ) : null}
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Çekim tarihi"
            value={dateText}
            onChangeText={setDateText}
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
            placeholder="Panoramikte boş bırakın"
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Yükleniyor…' : 'Röntgeni kaydet'}
          icon="cloud-upload-outline"
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Büyük görüntüleme ve öncesi/sonrası karşılaştırma
// ----------------------------------------------------------------------------
function Viewer({
  items,
  treatmentLabel,
  onClose,
  onInvalidate,
}: {
  items: Radiograph[];
  treatmentLabel?: string;
  onClose: () => void;
  onInvalidate?: (r: Radiograph) => void;
}) {
  const isWide = useIsWideLayout();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerBar}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {items.length > 1
              ? `Karşılaştırma${treatmentLabel ? ` · ${treatmentLabel}` : ''}`
              : 'Röntgen'}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={[
            styles.viewerBody,
            isWide && items.length > 1 && styles.viewerBodyWide,
          ]}>
          {items.map((r) => (
            <View key={r.id} style={[styles.viewerItem, isWide && items.length > 1 && { flex: 1 }]}>
              <View style={styles.viewerMeta}>
                <Badge label={purposeLabels[r.purpose]} tone={purposeTone[r.purpose]} />
                <Text style={styles.viewerMetaText}>
                  {kindLabels[r.kind]} · {formatDate(r.takenOn)}
                  {r.tooth ? ` · Diş ${r.tooth}` : ''}
                </Text>
              </View>
              {r.url ? (
                <Image source={{ uri: r.url }} style={styles.viewerImage} contentFit="contain" />
              ) : (
                <Text style={styles.viewerMetaText}>Görüntü açılamadı.</Text>
              )}
              {r.note ? <Text style={styles.viewerMetaText}>{r.note}</Text> : null}
              {onInvalidate && !r.invalid ? (
                confirmId === r.id ? (
                  <View style={styles.actions}>
                    <Button label="Vazgeç" variant="secondary" onPress={() => setConfirmId(null)} />
                    <Button
                      label="Evet, geçersiz say"
                      variant="danger"
                      onPress={() => onInvalidate(r)}
                    />
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmId(r.id)} accessibilityRole="button">
                    <Text style={styles.invalidLink}>
                      Yanlış görüntü mü? Geçersiz olarak işaretle
                    </Text>
                  </Pressable>
                )
              ) : null}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Kart
// ----------------------------------------------------------------------------
/** Röntgenler: yalnızca hekim (rontgen.oku). Diğer rollerde hiç çizilmez. */
export function RadiographsCard({
  patient,
  radiographs,
  onChanged,
}: {
  patient: Patient;
  radiographs: Radiograph[];
  onChanged: () => void;
}) {
  const { can } = useClinicSession();
  const [uploading, setUploading] = useState(false);
  const [viewing, setViewing] = useState<{ items: Radiograph[]; label?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!can('rontgen.oku')) return null;

  const treatments = patient.treatments ?? [];
  const valid = radiographs.filter((r) => !r.invalid);

  // Öncesi ve bitim röntgeni olan tedaviler için karşılaştırma kısayolu
  const comparisons = treatments
    .map((t) => {
      const before = valid.find((r) => r.treatmentId === t.id && r.purpose === 'tedavi_oncesi');
      const after = valid.find((r) => r.treatmentId === t.id && r.purpose === 'tedavi_sonrasi');
      return before && after ? { t, before, after } : null;
    })
    .filter((x) => x !== null);

  const invalidate = async (r: Radiograph) => {
    try {
      await radiographRepository.invalidate(r.id);
      setViewing(null);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Röntgen güncellenemedi.');
    }
  };

  return (
    <Card
      title={`Röntgenler (yalnızca hekim)${valid.length ? ` · ${valid.length}` : ''}`}
      action={
        can('rontgen.yaz') && !uploading ? (
          <Button
            label="Röntgen ekle"
            icon="add"
            variant="secondary"
            onPress={() => setUploading(true)}
          />
        ) : null
      }>
      {uploading ? (
        <UploadForm
          patient={patient}
          onCancel={() => setUploading(false)}
          onDone={() => {
            setUploading(false);
            onChanged();
          }}
        />
      ) : null}

      {comparisons.map(({ t, before, after }) => (
        <Pressable
          key={t.id}
          onPress={() =>
            setViewing({
              items: [before, after],
              label: `${t.procedure}${t.tooth ? ` · Diş ${t.tooth}` : ''}`,
            })
          }
          accessibilityRole="button"
          style={({ pressed }) => [styles.compare, pressed && { opacity: 0.7 }]}>
          <Ionicons name="git-compare-outline" size={18} color={Colors.primary} />
          <Text style={styles.compareText}>
            Öncesi / bitim karşılaştır: {t.procedure}
            {t.tooth ? ` · Diş ${t.tooth}` : ''}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </Pressable>
      ))}

      {radiographs.length === 0 && !uploading ? (
        <Text style={styles.hint}>Henüz röntgen yok.</Text>
      ) : (
        <View style={styles.grid}>
          {radiographs.map((r) => {
            const t = treatments.find((x) => x.id === r.treatmentId);
            return (
              <Pressable
                key={r.id}
                onPress={() => setViewing({ items: [r] })}
                accessibilityRole="button"
                accessibilityLabel={`${purposeLabels[r.purpose]} ${kindLabels[r.kind]} ${formatDate(r.takenOn)}`}
                style={({ pressed }) => [
                  styles.tile,
                  r.invalid && styles.tileInvalid,
                  pressed && { opacity: 0.7 },
                ]}>
                {r.url ? (
                  <Image
                    source={{ uri: r.url }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={150}
                  />
                ) : (
                  <View style={[styles.thumb, styles.previewEmpty]} />
                )}
                <View style={styles.tileBody}>
                  <Badge
                    label={r.invalid ? 'Geçersiz' : purposeLabels[r.purpose]}
                    tone={r.invalid ? 'muted' : purposeTone[r.purpose]}
                  />
                  <Text style={styles.tileText} numberOfLines={1}>
                    {kindLabels[r.kind]} · {formatDate(r.takenOn)}
                  </Text>
                  {t ? (
                    <Text style={styles.tileSub} numberOfLines={1}>
                      {t.procedure}
                      {t.tooth ? ` · ${t.tooth}` : ''}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {viewing ? (
        <Viewer
          items={viewing.items}
          treatmentLabel={viewing.label}
          onClose={() => setViewing(null)}
          onInvalidate={can('rontgen.yaz') ? invalidate : undefined}
        />
      ) : null}
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
  pickRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', flexWrap: 'wrap' },
  preview: { width: 160, height: 90, borderRadius: Radius.sm, backgroundColor: '#111' },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 220 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  hint: { fontSize: 12, color: Colors.textMuted },
  error: { fontSize: 13, color: Colors.danger },
  compare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  compareText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: {
    width: 200,
    flexGrow: 1,
    maxWidth: 260,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  tileInvalid: { opacity: 0.45 },
  thumb: { width: '100%', height: 110, backgroundColor: '#111' },
  tileBody: { padding: Spacing.sm, gap: 4 },
  tileText: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  tileSub: { fontSize: 12, color: Colors.textSecondary },
  viewer: { flex: 1, backgroundColor: '#0B0D12' },
  viewerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  viewerTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', flex: 1 },
  viewerBody: { padding: Spacing.lg, gap: Spacing.xl },
  viewerBodyWide: { flexDirection: 'row' },
  viewerItem: { gap: Spacing.sm },
  viewerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  viewerMetaText: { color: '#C9CED8', fontSize: 13 },
  viewerImage: { width: '100%', aspectRatio: 2, backgroundColor: '#000' },
  invalidLink: { color: '#F87171', fontSize: 13, textDecorationLine: 'underline' },
});
