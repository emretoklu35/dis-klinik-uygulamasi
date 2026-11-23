import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  CenteredMessage,
  Divider,
  Grid,
  gridItem,
  Screen,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { AppointmentCard } from '@/features/appointments/components';
import { usePatientAppointments } from '@/features/appointments/hooks';
import { isActive } from '@/features/appointments/utils';
import { usePatient, useTreatmentSummaries } from '@/features/patients/hooks';
import { MedicalCard } from '@/features/patients/medical-card';
import { TreatmentsCard } from '@/features/patients/treatments-card';
import { PaymentsCard } from '@/features/payments/payments-card';
import { usePatientAccount } from '@/features/payments/payments';
import {
  buildHistory,
  formatStamp,
  kindStyle,
  NoteCard,
  NotesPanel,
  type HistoryEvent,
} from '@/features/notes/notes-panel';
import { isVisitClosed, kindLabels, usePatientNotes, type Note } from '@/features/notes/notes';
import { Odontogram } from '@/features/notes/odontogram';
import { parseTeeth, toothStates } from '@/features/notes/teeth';
import { MediaCard } from '@/features/radiographs/media-card';
import { useOpenMediaRequests, usePatientRadiographs } from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import type { Patient } from '@/features/patients/types';
import {
  formatDate,
  fullName,
  genderLabels,
  treatmentStatusLabels,
} from '@/features/patients/utils';
import { visitTypeLabels } from '@/features/appointments/clinic';
import { formatDayLong, nowLocalDateTime, todayKey } from '@/lib/dates';
import { formatTL } from '@/lib/money';

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/**
 * Hekim: alerji, kronik hastalık ve klinik notları görür.
 * Diğer roller: yalnızca "alerji kaydı var" uyarısını görür (ayrıntı veritabanından hiç gelmez).
 */
