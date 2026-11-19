/**
 * Seansı kapat: randevu bitince yapılanlar, ücretler, kullanılan malzemeler, seans notu ve
 * sonraki adım tek ekranda girilir ve TEK İŞLEMDE kaydedilir (veritabanında close_visit).
 * Yalnızca hekim kapatabilir.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Badge,
  Button,
  Card,
  CenteredMessage,
  Chip,
  Divider,
  Screen,
  TextField,
} from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { visitTypeLabels } from '@/features/appointments/clinic';
import { useAppointment } from '@/features/appointments/hooks';
import { closeVisit, isVisitClosed, usePatientNotes } from '@/features/notes/notes';
import { Odontogram } from '@/features/notes/odontogram';
import { parseTeeth } from '@/features/notes/teeth';
import { NOTE_TEMPLATES } from '@/features/notes/templates';
import { usePatient } from '@/features/patients/hooks';
import type { Treatment } from '@/features/patients/types';
import { fullName, normalizeForSearch, treatmentStatusLabels } from '@/features/patients/utils';
import { usePatientAccount, usePriceList, type PriceItem } from '@/features/payments/payments';
import { useClinicSession } from '@/features/session/session-context';
import { formatQty, useStockItems, type StockItem } from '@/features/stock/stock';
import { addDays, formatDayLong, todayKey } from '@/lib/dates';
import { formatTL } from '@/lib/money';

type Extra = {
  key: string;
  procedure: string;
  tooth: string;
  priceItemId?: string;
  amount?: number;
};
type Usage = { itemId: string; quantity: number; lotNo?: string };

const FOLLOW_UPS: { label: string; days: number }[] = [
  { label: '1 hafta', days: 7 },
  { label: '2 hafta', days: 14 },
  { label: '1 ay', days: 30 },
  { label: '3 ay', days: 90 },
  { label: '6 ay', days: 180 },
];

/** Tedavi adına en iyi uyan fiyat listesi kalemi ("Kanal tedavisi (1. seans)" → "Kanal tedavisi") */
function matchPrice(procedure: string, prices: PriceItem[]) {
  const p = normalizeForSearch(procedure);
  return prices
    .filter((i) => i.active && p.startsWith(normalizeForSearch(i.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
}

/** Son kullanma tarihi en yakın, süresi geçmemiş parti (önce o kullanılır) */
function firstLot(item: StockItem) {
  const today = todayKey();
  return item.lots.find((l) => l.quantity > 0 && (!l.expiryDate || l.expiryDate >= today))?.lotNo;
}

export default function CloseVisitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can } = useClinicSession();
  const { data: appt, loading: apptLoading } = useAppointment(id);
  const { data: patient } = usePatient(appt?.patientId ?? undefined);
  const { data: notes, loading: notesLoading } = usePatientNotes(appt?.patientId ?? undefined);
  const { data: prices } = usePriceList(can('odeme.yaz'));
  const { data: account } = usePatientAccount(appt?.patientId ?? undefined);
  const { data: stock } = useStockItems(can('stok.kullanim'));

  const [done, setDone] = useState<Set<string> | null>(null);
  const [chargeOff, setChargeOff] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Extra[]>([]);
  const [freeText, setFreeText] = useState('');
  const [usage, setUsage] = useState<Usage[]>([]);
  const [stockQuery, setStockQuery] = useState('');
  const [body, setBody] = useState('');
  const [manualTeeth, setManualTeeth] = useState<number[]>([]);
  const [showTeeth, setShowTeeth] = useState(false);
  const [important, setImportant] = useState(false);
  const [followTitle, setFollowTitle] = useState('');
  const [followDays, setFollowDays] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ dueDate?: string } | null>(null);

  if (!can('seans.kapat')) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="lock-closed-outline" title="Seansı yalnızca hekim kapatabilir." />
        </Card>
      </Screen>
    );
  }
  if (appt && !appt.patientId) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage
            icon="person-add-outline"
            title="Bu randevuya henüz hasta bağlanmamış."
            text="Seansı kapatmadan önce randevu ayrıntısından “Hasta bağla” ile hastayı seçin."
          />
        </Card>
      </Screen>
    );
  }
  if ((apptLoading && !appt) || !patient || (notesLoading && notes.length === 0 && !appt)) {
    return (
      <Screen inStack>
        {!apptLoading && !appt ? (
          <Card>
            <CenteredMessage icon="calendar-outline" title="Randevu bulunamadı." />
          </Card>
        ) : (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
        )}
      </Screen>
    );
  }
  if (!appt) return null;

  const open: Treatment[] = (patient.treatments ?? []).filter((t) => t.status !== 'tamamlandi');
  // Varsayılan: randevudaki işlemle aynı adlı açık tedavi işaretli gelir
  const plannedProc = normalizeForSearch(appt.clinical?.procedure ?? '');
  const selected =
    done ??
    new Set(
      open
        .filter((t) => plannedProc && normalizeForSearch(t.procedure).startsWith(plannedProc))
        .map((t) => t.id),
    );
  const toggleDone = (tid: string) => {
    const next = new Set(selected);
    if (next.has(tid)) next.delete(tid);
    else next.add(tid);
    setDone(next);
  };

  const alreadyCharged = (name: string, tooth?: string) =>
    (account?.charges ?? []).some(
      (c) =>
        !c.cancelled &&
        normalizeForSearch(c.description) === normalizeForSearch(name) &&
        (c.tooth ?? '') === (tooth ?? ''),
    );

  const doneList = open.filter((t) => selected.has(t.id));
  const charges = can('odeme.yaz')
    ? doneList
        .map((t) => ({ t, price: matchPrice(t.procedure, prices) }))
        .filter(
          (x) => x.price && !chargeOff.has(x.t.id) && !alreadyCharged(x.price.name, x.t.tooth),
        )
    : [];

  const autoTeeth = [
    ...doneList.flatMap((t) => parseTeeth(t.tooth)),
    ...extras.flatMap((e) => parseTeeth(e.tooth)),
  ];
  const teeth = [...new Set([...autoTeeth, ...manualTeeth])].sort((a, b) => a - b);
  const remaining = open.filter((t) => !selected.has(t.id));
  const total =
    charges.reduce((s, c) => s + c.price!.amount, 0) +
    extras.reduce((s, e) => s + (e.amount ?? 0), 0);
  const closed = isVisitClosed(notes, appt.id);

  const stockMatches = stockQuery.trim()
    ? stock.filter(
        (i) =>
          i.active &&
          i.quantity > 0 &&
          !usage.some((u) => u.itemId === i.id) &&
          normalizeForSearch(i.name).includes(normalizeForSearch(stockQuery)),
      )
    : [];
  const addUsage = (item: StockItem) => {
    setUsage((u) => [
      ...u,
      { itemId: item.id, quantity: 1, lotNo: item.trackLots ? firstLot(item) : undefined },
    ]);
    setStockQuery('');
  };
  const setQty = (itemId: string, delta: number) =>
    setUsage((u) =>
      u.map((x) => (x.itemId === itemId ? { ...x, quantity: Math.max(1, x.quantity + delta) } : x)),
    );

  const addExtra = (price?: PriceItem) => {
    const procedure = price ? price.name : freeText.trim();
    if (!procedure) return;
    setExtras((x) => [
      ...x,
      {
        key: `${Date.now()}-${x.length}`,
        procedure,
        tooth: '',
        priceItemId: price?.id,
        amount: price?.amount,
      },
    ]);
    if (!price) setFreeText('');
  };

  const submit = async () => {
    const missingLot = usage.find((u) => {
      const item = stock.find((i) => i.id === u.itemId);
      return item?.trackLots && !u.lotNo;
    });
    if (missingLot) return setError('Parti takipli malzemede hangi partinin kullanıldığını seçin.');
    if (doneList.length === 0 && extras.length === 0 && !body.trim())
      return setError('Yapılan bir işlem işaretleyin ya da seans notu yazın.');
    const dueDate = followDays ? addDays(todayKey(), followDays) : undefined;
    setSaving(true);
    setError(null);
    try {
      await closeVisit(appt.id, {
        doneTreatmentIds: doneList.map((t) => t.id),
        newTreatments: extras.map((e) => ({
          procedure: e.procedure,
          tooth: e.tooth.trim() || undefined,
          priceItemId: e.priceItemId,
          amount: can('odeme.yaz') ? e.amount : undefined,
        })),
        charges: charges.map((c) => ({
          treatmentId: c.t.id,
          priceItemId: c.price!.id,
          description: c.price!.name,
          tooth: c.t.tooth,
          amount: c.price!.amount,
        })),
        stock: usage,
        note: { body, teeth, important },
        followUp: followTitle.trim()
          ? {
              title: followTitle.trim(),
              taskTitle: `${fullName(patient)}: ${followTitle.trim()}`,
              dueDate,
            }
          : undefined,
      });
      setResult({ dueDate: followTitle.trim() ? dueDate : undefined });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Seans kapatılamadı.');
    } finally {
      setSaving(false);
    }
  };

  const backToPatient = () =>
    router.replace({ pathname: '/hastalar/[id]', params: { id: patient.id, sekme: 'notlar' } });

  // ------------------------------ Başarılı ------------------------------
  if (result) {
    return (
      <Screen inStack>
        <Stack.Screen options={{ title: 'Seans kapatıldı' }} />
        <Card>
          <CenteredMessage
            icon="checkmark-circle-outline"
            title="Seans kapatıldı"
            text="Tedaviler, ücretler, kullanılan malzemeler ve seans notu kaydedildi.">
            <View style={styles.actions}>
              {result.dueDate && can('randevu.yaz') ? (
                <Button
                  label="Sonraki randevuyu ver"
                  icon="calendar-outline"
                  variant="secondary"
                  onPress={() =>
                    router.push(
                      {
                        pathname: '/takvim/yeni',
                        params: { patientId: patient.id, date: result.dueDate! },
                      },
                      { withAnchor: true },
                    )
                  }
                />
              ) : null}
              <Button label="Hasta kartına dön" icon="person-outline" onPress={backToPatient} />
            </View>
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  if (closed) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="checkmark-done-outline" title="Bu seans zaten kapatılmış.">
            <Button label="Hasta kartına dön" variant="secondary" onPress={backToPatient} />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const klinikTemplates = NOTE_TEMPLATES.filter((t) => t.kind === 'klinik' && !t.structured);

  return (
    <Screen inStack>
      <Stack.Screen options={{ title: 'Seansı Kapat' }} />

      <Card>
        <Text style={styles.patient}>{fullName(patient)}</Text>
        <Text style={styles.sub}>
          {formatDayLong(appt.start.slice(0, 10))} {appt.start.slice(11, 16)} ·{' '}
          {visitTypeLabels[appt.visitType]} · {appt.doctorName} · {appt.chairName}
        </Text>
        {appt.clinical?.procedure ? (
          <Text style={styles.sub}>Planlanan işlem: {appt.clinical.procedure}</Text>
        ) : null}
      </Card>

      {/* 1. Yapılanlar */}
      <Card title="1. Yapılanlar">
        {open.length === 0 ? (
          <Text style={styles.muted}>Planlanan ya da devam eden tedavi yok.</Text>
        ) : (
          open.map((t, i) => {
            const on = selected.has(t.id);
            const price = matchPrice(t.procedure, prices);
            const charged = price ? alreadyCharged(price.name, t.tooth) : false;
            return (
              <View key={t.id} style={{ gap: 6 }}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() => toggleDone(t.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={styles.checkRow}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={on ? Colors.primary : Colors.textMuted}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {t.procedure}
                      {t.tooth ? <Text style={styles.tooth}> · {t.tooth}</Text> : null}
                    </Text>
                    <Text style={styles.muted}>{treatmentStatusLabels[t.status]}</Text>
                  </View>
                </Pressable>
                {on && can('odeme.yaz') ? (
                  price ? (
                    charged ? (
                      <Text style={styles.chargeNote}>
                        Ücreti daha önce hesaba eklenmiş ({price.name}).
                      </Text>
                    ) : (
                      <View style={styles.chargeRow}>
                        <Text style={styles.chargeText}>
                          Ücreti hesaba ekle · {formatTL(price.amount)}
                        </Text>
                        <Switch
                          value={!chargeOff.has(t.id)}
                          onValueChange={(v) =>
                            setChargeOff((s) => {
                              const n = new Set(s);
                              if (v) n.delete(t.id);
                              else n.add(t.id);
                              return n;
                            })
                          }
                          trackColor={{ true: Colors.primary, false: Colors.border }}
                          thumbColor="#FFFFFF"
                          accessibilityLabel={`${t.procedure} ücretini hesaba ekle`}
                        />
                      </View>
                    )
                  ) : (
                    <Text style={styles.chargeNote}>
                      Fiyat listesinde karşılığı yok; ücreti Ödemeler’den ekleyin.
                    </Text>
                  )
                ) : null}
              </View>
            );
          })
        )}

        <Divider />
        <Text style={styles.label}>Bugün yapılan başka işlem</Text>
        {extras.map((e) => (
          <View key={e.key} style={styles.extraRow}>
            <Text style={[styles.itemTitle, { flex: 1 }]}>
              {e.procedure}
              {e.amount !== undefined && can('odeme.yaz') ? (
                <Text style={styles.muted}> · {formatTL(e.amount)}</Text>
              ) : null}
            </Text>
            <TextInput
              value={e.tooth}
              onChangeText={(v) =>
                setExtras((x) => x.map((y) => (y.key === e.key ? { ...y, tooth: v } : y)))
              }
              placeholder="Diş"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel={`${e.procedure} diş numarası`}
              style={styles.toothInput}
            />
            <Pressable
              onPress={() => setExtras((x) => x.filter((y) => y.key !== e.key))}
              accessibilityRole="button"
              accessibilityLabel={`${e.procedure} işlemini kaldır`}
              hitSlop={8}>
              <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
            </Pressable>
          </View>
        ))}
        {can('odeme.yaz') && prices.length > 0 ? (
          <View style={styles.chips}>
            {prices
              .filter((p) => p.active)
              .map((p) => (
                <Chip key={p.id} label={p.name} onPress={() => addExtra(p)} />
              ))}
          </View>
        ) : null}
        <View style={styles.inline}>
          <TextInput
            value={freeText}
            onChangeText={setFreeText}
            placeholder="Listede olmayan işlem (ücretsiz)"
            placeholderTextColor={Colors.textMuted}
            accessibilityLabel="Listede olmayan işlem"
            style={styles.inlineInput}
            onSubmitEditing={() => addExtra()}
          />
          <Button label="Ekle" icon="add" variant="secondary" onPress={() => addExtra()} />
        </View>
      </Card>

      {/* 2. Kullanılan malzemeler */}
      {can('stok.kullanim') ? (
        <Card title="2. Kullanılan malzemeler">
          {usage.length === 0 ? (
            <Text style={styles.muted}>
              Seçtiğiniz malzemeler stoktan bu hastayla birlikte düşülür (implant partisi
              izlenebilir).
            </Text>
          ) : null}
          {usage.map((u) => {
            const item = stock.find((i) => i.id === u.itemId);
            if (!item) return null;
            return (
              <View key={u.itemId} style={styles.usage}>
                <View style={styles.usageHead}>
                  <Text style={[styles.itemTitle, { flex: 1 }]}>{item.name}</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      onPress={() => setQty(u.itemId, -1)}
                      accessibilityRole="button"
                      accessibilityLabel="Azalt"
                      style={styles.stepBtn}>
                      <Ionicons name="remove" size={18} color={Colors.primary} />
                    </Pressable>
                    <Text style={styles.qty}>{formatQty(u.quantity, item.unit)}</Text>
                    <Pressable
                      onPress={() => setQty(u.itemId, 1)}
                      accessibilityRole="button"
                      accessibilityLabel="Artır"
                      style={styles.stepBtn}>
                      <Ionicons name="add" size={18} color={Colors.primary} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => setUsage((x) => x.filter((y) => y.itemId !== u.itemId))}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} malzemesini kaldır`}
                    hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={22} color={Colors.textMuted} />
                  </Pressable>
                </View>
                {item.trackLots ? (
                  <View style={styles.chips}>
                    {item.lots
                      .filter((l) => l.quantity > 0)
                      .map((l) => (
                        <Chip
                          key={l.lotNo}
                          label={`Parti ${l.lotNo} · ${l.quantity} ${item.unit}`}
                          selected={u.lotNo === l.lotNo}
                          onPress={() =>
                            setUsage((x) =>
                              x.map((y) => (y.itemId === u.itemId ? { ...y, lotNo: l.lotNo } : y)),
                            )
                          }
                        />
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })}
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={Colors.textMuted} />
            <TextInput
              value={stockQuery}
              onChangeText={setStockQuery}
              placeholder="Malzeme ara (ör. eldiven, anestezik)"
              placeholderTextColor={Colors.textMuted}
              accessibilityLabel="Malzeme ara"
              style={styles.searchInput}
            />
          </View>
          {stockMatches.slice(0, 6).map((i) => (
            <Pressable
              key={i.id}
              onPress={() => addUsage(i)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.match, pressed && { opacity: 0.6 }]}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
              <Text style={[styles.itemTitle, { flex: 1 }]}>{i.name}</Text>
              <Text style={styles.muted}>{formatQty(i.quantity, i.unit)}</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {/* 3. Seans notu */}
      <Card title="3. Seans notu">
        <View style={styles.chips}>
          {klinikTemplates.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              onPress={() => setBody((b) => (b.trim() ? `${b.trimEnd()}\n${t.body}` : t.body))}
            />
          ))}
        </View>
        <TextInput
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
          placeholder="Ne yapıldı, neye bakıldı? (ör. Kanallar dolduruldu, hassasiyet yok.)"
          placeholderTextColor={Colors.textMuted}
          accessibilityLabel="Seans notu"
          style={styles.textarea}
        />
        <Pressable
          onPress={() => setShowTeeth((v) => !v)}
          accessibilityRole="button"
          style={styles.rowBetween}>
          <Text style={styles.label}>Dişler{teeth.length ? `: ${teeth.join(', ')}` : ''}</Text>
          <Ionicons
            name={showTeeth ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textSecondary}
          />
        </Pressable>
        {showTeeth ? (
          <Odontogram
            selected={teeth}
            compact
            showLegend={false}
            onPress={(n) =>
              setManualTeeth((t) => (t.includes(n) ? t.filter((x) => x !== n) : [...t, n]))
            }
          />
        ) : null}
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Önemli not</Text>
          <Switch
            value={important}
            onValueChange={setImportant}
            trackColor={{ true: Colors.danger, false: Colors.border }}
            thumbColor="#FFFFFF"
            accessibilityLabel="Önemli not"
          />
        </View>
      </Card>

      {/* 4. Sonraki adım */}
      <Card title="4. Sonraki adım">
        {remaining.length > 0 ? (
          <View style={styles.chips}>
            {remaining.map((t) => {
              const label = `${t.tooth ? `${t.tooth} ` : ''}${t.procedure}`;
              return (
                <Chip
                  key={t.id}
                  label={label}
                  selected={followTitle === label}
                  onPress={() => setFollowTitle(label)}
                />
              );
            })}
          </View>
        ) : null}
        <TextField
          label="Ne yapılacak?"
          value={followTitle}
          onChangeText={setFollowTitle}
          placeholder="Ör. 36 kron ölçüsü"
          hint="Görevlere eklenir; tarih seçerseniz o gün görünür."
        />
        <View style={styles.chips}>
          {FOLLOW_UPS.map((f) => (
            <Chip
              key={f.days}
              label={f.label}
              selected={followDays === f.days}
              onPress={() => setFollowDays((d) => (d === f.days ? null : f.days))}
            />
          ))}
        </View>
        {followDays ? (
          <Text style={styles.muted}>
            Takip tarihi: {formatDayLong(addDays(todayKey(), followDays))}
          </Text>
        ) : null}
      </Card>

      {/* Özet ve kaydet */}
      <Card title="Özet">
        <Text style={styles.summary}>
          {doneList.length + extras.length} işlem
          {charges.length + extras.filter((e) => e.amount !== undefined).length > 0 &&
          can('odeme.yaz')
            ? ` · hesaba ${formatTL(total)}`
            : ''}
          {usage.length ? ` · ${usage.length} malzeme` : ''}
          {followTitle.trim() ? ' · takip görevi' : ''}
        </Text>
        <Text style={styles.muted}>
          Kaydedince randevu “tamamlandı” olur. Bir adım kaydedilemezse hiçbiri kaydedilmez.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button
            label="Vazgeç"
            variant="secondary"
            onPress={() => router.back()}
            disabled={saving}
          />
          <Button
            label={saving ? 'Kaydediliyor…' : 'Seansı kapat'}
            icon="checkmark-done-outline"
            onPress={submit}
            disabled={saving}
          />
        </View>
        {appt.status === 'tamamlandi' ? (
          <Badge label="Randevu zaten tamamlandı olarak işaretli" tone="muted" />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  patient: { fontSize: 20, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 13, color: Colors.textSecondary },
  muted: { fontSize: 13, color: Colors.textMuted },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  itemTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { color: Colors.primary },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 44 },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 36,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  chargeText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  chargeNote: { fontSize: 12, color: Colors.textMuted, marginLeft: 36 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toothInput: {
    width: 72,
    minHeight: 40,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  inlineInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    color: Colors.text,
  },
  usage: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  usageHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primarySoft,
  },
  qty: { minWidth: 72, textAlign: 'center', fontSize: 14, fontWeight: '600', color: Colors.text },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15, color: Colors.text },
  match: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
  },
  textarea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
    lineHeight: 21,
    color: Colors.text,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summary: { fontSize: 16, fontWeight: '700', color: Colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  error: { fontSize: 13, color: Colors.danger },
});
