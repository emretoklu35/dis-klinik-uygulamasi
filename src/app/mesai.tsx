import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Chip, Divider, Segmented, TextField } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  attendanceRepository,
  clockOf,
  formatMinutes,
  monthRange,
  sourceLabels,
  useAttendance,
  useStaff,
  type AttendanceRecord,
  type StaffMember,
} from '@/features/attendance/attendance';
import { QrScanner } from '@/features/attendance/scanner';
import { useClinicSession } from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import {
  addDays,
  formatDateInput,
  formatDayLong,
  fromClinicLocal,
  parseDateInput,
  todayKey,
} from '@/lib/dates';

const TIME = /^([01]?\d|2[0-3])[:.]([0-5]\d)$/;
const normTime = (t: string) => {
  const m = t.trim().match(TIME);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};

// ----------------------------------------------------------------------------
// Düzeltme / elle kayıt penceresi (yalnızca yönetici ve sahip)
// ----------------------------------------------------------------------------
type EditTarget = { type: 'correct'; record: AttendanceRecord } | { type: 'add' };

function EditModal({
  target,
  staff,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  staff: StaffMember[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const rec = target.type === 'correct' ? target.record : null;
  const [memberId, setMemberId] = useState(rec?.memberId ?? '');
  const [day, setDay] = useState(formatDateInput(rec?.day ?? todayKey()));
  const [inText, setInText] = useState(rec ? clockOf(rec.checkIn) : '09:00');
  const [outText, setOutText] = useState(rec?.checkOut ? clockOf(rec.checkOut) : '');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const key = parseDateInput(day);
    const tin = normTime(inText);
    const tout = outText.trim() ? normTime(outText) : null;
    if (!memberId) return setError('Personel seçin.');
    if (!key) return setError('Günü GG.AA.YYYY biçiminde yazın.');
    if (!tin) return setError('Giriş saatini SS:DD biçiminde yazın (ör. 08:45).');
    if (outText.trim() && !tout) return setError('Çıkış saatini SS:DD biçiminde yazın.');
    if (!reason.trim()) return setError('Sebep yazın; düzeltme geçmişinde görünür.');
    const inIso = fromClinicLocal(`${key}T${tin}`);
    const outIso = tout ? fromClinicLocal(`${key}T${tout}`) : null;
    setSaving(true);
    setError(null);
    try {
      if (rec) await attendanceRepository.correct(rec.id, inIso, outIso, reason);
      else await attendanceRepository.add(memberId, inIso, outIso, reason);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.dialogScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{rec ? 'Kaydı düzelt' : 'Elle kayıt ekle'}</Text>
            {rec ? (
              <Text style={styles.muted}>
                {rec.memberName} · {formatDayLong(rec.day)} · şu an {clockOf(rec.checkIn)}–
                {clockOf(rec.checkOut)}
              </Text>
            ) : (
              <View style={styles.chips}>
                {staff.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    selected={memberId === s.id}
                    onPress={() => setMemberId(s.id)}
                  />
                ))}
              </View>
            )}
            <View style={styles.row}>
              <View style={styles.col}>
                <TextField
                  label="Gün"
                  value={day}
                  onChangeText={setDay}
                  placeholder="GG.AA.YYYY"
                  editable={!rec}
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label="Giriş"
                  value={inText}
                  onChangeText={setInText}
                  placeholder="08:45"
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label="Çıkış"
                  value={outText}
                  onChangeText={setOutText}
                  placeholder="18:00"
                  hint="Boş bırakılırsa açık kalır."
                />
              </View>
            </View>
            <TextField
              label="Sebep"
              required
              value={reason}
              onChangeText={setReason}
              placeholder="Ör. Çıkışı okutmayı unuttu, 18:00'de çıktı."
              multiline
            />
            <Text style={styles.muted}>
              Eski ve yeni saat ile düzelten kişi kalıcı olarak saklanır.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Button label="Vazgeç" variant="secondary" onPress={onClose} disabled={saving} />
              <Button
                label={saving ? 'Kaydediliyor…' : 'Kaydet'}
                icon="checkmark"
                onPress={save}
                disabled={saving}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// Kayıt satırı
// ----------------------------------------------------------------------------
function RecordRow({
  r,
  showName,
  onEdit,
}: {
  r: AttendanceRecord;
  showName?: boolean;
  onEdit?: (r: AttendanceRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  const corrected = r.changes.length > 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.recRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.recTitle}>
            {showName ? `${r.memberName} · ` : ''}
            {formatDayLong(r.day)}
          </Text>
          <Text style={styles.recTime}>
            {clockOf(r.checkIn)} –{' '}
            {r.checkOut ? clockOf(r.checkOut) : r.missingOut ? '?' : 'içeride'}
            {r.minutes > 0 ? <Text style={styles.muted}> · {formatMinutes(r.minutes)}</Text> : null}
          </Text>
        </View>
        <View style={styles.badges}>
          {r.missingOut ? <Badge label="Çıkış eksik" tone="danger" /> : null}
          {!r.checkOut && !r.missingOut ? <Badge label="İçeride" tone="success" /> : null}
          {corrected ? (
            <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" hitSlop={6}>
              <Badge label="Düzeltildi" tone="warning" />
            </Pressable>
          ) : (
            <Badge
              label={
                sourceLabels[r.inSource] + (r.outSource ? ` / ${sourceLabels[r.outSource]}` : '')
              }
              tone="muted"
            />
          )}
          {onEdit ? (
            <Pressable onPress={() => onEdit(r)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Düzelt</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {open
        ? r.changes.map((c, i) => (
            <View key={i} style={styles.change}>
              <Text style={styles.changeText}>
                {c.oldIn ? `${clockOf(c.oldIn)}–${clockOf(c.oldOut)}` : 'Kayıt yoktu'} →{' '}
                {clockOf(c.newIn)}–{clockOf(c.newOut)}
              </Text>
              <Text style={styles.muted}>
                “{c.reason}” · {c.changedByName} ·{' '}
                {new Date(c.changedAt).toLocaleString('tr-TR', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}

// ----------------------------------------------------------------------------
// Ekran
// ----------------------------------------------------------------------------
type ManagerView = 'bugun' | 'ay' | 'eksik';

export default function AttendanceScreen() {
  const router = useRouter();
  const isWide = useIsWideLayout();
  const { member, can } = useClinicSession();
  const isManager = can('mesai.yonet');
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const range = monthRange(month);
  // Eksik çıkışlar için önceki ayın sonu da gerekebilir: son 45 gün + seçili ay
  const back45 = fromClinicLocal(`${addDays(today, -45)}T00:00`);
  const fromIso = range.from < back45 ? range.from : back45;
  const { data, loading, error, reload } = useAttendance(fromIso, range.to);
  const { data: staff } = useStaff(isManager);

  const [scanning, setScanning] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [view, setView] = useState<ManagerView>('bugun');
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const inMonth = data.filter((r) => r.day.startsWith(month));
  const mine = data.filter((r) => r.memberId === member.id);
  const myMonth = mine.filter((r) => r.day.startsWith(month));
  const myToday = mine.filter((r) => r.day === today);
  const openToday = myToday.find((r) => !r.checkOut);
  const myTotal = myMonth.reduce((s, r) => s + (r.checkOut ? r.minutes : 0), 0);
  const myDays = new Set(myMonth.map((r) => r.day)).size;
  const missing = data.filter((r) => r.missingOut);

  const submit = async (code: string) => {
    setBusy(true);
    setResult(null);
    try {
      const r = await attendanceRepository.checkIn(code);
      setResult({
        ok: true,
        text:
          r.action === 'giris'
            ? `Giriş kaydedildi · ${clockOf(r.at)}`
            : `Çıkış kaydedildi · ${clockOf(r.at)} · bugün ${formatMinutes(r.minutes)}`,
      });
      setTyped('');
      setTyping(false);
      reload();
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Kayıt yapılamadı.' });
    } finally {
      setBusy(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const monthLabel = new Date(`${month}-15T12:00:00`).toLocaleDateString('tr-TR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={[styles.headerInner, isWide && styles.headerInnerWide]}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.title} accessibilityRole="header">
            Mesai Takibi
          </Text>
          {isManager ? (
            <Pressable
              onPress={() => router.push('/ayarlar/mesai-ekrani', { withAnchor: true })}
              accessibilityRole="button"
              accessibilityLabel="Mesai ekranları"
              hitSlop={10}
              style={styles.iconBtn}>
              <Ionicons name="tablet-portrait-outline" size={24} color={Colors.text} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={reload}
            accessibilityRole="button"
            accessibilityLabel="Yenile"
            hitSlop={10}
            style={styles.iconBtn}>
            <Ionicons name="refresh-outline" size={24} color={Colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, isWide && styles.contentWide]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.inner}>
          {/* ------------------------- Kendi mesaim ------------------------- */}
          {can('mesai.kendi') ? (
            <Card>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusIcon,
                    { backgroundColor: openToday ? Colors.successSoft : Colors.primarySoft },
                  ]}>
                  <Ionicons
                    name={openToday ? 'log-in-outline' : 'time-outline'}
                    size={26}
                    color={openToday ? Colors.success : Colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.statusTitle}>
                    {openToday
                      ? `İçeridesiniz · giriş ${clockOf(openToday.checkIn)}`
                      : myToday.length
                        ? `Bugün çıkış yaptınız · ${clockOf(myToday[0].checkOut)}`
                        : 'Bugün henüz giriş yok'}
                  </Text>
                  <Text style={styles.muted}>
                    {openToday
                      ? `Şimdiye kadar ${formatMinutes(openToday.minutes)}`
                      : myToday.length
                        ? `Bugün ${formatMinutes(myToday.reduce((s, r) => s + r.minutes, 0))}`
                        : 'Resepsiyondaki ekrandaki QR kodu okutun.'}
                  </Text>
                </View>
              </View>

              <View style={styles.actions}>
                <Button
                  label={openToday ? 'Çıkış için QR okut' : 'Giriş için QR okut'}
                  icon="qr-code-outline"
                  onPress={() => {
                    setResult(null);
                    setScanning(true);
                  }}
                  disabled={busy}
                />
                <Button
                  label="Kodu yaz"
                  icon="keypad-outline"
                  variant="secondary"
                  onPress={() => setTyping((v) => !v)}
                  disabled={busy}
                />
              </View>
              {typing ? (
                <View style={styles.inline}>
                  <TextInput
                    value={typed}
                    onChangeText={(v) => setTyped(v.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6 haneli kod"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="number-pad"
                    accessibilityLabel="Ekrandaki 6 haneli kod"
                    style={styles.codeInput}
                    onSubmitEditing={() => typed.length === 6 && submit(typed)}
                  />
                  <Button
                    label={busy ? 'Gönderiliyor…' : 'Gönder'}
                    onPress={() => submit(typed)}
                    disabled={busy || typed.length !== 6}
                  />
                </View>
              ) : null}
              {result ? (
                <View style={[styles.result, !result.ok && styles.resultError]}>
                  <Ionicons
                    name={result.ok ? 'checkmark-circle' : 'alert-circle'}
                    size={20}
                    color={result.ok ? Colors.success : Colors.danger}
                  />
                  <Text style={[styles.resultText, !result.ok && { color: Colors.danger }]}>
                    {result.text}
                  </Text>
                </View>
              ) : null}
            </Card>
          ) : null}

          {/* Ay seçimi */}
          <View style={styles.monthRow}>
            <Pressable
              onPress={() => shiftMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Önceki ay"
              style={styles.iconBtn}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </Pressable>
            <Text style={styles.monthText}>{monthLabel}</Text>
            <Pressable
              onPress={() => shiftMonth(1)}
              disabled={month >= today.slice(0, 7)}
              accessibilityRole="button"
              accessibilityLabel="Sonraki ay"
              style={[styles.iconBtn, month >= today.slice(0, 7) && { opacity: 0.3 }]}>
              <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          {can('mesai.kendi') ? (
            <Card title="Benim kayıtlarım">
              <Text style={styles.summary}>
                {formatMinutes(myTotal)} · {myDays} gün
              </Text>
              {loading && data.length === 0 ? (
                <ActivityIndicator color={Colors.primary} />
              ) : myMonth.length === 0 ? (
                <Text style={styles.muted}>Bu ay kayıt yok.</Text>
              ) : (
                myMonth.map((r, i) => (
                  <Fragment key={r.id}>
                    {i > 0 ? <Divider /> : null}
                    <RecordRow r={r} />
                  </Fragment>
                ))
              )}
              <Text style={styles.muted}>
                Hatalı bir kayıt varsa yöneticinize söyleyin; düzeltmeyi yönetici ya da sahip yapar.
              </Text>
            </Card>
          ) : null}

          {/* ------------------------- Yönetici ------------------------- */}
          {isManager ? (
            <Card
              title="Personel"
              action={
                <Button
                  label="Kayıt ekle"
                  icon="add"
                  variant="secondary"
                  onPress={() => setEdit({ type: 'add' })}
                />
              }>
              <Segmented
                label="Görünüm"
                value={view}
                options={[
                  { value: 'bugun', label: 'Bugün' },
                  { value: 'ay', label: 'Aylık özet' },
                  { value: 'eksik', label: `Eksikler (${missing.length})` },
                ]}
                onChange={setView}
              />

              {view === 'bugun'
                ? staff.map((s, i) => {
                    const recs = data.filter((r) => r.memberId === s.id && r.day === today);
                    const open = recs.find((r) => !r.checkOut);
                    return (
                      <Fragment key={s.id}>
                        {i > 0 ? <Divider /> : null}
                        <View style={styles.recRow}>
                          <Text style={[styles.recTitle, { flex: 1 }]}>{s.name}</Text>
                          {open ? (
                            <Badge label={`İçeride · ${clockOf(open.checkIn)}`} tone="success" />
                          ) : recs.length ? (
                            <Badge
                              label={`Çıktı · ${clockOf(recs[recs.length - 1].checkIn)}–${clockOf(recs[0].checkOut)}`}
                              tone="muted"
                            />
                          ) : (
                            <Badge label="Gelmedi" tone="warning" />
                          )}
                        </View>
                      </Fragment>
                    );
                  })
                : null}

              {view === 'ay'
                ? staff.map((s, i) => {
                    const recs = inMonth.filter((r) => r.memberId === s.id);
                    const total = recs.reduce((t, r) => t + (r.checkOut ? r.minutes : 0), 0);
                    const days = new Set(recs.map((r) => r.day)).size;
                    const miss = recs.filter((r) => r.missingOut).length;
                    const isOpen = expanded === s.id;
                    return (
                      <Fragment key={s.id}>
                        {i > 0 ? <Divider /> : null}
                        <Pressable
                          onPress={() => setExpanded(isOpen ? null : s.id)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: isOpen }}
                          style={styles.recRow}>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text style={styles.recTitle}>{s.name}</Text>
                            <Text style={styles.muted}>
                              {days} gün · {formatMinutes(total)}
                              {days ? ` · günlük ort. ${formatMinutes(total / days)}` : ''}
                            </Text>
                          </View>
                          {miss ? <Badge label={`${miss} eksik`} tone="danger" /> : null}
                          <Ionicons
                            name={isOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={Colors.textSecondary}
                          />
                        </Pressable>
                        {isOpen
                          ? recs.map((r) => (
                              <View key={r.id} style={styles.nested}>
                                <RecordRow
                                  r={r}
                                  onEdit={(x) => setEdit({ type: 'correct', record: x })}
                                />
                              </View>
                            ))
                          : null}
                      </Fragment>
                    );
                  })
                : null}

              {view === 'eksik' ? (
                missing.length === 0 ? (
                  <Text style={styles.muted}>Çıkışı eksik kayıt yok.</Text>
                ) : (
                  missing.map((r, i) => (
                    <Fragment key={r.id}>
                      {i > 0 ? <Divider /> : null}
                      <RecordRow
                        r={r}
                        showName
                        onEdit={(x) => setEdit({ type: 'correct', record: x })}
                      />
                    </Fragment>
                  ))
                )
              ) : null}
            </Card>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.demo}>Bu ekrandaki tüm bilgiler sahte demo verisidir.</Text>
        </View>
      </ScrollView>

      {scanning ? (
        <QrScanner
          onClose={() => setScanning(false)}
          onScanned={(d) => {
            setScanning(false);
            submit(d);
          }}
        />
      ) : null}
      {edit ? (
        <EditModal
          target={edit}
          staff={staff}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            reload();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EAF0',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerInnerWide: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: Colors.text, marginLeft: Spacing.xs },
  scroll: { flex: 1, backgroundColor: '#F4F5F7' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  contentWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: Spacing.lg },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  codeInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 4,
    color: Colors.text,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.successSoft,
  },
  resultError: { backgroundColor: Colors.dangerSoft },
  resultText: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.success },

  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    minWidth: 140,
    textAlign: 'center',
  },
  summary: { fontSize: 20, fontWeight: '700', color: Colors.text },

  recRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  recTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  recTime: { fontSize: 14, color: Colors.text },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  nested: { paddingLeft: Spacing.md, borderLeftWidth: 2, borderLeftColor: Colors.border },
  change: { gap: 2, padding: Spacing.sm, borderRadius: Radius.sm, backgroundColor: '#FFF8EB' },
  changeText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  link: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  muted: { fontSize: 13, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
  demo: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  dialog: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  col: { flexGrow: 1, flexBasis: 120 },
});
