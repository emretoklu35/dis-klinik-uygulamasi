/** Klinik görevleri: tipler, veri erişimi (Supabase) ve kanca. */

import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import type { Database } from '@/lib/database.types';
import { addDays, formatDayShort, todayKey } from '@/lib/dates';
import { unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

export type TaskPriority = Database['public']['Enums']['task_priority'];

export type Task = {
  id: string;
  title: string;
  dueDate?: string; // gün anahtarı
  priority: TaskPriority;
  done: boolean;
};

export const taskRepository = {
  async list(clinicId: string): Promise<Task[]> {
    const rows = unwrap(
      await supabase
        .from('tasks')
        .select('id, title, due_date, priority, done_at')
        .eq('clinic_id', clinicId)
        .order('done_at', { ascending: true, nullsFirst: true })
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at'),
      'Görevler yüklenemedi.',
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.due_date ?? undefined,
      priority: r.priority,
      done: r.done_at !== null,
    }));
  },

  async setDone(id: string, done: boolean) {
    unwrap(
      await supabase
        .from('tasks')
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq('id', id)
        .select('id')
        .single(),
      'Görev güncellenemedi.',
    );
  },

  async create(
    clinicId: string,
    input: { title: string; dueDate?: string; priority: TaskPriority },
  ) {
    unwrap(
      await supabase
        .from('tasks')
        .insert({
          clinic_id: clinicId,
          title: input.title,
          due_date: input.dueDate ?? null,
          priority: input.priority,
        })
        .select('id')
        .single(),
      'Görev eklenemedi.',
    );
  },
};

export function useTasks() {
  const { clinic } = useClinicSession();
  const load = useCallback(() => taskRepository.list(clinic.id), [clinic.id]);
  return useFocusLoad<Task[]>(load, [], 'Görevler yüklenemedi.');
}

/** "Bugün", "Yarın", "Gecikti · Pzt 9 Kas", "Per 12 Kas" */
export function dueLabel(dueDate?: string) {
  if (!dueDate) return 'Tarihsiz';
  const today = todayKey();
  if (dueDate === today) return 'Bugün';
  if (dueDate === addDays(today, 1)) return 'Yarın';
  if (dueDate < today) return `Gecikti · ${formatDayShort(dueDate)}`;
  return formatDayShort(dueDate);
}
