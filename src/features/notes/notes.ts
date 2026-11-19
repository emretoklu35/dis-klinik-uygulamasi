/**
 * Hasta notları: tipler, veri erişimi (Supabase) ve kancalar.
 *
 * Kim neyi görür veritabanında (RLS) belirlenir; burada yalnızca düğmeleri göstermek için
 * aynı kurallar tekrarlanır (canWriteKind). Yazan kişi ve zamanı veritabanı atar.
 */

import { useCallback } from 'react';

import { useClinicSession, type Permission } from '@/features/session/session-context';
import type { Database, Json } from '@/lib/database.types';
import { toAppError, unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

export type NoteKind = Database['public']['Enums']['note_kind'];

export const kindLabels: Record<NoteKind, string> = {
  klinik: 'Klinik',
  randevu: 'Randevu',
  odeme: 'Ödeme',
};

export const kindHints: Record<NoteKind, string> = {
  klinik: 'Hekimler ve asistan görür.',
  randevu: 'Tüm personel görür.',
  odeme: 'Ödemeleri görenler görür.',
};

/** Her not türü için yazma yetkisi (veritabanındaki can_write_note ile aynı) */
const writePermission: Record<NoteKind, Permission> = {
  klinik: 'not.klinik.yaz',
  randevu: 'not.yaz',
  odeme: 'odeme.yaz',
};

export function canWriteKind(can: (p: Permission) => boolean, kind: NoteKind) {
  return can(writePermission[kind]);
}

/** Seans notunun yapılandırılmış özeti (close_visit yazar) */
export type VisitSummary = {
  treatments?: { procedure: string; tooth?: string | null }[];
  stock?: { name: string; quantity: number; unit: string; lot_no?: string | null }[];
  follow_up?: { title?: string; due_date?: string };
};

export type Note = {
  id: string;
  patientId: string;
  kind: NoteKind;
  body: string;
  teeth: number[];
  important: boolean;
  hidden: boolean;
  template?: string;
  data?: Json;
  appointmentId?: string;
  treatmentId?: string;
  parentId?: string;
  authorMemberId: string;
  authorName: string;
  createdAt: string;
  editedAt?: string;
  editCount: number;
  /** Ek notlar (eskiden yeniye) */
  addenda: Note[];
};

export type NoteRevision = { oldBody: string; changedByName: string; changedAt: string };

export type NoteInput = {
  kind: NoteKind;
  body: string;
  teeth: number[];
  important: boolean;
  hidden: boolean;
  template?: string;
  data?: Json;
  appointmentId?: string;
  treatmentId?: string;
};

export type Phrase = { id: string; text: string };

/** Notu yazan kişi 24 saat içinde düzeltebilir; sonra kilitlenir (veritabanı da denetler). */
export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isEditable(note: Note, memberId: string, now = Date.now()) {
  return (
    note.authorMemberId === memberId && now - new Date(note.createdAt).getTime() < EDIT_WINDOW_MS
  );
}

type NoteRow = Database['public']['Tables']['patient_notes']['Row'] & {
  clinic_members: { display_name: string } | null;
};

function toNote(r: NoteRow): Note {
  return {
    id: r.id,
    patientId: r.patient_id,
    kind: r.kind,
    body: r.body,
    teeth: r.teeth ?? [],
    important: r.important,
    hidden: r.hidden,
    template: r.template ?? undefined,
    data: r.data ?? undefined,
    appointmentId: r.appointment_id ?? undefined,
    treatmentId: r.treatment_id ?? undefined,
    parentId: r.parent_id ?? undefined,
    authorMemberId: r.author_member_id,
    authorName: r.clinic_members?.display_name ?? 'Bilinmeyen kullanıcı',
    createdAt: r.created_at,
    editedAt: r.edited_at ?? undefined,
    editCount: r.edit_count,
    addenda: [],
  };
}

const SELECT = '*, clinic_members(display_name)';

type NoteInsert = Database['public']['Tables']['patient_notes']['Insert'];
/** Yazan kişi (author_member_id) veritabanında oturumdaki üye olarak atanır; istemci gönderemez. */
const noteRow = (r: Omit<NoteInsert, 'author_member_id'>) => r as NoteInsert;

export const noteRepository = {
  /** Hastanın görebildiğiniz notları; ek notlar ana notun altında. Yeniden eskiye. */
  async listForPatient(clinicId: string, patientId: string): Promise<Note[]> {
    const rows = unwrap(
      await supabase
        .from('patient_notes')
        .select(SELECT)
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      'Notlar yüklenemedi.',
    ) as NoteRow[];
    const notes = rows.map(toNote);
    const byId = new Map(notes.map((n) => [n.id, n]));
    const roots: Note[] = [];
    for (const n of notes) {
      const parent = n.parentId ? byId.get(n.parentId) : undefined;
      if (parent) parent.addenda.unshift(n);
      else roots.push(n);
    }
    return roots;
  },

  async create(clinicId: string, patientId: string, input: NoteInput) {
    const row = unwrap(
      await supabase
        .from('patient_notes')
        .insert(
          noteRow({
            clinic_id: clinicId,
            patient_id: patientId,
            kind: input.kind,
            body: input.body.trim(),
            teeth: input.teeth,
            important: input.important,
            hidden: input.kind === 'klinik' && input.hidden,
            template: input.template ?? null,
            data: input.data ?? null,
            appointment_id: input.appointmentId ?? null,
            treatment_id: input.treatmentId ?? null,
          }),
        )
        .select('id')
        .single(),
      'Not kaydedilemedi.',
    );
    return row.id;
  },

  async addAddendum(clinicId: string, parent: Note, body: string) {
    unwrap(
      await supabase
        .from('patient_notes')
        .insert(
          noteRow({
            clinic_id: clinicId,
            // Tür, hasta ve gizlilik ana nottan alınır (veritabanı da zorlar)
            patient_id: parent.patientId,
            kind: parent.kind,
            body: body.trim(),
            parent_id: parent.parentId ?? parent.id,
          }),
        )
        .select('id')
        .single(),
      'Ek not kaydedilemedi.',
    );
  },

  async update(
    id: string,
    input: { body: string; teeth: number[]; important: boolean; data?: Json },
  ) {
    const { data, error } = await supabase
      .from('patient_notes')
      .update({
        body: input.body.trim(),
        teeth: input.teeth,
        important: input.important,
        ...(input.data !== undefined ? { data: input.data } : {}),
      })
      .eq('id', id)
      .select('id');
    if (error) throw toAppError(error, 'Not düzeltilemedi.');
    if (!data?.length) throw toAppError({ code: '42501' }, 'Not düzeltilemedi.');
  },

  async revisions(clinicId: string, noteId: string): Promise<NoteRevision[]> {
    const [revs, members] = await Promise.all([
      supabase
        .from('note_revisions')
        .select('old_body, changed_by, changed_at')
        .eq('note_id', noteId)
        .order('changed_at', { ascending: false }),
      supabase.from('clinic_members').select('user_id, display_name').eq('clinic_id', clinicId),
    ]);
    const names = new Map((members.data ?? []).map((m) => [m.user_id, m.display_name]));
    return unwrap(revs, 'Not geçmişi yüklenemedi.').map((r) => ({
      oldBody: r.old_body,
      changedByName: (r.changed_by && names.get(r.changed_by)) || 'Bilinmeyen kullanıcı',
      changedAt: r.changed_at,
    }));
  },

  // ---------------- Favori cümleler (kişisel) ----------------
  async listPhrases(clinicId: string): Promise<Phrase[]> {
    return unwrap(
      await supabase
        .from('note_phrases')
        .select('id, text')
        .eq('clinic_id', clinicId)
        .order('created_at'),
      'Favori cümleler yüklenemedi.',
    );
  },

  async addPhrase(clinicId: string, text: string) {
    unwrap(
      await supabase
        .from('note_phrases')
        // member_id veritabanında oturumdaki üye olarak atanır (istemci gönderemez)
        .insert({
          clinic_id: clinicId,
          text: text.trim(),
        } as Database['public']['Tables']['note_phrases']['Insert'])
        .select('id')
        .single(),
      'Favori cümle eklenemedi.',
    );
  },

  async removePhrase(id: string) {
    const { error } = await supabase.from('note_phrases').delete().eq('id', id);
    if (error) throw toAppError(error, 'Favori cümle silinemedi.');
  },
};

// --------------------------------------------------------------------------
// Seans kapatma (tek işlem: tedavi, ücret, stok, not, takip görevi, randevu)
// --------------------------------------------------------------------------
export type CloseVisitInput = {
  doneTreatmentIds: string[];
  newTreatments: { procedure: string; tooth?: string; priceItemId?: string; amount?: number }[];
  charges: {
    treatmentId: string;
    priceItemId?: string;
    description: string;
    tooth?: string;
    amount: number;
  }[];
  stock: { itemId: string; quantity: number; lotNo?: string }[];
  note: { body: string; teeth: number[]; important: boolean };
  followUp?: { title: string; taskTitle?: string; dueDate?: string };
};

export async function closeVisit(appointmentId: string, input: CloseVisitInput) {
  const p = {
    done_treatment_ids: input.doneTreatmentIds,
    new_treatments: input.newTreatments.map((t) => ({
      procedure: t.procedure,
      tooth: t.tooth ?? null,
      price_item_id: t.priceItemId ?? null,
      ...(t.amount !== undefined ? { amount: t.amount } : {}),
    })),
    charges: input.charges.map((c) => ({
      treatment_id: c.treatmentId,
      price_item_id: c.priceItemId ?? null,
      description: c.description,
      tooth: c.tooth ?? null,
      amount: c.amount,
    })),
    stock: input.stock.map((s) => ({
      item_id: s.itemId,
      quantity: s.quantity,
      lot_no: s.lotNo ?? null,
    })),
    note: input.note,
    follow_up: input.followUp
      ? {
          title: input.followUp.title,
          task_title: input.followUp.taskTitle ?? null,
          due_date: input.followUp.dueDate ?? null,
        }
      : null,
  };
  const { data, error } = await supabase.rpc('close_visit', { p_appointment: appointmentId, p });
  if (error) throw toAppError(error, 'Seans kapatılamadı.');
  return data;
}

// --------------------------------------------------------------------------
// Kancalar
// --------------------------------------------------------------------------
export function usePatientNotes(patientId: string | undefined) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (patientId ? noteRepository.listForPatient(clinic.id, patientId) : Promise.resolve([])),
    [clinic.id, patientId],
  );
  return useFocusLoad<Note[]>(load, [], 'Notlar yüklenemedi.');
}

export function usePhrases() {
  const { clinic } = useClinicSession();
  const load = useCallback(() => noteRepository.listPhrases(clinic.id), [clinic.id]);
  return useFocusLoad<Phrase[]>(load, [], 'Favori cümleler yüklenemedi.');
}

/** Bu randevunun seansı kapatılmış mı? (seans notu var mı) */
export function isVisitClosed(notes: Note[], appointmentId: string) {
  return notes.some((n) => n.template === 'seans' && n.appointmentId === appointmentId);
}

export function visitSummary(note: Note): VisitSummary | null {
  if (note.template !== 'seans' || !note.data || typeof note.data !== 'object') return null;
  return note.data as unknown as VisitSummary;
}

export function implantRows(note: Note) {
  if (note.template !== 'implant' || !note.data || typeof note.data !== 'object') return null;
  const rows = (note.data as { implants?: unknown }).implants;
  return Array.isArray(rows) ? (rows as Record<string, string>[]) : null;
}
