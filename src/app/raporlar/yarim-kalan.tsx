/**
 * Yarım Kalan Tedaviler: uygulanan planı bitmemiş hastalar. Önce kaybolma riski yüksek olanlar
 * (ileri tarihli randevusu yok, uzun süredir işlem yapılmamış). Satırdan hastaya gidilir ya da
 * resepsiyona "ara" görevi açılır.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Chip, Screen, TextField } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { normalizeForSearch, treatmentKindLabels } from '@/features/patients/utils';
import type { TreatmentKind } from '@/features/patients/types';
import {
  Donut,
  ListHeader,
  RangeButton,
  reportStyles as rs,
  StatTile,
  TileGrid,
} from '@/features/reports/components';
import {
  reportsRepository,
  useReport,
  type DateRange,
  type UnfinishedPlan,
} from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';
import { taskRepository } from '@/features/tasks/tasks';
import { addDays, todayKey } from '@/lib/dates';
import { formatTL } from '@/lib/money';

type StatusFilter = 'tumu' | 'yarim' | 'baslanmamis' | 'randevusuz';
const STATUS: { key: StatusFilter; label: string }[] = [
  { key: 'tumu', label: 'Tümü' },
  { key: 'randevusuz', label: 'Randevusu olmayanlar' },
  { key: 'yarim', label: 'Yarım kalanlar' },
  { key: 'baslanmamis', label: 'Hiç başlanmamışlar' },
];

const notStarted = (p: UnfinishedPlan) => p.doneItems === 0 && p.startedItems === 0;
const daysSince = (iso?: string) =>
  iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000)) : undefined;

export default function UnfinishedPlansReport() {
  const { clinic, can } = useClinicSession();
  const all = can('rapor.oku');
  const canTask = can('gorev.yaz');
  // Plan oluşturulma tarihine göre; varsayılan son 12 ay
  const [range, setRange] = useState<DateRange>(() => ({
    from: addDays(todayKey(), -364),
    to: todayKey(),
  }));
  const { data, loading, error } = useReport<UnfinishedPlan>(
    reportsRepository.unfinishedPlans,
    range,
  );
  const [status, setStatus] = useState<StatusFilter>('tumu');
  const [doctor, setDoctor] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tasked, setTasked] = useState<Record<string, 'ok' | string>>({});

  const doctors = [...new Map(data.map((p) => [p.doctorId, p.doctorName])).entries()];
  const kinds = [...new Set(data.flatMap((p) => p.kinds))].sort();
  const q = normalizeForSearch(query.trim());
  const rows = data
    .filter((p) => !doctor || p.doctorId === doctor)
    .filter((p) => !kind || p.kinds.includes(kind))
    .filter(
      (p) =>
        !q ||
        normalizeForSearch(p.patientName).includes(q) ||
        normalizeForSearch(p.planTitle).includes(q),
    )
    .filter((p) =>
      status === 'randevusuz'
        ? !p.nextAppointment
        : status === 'baslanmamis'
          ? notStarted(p)
          : status === 'yarim'
            ? !notStarted(p)
            : true,
    )
    // Önce randevusu olmayanlar, sonra en uzun süredir işlem görmeyenler
    .sort(
      (a, b) =>
        Number(!!a.nextAppointment) - Number(!!b.nextAppointment) ||
        (a.lastDoneAt ?? a.planCreatedAt).localeCompare(b.lastDoneAt ?? b.planCreatedAt),
    );

  const totalItems = rows.reduce((s, p) => s + p.totalItems, 0);
  const doneItems = rows.reduce((s, p) => s + p.doneItems, 0);
  const totalAmount = rows.reduce((s, p) => s + p.totalAmount, 0);
  const doneAmount = rows.reduce((s, p) => s + p.doneAmount, 0);
  const pct = totalAmount ? (doneAmount / totalAmount) * 100 : 0;
  const patients = new Set(rows.map((p) => p.patientId)).size;
  const noAppt = rows.filter((p) => !p.nextAppointment).length;

  const createTask = async (p: UnfinishedPlan) => {
    try {
      await taskRepository.create(clinic.id, {
        title:
          `${p.patientName} hastasını ara${p.patientPhone ? ` (${p.patientPhone})` : ''}: ` +
          `“${p.planTitle}” yarım kaldı, ${p.doneItems}/${p.totalItems} işlem, kalan ` +
          `${formatTL(p.totalAmount - p.doneAmount)}.`,
        dueDate: todayKey(),
        priority: p.nextAppointment ? 'normal' : 'yuksek',
      });
      setTasked((t) => ({ ...t, [p.planId]: 'ok' }));
    } catch (e) {
      setTasked((t) => ({
        ...t,
        [p.planId]: e instanceof Error ? e.message : 'Görev oluşturulamadı.',
      }));
    }
  };

  return (
    <Screen inStack>
      <RangeButton range={range} onChange={setRange} />
      <Text style={rs.small}>
        Uygulanan planı bitmemiş hastalar · plan oluşturulma tarihine göre
        {!all ? ' · yalnızca sizin planlarınız' : ''}
      </Text>

      <TextField
        label="Ara"
        value={query}
        onChangeText={setQuery}
        placeholder="Hasta ya da plan adı"
      />
      <View style={styles.chips}>
        {STATUS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            selected={status === s.key}
            onPress={() => setStatus(s.key)}
          />
        ))}
      </View>
      {all && doctors.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Tüm hekimler" selected={!doctor} onPress={() => setDoctor(null)} />
          {doctors.map(([id, name]) => (
            <Chip key={id} label={name} selected={doctor === id} onPress={() => setDoctor(id)} />
          ))}
        </View>
      ) : null}
      {kinds.length > 1 ? (
        <View style={styles.chips}>
          <Chip label="Tüm işlemler" selected={!kind} onPress={() => setKind(null)} />
          {kinds.map((k) => (
            <Chip
              key={k}
              label={treatmentKindLabels[k as TreatmentKind] ?? k}
              selected={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
      ) : null}

      <TileGrid>
        <StatTile icon="people-outline" label="Hasta" value={String(patients)} />
        <StatTile
          icon="alert-circle-outline"
          label="Randevusu olmayan"
          value={String(noAppt)}
          tone="orange"
        />
        <StatTile icon="medical-outline" label="Toplam tedavi" value={String(totalItems)} />
        <StatTile icon="cash" label="Toplam tutar" value={formatTL(totalAmount)} tone="green" />
      </TileGrid>

      <View style={styles.summary}>
        <Donut
          parts={[
            { value: doneAmount, color: Colors.primary },
            { value: Math.max(0, totalAmount - doneAmount), color: '#F3C6C2' },
          ]}
          centerTop={`%${pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`}
          centerBottom="tamamlandı (₺)"
        />
        <View style={{ flex: 1, minWidth: 240, gap: Spacing.md }}>
          <SplitBar
            title="Tamamlanan / yarım kalan tedavi"
            left={doneItems}
            right={totalItems - doneItems}
            format={String}
          />
          <SplitBar
            title="Kazanılan / gelecekte kazanılabilecek"
            left={doneAmount}
            right={totalAmount - doneAmount}
            format={formatTL}
          />
        </View>
      </View>

      <ListHeader title="Planlar" count={rows.length} />
      {error ? (
        <Text style={rs.empty}>{error}</Text>
      ) : loading && data.length === 0 ? (
        <ActivityIndicator color={Colors.primary} />
      ) : rows.length === 0 ? (
        <Text style={rs.empty}>Bu filtrelerle yarım kalan plan yok.</Text>
      ) : (
        rows.map((p) => {
          const idle = daysSince(p.lastDoneAt);
          const done = p.totalItems ? p.doneItems / p.totalItems : 0;
          const t = tasked[p.planId];
          return (
            <View key={p.planId} style={rs.card}>
              <View style={rs.row}>
                <Link
                  href={{
                    pathname: '/hastalar/[id]',
                    params: { id: p.patientId, sekme: 'tedavi' },
                  }}
                  withAnchor
                  style={[rs.title, { color: Colors.primary, flexShrink: 1 }]}>
                  {p.patientName}
                </Link>
                {p.nextAppointment ? (
                  <View style={[rs.badge, { backgroundColor: Colors.primarySoft }]}>
                    <Text style={[rs.badgeText, { color: Colors.primaryDeep }]}>
                      Randevu{' '}
                      {new Date(p.nextAppointment).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </Text>
                  </View>
                ) : (
                  <View style={[rs.badge, { backgroundColor: Colors.dangerSoft }]}>
                    <Text style={[rs.badgeText, { color: Colors.danger }]}>Randevusu yok</Text>
                  </View>
                )}
                {p.locked ? <Ionicons name="lock-closed" size={14} color={Colors.primary} /> : null}
              </View>
              <Text style={rs.muted}>
                {p.planTitle} · {p.doctorName} ·{' '}
                {new Date(p.planCreatedAt).toLocaleDateString('tr-TR')}
              </Text>

              <View style={styles.progressRow}>
                <View style={styles.progress}>
                  <View style={[styles.progressFill, { width: `${Math.round(done * 100)}%` }]} />
                  <Text style={[styles.progressText, done > 0.55 && { color: '#FFFFFF' }]}>
                    {p.doneItems} / {p.totalItems}
                  </Text>
                </View>
                <Text style={styles.money}>
                  {formatTL(p.doneAmount)} / {formatTL(p.totalAmount)}
                </Text>
              </View>

              <View style={rs.row}>
                <Ionicons name="time-outline" size={15} color={Colors.textMuted} />
                <Text style={[rs.small, { flex: 1 }]}>
                  {notStarted(p)
                    ? 'Hiç başlanmadı'
                    : idle !== undefined
                      ? `Son işlem ${idle === 0 ? 'bugün' : `${idle} gün önce`}`
                      : 'Devam ediyor'}
                  {p.patientPhone ? ` · ${p.patientPhone}` : ''}
                </Text>
                {canTask ? (
                  t === 'ok' ? (
                    <Text style={[rs.small, { color: Colors.success }]}>✓ Arama görevi açıldı</Text>
                  ) : (
                    <Pressable
                      onPress={() => createTask(p)}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.patientName} için arama görevi oluştur`}
                      hitSlop={6}
                      style={styles.taskBtn}>
                      <Ionicons name="call-outline" size={14} color={Colors.primary} />
                      <Text style={styles.taskText}>Arama görevi</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
              {t && t !== 'ok' ? (
                <Text style={[rs.small, { color: Colors.danger }]}>{t}</Text>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}

function SplitBar({
  title,
  left,
  right,
  format,
}: {
  title: string;
  left: number;
  right: number;
  format: (n: number) => string;
}) {
  const total = left + right || 1;
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.splitTitle}>{title}</Text>
      <View style={styles.split}>
        <View style={[styles.splitLeft, { flex: Math.max(left / total, 0.0001) }]}>
          <Text style={styles.splitText}>{format(left)}</Text>
        </View>
        <View style={[styles.splitRight, { flex: Math.max(right / total, 0.0001) }]}>
          <Text style={styles.splitText}>{format(right)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  splitTitle: { fontSize: 12, fontFamily: Fonts.bodySemi, color: Colors.textSecondary },
  split: { flexDirection: 'row', height: 26, borderRadius: Radius.pill, overflow: 'hidden' },
  splitLeft: { backgroundColor: '#CFE9E2', justifyContent: 'center', alignItems: 'center' },
  splitRight: { backgroundColor: '#F6D3CF', justifyContent: 'center', alignItems: 'center' },
  splitText: { fontSize: 11, fontFamily: Fonts.bodySemi, color: Colors.text },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progress: {
    flex: 1,
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
  money: { fontSize: 12, fontFamily: Fonts.bodySemi, color: Colors.text },
  taskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
  },
  taskText: { fontSize: 12, fontFamily: Fonts.bodySemi, color: Colors.primary },
});
