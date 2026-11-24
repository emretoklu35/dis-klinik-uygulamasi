/**
 * Hasta Kartı → Tedavi Planları sekmesi.
 *  - Üstte diş şeması ve yanında Planlanan / Tamamlanan işlemler.
 *  - Altta hastanın planları: Uygula, başlık, doktor, tarih, tamamlanma, planlanan ve tamamlanan tutar.
 *  - Bir plan açılınca işlemleri listelenir; işlem eklenir ya da düzenlenir.
 * Planlanan işlemler yalnızca UYGULANAN plandan gelir; tamamlanan işlemler hangi plandan olursa olsun
 * gösterilir (yapılmış tedavi geçmişi).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  Badge,
  Button,
  Card,
  Divider,
  Segmented,
  TextField,
  type BadgeTone,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { ProfitRow } from '@/features/costs/costs';
import {
  ItemExpenses,
  marginAfterDiscount,
  pctText,
  ProfitPanel,
  usePlanCosts,
} from '@/features/costs/plan-costs';
import { Odontogram } from '@/features/notes/odontogram';
import { parseTeeth, type ToothState } from '@/features/notes/teeth';
import type { Radiograph } from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import { formatTL, parseTL } from '@/lib/money';

import { patientRepository } from './repository';
import { TreatmentForm, type TreatmentEditor } from './treatments-card';
import type { Treatment, TreatmentPlan, TreatmentStatus } from './types';
import { formatDate, treatmentKindLabels, treatmentStatusLabels } from './utils';

const statusTone: Record<TreatmentStatus, BadgeTone> = {
  planlandi: 'primary',
  devam: 'warning',
  tamamlandi: 'success',
};

const sum = (list: Treatment[]) => list.reduce((s, t) => s + (t.amount ?? 0), 0);
const listSum = (list: Treatment[]) =>
  list.reduce((s, t) => s + (t.listAmount ?? t.amount ?? 0), 0);

/** Ücret; indirim varsa liste fiyatı üstü çizili */
function Price({ t }: { t: Treatment }) {
  const discounted = t.listAmount != null && t.amount != null && t.listAmount > t.amount;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      {discounted ? <Text style={styles.oldPrice}>{formatTL(t.listAmount!)}</Text> : null}
      <Text style={[styles.amount, discounted && styles.newPrice]}>{formatTL(t.amount!)}</Text>
    </View>
  );
}

