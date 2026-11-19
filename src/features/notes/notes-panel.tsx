/**
 * Hastanın notları ve otomatik geçmişi tek zaman çizelgesinde.
 * Otomatik kayıtlar (tedavi, röntgen, ödeme, randevu) mevcut verilerden okunur; ayrıca yazılmaz.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge, Button, Card, Chip } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Appointment } from '@/features/appointments/types';
import type { Patient, Treatment } from '@/features/patients/types';
import { normalizeForSearch } from '@/features/patients/utils';
import type { PatientAccount } from '@/features/payments/payments';
import {
  kindLabels as mediaKindLabels,
  purposeLabels,
  type Radiograph,
} from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL } from '@/lib/money';

import { NoteComposer, type ComposerMode } from './note-composer';
import {
  canWriteKind,
  implantRows,
  isEditable,
  kindLabels,
  noteRepository,
  visitSummary,
  type Note,
  type NoteKind,
  type NoteRevision,
} from './notes';
import { parseTeeth } from './teeth';
import { templateLabel } from './templates';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const kindStyle: Record<NoteKind, { icon: IconName; color: string; soft: string }> = {
  klinik: { icon: 'medkit-outline', color: Colors.primary, soft: Colors.primarySoft },
  randevu: { icon: 'calendar-outline', color: '#0F8A7E', soft: '#E3F4F2' },
  odeme: { icon: 'cash-outline', color: '#B7791F', soft: '#FDF3E3' },
};

/** "10 Kasım 2026 14:20" (bu yılsa yıl yazılmaz) */
export function formatStamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDayStamp(key: string) {
  const d = new Date(`${key}T12:00:00`);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// ----------------------------------------------------------------------------
// Otomatik geçmiş
// ----------------------------------------------------------------------------
export type HistoryEvent = {
  id: string;
  /** Sıralama anahtarı: ISO zaman ya da gün (gün sonuna yerleşir) */
  sortKey: string;
  stamp: string;
  icon: IconName;
  color: string;
  text: string;
  by?: string;
  teeth: number[];
};

export function buildHistory({
  treatments,
  appointments,
  radiographs,
  account,
}: {
  /** Hekim için tam liste, yönetici/sahip için özet */
  treatments: Treatment[];
  appointments: Appointment[];
  radiographs: Radiograph[];
  account: PatientAccount | null;
}): HistoryEvent[] {
  const events: HistoryEvent[] = [];
  for (const t of treatments) {
    if (t.status === 'planlandi') continue;
    events.push({
      id: `t-${t.id}`,
      sortKey: `${t.date}T23:58`,
      stamp: formatDayStamp(t.date),
      icon: t.status === 'tamamlandi' ? 'checkmark-circle-outline' : 'sync-outline',
      color: t.status === 'tamamlandi' ? Colors.success : Colors.warning,
      text: `${t.status === 'tamamlandi' ? 'Tedavi tamamlandı' : 'Tedavi devam ediyor'}: ${t.procedure}${t.tooth ? ` (${t.tooth})` : ''}`,
      by: t.doctorName,
      teeth: parseTeeth(t.tooth),
    });
  }
  for (const r of radiographs) {
    events.push({
      id: `r-${r.id}`,
      sortKey: `${r.takenOn}T23:57`,
      stamp: formatDayStamp(r.takenOn),
      icon: 'image-outline',
      color: '#7C3AED',
      text: `${r.invalid ? 'Geçersiz sayılan görüntü' : 'Görüntü yüklendi'}: ${mediaKindLabels[r.kind]} · ${purposeLabels[r.purpose]}${r.tooth ? ` (${r.tooth})` : ''}`,
      by: r.uploadedByName,
      teeth: parseTeeth(r.tooth),
    });
  }
  for (const p of account?.payments ?? []) {
    if (p.cancelled) continue;
    events.push({
      id: `p-${p.id}`,
      // Ödeme günü esas alınır (kayıt sonradan girilmiş olabilir)
      sortKey: `${p.paidOn}T23:59`,
      stamp: formatDayStamp(p.paidOn),
      icon: 'wallet-outline',
      color: '#B7791F',
      text: `Ödeme alındı: ${formatTL(p.amount)}`,
      by: p.receivedByName,
      teeth: [],
    });
  }
  const now = new Date().toISOString().slice(0, 16);
  for (const a of appointments) {
    if (a.start > now) continue;
    if (a.status === 'gelmedi' || a.status === 'iptal') {
      events.push({
        id: `a-${a.id}`,
        sortKey: `${a.start}`,
        stamp: formatStamp(`${a.start}:00`),
        icon: a.status === 'gelmedi' ? 'person-remove-outline' : 'close-circle-outline',
        color: Colors.danger,
        text: a.status === 'gelmedi' ? 'Randevuya gelmedi' : 'Randevu iptal edildi',
        by: a.doctorName,
        teeth: [],
      });
    }
  }
  return events;
}

// ----------------------------------------------------------------------------
// Not kartı
// ----------------------------------------------------------------------------
function Revisions({ note }: { note: Note }) {
  const { clinic } = useClinicSession();
  const [rows, setRows] = useState<NoteRevision[] | null>(null);
  const [open, setOpen] = useState(false);
  const toggle = async () => {
    setOpen((v) => !v);
    if (!rows) {
      try {
        setRows(await noteRepository.revisions(clinic.id, note.id));
      } catch {
        setRows([]);
      }
    }
  };
  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={toggle} accessibilityRole="button" hitSlop={6}>
        <Text style={styles.metaLink}>
          Düzenlendi ({note.editCount}) · {open ? 'geçmişi gizle' : 'eski hâlini gör'}
        </Text>
      </Pressable>
      {open
        ? (rows ?? []).map((r, i) => (
            <View key={i} style={styles.revision}>
              <Text style={styles.revisionMeta}>
                {formatStamp(r.changedAt)} öncesi · {r.changedByName}
              </Text>
              <Text style={styles.revisionText}>{r.oldBody}</Text>
            </View>
          ))
        : null}
    </View>
  );
}

