/**
 * Proforma: tedavi planından hazırlanan fiyat teklifi. Yazdırılır, PDF olarak paylaşılır,
 * hastaya klinikteki ekranda imzalatılır (imza ile plan kilitlenir).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { SignaturePad } from '@/components/signature-pad';
import { Badge, Button, Card, CenteredMessage, Divider, Screen } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { Odontogram } from '@/features/notes/odontogram';
import { toothStates } from '@/features/notes/teeth';
import {
  usePatient,
  usePlanApprovals,
  useTreatmentPlans,
  useTreatmentSummaries,
} from '@/features/patients/hooks';
import {
  buildProformaHtml,
  groupProformaRows,
  proformaListTotal,
  printProforma,
  proformaTotal,
  shareProforma,
} from '@/features/patients/proforma';
import { patientRepository } from '@/features/patients/repository';
import type { Signature } from '@/features/patients/types';
import { formatDate, fullName, treatmentStatusLabels } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL } from '@/lib/money';

export default function ProformaScreen() {
  const { planId, hasta } = useLocalSearchParams<{ planId: string; hasta: string }>();
  const { clinic, can } = useClinicSession();
  const { data: patient, loading } = usePatient(hasta);
  const { data: summaries } = useTreatmentSummaries(hasta);
  const { data: plans, reload: reloadPlans } = useTreatmentPlans(
    hasta,
    can('tedavi.oku') || can('tedavi.ozet.oku'),
  );
  const { data: approvals, reload: reloadApprovals } = usePlanApprovals(planId);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState<Signature | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Proformaya girmeyecek işlemler (yalnızca yazdırma/paylaşma; imza tüm plan içindir)
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const plan = plans.find((p) => p.id === planId);
  if (!patient || !plan) {
    return (
      <Screen inStack>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
        ) : (
          <Card>
            <CenteredMessage icon="document-outline" title="Tedavi planı bulunamadı." />
          </Card>
        )}
      </Screen>
    );
  }

  const planItems = (patient.treatments ?? summaries ?? []).filter((t) => t.planId === plan.id);
  const items = planItems.filter((t) => !excluded.has(t.id));
  const partial = items.length < planItems.length;
  const states = toothStates(items, []);
  const total = proformaTotal(items);
  const listTotal = proformaListTotal(items);
  const rows = groupProformaRows(planItems);
  // Geçerli onay: kilitten sonra atılmış imza (kilit açılıp plan değiştiyse eski imza geçersiz)
  const approval = approvals.find((a) => plan.lockedAt && a.signedAt >= plan.lockedAt);
  const today = new Date().toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const html = () =>
    buildProformaHtml({
      clinicName: clinic.name,
      clinicAddress: clinic.address,
      clinicPhone: clinic.phone,
      clinicEmail: clinic.email,
      patientName: fullName(patient),
      patientBirthDate: patient.birthDate,
      planTitle: plan.title,
      doctorName: plan.doctorName,
      date: today,
      items,
      states,
      approval,
    });

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const sign = () =>
    run(async () => {
      if (!signature) throw new Error('Lütfen imza alanına imzanızı atın.');
      await patientRepository.signPlan(plan.id, signature);
      setSigning(false);
      setSignature(null);
      reloadPlans();
      reloadApprovals();
    });

  return (
    <Screen inStack>
      <Stack.Screen options={{ title: 'Proforma' }} />

      <View style={styles.toolbar}>
        <Button
          label={Platform.OS === 'web' ? 'Yazdır / PDF' : 'Yazdır'}
          icon="print-outline"
          variant="secondary"
          onPress={() => run(() => printProforma(html()))}
          disabled={busy}
        />
        {Platform.OS !== 'web' ? (
          <Button
            label="PDF paylaş"
            icon="share-outline"
            variant="secondary"
            onPress={() => run(() => shareProforma(html(), `Proforma · ${fullName(patient)}`))}
            disabled={busy}
          />
        ) : null}
        {!approval ? (
          <Button
            label="Hastaya imzalat"
            icon="create-outline"
            onPress={() => {
              setError(null);
              setSigning(true);
            }}
            disabled={busy || planItems.length === 0 || partial}
          />
        ) : null}
      </View>
      {partial ? (
        <Text style={styles.muted}>
          Yalnızca seçili işlemler yazdırılır. Hastaya imzalatmak için tüm işlemleri seçin; imza
          planın tamamı içindir.
        </Text>
      ) : null}
      {error && !signing ? <Text style={styles.error}>{error}</Text> : null}

      {/* -------------------------------- Belge -------------------------------- */}
      <View style={styles.doc}>
        <View style={styles.docHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clinic}>{clinic.name}</Text>
            {[clinic.address, clinic.phone, clinic.email].some(Boolean) ? (
              <Text style={styles.muted}>
                {[clinic.address, clinic.phone, clinic.email].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            <Text style={styles.muted}>{plan.doctorName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.docTitle}>PROFORMA</Text>
            <Text style={styles.muted}>Tarih: {today}</Text>
          </View>
        </View>

        <View style={styles.info}>
          <Info label="Hasta" value={fullName(patient)} />
          {patient.birthDate ? (
            <Info label="Doğum tarihi" value={formatDate(patient.birthDate)} />
          ) : null}
          <Info label="Tedavi planı" value={plan.title} />
        </View>

        <Odontogram states={states} showLegend={false} />

        <View style={[styles.tr, styles.th]}>
          <View style={styles.check} />
          <Text style={[styles.thText, { flex: 2 }]}>Tedavi</Text>
          <Text style={[styles.thText, { flex: 1.2 }]}>Diş</Text>
          <Text style={[styles.thText, { flex: 1 }]}>Durum</Text>
          <Text style={[styles.thText, styles.num]}>Birim</Text>
          <Text style={[styles.thText, styles.num]}>Toplam</Text>
        </View>
        {rows.map((r, i) => {
          const on = r.ids.some((id) => !excluded.has(id));
          return (
            <Fragment key={r.key}>
              {i > 0 ? <Divider /> : null}
              <View style={[styles.tr, !on && { opacity: 0.45 }]}>
                <Pressable
                  onPress={() =>
                    setExcluded((s) => {
                      const n = new Set(s);
                      for (const id of r.ids) {
                        if (on) n.add(id);
                        else n.delete(id);
                      }
                      return n;
                    })
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${r.procedure} proformaya girsin`}
                  hitSlop={6}
                  style={styles.check}>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={on ? Colors.primary : Colors.textMuted}
                  />
                </Pressable>
                <Text style={[styles.td, { flex: 2 }]}>
                  {r.procedure}
                  {r.count > 1 ? <Text style={styles.count}> ×{r.count}</Text> : null}
                </Text>
                <Text style={[styles.td, { flex: 1.2 }]}>{r.teeth}</Text>
                <View style={{ flex: 1, alignItems: 'flex-start' }}>
                  <Badge
                    label={treatmentStatusLabels[r.status]}
                    tone={
                      r.status === 'tamamlandi'
                        ? 'success'
                        : r.status === 'devam'
                          ? 'warning'
                          : 'muted'
                    }
                  />
                </View>
                <Money now={r.unit} list={r.unitList} />
                <Money now={r.total} list={r.totalList} />
              </View>
            </Fragment>
          );
        })}
        {listTotal > total ? (
          <>
            <View style={styles.subRow}>
              <Text style={styles.muted}>Liste fiyatı</Text>
              <Text style={styles.muted}>{formatTL(listTotal)}</Text>
            </View>
            <View style={styles.subRow}>
              <Text style={styles.disc}>İndirim</Text>
              <Text style={styles.disc}>−{formatTL(listTotal - total)}</Text>
            </View>
          </>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.total}>Toplam</Text>
          <Text style={styles.total}>{formatTL(total)}</Text>
        </View>

        {/* İmza */}
        <View style={styles.signBlock}>
          {approval ? (
            <>
              <View style={styles.signBox}>
                <Svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${approval.signature.w} ${approval.signature.h}`}>
                  <Path
                    d={approval.signature.d}
                    fill="none"
                    stroke={Colors.text}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View style={styles.signedLine}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.signMeta}>
                  Hasta onayı · {new Date(approval.signedAt).toLocaleString('tr-TR')} ·{' '}
                  {formatTL(approval.total)}
                  {approval.recordedByName ? ` · Kaydeden: ${approval.recordedByName}` : ''}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={[styles.signBox, styles.signEmpty]} />
              <Text style={styles.signMeta}>Hasta imzası</Text>
            </>
          )}
        </View>
        <Text style={styles.note}>
          Bu belge bir fiyat teklifidir, fatura yerine geçmez. Hasta imzasıyla onaylanan fiyatlar
          tedavi bitene kadar değişmez.
        </Text>
      </View>

      {/* ---------------------------- İmzalatma ekranı ---------------------------- */}
      {signing ? (
        <Modal visible animationType="slide" onRequestClose={() => setSigning(false)}>
          <SafeAreaView style={styles.signScreen}>
            <ScrollView
              contentContainerStyle={styles.signContent}
              keyboardShouldPersistTaps="handled">
              <Text style={styles.signTitle}>Tedavi planı onayı</Text>
              <Text style={styles.muted}>
                {clinic.name} · {plan.doctorName}
              </Text>
              <View style={styles.summary}>
                <Text style={styles.summaryName}>{fullName(patient)}</Text>
                <Text style={styles.muted}>{plan.title}</Text>
                {items.map((t) => (
                  <View key={t.id} style={styles.summaryRow}>
                    <Text style={styles.td}>
                      {t.tooth ? `${t.tooth} · ` : ''}
                      {t.procedure}
                    </Text>
                    <Text style={styles.td}>{t.amount != null ? formatTL(t.amount) : '—'}</Text>
                  </View>
                ))}
                <View style={styles.summaryRow}>
                  <Text style={styles.total}>Toplam</Text>
                  <Text style={styles.total}>{formatTL(total)}</Text>
                </View>
              </View>
              <Text style={styles.consent}>
                Yukarıdaki tedavi planını ve toplam {formatTL(total)} ücreti okudum, anladım ve
                onaylıyorum. Onayladığım fiyatlar tedavi bitene kadar değişmez.
              </Text>
              <SignaturePad onChange={setSignature} />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <View style={styles.signActions}>
                <Button
                  label="Vazgeç"
                  variant="secondary"
                  onPress={() => {
                    setSigning(false);
                    setSignature(null);
                  }}
                  disabled={busy}
                />
                <Button
                  label={busy ? 'Kaydediliyor…' : 'Onayla ve imzala'}
                  icon="checkmark"
                  onPress={sign}
                  disabled={busy || !signature}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>
      ) : null}
    </Screen>
  );
}

function Money({ now, list }: { now?: number; list?: number }) {
  if (now == null) return <Text style={[styles.td, styles.num]}>—</Text>;
  const discounted = list != null && list > now;
  return (
    <View style={styles.num}>
      {discounted ? <Text style={styles.old}>{formatTL(list)}</Text> : null}
      <Text style={[styles.td, { textAlign: 'right' }, discounted && { color: Colors.success }]}>
        {formatTL(now)}
      </Text>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'flex-end' },
  error: { fontSize: 13, color: Colors.danger },
  doc: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  docHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.text,
  },
  clinic: { fontSize: 18, fontFamily: Fonts.heading, color: Colors.text },
  docTitle: { fontSize: 18, fontFamily: Fonts.heading, letterSpacing: 2, color: Colors.text },
  muted: { fontSize: 12, color: Colors.textSecondary },
  info: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xl },
  infoLabel: { fontSize: 10, fontFamily: Fonts.bodySemi, color: Colors.textMuted },
  infoValue: { fontSize: 14, fontFamily: Fonts.bodyMedium, color: Colors.text },
  tr: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 8 },
  th: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  thText: { fontSize: 11, fontFamily: Fonts.bodySemi, color: Colors.textMuted },
  td: { fontSize: 13, color: Colors.text },
  num: { width: 96, textAlign: 'right', alignItems: 'flex-end' },
  check: { width: 24 },
  count: { color: Colors.textSecondary, fontFamily: Fonts.bodySemi },
  old: { fontSize: 11, color: Colors.textMuted, textDecorationLine: 'line-through' },
  subRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.xl },
  disc: { fontSize: 13, color: Colors.success },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  total: { fontSize: 15, fontFamily: Fonts.bodyBold, color: Colors.text },
  signBlock: { alignItems: 'center', gap: 6, marginTop: Spacing.md },
  signBox: {
    width: 280,
    height: 110,
    borderRadius: Radius.md,
    backgroundColor: '#F6F8F7',
  },
  signEmpty: { borderBottomWidth: 1, borderBottomColor: Colors.text, borderRadius: 0 },
  signedLine: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  signMeta: { fontSize: 11, color: Colors.textSecondary, textAlign: 'center' },
  note: { fontSize: 11, color: Colors.textMuted },
  signScreen: { flex: 1, backgroundColor: Colors.background },
  signContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  signTitle: { fontSize: 22, fontFamily: Fonts.heading, color: Colors.text },
  summary: {
    gap: 6,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryName: { fontSize: 16, fontFamily: Fonts.bodySemi, color: Colors.text },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  consent: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  signActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