/** İndirim: yüzde ya da tutar, seçilen işlemlere. Liste fiyatı üzerinden hesaplanır. */
function DiscountForm({
  planId,
  items,
  limitPct,
  profit,
  onCancel,
  onDone,
}: {
  planId: string;
  items: Treatment[];
  /** null: sınırsız (klinik sahibi) */
  limitPct: number | null;
  /** Kârlılık (maliyet.oku yoksa boş): indirimin marja etkisini göstermek için */
  profit: ProfitRow[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'yuzde' | 'tutar'>('yuzde');
  const [valueText, setValueText] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((t) => t.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = items.filter((t) => selected.has(t.id));
  const before = listSum(chosen);
  const value =
    mode === 'yuzde'
      ? Number(valueText.replace(',', '.').replace('%', '').trim())
      : (parseTL(valueText) ?? NaN);
  const valid =
    valueText.trim() !== '' &&
    Number.isFinite(value) &&
    value >= 0 &&
    (mode === 'yuzde' ? value <= 100 : value <= before);
  const cut = !valid ? 0 : mode === 'yuzde' ? Math.round((before * value) / 100) : value;
  const pct = before ? (cut / before) * 100 : 0;
  const overLimit = limitPct != null && pct > limitPct + 0.001;
  const margin =
    valid && profit.length
      ? marginAfterDiscount(
          profit,
          chosen.map((t) => t.id),
          // İndirim liste fiyatından; mevcut indirimli gelire göre fark
          cut - (listSum(chosen) - sum(chosen)),
        )
      : null;

  const apply = async () => {
    if (!valid || chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await patientRepository.applyDiscount(
        planId,
        chosen.length === items.length ? null : chosen.map((t) => t.id),
        mode,
        value,
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İndirim uygulanamadı.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.inlineForm}>
      <Text style={styles.formTitle}>İndirim</Text>
      <Segmented
        label="İndirim türü"
        value={mode}
        options={[
          { value: 'yuzde', label: 'Yüzde (%)' },
          { value: 'tutar', label: 'Tutar (₺)' },
        ]}
        onChange={(m) => {
          setMode(m);
          setValueText('');
        }}
      />
      <TextField
        label={mode === 'yuzde' ? 'İndirim oranı (%)' : 'İndirim tutarı (₺)'}
        value={valueText}
        onChangeText={setValueText}
        placeholder={mode === 'yuzde' ? 'Ör. 15' : 'Ör. 3.000'}
        keyboardType="decimal-pad"
        hint={
          limitPct != null
            ? `İndirim sınırınız %${limitPct}. 0 girerseniz indirim kaldırılır.`
            : 'Klinik sahibi olarak sınırınız yok. 0 girerseniz indirim kaldırılır.'
        }
      />
      <View style={{ gap: 4 }}>
        <Text style={styles.formLabel}>Uygulanacak işlemler</Text>
        {items.map((t) => {
          const on = selected.has(t.id);
          return (
            <Pressable
              key={t.id}
              onPress={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (on) n.delete(t.id);
                  else n.add(t.id);
                  return n;
                })
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={styles.checkRow}>
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? Colors.primary : Colors.textMuted}
              />
              <Text style={[styles.itemTitle, { flex: 1 }]}>
                {t.tooth ? `${t.tooth} · ` : ''}
                {t.procedure}
              </Text>
              <Text style={styles.amount}>{formatTL(t.listAmount ?? t.amount ?? 0)}</Text>
            </Pressable>
          );
        })}
      </View>
      {valid && chosen.length > 0 ? (
        <Text style={[styles.preview, overLimit && { color: Colors.danger }]}>
          {formatTL(before)} → {formatTL(before - cut)} · indirim {formatTL(cut)} (%
          {pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })})
          {overLimit ? ` · sınırınız %${limitPct}` : ''}
        </Text>
      ) : null}
      {margin ? (
        <Text
          style={[
            styles.preview,
            { color: (margin.after ?? 0) < 20 ? Colors.danger : Colors.primaryDeep },
          ]}>
          Kâr marjı {pctText(margin.before)} → {pctText(margin.after)}
          {(margin.after ?? 0) < 20 ? ' · marj düşük' : ''}
        </Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        <Button
          label={busy ? 'Uygulanıyor…' : 'Uygula'}
          icon="checkmark"
          onPress={apply}
          disabled={busy || !valid || chosen.length === 0 || overLimit}
        />
      </View>
    </View>
  );
}

export function TreatmentPlansTab({
  patientId,
  treatments,
  plans,
  states,
  tooth,
  onTooth,
  readOnly,
  radiographs,
  onChanged,
}: {
  patientId: string;
  /** Hekimde tam kayıt, yönetici/sahipte özet */
  treatments: Treatment[];
  plans: TreatmentPlan[];
  /** Şemadaki renkler (uygulanan plan + tamamlananlar) */
  states: Map<number, ToothState>;
  tooth?: number;
  onTooth: (n: number | undefined) => void;
  readOnly: boolean;
  radiographs: Radiograph[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const { clinic, member, can } = useClinicSession();
  const openProforma = (planId: string) =>
    router.push({ pathname: '/hastalar/proforma/[planId]', params: { planId, hasta: patientId } });
  const canWrite = !readOnly && can('tedavi.yaz');
  const canUnlock = can('plan.kilit.ac');
  const showMoney = can('odeme.oku');
  const isWide = useIsWideLayout();
  // Şema ile listeyi yan yana koymak için daha geniş alan gerekir
  const { width } = useWindowDimensions();
  const sideBySide = isWide && width >= 1240;
  // Plan tablosu sütunları için yeterli genişlik yoksa kart görünümü
  const table = isWide && width >= 1080;

  const [side, setSide] = useState<'planned' | 'done'>('planned');
  const [openPlanId, setOpenPlanId] = useState<string | undefined>();
  const [editor, setEditor] = useState<TreatmentEditor | null>(null);
  const [newPlanTitle, setNewPlanTitle] = useState<string | null>(null);
  // Onay bekleyen plan işlemi: silme, kilitleme ya da kilidi açma
  const [confirm, setConfirm] = useState<{ id: string; action: 'sil' | 'kilitle' | 'ac' }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activePlan = plans.find((p) => p.isActive);
  const planTitle = (id: string) => plans.find((p) => p.id === id)?.title ?? '—';
  const forTooth = (list: Treatment[]) =>
    tooth ? list.filter((t) => parseTeeth(t.tooth).includes(tooth)) : list;

  const planned = forTooth(
    treatments.filter((t) => t.status !== 'tamamlandi' && t.planId === activePlan?.id),
  );
  const done = forTooth(treatments.filter((t) => t.status === 'tamamlandi')).sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );
  const sideList = side === 'planned' ? planned : done;
  const openPlan = plans.find((p) => p.id === openPlanId);
  const openItems = treatments.filter((t) => t.planId === openPlanId);
  const canDiscount = !readOnly && can('indirim.yap') && showMoney;
  const [discounting, setDiscounting] = useState(false);
  // İndirim yalnızca ücreti olan ve henüz tamamlanmamış işlemlere
  const discountable = openItems.filter((t) => t.amount != null && t.status !== 'tamamlandi');
  const costs = usePlanCosts(
    openPlanId,
    openItems.map((t) => t.id),
  );
  const costsChanged = () => {
    costs.reload();
    onChanged();
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const createPlan = () =>
    run(async () => {
      const title = newPlanTitle?.trim() || `Tedavi planı ${plans.length + 1}`;
      const id = await patientRepository.createPlan(
        clinic.id,
        patientId,
        member.id,
        title,
        !activePlan,
      );
      setNewPlanTitle(null);
      setOpenPlanId(id);
      setEditor({ mode: 'new' });
    });

  const openItem = (t: Treatment) => {
    setOpenPlanId(t.planId);
    if (canWrite) setEditor({ mode: 'edit', treatment: t });
  };

  const hasCompletionRadiograph = (id: string) =>
    radiographs.some((r) => !r.invalid && r.treatmentId === id && r.purpose === 'tedavi_sonrasi');

  return (
    <>
      {/* ---------------------- Şema + Planlanan / Tamamlanan ---------------------- */}
      <Card title="Diş şeması">
        <View style={[styles.top, sideBySide && styles.topWide]}>
          <View style={sideBySide ? { flex: 1.7, minWidth: 0 } : undefined}>
            <Odontogram
              states={states}
              selected={tooth ? [tooth] : []}
              onPress={(n) => onTooth(tooth === n ? undefined : n)}
            />
          </View>

          <View style={[styles.side, sideBySide && styles.sideWide]}>
            <View style={styles.toggle} accessibilityRole="tablist">
              {(
                [
                  ['planned', 'Planlanan', planned.length],
                  ['done', 'Tamamlanan', done.length],
                ] as const
              ).map(([key, label, count]) => (
                <Pressable
                  key={key}
                  onPress={() => setSide(key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: side === key }}
                  style={[styles.toggleItem, side === key && styles.toggleItemOn]}>
                  <Text style={[styles.toggleText, side === key && styles.toggleTextOn]}>
                    {label} {count}
                  </Text>
                </Pressable>
              ))}
            </View>
            {tooth ? (
              <View style={styles.toothFilter}>
                <Text style={styles.toothFilterText}>{tooth} numaralı diş</Text>
                <Pressable
                  onPress={() => onTooth(undefined)}
                  accessibilityRole="button"
                  hitSlop={8}>
                  <Text style={styles.link}>Tümünü göster</Text>
                </Pressable>
              </View>
            ) : null}
            {side === 'planned' && !activePlan ? (
              <Text style={styles.empty}>Uygulanan plan yok. Aşağıdan bir plan oluşturun.</Text>
            ) : sideList.length === 0 ? (
              <Text style={styles.empty}>
                {side === 'planned' ? 'Planlanan işlem yok.' : 'Tamamlanan işlem yok.'}
              </Text>
            ) : (
              <ScrollView style={sideBySide ? { maxHeight: 340 } : undefined} nestedScrollEnabled>
                {sideList.map((t, i) => (
                  <Fragment key={t.id}>
                    {i > 0 ? <Divider /> : null}
                    <Pressable
                      onPress={() => openItem(t)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.sideItem, pressed && { opacity: 0.6 }]}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.itemTitle}>
                          {t.tooth ? <Text style={styles.toothNo}>{t.tooth} · </Text> : null}
                          {t.procedure}
                        </Text>
                        <Text style={styles.sub}>
                          {planTitle(t.planId)} ·{' '}
                          {t.status === 'tamamlandi'
                            ? formatDate(t.date)
                            : treatmentStatusLabels[t.status]}
                        </Text>
                      </View>
                      {showMoney && t.amount != null ? <Price t={t} /> : null}
                    </Pressable>
                  </Fragment>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Card>

      {/* --------------------------------- Planlar --------------------------------- */}
      <Card
        title="Tedavi planları"
        action={
          canWrite && newPlanTitle === null ? (
            <Button
              label="Yeni plan"
              icon="add"
              variant="secondary"
              onPress={() => setNewPlanTitle(`Tedavi planı ${plans.length + 1}`)}
            />
          ) : null
        }>
        {newPlanTitle !== null ? (
          <View style={styles.inlineForm}>
            <TextField
              label="Plan adı"
              value={newPlanTitle}
              onChangeText={setNewPlanTitle}
              placeholder="Ör. İmplantlı plan"
              hint={
                activePlan
                  ? 'Yeni plan uygulanmaz; hasta karar verince “Uygula” ile seçin.'
                  : 'Hastanın ilk planı olduğu için uygulanır.'
              }
            />
            <View style={styles.actions}>
              <Button label="Vazgeç" variant="secondary" onPress={() => setNewPlanTitle(null)} />
              <Button label="Oluştur" icon="checkmark" onPress={createPlan} disabled={busy} />
            </View>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {plans.length === 0 ? (
          <Text style={styles.empty}>Bu hasta için henüz tedavi planı yok.</Text>
        ) : (
          <>
            {table ? (
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[styles.th, styles.cApply]}>Uygula</Text>
                <Text style={[styles.th, styles.cTitle]}>Başlık</Text>
                <Text style={[styles.th, styles.cDoctor]}>Doktor</Text>
                <Text style={[styles.th, styles.cDate]}>Oluşturulma</Text>
                <Text style={[styles.th, styles.cProgress]}>Tamamlanma</Text>
                {showMoney ? (
                  <>
                    <Text style={[styles.th, styles.cMoney]}>Planlanan</Text>
                    <Text style={[styles.th, styles.cMoney]}>Tamamlanan</Text>
                  </>
                ) : null}
                <View style={styles.cActions} />
              </View>
            ) : null}
            {plans.map((p, i) => {
              const items = treatments.filter((t) => t.planId === p.id);
              const completed = items.filter((t) => t.status === 'tamamlandi');
              const apply = (
                <Switch
                  value={p.isActive}
                  disabled={!canWrite || p.isActive || busy}
                  onValueChange={(v) => {
                    if (v) run(() => patientRepository.setActivePlan(p.id));
                  }}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  accessibilityLabel={`${p.title} planını uygula`}
                />
              );
              const title = (
                <Pressable
                  onPress={() => {
                    setOpenPlanId(openPlanId === p.id ? undefined : p.id);
                    setEditor(null);
                  }}
                  accessibilityRole="button"
                  accessibilityHint="Planın işlemlerini aç">
                  <Text style={styles.planTitle} numberOfLines={1}>
                    {p.title}
                  </Text>
                  {p.lockedAt ? (
                    <View style={styles.lockLine}>
                      <Ionicons name="lock-closed" size={11} color={Colors.textSecondary} />
                      <Text style={styles.lockText} numberOfLines={1}>
                        Kilitli · {formatDate(p.lockedAt)}
                        {p.lockedByName ? ` · ${p.lockedByName}` : ''}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
              const progress = <Progress done={completed.length} total={items.length} />;
              const lockButton = p.lockedAt ? (
                canUnlock && !readOnly ? (
                  <IconButton
                    icon="lock-closed"
                    color={Colors.primary}
                    label={`${p.title} planının kilidini aç`}
                    onPress={() => setConfirm({ id: p.id, action: 'ac' })}
                  />
                ) : (
                  <View style={styles.iconButton} accessibilityLabel="Kilitli plan">
                    <Ionicons name="lock-closed" size={18} color={Colors.primary} />
                  </View>
                )
              ) : canWrite && items.length > 0 ? (
                <IconButton
                  icon="lock-open-outline"
                  label={`${p.title} planını kilitle`}
                  onPress={() => setConfirm({ id: p.id, action: 'kilitle' })}
                />
              ) : null;
              const actions = (
                <View style={styles.iconActions}>
                  {items.length > 0 ? (
                    <IconButton
                      icon="document-text-outline"
                      label={`${p.title} planının proformasını aç`}
                      onPress={() => openProforma(p.id)}
                    />
                  ) : null}
                  {lockButton}
                  {canWrite ? (
                    <IconButton
                      icon="copy-outline"
                      label={`${p.title} planını kopyala`}
                      onPress={() =>
                        run(() => patientRepository.copyPlan(p.id, `${p.title} (kopya)`))
                      }
                    />
                  ) : null}
                  {canWrite && !p.lockedAt ? (
                    <IconButton
                      icon="trash-outline"
                      label={`${p.title} planını sil`}
                      onPress={() => setConfirm({ id: p.id, action: 'sil' })}
                    />
                  ) : null}
                </View>
              );
              const confirmBox =
                confirm?.id === p.id ? (
                  <View style={[styles.confirm, confirm.action !== 'sil' && styles.confirmInfo]}>
                    <Text
                      style={[
                        styles.confirmText,
                        confirm.action !== 'sil' && styles.confirmInfoText,
                      ]}>
                      {confirm.action === 'sil'
                        ? `“${p.title}” ve içindeki planlanan işlemler silinsin mi? Bu geri alınamaz.`
                        : confirm.action === 'kilitle'
                          ? `Hasta “${p.title}” planını onayladı mı? Kilitlenince işlem eklenemez; işlemlerin ücreti, dişi ve türü değiştirilemez. İşlemler yine tamamlandı olarak işaretlenir. Kilidi yalnızca klinik sahibi açabilir.`
                          : `“${p.title}” planının kilidi açılsın mı? Açılınca fiyatlar ve işlemler yeniden değiştirilebilir; kilidi açan kişi kaydedilir.`}
                    </Text>
                    <View style={styles.actions}>
                      <Button
                        label="Vazgeç"
                        variant="secondary"
                        onPress={() => setConfirm(undefined)}
                      />
                      <Button
                        label={
                          confirm.action === 'sil'
                            ? 'Sil'
                            : confirm.action === 'kilitle'
                              ? 'Kilitle'
                              : 'Kilidi aç'
                        }
                        icon={
                          confirm.action === 'sil'
                            ? 'trash-outline'
                            : confirm.action === 'kilitle'
                              ? 'lock-closed-outline'
                              : 'lock-open-outline'
                        }
                        disabled={busy}
                        onPress={() =>
                          run(async () => {
                            if (confirm.action === 'sil') {
                              await patientRepository.deletePlan(p.id);
                              if (openPlanId === p.id) setOpenPlanId(undefined);
                            } else if (confirm.action === 'kilitle') {
                              await patientRepository.lockPlan(p.id);
                              setEditor(null);
                            } else {
                              await patientRepository.unlockPlan(p.id);
                            }
                            setConfirm(undefined);
                          })
                        }
                      />
                    </View>
                  </View>
                ) : null;

              return (
                <Fragment key={p.id}>
                  {i > 0 || table ? <Divider /> : null}
                  {table ? (
                    <View style={[styles.tableRow, p.isActive && styles.rowActive]}>
                      <View style={styles.cApply}>{apply}</View>
                      <View style={styles.cTitle}>{title}</View>
                      <Text style={[styles.td, styles.cDoctor]} numberOfLines={1}>
                        {p.doctorName}
                      </Text>
                      <Text style={[styles.td, styles.cDate]}>{formatDate(p.createdAt)}</Text>
                      <View style={styles.cProgress}>{progress}</View>
                      {showMoney ? (
                        <>
                          <Text style={[styles.td, styles.cMoney]}>{formatTL(sum(items))}</Text>
                          <Text style={[styles.td, styles.cMoney]}>{formatTL(sum(completed))}</Text>
                        </>
                      ) : null}
                      <View style={styles.cActions}>{actions}</View>
                    </View>
                  ) : (
                    <View style={[styles.planCard, p.isActive && styles.rowActive]}>
                      <View style={styles.planCardHead}>
                        <View style={{ flex: 1 }}>{title}</View>
                        <Text style={styles.sub}>Uygula</Text>
                        {apply}
                      </View>
                      <Text style={styles.sub}>
                        {p.doctorName} · {formatDate(p.createdAt)}
                      </Text>
                      {progress}
                      <View style={styles.planCardFoot}>
                        {showMoney ? (
                          <Text style={styles.sub}>
                            Planlanan {formatTL(sum(items))} · Tamamlanan {formatTL(sum(completed))}
                          </Text>
                        ) : (
                          <View />
                        )}
                        {actions}
                      </View>
                    </View>
                  )}
                  {confirmBox}
                </Fragment>
              );
            })}
          </>
        )}
      </Card>

      {/* ------------------------------ Açık plan ------------------------------ */}
      {openPlan ? (
        <Card
          title={openPlan.title}
          action={
            <View style={styles.iconActions}>
              {canDiscount && !openPlan.lockedAt && !discounting && discountable.length > 0 ? (
                <Button
                  label="İndirim"
                  icon="pricetag-outline"
                  variant="secondary"
                  onPress={() => {
                    setEditor(null);
                    setDiscounting(true);
                  }}
                />
              ) : null}
              {openItems.length > 0 ? (
                <Button
                  label="Proforma"
                  icon="document-text-outline"
                  variant="secondary"
                  onPress={() => openProforma(openPlan.id)}
                />
              ) : null}
              {canWrite && !editor && !openPlan.lockedAt ? (
                <Button
                  label="İşlem ekle"
                  icon="add"
                  variant="secondary"
                  onPress={() => setEditor({ mode: 'new' })}
                />
              ) : null}
              <IconButton
                icon="close"
                label="Planı kapat"
                onPress={() => {
                  setOpenPlanId(undefined);
                  setEditor(null);
                }}
              />
            </View>
          }>
          <Text style={styles.sub}>
            {openPlan.isActive ? 'Uygulanan plan' : 'Uygulanmayan plan'} · {openPlan.doctorName}
          </Text>
          {openPlan.lockedAt ? (
            <View style={styles.lockBanner}>
              <Ionicons name="lock-closed" size={16} color={Colors.primaryDeep} />
              <Text style={styles.lockBannerText}>
                Hasta onayıyla kilitlendi ({formatDate(openPlan.lockedAt)}
                {openPlan.lockedByName ? `, ${openPlan.lockedByName}` : ''}). Anlaşılan fiyatlar
                tedavi bitene kadar aynı kalır; işlemler yalnızca tamamlandı olarak işaretlenir.
              </Text>
            </View>
          ) : null}
          {discounting && !openPlan.lockedAt ? (
            <DiscountForm
              key={openPlan.id}
              planId={openPlan.id}
              items={discountable}
              limitPct={can('indirim.sinirsiz') ? null : clinic.discountLimitPct}
              profit={costs.data.profit}
              onCancel={() => setDiscounting(false)}
              onDone={() => {
                setDiscounting(false);
                costsChanged();
              }}
            />
          ) : null}
          {openItems.length > 0 && showMoney && sum(openItems) < listSum(openItems) ? (
            <Text style={styles.discountNote}>
              Plan toplamı {formatTL(sum(openItems))} · liste fiyatı {formatTL(listSum(openItems))}{' '}
              · indirim {formatTL(listSum(openItems) - sum(openItems))}
            </Text>
          ) : null}
          {editor ? (
            <TreatmentForm
              key={editor.mode === 'edit' ? editor.treatment.id : `yeni-${openPlan.id}`}
              editor={editor}
              patientId={patientId}
              planId={openPlan.id}
              locked={!!openPlan.lockedAt}
              hasCompletionRadiograph={
                editor.mode === 'edit' && hasCompletionRadiograph(editor.treatment.id)
              }
              onCancel={() => setEditor(null)}
              onDone={() => {
                setEditor(null);
                onChanged();
              }}
            />
          ) : null}
          {openItems.length === 0 ? (
            <Text style={styles.empty}>Bu planda henüz işlem yok.</Text>
          ) : (
            openItems.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 ? <Divider /> : null}
                <Pressable
                  onPress={canWrite ? () => setEditor({ mode: 'edit', treatment: t }) : undefined}
                  disabled={!canWrite}
                  accessibilityRole={canWrite ? 'button' : undefined}
                  accessibilityHint={canWrite ? 'İşlemi düzenle' : undefined}
                  style={({ pressed }) => [styles.sideItem, pressed && { opacity: 0.6 }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemTitle}>
                      {t.tooth ? <Text style={styles.toothNo}>{t.tooth} · </Text> : null}
                      {t.procedure}
                    </Text>
                    <Text style={styles.sub}>
                      {treatmentKindLabels[t.kind]} · {formatDate(t.date)}
                      {t.note ? ` · ${t.note}` : ''}
                    </Text>
                  </View>
                  {showMoney && t.amount != null ? <Price t={t} /> : null}
                  <Badge label={treatmentStatusLabels[t.status]} tone={statusTone[t.status]} />
                </Pressable>
                {costs.canWrite || costs.canRead ? (
                  <ItemExpenses
                    treatmentId={t.id}
                    expenses={costs.data.expenses}
                    labs={costs.data.labs}
                    canWrite={costs.canWrite}
                    onChanged={costsChanged}
                  />
                ) : null}
              </Fragment>
            ))
          )}
          {costs.canRead ? <ProfitPanel rows={costs.data.profit} /> : null}
        </Card>
      ) : null}
    </>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <View
      style={styles.progress}
      accessibilityRole="progressbar"
      accessibilityLabel={`${total} işlemin ${done} tanesi tamamlandı`}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
      <Text style={[styles.progressText, pct > 55 && { color: '#FFFFFF' }]}>
        {done} / {total}
      </Text>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  color = Colors.textSecondary,
}: {
  icon:
    | 'copy-outline'
    | 'trash-outline'
    | 'close'
    | 'lock-closed'
    | 'lock-open-outline'
    | 'document-text-outline';
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { gap: Spacing.lg },
  topWide: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { gap: Spacing.sm },
  sideWide: { flex: 1, minWidth: 280 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    padding: 3,
  },
  toggleItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  toggleItemOn: { backgroundColor: Colors.primary },
  toggleText: { fontSize: 13, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  toggleTextOn: { color: '#FFFFFF', fontFamily: Fonts.bodySemi },
  toothFilter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toothFilterText: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.text },
  sideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  itemTitle: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.text },
  toothNo: { color: Colors.primary },
  amount: { fontSize: 13, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  sub: { fontSize: 12, color: Colors.textSecondary },
  empty: { fontSize: 14, color: Colors.textMuted },
  link: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.primary },
  error: { fontSize: 13, color: Colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  inlineForm: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
  },
  tableHead: { backgroundColor: Colors.background },
  rowActive: { backgroundColor: '#F2F9F8' },
  th: { fontSize: 11, fontFamily: Fonts.bodySemi, color: Colors.textMuted },
  td: { fontSize: 13, color: Colors.textSecondary },
  cApply: { width: 56 },
  cTitle: { flex: 1.4, minWidth: 0 },
  cDoctor: { flex: 1, minWidth: 0 },
  cDate: { width: 112 },
  cProgress: { width: 96 },
  cMoney: { width: 96 },
  cActions: { width: 124 },
  planTitle: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.primary },
  iconActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { padding: 6, borderRadius: Radius.sm },
  progress: {
    height: 20,
    borderRadius: Radius.pill,
    backgroundColor: '#E6EBE9',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: Fonts.bodySemi,
    color: Colors.text,
  },
  planCard: { gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md },
  planCardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planCardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirm: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerSoft,
  },
  confirmText: { fontSize: 13, color: Colors.danger },
  formTitle: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  formLabel: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  preview: { fontSize: 13, fontFamily: Fonts.bodySemi, color: Colors.primaryDeep },
  oldPrice: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' },
  newPrice: { color: Colors.success },
  discountNote: { fontSize: 12, color: Colors.success },
  confirmInfo: { backgroundColor: Colors.primarySoft },
  confirmInfoText: { color: Colors.primaryDeep },
  lockLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  lockText: { fontSize: 11, color: Colors.textSecondary },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  lockBannerText: { flex: 1, fontSize: 13, color: Colors.primaryDeep },
});