function VisitDetails({ note }: { note: Note }) {
  const s = visitSummary(note);
  if (!s) return null;
  return (
    <View style={styles.visit}>
      {s.treatments?.length ? (
        <Text style={styles.visitLine}>
          <Text style={styles.visitLabel}>Yapılanlar: </Text>
          {s.treatments.map((t) => `${t.procedure}${t.tooth ? ` (${t.tooth})` : ''}`).join(', ')}
        </Text>
      ) : null}
      {s.stock?.length ? (
        <Text style={styles.visitLine}>
          <Text style={styles.visitLabel}>Kullanılan: </Text>
          {s.stock
            .map(
              (m) => `${m.name} ${m.quantity} ${m.unit}${m.lot_no ? ` (parti ${m.lot_no})` : ''}`,
            )
            .join(', ')}
        </Text>
      ) : null}
      {s.follow_up?.title ? (
        <Text style={styles.visitLine}>
          <Text style={styles.visitLabel}>Sonraki adım: </Text>
          {s.follow_up.title}
          {s.follow_up.due_date ? ` · ${formatDayStamp(s.follow_up.due_date)}` : ''}
        </Text>
      ) : null}
    </View>
  );
}

function ImplantTable({ note }: { note: Note }) {
  const rows = implantRows(note);
  if (!rows?.length) return null;
  return (
    <View style={styles.table}>
      <View style={[styles.tr, styles.th]}>
        {['Diş', 'Sistem', 'Çap×Boy', 'Tork', 'Parti'].map((h) => (
          <Text key={h} style={[styles.td, styles.thText]}>
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr}>
          <Text style={[styles.td, { fontWeight: '700' }]}>{r.tooth}</Text>
          <Text style={styles.td}>{r.brand || '—'}</Text>
          <Text style={styles.td}>
            {r.diameter || r.length ? `${r.diameter || '?'}×${r.length || '?'}` : '—'}
          </Text>
          <Text style={styles.td}>{r.torque ? `${r.torque} N` : '—'}</Text>
          <Text style={styles.td}>{r.lot || '—'}</Text>
        </View>
      ))}
    </View>
  );
}

function NoteBody({ note }: { note: Note }) {
  const implant = implantRows(note);
  // İmplant notunda tablo var; metindeki tekrar eden satırlar gösterilmez
  const text = implant
    ? note.body
        .split('\n')
        .filter((l, i) => i > 0 && !/^\d{2}: /.test(l))
        .join('\n')
    : note.body;
  return (
    <>
      <ImplantTable note={note} />
      {text ? <Text style={styles.body}>{text}</Text> : null}
      <VisitDetails note={note} />
    </>
  );
}