function HealthBlock({ patient }: { patient: Patient }) {
  const m = patient.medical;
  if (!m) {
    return patient.hasAllergyAlert ? (
      <View style={styles.alert}>
        <Ionicons name="warning" size={20} color={Colors.danger} />
        <Text style={[styles.alertText, styles.alertStrong]}>
          Alerji kaydı var — hekim kontrol etsin.
        </Text>
      </View>
    ) : (
      <View style={[styles.alert, styles.alertNeutral]}>
        <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
        <Text style={[styles.alertText, { color: Colors.textSecondary }]}>
          Alerji kaydı yok. Sağlık ayrıntılarını yalnızca hekimler görür.
        </Text>
      </View>
    );
  }
  const hasWarning = m.allergies.length > 0 || m.conditions.length > 0;
  return (
    <>
      {hasWarning ? (
        <View style={styles.alert}>
          <Ionicons name="warning" size={20} color={Colors.danger} />
          <View style={{ flex: 1, gap: 4 }}>
            {m.allergies.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Alerji: </Text>
                {m.allergies.join(', ')}
              </Text>
            ) : null}
            {m.conditions.length > 0 ? (
              <Text style={styles.alertText}>
                <Text style={styles.alertStrong}>Sağlık durumu: </Text>
                {m.conditions.join(', ')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={[styles.alert, styles.alertOk]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.success} />
          <Text style={[styles.alertText, { color: Colors.success }]}>
            Kayıtlı alerji veya sağlık uyarısı yok.
          </Text>
        </View>
      )}
    </>
  );
}

/** "33 yaş 4 ay" (çocuklarda ay önemli) */
function ageText(birthDate?: string) {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return undefined;
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months--;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y} yaş ${m} ay` : `${y} yaş`;
}

type TabKey = 'genel' | 'notlar' | 'tedavi' | 'medya' | 'odeme' | 'iletisim';

function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: TabKey; label: string; count?: number }[];
  value: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabs}
      accessibilityRole="tablist">
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.tab,
              active && styles.tabActive,
              pressed && { opacity: 0.7 },
            ]}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            {t.count ? (
              <View style={[styles.tabCount, active && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, active && { color: Colors.primary }]}>
                  {t.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Tag({ label, tone }: { label: string; tone: 'danger' | 'warning' | 'primary' }) {
  const c =
    tone === 'danger'
      ? { bg: Colors.dangerSoft, fg: Colors.danger }
      : tone === 'warning'
        ? { bg: Colors.warningSoft, fg: Colors.warning }
        : { bg: Colors.primarySoft, fg: Colors.primary };
  return (
    <View style={[styles.tag, { backgroundColor: c.bg }]}>
      <Text style={[styles.tagText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

export default function PatientDetailScreen() {
  const { id, sekme } = useLocalSearchParams<{ id: string; sekme?: TabKey }>();
  const router = useRouter();
  const { data: patient, loading, error, reload } = usePatient(id);
  const { data: appointments } = usePatientAppointments(id);
  const { can } = useClinicSession();
  const { data: radiographs, reload: reloadRadiographs } = usePatientRadiographs(
    id,
    can('rontgen.oku'),
  );
  const { data: mediaRequests, reload: reloadRequests } = useOpenMediaRequests(
    id,
    can('medya.istek.oku'),
  );
  const { data: notes, reload: reloadNotes } = usePatientNotes(id);
  const { data: account } = usePatientAccount(id);
  const { data: summaries } = useTreatmentSummaries(id);
  const [tooth, setTooth] = useState<number | undefined>();
  const tab: TabKey = sekme ?? 'genel';
  const setTab = (t: TabKey) => router.setParams({ sekme: t });
  const reloadMedia = () => {
    reloadRadiographs();
    reloadRequests();
  };

  // Yalnızca ilk yüklemede tam ekran bekleme; kayıttan sonra yenilerken kart yerinde kalır.
  if (loading && !patient) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }

  if (error || !patient) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage
            icon="person-remove-outline"
            title={error ?? 'Hasta bulunamadı'}
            text="Kayıt silinmiş ya da bağlantı hatalı olabilir.">
            <Button
              label="Hasta listesine dön"
              variant="secondary"
              onPress={() => router.replace('/hastalar')}
            />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const age = ageText(patient.birthDate);
  const now = nowLocalDateTime();
  const today = todayKey();
  const upcoming = appointments.filter((a) => isActive(a) && a.start >= now);
  const lastPast = appointments.filter((a) => a.start < now && a.status === 'tamamlandi').at(-1);
  const important = notes.filter((n) => n.important);
  // Hekim tam tedavi kaydını, yönetici/sahip özetini görür (null: hiç göremez)
  const treatmentList = patient.treatments ?? summaries;
  const readOnlyTreatments = patient.treatments === null;
  const events = buildHistory({
    treatments: treatmentList ?? [],
    appointments,
    radiographs,
    account,
  });
  const states = toothStates(treatmentList, [
    ...notes.flatMap((n) => [n.teeth, ...n.addenda.map((a) => a.teeth)]),
    ...radiographs.map((r) => parseTeeth(r.tooth)),
  ]);
  const openTreatments = (treatmentList ?? []).filter((t) => t.status !== 'tamamlandi');
  const todayVisits = can('seans.kapat')
    ? appointments.filter(
        (a) => a.start.startsWith(today) && a.status !== 'iptal' && a.status !== 'gelmedi',
      )
    : [];
  const showTreatments = treatmentList !== null;
  const showMedia = can('rontgen.oku') || can('medya.yukle') || can('medya.istek.oku');
  const showPayments = can('odeme.oku');

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'genel', label: 'Genel Bakış' },
    { key: 'notlar', label: 'Notlar', count: notes.length },
    ...(showTreatments
      ? [{ key: 'tedavi' as const, label: 'Tedaviler', count: openTreatments.length }]
      : []),
    ...(showMedia ? [{ key: 'medya' as const, label: 'Medya' }] : []),
    ...(showPayments ? [{ key: 'odeme' as const, label: 'Ödemeler' }] : []),
    { key: 'iletisim', label: 'İletişim' },
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab : 'genel';

  // Son kayıtlar: notlar + sistem kayıtları, en yeni 4
  const recent: { key: string; sortKey: string; note?: Note; event?: HistoryEvent }[] = [
    ...notes.map((n) => ({ key: n.id, sortKey: n.createdAt, note: n })),
    ...events.map((e) => ({ key: e.id, sortKey: e.sortKey, event: e })),
  ]
    .sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1))
    .slice(0, 4);

  const toothTreatments = tooth
    ? (treatmentList ?? []).filter((t) => parseTeeth(t.tooth).includes(tooth))
    : [];
  const toothNotes = tooth ? notes.filter((n) => n.teeth.includes(tooth)) : [];
  const toothMedia = tooth ? radiographs.filter((r) => parseTeeth(r.tooth).includes(tooth)) : [];

  return (
    <Screen inStack>
      <Stack.Screen options={{ title: fullName(patient) }} />

      {/* Kimlik + sekmeler: tek başlık alanı */}
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.squareAvatar}>
            <Text style={styles.squareAvatarText}>
              {(patient.firstName[0] ?? '') + (patient.lastName[0] ?? '')}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{fullName(patient)}</Text>
            <Text style={styles.sub}>
              {[age, genderLabels[patient.gender], patient.phone].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.tags}>
              {patient.hasAllergyAlert ? <Tag label="Alerji var" tone="danger" /> : null}
              {patient.medical?.conditions.length ? (
                <Tag label="Sağlık uyarısı" tone="danger" />
              ) : null}
              {important.length ? (
                <Tag label={`${important.length} önemli not`} tone="danger" />
              ) : null}
              {account && account.remaining > 0 ? (
                <Tag label={`Borç ${formatTL(account.remaining)}`} tone="warning" />
              ) : null}
              {openTreatments.length ? (
                <Tag label={`${openTreatments.length} açık tedavi`} tone="primary" />
              ) : null}
            </View>
          </View>
        </View>
        <Tabs tabs={tabs} value={activeTab} onChange={setTab} />
      </View>

      {/* ------------------------------ GENEL BAKIŞ ------------------------------ */}
      {activeTab === 'genel' ? (
        <>
          {/* Sağlık uyarısı: tedavi öncesi görünür olmalı */}
          <HealthBlock patient={patient} />

          {todayVisits.length > 0 ? (
            <View style={styles.visitCard}>
              {todayVisits.map((a, i) => {
                const closed = isVisitClosed(notes, a.id);
                return (
                  <Fragment key={a.id}>
                    {i > 0 ? <View style={styles.visitDivider} /> : null}
                    <View style={styles.visitRow}>
                      <Text style={styles.visitTime}>{a.start.slice(11, 16)}</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.visitTitle}>
                          Bugünkü seans · {visitTypeLabels[a.visitType]}
                        </Text>
                        <Text style={styles.visitSub}>
                          {a.doctorName} · {a.chairName} · {a.durationMin} dk
                        </Text>
                      </View>
                    </View>
                    {closed ? (
                      <View style={styles.visitDone}>
                        <Ionicons name="checkmark-circle" size={18} color={Colors.mint} />
                        <Text style={styles.visitDoneText}>Seans kapatıldı</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/hastalar/seans/[id]', params: { id: a.id } })
                        }
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.visitBtn, pressed && { opacity: 0.85 }]}>
                        <Ionicons name="checkmark" size={18} color="#062B29" />
                        <Text style={styles.visitBtnText}>Seansı kapat</Text>
                      </Pressable>
                    )}
                  </Fragment>
                );
              })}
            </View>
          ) : null}

          {important.length > 0 ? (
            <Card
              title="Önemli notlar"
              action={
                <Pressable onPress={() => setTab('notlar')} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>Tüm notlar</Text>
                </Pressable>
              }>
              {important.slice(0, 3).map((n, i) => (
                <Fragment key={n.id}>
                  {i > 0 ? <Divider /> : null}
                  <View style={styles.importantRow}>
                    <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.importantText} numberOfLines={3}>
                        {n.body}
                      </Text>
                      <Text style={styles.meta}>
                        {kindLabels[n.kind]} · {n.authorName} · {formatStamp(n.createdAt)}
                      </Text>
                    </View>
                  </View>
                </Fragment>
              ))}
            </Card>
          ) : null}

          <Grid>
            {showTreatments ? (
              <Card
                title="Tedavi durumu"
                style={gridItem}
                action={
                  <Pressable onPress={() => setTab('tedavi')} accessibilityRole="link" hitSlop={8}>
                    <Text style={styles.link}>Diş şeması</Text>
                  </Pressable>
                }>
                {openTreatments.length === 0 ? (
                  <Text style={styles.empty}>Açık (planlanan / devam eden) tedavi yok.</Text>
                ) : (
                  openTreatments.slice(0, 4).map((t) => (
                    <View key={t.id} style={styles.openRow}>
                      <Text style={styles.openTitle}>
                        {t.procedure}
                        {t.tooth ? <Text style={styles.tooth}> · {t.tooth}</Text> : null}
                      </Text>
                      <Badge
                        label={treatmentStatusLabels[t.status]}
                        tone={t.status === 'devam' ? 'warning' : 'primary'}
                      />
                    </View>
                  ))
                )}
              </Card>
            ) : null}

            {account ? (
              <Card
                title="Hesap"
                style={gridItem}
                action={
                  <Pressable onPress={() => setTab('odeme')} accessibilityRole="link" hitSlop={8}>
                    <Text style={styles.link}>Ödemeler</Text>
                  </Pressable>
                }>
                <InfoRow
                  icon="receipt-outline"
                  label="Toplam ücret"
                  value={formatTL(account.totalCharged)}
                />
                <Divider />
                <InfoRow icon="wallet-outline" label="Ödenen" value={formatTL(account.totalPaid)} />
                <Divider />
                <InfoRow
                  icon="alert-circle-outline"
                  label="Kalan"
                  value={formatTL(account.remaining)}
                />
              </Card>
            ) : null}

            <Card
              title="Ziyaretler"
              style={gridItem}
              action={
                <Pressable onPress={() => setTab('iletisim')} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>Randevular</Text>
                </Pressable>
              }>
              <InfoRow
                icon="time-outline"
                label="Son ziyaret"
                value={formatDate(lastPast?.start.slice(0, 10))}
              />
              <Divider />
              <InfoRow
                icon="calendar-outline"
                label="Sıradaki randevu"
                value={
                  upcoming[0]
                    ? `${formatDayLong(upcoming[0].start.slice(0, 10))} ${upcoming[0].start.slice(11, 16)}`
                    : '—'
                }
              />
            </Card>
          </Grid>

          <Card
            title="Son kayıtlar"
            action={
              <Pressable onPress={() => setTab('notlar')} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Geçmişin tamamı</Text>
              </Pressable>
            }>
            {recent.length === 0 ? (
              <Text style={styles.empty}>Henüz kayıt yok.</Text>
            ) : (
              recent.map((r, i) => {
                const icon = r.note ? kindStyle[r.note.kind].icon : r.event!.icon;
                const color = r.note ? kindStyle[r.note.kind].color : r.event!.color;
                return (
                  <Fragment key={r.key}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.importantRow}>
                      <Ionicons name={icon} size={18} color={color} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.recentText} numberOfLines={2}>
                          {r.note ? r.note.body : r.event!.text}
                        </Text>
                        <Text style={styles.meta}>
                          {r.note
                            ? `${r.note.authorName} · ${formatStamp(r.note.createdAt)}`
                            : `${r.event!.stamp}${r.event!.by ? ` · ${r.event!.by}` : ''}`}
                        </Text>
                      </View>
                    </View>
                  </Fragment>
                );
              })
            )}
          </Card>

          <MedicalCard patient={patient} onSaved={reload} />
        </>
      ) : null}

      {/* -------------------------------- NOTLAR --------------------------------- */}
      {activeTab === 'notlar' ? (
        <NotesPanel
          patient={patient}
          notes={notes}
          events={events}
          onChanged={reloadNotes}
          tooth={tooth}
          onTooth={setTooth}
        />
      ) : null}

      {/* ------------------------------- TEDAVİLER ------------------------------- */}
      {activeTab === 'tedavi' ? (
        <>
          <Card title="Diş şeması">
            <Text style={styles.hint}>
              Bir dişe basınca o dişin tedavileri, notları ve görüntüleri aşağıda listelenir.
            </Text>
            <Odontogram
              states={states}
              selected={tooth ? [tooth] : []}
              onPress={(n) => setTooth((t) => (t === n ? undefined : n))}
            />
          </Card>

          {tooth ? (
            <Card
              title={`${tooth} numaralı diş`}
              action={
                <Pressable onPress={() => setTab('notlar')} accessibilityRole="link" hitSlop={8}>
                  <Text style={styles.link}>Notlarda göster</Text>
                </Pressable>
              }>
              {toothTreatments.length + toothNotes.length + toothMedia.length === 0 ? (
                <Text style={styles.empty}>
                  Bu dişe bağlı kayıt yok. Notlar sekmesinden bu dişe not ekleyebilirsiniz.
                </Text>
              ) : null}
              {toothTreatments.map((t) => (
                <View key={t.id} style={styles.openRow}>
                  <Text style={styles.openTitle}>
                    {t.procedure}
                    <Text style={styles.sub}> · {formatDate(t.date)}</Text>
                  </Text>
                  <Badge
                    label={treatmentStatusLabels[t.status]}
                    tone={
                      t.status === 'tamamlandi'
                        ? 'success'
                        : t.status === 'devam'
                          ? 'warning'
                          : 'primary'
                    }
                  />
                </View>
              ))}
              {toothMedia.map((r) => (
                <Text key={r.id} style={styles.sub}>
                  Görüntü · {formatDate(r.takenOn)}
                  {r.invalid ? ' · geçersiz' : ''}
                </Text>
              ))}
              {toothNotes.map((n) => (
                <NoteCard key={n.id} note={n} />
              ))}
            </Card>
          ) : null}

          {readOnlyTreatments ? (
            // Yönetici / sahip: yalnızca özet; ekleme ve düzenleme yok
            <Card title="Tedaviler">
              <Text style={styles.hint}>
                Salt okunur. Tedavi notları ve sağlık ayrıntıları gösterilmez; tedavileri hekim
                girer.
              </Text>
              {(treatmentList ?? []).length === 0 ? (
                <Text style={styles.empty}>Kayıtlı tedavi yok.</Text>
              ) : (
                [...(treatmentList ?? [])].reverse().map((t, i) => (
                  <Fragment key={t.id}>
                    {i > 0 ? <Divider /> : null}
                    <View style={styles.openRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.openTitle}>
                          {t.procedure}
                          {t.tooth ? <Text style={styles.tooth}> · {t.tooth}</Text> : null}
                        </Text>
                        <Text style={styles.sub}>
                          {formatDate(t.date)} · {t.doctorName}
                        </Text>
                      </View>
                      <Badge
                        label={treatmentStatusLabels[t.status]}
                        tone={
                          t.status === 'tamamlandi'
                            ? 'success'
                            : t.status === 'devam'
                              ? 'warning'
                              : 'primary'
                        }
                      />
                    </View>
                  </Fragment>
                ))
              )}
            </Card>
          ) : (
            <>
              {can('seans.kapat') ? (
                <View style={styles.hintBox}>
                  <Ionicons name="bulb-outline" size={18} color={Colors.primary} />
                  <Text style={styles.hintBoxText}>
                    Bugün yapılan işlemleri Genel Bakış’taki “Seansı kapat” ile kaydetmeniz
                    önerilir: tedavi, ücret, kullanılan malzeme ve seans notu birlikte işlenir.
                    Buradan yalnızca plan ekleyin ya da düzeltme yapın.
                  </Text>
                </View>
              ) : null}
              <TreatmentsCard patient={patient} radiographs={radiographs} onSaved={reload} />
            </>
          )}
        </>
      ) : null}

      {/* --------------------------------- MEDYA --------------------------------- */}
      {activeTab === 'medya' ? (
        <MediaCard
          patient={patient}
          radiographs={radiographs}
          requests={mediaRequests}
          onChanged={reloadMedia}
        />
      ) : null}

      {/* -------------------------------- ÖDEMELER ------------------------------- */}
      {/* Sahip, yönetici, hekim ve resepsiyon görür; asistan için hiç çizilmez */}
      {activeTab === 'odeme' ? <PaymentsCard patient={patient} /> : null}

      {/* -------------------------------- İLETİŞİM ------------------------------- */}
      {activeTab === 'iletisim' ? (
        <>
          <Grid>
            <Card title="İletişim" style={gridItem}>
              <InfoRow icon="call-outline" label="Telefon" value={patient.phone} />
              <Divider />
              <InfoRow icon="mail-outline" label="E-posta" value={patient.email || '—'} />
              <Divider />
              <InfoRow
                icon="gift-outline"
                label="Doğum tarihi"
                value={formatDate(patient.birthDate)}
              />
              <Divider />
              <InfoRow icon="id-card-outline" label="Kayıt" value={formatDate(patient.createdAt)} />
            </Card>

            <Card
              title="Randevular"
              style={gridItem}
              action={
                can('randevu.yaz') ? (
                  <Button
                    label="Randevu ver"
                    icon="add"
                    variant="secondary"
                    onPress={() =>
                      router.push(
                        { pathname: '/takvim/yeni', params: { patientId: patient.id } },
                        { withAnchor: true },
                      )
                    }
                  />
                ) : null
              }>
              <InfoRow
                icon="time-outline"
                label="Son ziyaret"
                value={formatDate(lastPast?.start.slice(0, 10))}
              />
              {upcoming.length === 0 ? (
                <>
                  <Divider />
                  <Text style={styles.empty}>Yaklaşan randevu yok.</Text>
                </>
              ) : (
                upcoming.slice(0, 3).map((a) => (
                  <Fragment key={a.id}>
                    <Divider />
                    <Text style={styles.sub}>{formatDayLong(a.start.slice(0, 10))}</Text>
                    <AppointmentCard appointment={a} />
                  </Fragment>
                ))
              )}
            </Card>
          </Grid>

          <Card title="İdari not">
            <Text style={patient.adminNote ? styles.notes : styles.empty}>
              {patient.adminNote || 'Not eklenmemiş.'}
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityText: { flex: 1, gap: 2 },
  squareAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareAvatarText: { fontFamily: Fonts.heading, fontSize: 20, color: Colors.primaryDeep },
  name: { fontSize: 24, fontFamily: Fonts.heading, color: Colors.text, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: Colors.textSecondary },
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: '#FDECEC',
    borderColor: '#F8C9C9',
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  alertOk: { backgroundColor: Colors.successSoft, borderColor: '#BFE5CB', alignItems: 'center' },
  alertNeutral: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  alertText: { fontSize: 14, color: '#991B1B', flexShrink: 1 },
  alertStrong: { fontWeight: '700' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  infoLabel: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  treatment: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  treatmentDate: { width: 92 },
  treatmentDateText: { fontSize: 13, color: Colors.textSecondary },
  treatmentTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  tooth: { fontSize: 13, fontWeight: '500', color: Colors.primary },
  empty: { fontSize: 14, color: Colors.textMuted },
  notes: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  hint: { fontSize: 12, color: Colors.textMuted },
  meta: { fontSize: 12, color: Colors.textMuted },
  link: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tag: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 12, fontWeight: '600' },
  // Altı çizili sekmeler (başlık alanının alt kenarında)
  tabs: { gap: 22 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: 14, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  tabTextActive: { fontFamily: Fonts.bodySemi, color: Colors.text },
  tabCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#EEF1F0',
    alignItems: 'center',
  },
  tabCountActive: { backgroundColor: Colors.primarySoft },
  tabCountText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  visitCard: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 16,
    backgroundColor: Colors.ink,
  },
  visitDivider: { height: 1, backgroundColor: '#2A4256' },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  visitTime: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  visitTitle: { fontSize: 14, fontFamily: Fonts.bodySemi, color: '#FFFFFF' },
  visitSub: { fontSize: 13, color: Colors.inkMuted },
  visitBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.mint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  visitBtnText: { fontSize: 15, fontFamily: Fonts.bodyBold, color: '#062B29' },
  visitDone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  visitDoneText: { fontSize: 14, fontFamily: Fonts.bodySemi, color: Colors.mint },
  importantRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  importantText: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  recentText: { fontSize: 14, color: Colors.text },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  hintBoxText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.primary },
  openTitle: { fontSize: 14, fontWeight: '600', color: Colors.text, flexShrink: 1 },
});
