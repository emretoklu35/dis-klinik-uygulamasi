import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Database } from '@/lib/database.types';
import { setClinicTimeZone, timeToMinutes } from '@/lib/dates';
import { toAppError } from '@/lib/db-errors';
import { supabase, supabaseConfigError } from '@/lib/supabase';

export type ClinicRole = Database['public']['Enums']['clinic_role'];

/**
 * Yetki adları veritabanındaki role_permissions tablosuyla aynıdır.
 * Ekranlar yalnızca neyi GÖSTERECEĞİNE karar vermek için kullanır;
 * asıl koruma veritabanındaki RLS kurallarıdır.
 */
export type Permission =
  | 'klinik.oku'
  | 'klinik.yonet'
  | 'uye.yonet'
  | 'sahip.ata'
  | 'hekim.ata'
  | 'hasta.temel.oku'
  | 'hasta.temel.yaz'
  | 'hasta.arsivle'
  | 'saglik.detay.oku'
  | 'saglik.detay.yaz'
  | 'tedavi.oku'
  | 'tedavi.yaz'
  | 'randevu.oku'
  | 'randevu.yaz'
  | 'gorev.oku'
  | 'gorev.yaz'
  | 'denetim.oku';

export type ClinicInfo = {
  id: string;
  name: string;
  timezone: string;
  openMin: number;
  closeMin: number;
  slotMin: number;
  /** ISO gün numaraları: 1 = Pazartesi … 7 = Pazar */
  workingDays: number[];
};

export type StaffRef = { id: string; name: string };

export type ReadySession = {
  status: 'ready';
  userId: string;
  email: string;
  clinic: ClinicInfo;
  member: StaffRef;
  roles: ClinicRole[];
  permissions: Set<string>;
  doctors: StaffRef[];
  chairs: StaffRef[];
};

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'noClinic'; email: string }
  | { status: 'error'; message: string }
  | ReadySession;

type SessionContextValue = {
  state: SessionState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Hekim/koltuk listesi gibi klinik bilgisini yeniden yükler. */
  reload: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function loadClinicSession(userId: string, email: string): Promise<SessionState> {
  const { data: members, error } = await supabase
    .from('clinic_members')
    .select(
      'id, display_name, clinic_id, clinics(id, name, timezone, open_time, close_time, slot_minutes, working_days), member_roles(role)',
    )
    .eq('user_id', userId)
    .eq('status', 'aktif');
  if (error) throw toAppError(error, 'Klinik bilgisi yüklenemedi.');

  // İlk sürüm tek klinik; ileride burada klinik seçimi yapılacak.
  const m = members?.[0];
  if (!m || !m.clinics) return { status: 'noClinic', email };

  const roles = (m.member_roles ?? []).map((r) => r.role);
  const c = m.clinics;

  const [perms, doctorRows, chairRows] = await Promise.all([
    roles.length
      ? supabase.from('role_permissions').select('permission').in('role', roles)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('member_roles')
      .select('member_id, clinic_members(display_name, status)')
      .eq('clinic_id', c.id)
      .eq('role', 'hekim'),
    supabase
      .from('chairs')
      .select('id, name')
      .eq('clinic_id', c.id)
      .eq('active', true)
      .order('name'),
  ]);
  for (const r of [perms, doctorRows, chairRows]) {
    if (r.error) throw toAppError(r.error, 'Klinik bilgisi yüklenemedi.');
  }

  setClinicTimeZone(c.timezone);

  return {
    status: 'ready',
    userId,
    email,
    clinic: {
      id: c.id,
      name: c.name,
      timezone: c.timezone,
      openMin: timeToMinutes(c.open_time.slice(0, 5)),
      closeMin: timeToMinutes(c.close_time.slice(0, 5)),
      slotMin: c.slot_minutes,
      workingDays: [...c.working_days].sort(),
    },
    member: { id: m.id, name: m.display_name },
    roles,
    permissions: new Set((perms.data ?? []).map((p) => p.permission)),
    doctors: (doctorRows.data ?? [])
      .filter((d) => d.clinic_members?.status === 'aktif')
      .map((d) => ({ id: d.member_id, name: d.clinic_members!.display_name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    chairs: (chairRows.data ?? []).map((ch) => ({ id: ch.id, name: ch.name })),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [authSession, setAuthSession] = useState<Session | null | undefined>(undefined);
  const [version, setVersion] = useState(0);
  // Yüklenen klinik oturumu, hangi kullanıcı/yükleme için olduğu bilgisiyle saklanır.
  const [loaded, setLoaded] = useState<{ key: string; state: SessionState } | null>(null);

  useEffect(() => {
    if (supabaseConfigError) return;
    supabase.auth.getSession().then(({ data }) => setAuthSession(data.session));
    // Not: bu geri çağırmanın içinde başka bir Supabase çağrısı yapılmıyor; yükleme aşağıdaki effect'te.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      setAuthSession(session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = authSession?.user.id;
  const email = authSession?.user.email ?? '';
  const loadKey = `${userId}:${version}`;

  useEffect(() => {
    if (supabaseConfigError || !userId) return;
    let active = true;
    loadClinicSession(userId, email)
      .then((s) => active && setLoaded({ key: loadKey, state: s }))
      .catch(
        (e) =>
          active &&
          setLoaded({
            key: loadKey,
            state: { status: 'error', message: e instanceof Error ? e.message : 'Bilinmeyen hata' },
          }),
      );
    return () => {
      active = false;
    };
    // authSession nesnesi her token yenilemede değişir; yalnızca kullanıcı değişince yeniden yükle.
  }, [userId, email, loadKey]);

  // Durum, efektte atanmak yerine buradan türetilir.
  const authLoading = authSession === undefined;
  const state = useMemo<SessionState>(
    () =>
      supabaseConfigError
        ? { status: 'error', message: supabaseConfigError }
        : authLoading
          ? { status: 'loading' }
          : !userId
            ? { status: 'signedOut' }
            : loaded?.key === loadKey
              ? loaded.state
              : { status: 'loading' },
    [authLoading, userId, loaded, loadKey],
  );

  const signIn = useCallback(async (mail: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: mail.trim(), password });
    if (!error) return null;
    if (error.message.toLowerCase().includes('invalid login credentials'))
      return 'E-posta veya şifre hatalı.';
    return toAppError(error, 'Giriş yapılamadı.').message;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ state, signIn, signOut, reload }),
    [state, signIn, signOut, reload],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession, SessionProvider içinde kullanılmalı.');
  return ctx;
}

/** Giriş yapılmış ve kliniği yüklenmiş oturum. Yalnızca erişim kapısının içindeki ekranlarda. */
export function useClinicSession() {
  const { state } = useSession();
  if (state.status !== 'ready') throw new Error('Klinik oturumu hazır değil.');
  const can = (perm: Permission) => state.permissions.has(perm);
  return { ...state, can };
}

export const roleLabels: Record<ClinicRole, string> = {
  sahip: 'Sahip',
  yonetici: 'Yönetici',
  hekim: 'Hekim',
  resepsiyonist: 'Resepsiyon',
};