export function NoteCard({
  note,
  onEdit,
  onAddendum,
  onTooth,
}: {
  note: Note;
  onEdit?: (n: Note) => void;
  onAddendum?: (n: Note) => void;
  onTooth?: (t: number) => void;
}) {
  const { member, can } = useClinicSession();
  const k = kindStyle[note.kind];
  const label = templateLabel(note.template);
  const canAdd = canWriteKind(can, note.kind) && onAddendum;
  return (
    <View style={[styles.card, note.important && styles.cardImportant]}>
      <View style={styles.cardHead}>
        <View style={[styles.kindIcon, { backgroundColor: k.soft }]}>
          <Ionicons name={k.icon} size={16} color={k.color} />
        </View>
        <Text style={[styles.kindText, { color: k.color }]}>
          {kindLabels[note.kind]}
          {label ? <Text style={styles.templateText}> · {label}</Text> : null}
        </Text>
        <View style={styles.badges}>
          {note.important ? <Badge label="Önemli" tone="danger" /> : null}
          {note.hidden ? <Badge label="Gizli · yalnızca hekim" tone="muted" /> : null}
        </View>
      </View>

      <NoteBody note={note} />

      {note.teeth.length ? (
        <View style={styles.teeth}>
          {note.teeth.map((t) => (
            <Pressable
              key={t}
              onPress={onTooth ? () => onTooth(t) : undefined}
              accessibilityRole={onTooth ? 'button' : undefined}
              accessibilityLabel={`Diş ${t}`}
              style={styles.toothChip}>
              <Text style={styles.toothChipText}>{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {note.authorName} · {formatStamp(note.createdAt)}
        </Text>
        <View style={styles.actions}>
          {onEdit && isEditable(note, member.id) ? (
            <Pressable onPress={() => onEdit(note)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.action}>Düzelt</Text>
            </Pressable>
          ) : null}
          {canAdd ? (
            <Pressable onPress={() => onAddendum(note)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.action}>Ek not</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {note.editCount > 0 ? <Revisions note={note} /> : null}

      {note.addenda.map((a) => (
        <View key={a.id} style={styles.addendum}>
          <Text style={styles.addendumLabel}>
            Ek not · {a.authorName} · {formatStamp(a.createdAt)}
          </Text>
          <Text style={styles.body}>{a.body}</Text>
          {onEdit && isEditable(a, member.id) ? (
            <Pressable onPress={() => onEdit(a)} accessibilityRole="button" hitSlop={6}>
              <Text style={styles.action}>Düzelt</Text>
            </Pressable>
          ) : null}
          {a.editCount > 0 ? <Revisions note={a} /> : null}
        </View>
      ))}
    </View>
  );
}

function EventRow({ e }: { e: HistoryEvent }) {
  return (
    <View style={styles.event}>
      <Ionicons name={e.icon} size={18} color={e.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.eventText}>{e.text}</Text>
        <Text style={styles.meta}>
          {e.stamp}
          {e.by ? ` · ${e.by}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Panel
// ----------------------------------------------------------------------------
type Filter = 'tumu' | NoteKind | 'onemli';

export function NotesPanel({
  patient,
  notes,
  events,
  onChanged,
  tooth,
  onTooth,
}: {
  patient: Patient;
  notes: Note[];
  events: HistoryEvent[];
  onChanged: () => void;
  /** Diş şemasından gelen diş filtresi */
  tooth?: number;
  onTooth: (t: number | undefined) => void;
}) {
  const { can } = useClinicSession();
  const [filter, setFilter] = useState<Filter>('tumu');
  const [query, setQuery] = useState('');
  const [showEvents, setShowEvents] = useState(true);
  const [composer, setComposer] = useState<ComposerMode | null>(null);
  const writableKinds = (['klinik', 'randevu', 'odeme'] as NoteKind[]).filter((k) =>
    canWriteKind(can, k),
  );
  const visibleKinds = (['klinik', 'randevu', 'odeme'] as NoteKind[]).filter((k) =>
    notes.some((n) => n.kind === k),
  );

  const q = normalizeForSearch(query.trim());
  const matches = (n: Note) =>
    (filter === 'tumu' || (filter === 'onemli' ? n.important : n.kind === filter)) &&
    (!tooth || n.teeth.includes(tooth) || n.addenda.some((a) => a.teeth.includes(tooth))) &&
    (!q ||
      normalizeForSearch(n.body).includes(q) ||
      n.addenda.some((a) => normalizeForSearch(a.body).includes(q)) ||
      n.teeth.some((t) => String(t) === q));
  const shownNotes = notes.filter(matches);
  // Sistem kayıtları yalnızca "Tümü" görünümünde
  const shownEvents =
    showEvents && filter === 'tumu'
      ? events.filter(
          (e) =>
            (!tooth || e.teeth.includes(tooth)) &&
            (!q || normalizeForSearch(e.text).includes(q) || e.teeth.some((t) => String(t) === q)),
        )
      : [];

  type Item = { key: string; sortKey: string; note?: Note; event?: HistoryEvent };
  const items: Item[] = [
    ...shownNotes.map((n) => ({ key: n.id, sortKey: n.createdAt, note: n })),
    ...shownEvents.map((e) => ({ key: e.id, sortKey: e.sortKey, event: e })),
  ].sort((a, b) => (a.sortKey < b.sortKey ? 1 : -1));
  // Önemli notlar her zaman en üstte
  if (filter === 'tumu')
    items.sort((a, b) => Number(!!b.note?.important) - Number(!!a.note?.important));

  return (
    <>
      <Card
        title="Notlar ve geçmiş"
        action={
          writableKinds.length > 0 ? (
            <Button
              label="Not ekle"
              icon="add"
              onPress={() => setComposer({ type: 'new', teeth: tooth ? [tooth] : [] })}
            />
          ) : null
        }>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Notlarda ara (kelime ya da diş no)"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            accessibilityLabel="Notlarda ara"
          />
        </View>
        <View style={styles.chips}>
          <Chip label="Tümü" selected={filter === 'tumu'} onPress={() => setFilter('tumu')} />
          {visibleKinds.map((k) => (
            <Chip
              key={k}
              label={kindLabels[k]}
              selected={filter === k}
              onPress={() => setFilter(k)}
            />
          ))}
          <Chip label="Önemli" selected={filter === 'onemli'} onPress={() => setFilter('onemli')} />
          {filter === 'tumu' ? (
            <Chip
              label={showEvents ? 'Sistem kayıtları: açık' : 'Sistem kayıtları: kapalı'}
              selected={showEvents}
              onPress={() => setShowEvents((v) => !v)}
            />
          ) : null}
        </View>
        {tooth ? (
          <View style={styles.toothFilter}>
            <Text style={styles.toothFilterText}>Yalnızca {tooth} numaralı diş</Text>
            <Pressable onPress={() => onTooth(undefined)} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.action}>Filtreyi kaldır</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      {items.length === 0 ? (
        <Card>
          <Text style={styles.empty}>
            {notes.length === 0 && events.length === 0
              ? 'Bu hasta için henüz not yok.'
              : 'Eşleşen kayıt yok.'}
          </Text>
        </Card>
      ) : (
        <View style={{ gap: Spacing.md }}>
          {items.map((it) => (
            <Fragment key={it.key}>
              {it.note ? (
                <NoteCard
                  note={it.note}
                  onEdit={(n) => setComposer({ type: 'edit', note: n })}
                  onAddendum={(n) => setComposer({ type: 'addendum', parent: n })}
                  onTooth={(t) => onTooth(t)}
                />
              ) : it.event ? (
                <EventRow e={it.event} />
              ) : null}
            </Fragment>
          ))}
        </View>
      )}

      {composer ? (
        <NoteComposer
          patientId={patient.id}
          mode={composer}
          treatments={patient.treatments}
          onClose={() => setComposer(null)}
          onSaved={() => {
            setComposer(null);
            onChanged();
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: { flex: 1, minHeight: 42, fontSize: 15, color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  toothFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  toothFilterText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  empty: { fontSize: 14, color: Colors.textMuted },

  card: {
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cardImportant: { borderLeftWidth: 4, borderLeftColor: Colors.danger },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  kindIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindText: { fontSize: 13, fontWeight: '700' },
  templateText: { fontWeight: '500', color: Colors.textSecondary },
  badges: { flexDirection: 'row', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' },
  body: { fontSize: 15, lineHeight: 22, color: Colors.text },
  teeth: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toothChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
  },
  toothChipText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  meta: { fontSize: 12, color: Colors.textMuted },
  metaLink: { fontSize: 12, color: Colors.primary },
  actions: { flexDirection: 'row', gap: Spacing.lg },
  action: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  revision: {
    gap: 2,
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    backgroundColor: '#F4F5F7',
  },
  revisionMeta: { fontSize: 11, color: Colors.textMuted },
  revisionText: { fontSize: 13, color: Colors.textSecondary, textDecorationLine: 'line-through' },
  addendum: {
    gap: 4,
    marginTop: 4,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.border,
  },
  addendumLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  visit: {
    gap: 4,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: '#F4F7FB',
  },
  visitLine: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  visitLabel: { fontWeight: '700' },
  table: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  th: { backgroundColor: '#F4F5F7', borderTopWidth: 0 },
  td: { flex: 1, paddingVertical: 6, paddingHorizontal: 6, fontSize: 13, color: Colors.text },
  thText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  event: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  eventText: { fontSize: 14, color: Colors.textSecondary },
});
