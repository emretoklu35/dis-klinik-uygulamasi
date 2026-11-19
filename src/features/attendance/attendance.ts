/**
 * Mesai takibi: tipler, veri erişimi (Supabase) ve kancalar.
 * Kayıtları yalnızca veritabanı fonksiyonları yazar (check_in, correct_attendance…);
 * istemci tabloya doğrudan yazamaz.
 */

import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import { fromClinicLocal, toClinicLocal } from '@/lib/dates';
import { toAppError, unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

export type AttendanceSource = 'qr' | 'kod' | 'duzeltme';

export type AttendanceRecord = {
  id: string;
  memberId: string;
  memberName: string;
  checkIn: string; // ISO
  checkOut?: string; // ISO
  inSource: AttendanceSource;
  outSource?: AttendanceSource;
  /** Klinik yerel gün 'YYYY-AA-GG' */
  day: string;
  /** Tamamlanmış kayıtta süre (dk); açık kayıtta şimdiye kadar */
  minutes: number;
  /** Önceki günden açık kalmış (çıkış okutulmamış) */
  missingOut: boolean;
  changes: AttendanceChange[];
};

export type AttendanceChange = {
  oldIn?: string;
  oldOut?: string;
  newIn: string;
  newOut?: string;
  reason: string;
  changedByName: string;
  changedAt: string;
};

export type KioskDevice = {
  memberId: string;
  name: string;
  createdAt: string;
  lastSeenAt?: string;
  revoked: boolean;
};

export const sourceLabels: Record<AttendanceSource, string> = {
  qr: 'QR',
  kod: 'Kod',
  duzeltme: 'Düzeltme',
};

/** 545 → "9 sa 5 dk" */
export function formatMinutes(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} dk`;
  return r ? `${h} sa ${r} dk` : `${h} sa`;
}

/** ISO → klinik yerel "HH:mm" */
export function clockOf(iso?: string) {
  return iso ? toClinicLocal(iso).slice(11, 16) : '—';
}

/** 'YYYY-AA' → klinik saatine göre ayın başı ve sonraki ayın başı (ISO) */
export function monthRange(monthKey: string) {
  const [y, m] = monthKey.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return { from: fromClinicLocal(`${monthKey}-01T00:00`), to: fromClinicLocal(`${next}-01T00:00`) };
}

type Row = {
  id: string;
  member_id: string;
  check_in: string;
  check_out: string | null;
  in_source: string;
  out_source: string | null;
  clinic_members: { display_name: string } | null;
  attendance_changes: {
    old_in: string | null;
    old_out: string | null;
    new_in: string;
    new_out: string | null;
    reason: string;
    changed_by: string | null;
    changed_at: string;
  }[];
};

export const attendanceRepository = {
  /** Görebildiğiniz kayıtlar (personel: yalnızca kendi; yönetici/sahip: herkes) */
  async list(clinicId: string, fromIso: string, toIso: string): Promise<AttendanceRecord[]> {
    const [res, members] = await Promise.all([
      supabase
        .from('attendance')
        .select(
          'id, member_id, check_in, check_out, in_source, out_source, clinic_members(display_name), attendance_changes(old_in, old_out, new_in, new_out, reason, changed_by, changed_at)',
        )
        .eq('clinic_id', clinicId)
        .gte('check_in', fromIso)
        .lt('check_in', toIso)
        .order('check_in', { ascending: false }),
      supabase.from('clinic_members').select('user_id, display_name').eq('clinic_id', clinicId),
    ]);
    const names = new Map((members.data ?? []).map((m) => [m.user_id, m.display_name]));
    const today = toClinicLocal(new Date()).slice(0, 10);
    const now = Date.now();
    return (unwrap(res, 'Mesai kayıtları yüklenemedi.') as unknown as Row[]).map((r) => {
      const day = toClinicLocal(r.check_in).slice(0, 10);
      const end = r.check_out ? new Date(r.check_out).getTime() : now;
      return {
        id: r.id,
        memberId: r.member_id,
        memberName: r.clinic_members?.display_name ?? 'Bilinmeyen kullanıcı',
        checkIn: r.check_in,
        checkOut: r.check_out ?? undefined,
        inSource: r.in_source as AttendanceSource,
        outSource: (r.out_source ?? undefined) as AttendanceSource | undefined,
        day,
        minutes: r.check_out || day === today ? (end - new Date(r.check_in).getTime()) / 60000 : 0,
        missingOut: !r.check_out && day < today,
        changes: [...(r.attendance_changes ?? [])]
          .sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1))
          .map((c) => ({
            oldIn: c.old_in ?? undefined,
            oldOut: c.old_out ?? undefined,
            newIn: c.new_in,
            newOut: c.new_out ?? undefined,
            reason: c.reason,
            changedByName: (c.changed_by && names.get(c.changed_by)) || 'Bilinmeyen kullanıcı',
            changedAt: c.changed_at,
          })),
      };
    });
  },

  async checkIn(code: string) {
    const { data, error } = await supabase.rpc('check_in', { p_code: code });
    if (error) throw toAppError(error, 'Mesai kaydı yapılamadı.');
    const row = data?.[0];
    if (!row) throw toAppError(null, 'Mesai kaydı yapılamadı.');
    return { action: row.action as 'giris' | 'cikis', at: row.at, minutes: row.worked_minutes };
  },

  async correct(id: string, inIso: string, outIso: string | null, reason: string) {
    const { error } = await supabase.rpc('correct_attendance', {
      p_id: id,
      p_in: inIso,
      p_out: outIso as string,
      p_reason: reason,
    });
    if (error) throw toAppError(error, 'Kayıt düzeltilemedi.');
  },

  async add(memberId: string, inIso: string, outIso: string | null, reason: string) {
    const { error } = await supabase.rpc('add_attendance', {
      p_member: memberId,
      p_in: inIso,
      p_out: outIso as string,
      p_reason: reason,
    });
    if (error) throw toAppError(error, 'Kayıt eklenemedi.');
  },

  // ---------------- Mesai ekranı (tablet) ----------------
  async kioskCode() {
    const { data, error } = await supabase.rpc('kiosk_current_code');
    if (error) throw toAppError(error, 'Kod alınamadı.');
    const row = data?.[0];
    if (!row) throw toAppError(null, 'Kod alınamadı.');
    return { clinicName: row.clinic_name, code: row.code, qr: row.qr, expiresAt: row.expires_at };
  },

  async devices(clinicId: string): Promise<KioskDevice[]> {
    const rows = unwrap(
      await supabase
        .from('kiosk_devices')
        .select('member_id, name, created_at, last_seen_at, revoked_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false }),
      'Mesai ekranları yüklenemedi.',
    );
    return rows.map((r) => ({
      memberId: r.member_id,
      name: r.name,
      createdAt: r.created_at,
      lastSeenAt: r.last_seen_at ?? undefined,
      revoked: !!r.revoked_at,
    }));
  },

  async createPairing(clinicId: string, name: string) {
    const { data, error } = await supabase.rpc('create_device_pairing', {
      p_clinic: clinicId,
      p_name: name,
    });
    if (error) throw toAppError(error, 'Eşleştirme kodu üretilemedi.');
    const row = data?.[0];
    if (!row) throw toAppError(null, 'Eşleştirme kodu üretilemedi.');
    return { code: row.code, expiresAt: row.expires_at };
  },

  async revoke(memberId: string) {
    const { error } = await supabase.rpc('revoke_device', { p_member: memberId });
    if (error) throw toAppError(error, 'Mesai ekranı kaldırılamadı.');
  },

  /**
   * Tablet: eşleştirme kodunu sunucu fonksiyonuna gönder; sunucu cihaz hesabını açar ve
   * bir kerelik giriş bilgisini döndürür. Tablet bununla oturum açar (şifre saklanmaz).
   */
  async pairDevice(code: string) {
    const { data, error } = await supabase.functions.invoke<{
      email?: string;
      password?: string;
      error?: string;
    }>('pair-device', { body: { code } });
    if (error) {
      let message = 'Eşleştirme yapılamadı. Sunucuya ulaşılabildiğinden emin olun.';
      const ctx = (error as { context?: Response }).context;
      try {
        const body = ctx ? await ctx.json() : null;
        if (body?.error) message = body.error;
      } catch {
        // gövde okunamadıysa genel mesaj
      }
      throw new Error(message);
    }
    if (!data?.email || !data.password) throw new Error(data?.error ?? 'Eşleştirme yapılamadı.');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (signInError) throw new Error('Cihaz oturumu açılamadı. Tekrar deneyin.');
  },
};

export function useAttendance(fromIso: string, toIso: string) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => attendanceRepository.list(clinic.id, fromIso, toIso),
    [clinic.id, fromIso, toIso],
  );
  return useFocusLoad<AttendanceRecord[]>(load, [], 'Mesai kayıtları yüklenemedi.');
}

export function useKioskDevices(enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (enabled ? attendanceRepository.devices(clinic.id) : Promise.resolve([])),
    [clinic.id, enabled],
  );
  return useFocusLoad<KioskDevice[]>(load, [], 'Mesai ekranları yüklenemedi.');
}

export type StaffMember = { id: string; name: string };

/** Mesaisi takip edilen personel (tabletler hariç, yalnızca aktif üyeler) */
export function useStaff(enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(async (): Promise<StaffMember[]> => {
    if (!enabled) return [];
    const rows = unwrap(
      await supabase
        .from('clinic_members')
        .select('id, display_name, status, member_roles(role)')
        .eq('clinic_id', clinic.id)
        .eq('status', 'aktif')
        .order('display_name'),
      'Personel listesi yüklenemedi.',
    );
    return rows
      .filter((m) => (m.member_roles ?? []).some((r) => r.role !== 'ekran'))
      .map((m) => ({ id: m.id, name: m.display_name }));
  }, [clinic.id, enabled]);
  return useFocusLoad<StaffMember[]>(load, [], 'Personel listesi yüklenemedi.');
}
