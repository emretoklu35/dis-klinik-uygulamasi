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
  reviewLabels,
  type MediaRequest,
  type Radiograph,
  type RadiographKind,
  type RadiographPurpose,
  type ReviewStatus,
} from './radiographs';

const purposeTone: Record<RadiographPurpose, 'warning' | 'success' | 'primary' | 'muted'> = {
  tedavi_oncesi: 'warning',
  tedavi_sonrasi: 'success',
  kontrol: 'primary',
  teshis: 'muted',
};

const reviewTone: Record<ReviewStatus, 'warning' | 'success' | 'danger'> = {
  inceleme_bekliyor: 'warning',
  onaylandi: 'success',
  tekrar_istendi: 'danger',
};

type Picked = { uri: string; width?: number };
type Prefill = {
  kind: RadiographKind;
  purpose: RadiographPurpose;
  tooth?: string;
  request: MediaRequest;
};

// ----------------------------------------------------------------------------
// Yükleme formu (asistan ve hekim)
// ----------------------------------------------------------------------------
function UploadForm({
  patient,
  prefill,
  onDone,
  onCancel,
}: {
  patient: Patient;
  prefill?: Prefill;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic, can } = useClinicSession();
  const canSeeMedia = can('rontgen.oku');
  // Tedaviye bağlama yalnızca hekim (tedavi listesi zaten yalnızca ona gelir).
  const treatments = can('rontgen.yaz') ? (patient.treatments ?? []) : [];
  const [picked, setPicked] = useState<Picked | null>(null);
  const [purpose, setPurpose] = useState<RadiographPurpose>(prefill?.purpose ?? 'tedavi_oncesi');
  const [kind, setKind] = useState<RadiographKind>(prefill?.kind ?? 'panoramik');
  const [treatmentId, setTreatmentId] = useState<string>('yok');
  const [tooth, setTooth] = useState(prefill?.tooth ?? '');
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
      await radiographRepository.upload(
        clinic.id,
        patient.id,
        {
          sourceUri: picked.uri,
          sourceWidth: picked.width,
          purpose,
          kind,
          treatmentId: treatmentId === 'yok' ? undefined : treatmentId,
          tooth: teeth.value,
          takenOn: date,
          note: note.trim() || undefined,
          requestId: prefill?.request.id,
        },
        canSeeMedia,
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Görüntü yüklenemedi.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{prefill ? 'Tekrar çekim yükle' : 'Yeni görüntü'}</Text>
      {prefill ? (
        <Text style={styles.requestReason}>Hekimin notu: “{prefill.request.reason}”</Text>
      ) : null}

      <View style={styles.pickRow}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={styles.preview} contentFit="contain" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Ionicons name="image-outline" size={28} color={Colors.textMuted} />
          </View>
        )}
        <View style={{ gap: Spacing.sm, flex: 1, minWidth: 200 }}>
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
        label="Tür"
        value={kind}
        options={(Object.keys(kindLabels) as RadiographKind[]).map((k) => ({
          value: k,
          label: kindLabels[k],
        }))}
        onChange={setKind}
      />
      <Segmented
        label="Amaç"
        value={purpose}
        options={(Object.keys(purposeLabels) as RadiographPurpose[]).map((p) => ({
          value: p,
          label: purposeLabels[p],
        }))}
        onChange={setPurpose}
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
      {!canSeeMedia ? (
        <Text style={styles.hint}>
          Yüklediğiniz görüntüyü hekim inceler. Görüntüleri yalnızca hekimler görebilir.
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Yükleniyor…' : 'Yükle'}
          icon="cloud-upload-outline"
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Görüntüleyici: büyük görüntü, karşılaştırma ve hekim incelemesi
// ----------------------------------------------------------------------------
function ReviewActions({ r, onChanged }: { r: Radiograph; onChanged: () => void }) {
  const [askingRetake, setAskingRetake] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = async (status: ReviewStatus, note?: string) => {
    setBusy(true);
    setError(null);
    try {
      await radiographRepository.review(r.id, status, note);
      setAskingRetake(false);
      setReason('');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İnceleme kaydedilemedi.');
    } finally {
      setBusy(false);
    }
  };

  if (r.invalid) return null;
  return (
    <View style={{ gap: Spacing.sm }}>
      {askingRetake ? (
        // Koyu görüntüleyici zemininde okunabilir olsun diye açık renkli panel
        <View style={styles.retakePanel}>
          <TextField
            label="Tekrar çekim sebebi (asistan görür)"
            value={reason}
            onChangeText={setReason}
            placeholder="Ör. Bulanık çıktı, 36 tekrar periapikal"
          />
          <View style={styles.actions}>
            <Button label="Vazgeç" variant="secondary" onPress={() => setAskingRetake(false)} />
            <Button
              label="Tekrar çekim iste"
              icon="refresh"
              variant="danger"
              disabled={busy || !reason.trim()}
              onPress={() => review('tekrar_istendi', reason.trim())}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          {r.reviewStatus !== 'onaylandi' ? (
            <Button
              label="Onayla"
              icon="checkmark"
              disabled={busy}
              onPress={() => review('onaylandi')}
            />
          ) : null}
          {r.reviewStatus !== 'tekrar_istendi' ? (
            <Button
              label="Tekrar çekim iste"
              icon="refresh"
              variant="secondary"
              disabled={busy}
              onPress={() => setAskingRetake(true)}
            />
          ) : null}
        </View>
      )}
      {error ? <Text style={styles.errorOnDark}>{error}</Text> : null}
    </View>
  );
}

function Viewer({
  items,
  title,
  canReview,
  onClose,
  onChanged,
}: {
  items: Radiograph[];
  title?: string;
  canReview: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const isWide = useIsWideLayout();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const invalidate = async (r: Radiograph) => {
    await radiographRepository.invalidate(r.id);
    onChanged();
  };
  const side = isWide && items.length > 1;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewer}>
        <View style={styles.viewerBar}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {title ?? 'Görüntü'}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.viewerBody, side && styles.viewerBodyWide]}>
          {items.map((r) => (
            <View key={r.id} style={[styles.viewerItem, side && { flex: 1 }]}>
              <View style={styles.viewerMeta}>
                <Badge label={purposeLabels[r.purpose]} tone={purposeTone[r.purpose]} />
                <Badge
                  label={r.invalid ? 'Geçersiz' : reviewLabels[r.reviewStatus]}
                  tone={r.invalid ? 'muted' : reviewTone[r.reviewStatus]}
                />
                <Text style={styles.viewerMetaText}>
                  {kindLabels[r.kind]} · {formatDate(r.takenOn)}
                  {r.tooth ? ` · Diş ${r.tooth}` : ''}
                  {r.uploadedByName ? ` · Yükleyen: ${r.uploadedByName}` : ''}
                </Text>
              </View>
              {r.url ? (
                <Image source={{ uri: r.url }} style={styles.viewerImage} contentFit="contain" />
              ) : (
                <Text style={styles.viewerMetaText}>Görüntü açılamadı.</Text>
              )}
              {r.note ? <Text style={styles.viewerMetaText}>Not: {r.note}</Text> : null}
              {r.reviewNote ? (
                <Text style={styles.viewerMetaText}>Hekim notu: {r.reviewNote}</Text>
              ) : null}
              {canReview ? <ReviewActions r={r} onChanged={onChanged} /> : null}
              {canReview && !r.invalid ? (
                confirmId === r.id ? (
                  <View style={styles.actions}>
                    <Button label="Vazgeç" variant="secondary" onPress={() => setConfirmId(null)} />
                    <Button
                      label="Evet, geçersiz say"
                      variant="danger"
                      onPress={() => invalidate(r)}
                    />
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmId(r.id)} accessibilityRole="button">
                    <Text style={styles.invalidLink}>
                      Yanlış hasta / yanlış görüntü mü? Geçersiz işaretle
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
// Medya kartı
// ----------------------------------------------------------------------------
/**
 * Hekim: tüm görüntüler, inceleme (onayla / tekrar çekim iste), karşılaştırma.
 * Asistan: yükleme ve açık tekrar çekim istekleri; görüntüleri GÖRMEZ.
 * Diğer roller: kart hiç çizilmez.
 */
export function MediaCard({
  patient,
  radiographs,
  requests,
  onChanged,
}: {
  patient: Patient;
  radiographs: Radiograph[];
  requests: MediaRequest[];
  onChanged: () => void;
}) {
  const { can } = useClinicSession();
  const canView = can('rontgen.oku');
  const canReview = can('rontgen.yaz');
  const canUpload = can('medya.yukle');
  const [uploading, setUploading] = useState<{ prefill?: Prefill } | null>(null);
  const [viewingIds, setViewingIds] = useState<{ ids: string[]; title?: string } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  if (!canView && !canUpload) return null;

  const treatments = patient.treatments ?? [];
  const valid = radiographs.filter((r) => !r.invalid);
  const pending = valid.filter((r) => r.reviewStatus === 'inceleme_bekliyor').length;
  // Görüntüleyici açıkken liste yenilenirse güncel kaydı göstersin
  const viewing = viewingIds
    ? viewingIds.ids
        .map((id) => radiographs.find((r) => r.id === id))
        .filter((r) => r !== undefined)
    : [];

  const comparisons = treatments
    .map((t) => {
      const before = valid.find((r) => r.treatmentId === t.id && r.purpose === 'tedavi_oncesi');
      const after = valid.find((r) => r.treatmentId === t.id && r.purpose === 'tedavi_sonrasi');
      return before && after ? { t, before, after } : null;
    })
    .filter((x) => x !== null);

  return (
    <Card
      title={canView ? `Medya${valid.length ? ` · ${valid.length}` : ''}` : 'Medya'}
      action={
        canUpload && !uploading ? (
          <Button
            label="Görüntü yükle"
            icon="add"
            variant="secondary"
            onPress={() => setUploading({})}
          />
        ) : null
      }>
      {done ? (
        <View style={styles.doneBox}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.doneText}>{done}</Text>
        </View>
      ) : null}

      {/* Açık tekrar çekim istekleri: hem hekim hem asistan görür */}
      {requests.map((q) => (
        <View key={q.id} style={styles.request}>
          <Ionicons name="refresh-circle" size={22} color={Colors.danger} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.requestTitle}>
              Tekrar çekim istendi: {kindLabels[q.kind]}
              {q.tooth ? ` · Diş ${q.tooth}` : ''}
            </Text>
            <Text style={styles.requestReason}>
              “{q.reason}” · {formatDate(q.requestedAt)}
            </Text>
          </View>
          {canUpload && !uploading ? (
            <Button
              label="Şimdi yükle"
              icon="cloud-upload-outline"
              onPress={() =>
                setUploading({
                  prefill: { kind: q.kind, purpose: q.purpose, tooth: q.tooth, request: q },
                })
              }
            />
          ) : null}
        </View>
      ))}

      {uploading ? (
        <UploadForm
          key={uploading.prefill?.request.id ?? 'yeni'}
          patient={patient}
          prefill={uploading.prefill}
          onCancel={() => setUploading(null)}
          onDone={() => {
            setUploading(null);
            setDone(
              canView ? 'Görüntü yüklendi.' : 'Görüntü yüklendi ve hekim incelemesine gönderildi.',
            );
            onChanged();
          }}
        />
      ) : null}

      {!canView ? (
        <Text style={styles.hint}>
          Görüntüleri yalnızca hekimler görür. Hekim bir görüntüyü beğenmezse tekrar çekim isteği
          burada görünür.
        </Text>
      ) : (
        <>
          {pending > 0 ? (
            <Text style={styles.pending}>{pending} görüntü incelemenizi bekliyor.</Text>
          ) : null}

          {comparisons.map(({ t, before, after }) => (
            <Pressable
              key={t.id}
              onPress={() =>
                setViewingIds({
                  ids: [before.id, after.id],
                  title: `Karşılaştırma · ${t.procedure}${t.tooth ? ` · Diş ${t.tooth}` : ''}`,
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

          {radiographs.length === 0 ? (
            <Text style={styles.hint}>Henüz görüntü yok.</Text>
          ) : (
            <View style={styles.grid}>
              {radiographs.map((r) => {
                const t = treatments.find((x) => x.id === r.treatmentId);
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => setViewingIds({ ids: [r.id], title: kindLabels[r.kind] })}
                    accessibilityRole="button"
                    accessibilityLabel={`${purposeLabels[r.purpose]} ${kindLabels[r.kind]} ${formatDate(r.takenOn)}, ${reviewLabels[r.reviewStatus]}`}
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
                      <View style={styles.badges}>
                        <Badge
                          label={r.invalid ? 'Geçersiz' : purposeLabels[r.purpose]}
                          tone={r.invalid ? 'muted' : purposeTone[r.purpose]}
                        />
                        {!r.invalid ? (
                          <Badge
                            label={reviewLabels[r.reviewStatus]}
                            tone={reviewTone[r.reviewStatus]}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.tileText} numberOfLines={1}>
                        {kindLabels[r.kind]} · {formatDate(r.takenOn)}
                      </Text>
                      <Text style={styles.tileSub} numberOfLines={1}>
                        {t
                          ? `${t.procedure}${t.tooth ? ` · ${t.tooth}` : ''}`
                          : (r.uploadedByName ?? '')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {viewing.length > 0 ? (
        <Viewer
          items={viewing}
          title={viewingIds?.title}
          canReview={canReview}
          onClose={() => setViewingIds(null)}
          onChanged={onChanged}
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
  errorOnDark: { fontSize: 13, color: '#F87171' },
  pending: { fontSize: 13, fontWeight: '600', color: Colors.warning },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.successSoft,
  },
  doneText: { fontSize: 14, color: Colors.success, flexShrink: 1 },
  request: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
    flexWrap: 'wrap',
  },
  requestTitle: { fontSize: 14, fontWeight: '700', color: Colors.danger },
  requestReason: { fontSize: 13, color: Colors.textSecondary },
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
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
  retakePanel: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
});
