/**
 * Not yazma penceresi: yeni not, düzeltme (24 saat içinde) ve ek not.
 * Tür, şablon, diş seçimi, favori cümleler, önemli/gizli işaretleri ve implant alanları.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Treatment } from '@/features/patients/types';
import { formatDate } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import { useStockItems } from '@/features/stock/stock';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import type { Json } from '@/lib/database.types';

import {
  canWriteKind,
  implantRows,
  kindHints,
  kindLabels,
  noteRepository,
  usePhrases,
  type Note,
  type NoteKind,
} from './notes';
import { Odontogram } from './odontogram';
import { isValidTooth } from './teeth';
import {
  emptyImplantRow,
  implantBody,
  NOTE_TEMPLATES,
  type ImplantRow,
  type NoteTemplate,
} from './templates';

export type ComposerMode =
  | { type: 'new'; kind?: NoteKind; teeth?: number[] }
  | { type: 'edit'; note: Note }
  | { type: 'addendum'; parent: Note };

const KIND_ORDER: NoteKind[] = ['klinik', 'randevu', 'odeme'];

// ----------------------------------------------------------------------------
// İmplant alanları
// ----------------------------------------------------------------------------
function ImplantEditor({
  rows,
  onChange,
}: {
  rows: ImplantRow[];
  onChange: (rows: ImplantRow[]) => void;
}) {
  const { can } = useClinicSession();
  const { data: stock } = useStockItems(can('stok.oku'));
  // Stoktaki implant partileri: seçilince marka ve parti dolar (geri çağırmada izlenebilirlik)
  const lots = stock
    .filter((i) => i.category === 'implant' && i.active)
    .flatMap((i) => i.lots.map((l) => ({ item: i, lot: l })));
  const set = (idx: number, patch: Partial<ImplantRow>) =>
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <View style={{ gap: Spacing.md }}>
      {rows.map((r, idx) => (
        <View key={idx} style={styles.implantRow}>
          <View style={styles.implantHead}>
            <Text style={styles.label}>İmplant {idx + 1}</Text>
            {rows.length > 1 ? (
              <Pressable
                onPress={() => onChange(rows.filter((_, i) => i !== idx))}
                accessibilityRole="button"
                accessibilityLabel={`İmplant ${idx + 1} satırını kaldır`}
                hitSlop={8}>
                <Ionicons name="close-circle-outline" size={20} color={Colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <View style={styles.fieldsRow}>
            <View style={styles.colS}>
              <TextField
                label="Diş"
                value={r.tooth}
                onChangeText={(v) => set(idx, { tooth: v.replace(/\D/g, '').slice(0, 2) })}
                keyboardType="number-pad"
                placeholder="46"
              />
            </View>
            <View style={styles.colL}>
              <TextField
                label="Marka / sistem"
                value={r.brand}
                onChangeText={(v) => set(idx, { brand: v })}
                placeholder="Ör. Demo İmplant"
              />
            </View>
          </View>
          <View style={styles.fieldsRow}>
            <View style={styles.colS}>
              <TextField
                label="Çap (mm)"
                value={r.diameter}
                onChangeText={(v) => set(idx, { diameter: v })}
                keyboardType="decimal-pad"
                placeholder="4.0"
              />
            </View>
            <View style={styles.colS}>
              <TextField
                label="Boy (mm)"
                value={r.length}
                onChangeText={(v) => set(idx, { length: v })}
                keyboardType="decimal-pad"
                placeholder="10"
              />
            </View>
            <View style={styles.colS}>
              <TextField
                label="Tork (N)"
                value={r.torque}
                onChangeText={(v) => set(idx, { torque: v })}
                keyboardType="number-pad"
                placeholder="30"
              />
            </View>
            <View style={styles.colS}>
              <TextField
                label="Parti no"
                value={r.lot}
                onChangeText={(v) => set(idx, { lot: v })}
                autoCapitalize="characters"
                placeholder="IMP-A10"
              />
            </View>
          </View>
          {lots.length > 0 ? (
            <View style={styles.chips}>
              {lots.map(({ item, lot }) => (
                <Chip
                  key={`${item.id}-${lot.lotNo}`}
                  label={`${item.name} · ${lot.lotNo}`}
                  selected={r.lot === lot.lotNo}
                  onPress={() =>
                    set(idx, { lot: lot.lotNo, brand: r.brand || item.supplier || item.name })
                  }
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}
      <Button
        label="İmplant ekle"
        icon="add"
        variant="secondary"
        onPress={() => onChange([...rows, emptyImplantRow()])}
      />
    </View>
  );
}

// ----------------------------------------------------------------------------
// Pencere
// ----------------------------------------------------------------------------
export function NoteComposer({
  patientId,
  mode,
  treatments,
  onClose,
  onSaved,
}: {
  patientId: string;
  mode: ComposerMode;
  /** Notu tedaviye bağlamak için (yalnızca hekim görür) */
  treatments: Treatment[] | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { clinic, can } = useClinicSession();
  const isWide = useIsWideLayout();
  const editing = mode.type === 'edit' ? mode.note : null;
  const parent = mode.type === 'addendum' ? mode.parent : null;
  const allowedKinds = KIND_ORDER.filter((k) => canWriteKind(can, k));
  const initialKind: NoteKind =
    editing?.kind ??
    parent?.kind ??
    (mode.type === 'new' && mode.kind && allowedKinds.includes(mode.kind)
      ? mode.kind
      : (allowedKinds[0] ?? 'randevu'));

  const initialImplants = editing ? implantRows(editing) : null;
  const [kind, setKind] = useState<NoteKind>(initialKind);
  const [template, setTemplate] = useState<string | undefined>(editing?.template);
  const [body, setBody] = useState(
    editing ? (initialImplants ? extraText(editing.body) : editing.body) : '',
  );
  const [teeth, setTeeth] = useState<number[]>(
    editing?.teeth ?? (mode.type === 'new' ? (mode.teeth ?? []) : []),
  );
  const [showTeeth, setShowTeeth] = useState(teeth.length > 0);
  const [important, setImportant] = useState(editing?.important ?? false);
  const [hidden, setHidden] = useState(false);
  const [treatmentId, setTreatmentId] = useState<string | undefined>();
  const [implants, setImplants] = useState<ImplantRow[]>(
    initialImplants
      ? initialImplants.map((r) => ({ ...emptyImplantRow(), ...r }))
      : [emptyImplantRow()],
  );
  const [newPhrase, setNewPhrase] = useState('');
  const [editPhrases, setEditPhrases] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: phrases, reload: reloadPhrases } = usePhrases();

  const structured = template === 'implant';
  const templates = NOTE_TEMPLATES.filter((t) => t.kind === kind);
  const title = editing ? 'Notu düzelt' : parent ? 'Ek not ekle' : 'Yeni not';
  const linkable = (treatments ?? [])
    .filter((t) => t.status !== 'tamamlandi' || t.date >= recentKey())
    .slice(0, 8);

  const pickTemplate = (t: NoteTemplate) => {
    if (template === t.key) {
      setTemplate(undefined);
      return;
    }
    setTemplate(t.key);
    if (!t.structured) setBody((b) => (b.trim() ? `${b.trimEnd()}\n${t.body}` : t.body));
  };

  const insertPhrase = (text: string) =>
    setBody((b) => (b.trim() ? `${b.trimEnd()}${b.endsWith('\n') ? '' : '\n'}${text}` : text));

  const toggleTooth = (n: number) =>
    setTeeth((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n].sort((a, b) => a - b)));

  const savePhrase = async () => {
    if (!newPhrase.trim()) return;
    try {
      await noteRepository.addPhrase(clinic.id, newPhrase);
      setNewPhrase('');
      reloadPhrases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Favori cümle eklenemedi.');
    }
  };
  const removePhrase = async (id: string) => {
    try {
      await noteRepository.removePhrase(id);
      reloadPhrases();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Favori cümle silinemedi.');
    }
  };

  const save = async () => {
    let finalBody = body;
    let finalTeeth = teeth;
    let data: Json | undefined = editing?.data;
    if (structured) {
      const filled = implants.filter((r) => r.tooth || r.brand || r.lot);
      if (filled.length === 0) return setError('En az bir implantın bilgisini girin.');
      const badTooth = filled.find((r) => !isValidTooth(Number(r.tooth)));
      if (badTooth) return setError(`Geçersiz diş numarası: “${badTooth.tooth || '—'}”.`);
      finalBody = implantBody(filled, body);
      finalTeeth = [...new Set([...teeth, ...filled.map((r) => Number(r.tooth))])].sort(
        (a, b) => a - b,
      );
      data = { implants: filled } as unknown as Json;
    }
    if (!finalBody.trim()) return setError('Not metnini yazın.');
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await noteRepository.update(editing.id, {
          body: finalBody,
          teeth: finalTeeth,
          important,
          data: structured ? data : undefined,
        });
      } else if (parent) {
        await noteRepository.addAddendum(clinic.id, parent, finalBody);
      } else {
        await noteRepository.create(clinic.id, patientId, {
          kind,
          body: finalBody,
          teeth: finalTeeth,
          important,
          hidden: kind === 'klinik' && hidden,
          template,
          data: structured ? data : undefined,
          treatmentId,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      animationType={isWide ? 'fade' : 'slide'}
      transparent={isWide}
      presentationStyle={isWide ? 'overFullScreen' : 'pageSheet'}
      onRequestClose={onClose}>
      <View style={[styles.backdrop, isWide && styles.backdropWide]}>
        <SafeAreaView style={[styles.sheet, isWide && styles.sheetWide]} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                hitSlop={10}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {parent ? (
                <View style={styles.parentBox}>
                  <Text style={styles.parentLabel}>
                    Ana not · {parent.authorName} · {formatDate(parent.createdAt)}
                  </Text>
                  <Text style={styles.parentText} numberOfLines={4}>
                    {parent.body}
                  </Text>
                  <Text style={styles.hint}>
                    Ek not ana notu değiştirmez; altına tarihli olarak eklenir.
                  </Text>
                </View>
              ) : null}

              {/* Tür: yalnızca yeni notta seçilir */}
              {mode.type === 'new' ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Not türü</Text>
                  <View style={styles.chips}>
                    {allowedKinds.map((k) => (
                      <Chip
                        key={k}
                        label={kindLabels[k]}
                        selected={kind === k}
                        onPress={() => {
                          setKind(k);
                          setTemplate(undefined);
                          if (k !== 'klinik') setHidden(false);
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.hint}>{kindHints[kind]}</Text>
                </View>
              ) : null}

              {mode.type === 'new' && templates.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Şablon</Text>
                  <View style={styles.chips}>
                    {templates.map((t) => (
                      <Chip
                        key={t.key}
                        label={t.label}
                        selected={template === t.key}
                        onPress={() => pickTemplate(t)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {structured ? <ImplantEditor rows={implants} onChange={setImplants} /> : null}

              <View style={{ gap: 6 }}>
                <Text style={styles.label}>{structured ? 'Ek açıklama' : 'Not'}</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  multiline
                  textAlignVertical="top"
                  placeholder={
                    structured
                      ? 'Ör. Greft uygulandı, iyileşme başlığı takıldı.'
                      : 'Ne yapıldı, neye bakıldı?'
                  }
                  placeholderTextColor={Colors.textMuted}
                  accessibilityLabel="Not metni"
                  style={styles.textarea}
                  autoFocus={!structured && mode.type !== 'new'}
                />
                <Text style={styles.hint}>
                  Sesle yazmak için klavyedeki mikrofon simgesini kullanabilirsiniz.
                </Text>
              </View>

              {/* Favori cümleler: kişiseldir, yalnızca kendiniz görürsünüz */}
              <View style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.label}>Favori cümleler</Text>
                  <Pressable
                    onPress={() => setEditPhrases((v) => !v)}
                    accessibilityRole="button"
                    hitSlop={8}>
                    <Text style={styles.link}>{editPhrases ? 'Bitti' : 'Düzenle'}</Text>
                  </Pressable>
                </View>
                <View style={styles.chips}>
                  {phrases.length === 0 && !editPhrases ? (
                    <Text style={styles.hint}>
                      Sık kullandığınız cümleleri “Düzenle” ile ekleyin.
                    </Text>
                  ) : null}
                  {phrases.map((p) => (
                    <Pressable
                      key={p.id}
                      onPress={() => (editPhrases ? removePhrase(p.id) : insertPhrase(p.text))}
                      accessibilityRole="button"
                      accessibilityLabel={
                        editPhrases ? `${p.text} cümlesini sil` : `${p.text} cümlesini ekle`
                      }
                      style={({ pressed }) => [styles.phrase, pressed && { opacity: 0.6 }]}>
                      <Ionicons
                        name={editPhrases ? 'trash-outline' : 'add'}
                        size={14}
                        color={editPhrases ? Colors.danger : Colors.primary}
                      />
                      <Text style={styles.phraseText}>{p.text}</Text>
                    </Pressable>
                  ))}
                </View>
                {editPhrases ? (
                  <View style={styles.phraseAdd}>
                    <TextInput
                      value={newPhrase}
                      onChangeText={setNewPhrase}
                      placeholder="Yeni favori cümle"
                      placeholderTextColor={Colors.textMuted}
                      accessibilityLabel="Yeni favori cümle"
                      style={styles.phraseInput}
                      onSubmitEditing={savePhrase}
                    />
                    <Button label="Ekle" icon="add" variant="secondary" onPress={savePhrase} />
                  </View>
                ) : null}
              </View>

              {!parent ? (
                <View style={{ gap: 6 }}>
                  <Pressable
                    onPress={() => setShowTeeth((v) => !v)}
                    accessibilityRole="button"
                    style={styles.rowBetween}>
                    <Text style={styles.label}>
                      Dişler{teeth.length ? `: ${teeth.join(', ')}` : ''}
                    </Text>
                    <Ionicons
                      name={showTeeth ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={Colors.textSecondary}
                    />
                  </Pressable>
                  {showTeeth ? (
                    <Odontogram selected={teeth} onPress={toggleTooth} compact showLegend={false} />
                  ) : (
                    <Text style={styles.hint}>
                      Notu dişe bağlarsanız diş şemasında o dişin geçmişinde görünür.
                    </Text>
                  )}
                </View>
              ) : null}

              {mode.type === 'new' && kind === 'klinik' && linkable.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.label}>Tedaviye bağla (isteğe bağlı)</Text>
                  <View style={styles.chips}>
                    {linkable.map((t) => (
                      <Chip
                        key={t.id}
                        label={`${t.procedure}${t.tooth ? ` · ${t.tooth}` : ''}`}
                        selected={treatmentId === t.id}
                        onPress={() => setTreatmentId((v) => (v === t.id ? undefined : t.id))}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {!parent ? (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Önemli not</Text>
                    <Text style={styles.hint}>
                      Hasta kartının en üstünde kırmızı işaretle görünür.
                    </Text>
                  </View>
                  <Switch
                    value={important}
                    onValueChange={setImportant}
                    trackColor={{ true: Colors.danger, false: Colors.border }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Önemli not"
                  />
                </View>
              ) : null}

              {mode.type === 'new' && kind === 'klinik' && can('not.gizli') ? (
                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Gizli not</Text>
                    <Text style={styles.hint}>
                      Yalnızca hekimler görür; asistan dahil diğer roller göremez.
                    </Text>
                  </View>
                  <Switch
                    value={hidden}
                    onValueChange={setHidden}
                    trackColor={{ true: Colors.primary, false: Colors.border }}
                    thumbColor="#FFFFFF"
                    accessibilityLabel="Gizli not"
                  />
                </View>
              ) : null}

              {editing ? (
                <Text style={styles.hint}>
                  Düzeltmede eski metin silinmez; not geçmişinde görünür.
                </Text>
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </ScrollView>

            <View style={styles.footer}>
              <Button label="Vazgeç" variant="secondary" onPress={onClose} disabled={saving} />
              <Button
                label={saving ? 'Kaydediliyor…' : editing ? 'Düzeltmeyi kaydet' : 'Kaydet'}
                icon="checkmark"
                onPress={save}
                disabled={saving}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/** Son 30 gün (bağlanabilecek tamamlanmış tedaviler için) */
function recentKey() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

/** İmplant notunun metninden yapılandırılmış satırları ayıklayıp yalnızca ek açıklamayı döndürür */
function extraText(body: string) {
  return body
    .split('\n')
    .filter((l, i) => i > 0 && !/^\d{2}: /.test(l))
    .join('\n');
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: Colors.surface },
  backdropWide: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  sheet: { flex: 1, backgroundColor: Colors.surface },
  sheetWide: {
    flex: 0,
    width: '100%',
    maxWidth: 720,
    height: '90%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textMuted },
  link: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  phrase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    maxWidth: '100%',
  },
  phraseText: { fontSize: 13, color: Colors.primary, flexShrink: 1 },
  phraseAdd: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  phraseInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.text,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  error: { fontSize: 13, color: Colors.danger },
  parentBox: {
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#F3F5F4',
  },
  parentLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  parentText: { fontSize: 14, color: Colors.text },
  implantRow: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FAFBFC',
  },
  implantHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  colS: { flexGrow: 1, flexBasis: 90 },
  colL: { flexGrow: 3, flexBasis: 180 },
});
