/**
 * Aktivite akışı: klinikte kim, ne zaman, ne yaptı.
 * Veri veritabanındaki activity_feed görünümünden gelir; her olay kaynağının RLS kuralına
 * tabidir (herkes yalnızca görmeye yetkili olduğu olayları görür).
 */

import type Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, type ComponentProps } from 'react';

import { visitTypeLabels } from '@/features/appointments/clinic';
import type { AppointmentStatus, VisitType } from '@/features/appointments/types';
import { statusLabels } from '@/features/appointments/utils';
import { kindLabels as noteKindLabels, type NoteKind } from '@/features/notes/notes';
import { methodLabels, type PaymentMethod } from '@/features/payments/payments';
import {
  kindLabels as mediaKindLabels,
  purposeLabels,
  reviewLabels,
  type RadiographKind,
  type RadiographPurpose,
  type ReviewStatus,
} from '@/features/radiographs/radiographs';
import { useClinicSession } from '@/features/session/session-context';
import { formatQty } from '@/features/stock/stock';
import { formatDayLong, toClinicLocal } from '@/lib/dates';
import { unwrap } from '@/lib/db-errors';
import { formatTL } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';
import { Colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type ActivityCategory =
  'hasta' | 'randevu' | 'tedavi' | 'gorsel' | 'not' | 'odeme' | 'stok' | 'gorev';

export const categoryInfo: Record<
  ActivityCategory,
  { label: string; icon: IconName; color: string; soft: string }
> = {
  hasta: { label: 'Hastalar', icon: 'person-outline', color: '#DC5A5A', soft: '#FDECEC' },
  randevu: { label: 'Randevular', icon: 'calendar-outline', color: '#0F8A7E', soft: '#E3F4F2' },
  tedavi: { label: 'Tedaviler', icon: 'medkit-outline', color: '#DC5A5A', soft: '#FDECEC' },
  gorsel: { label: 'Görüntüler', icon: 'image-outline', color: '#7C3AED', soft: '#F1EAFE' },
  not: {
    label: 'Notlar',
    icon: 'document-text-outline',
    color: Colors.primary,
    soft: Colors.primarySoft,
  },
  odeme: { label: 'Ödemeler', icon: 'wallet-outline', color: '#B7791F', soft: '#FDF3E3' },
  stok: { label: 'Stok', icon: 'cube-outline', color: '#475569', soft: '#EEF0F3' },
  gorev: {
    label: 'Görevler',
    icon: 'checkbox-outline',
    color: Colors.success,
    soft: Colors.successSoft,
  },
};

export const CATEGORY_ORDER: ActivityCategory[] = [
  'hasta',
  'randevu',
  'tedavi',
  'gorsel',
  'not',
  'odeme',
  'stok',
  'gorev',
];

export type Activity = {
  id: string;
  /** Klinik yerel tarih-saat 'YYYY-AA-GGTSS:DD' */
  at: string;
  iso: string;
  category: ActivityCategory;
  patientId?: string;
  patientName?: string;
  actorUserId?: string;
  actorName: string;
  /** Hasta adından sonra gelen cümle (ör. "isimli hasta sisteme eklendi") */
  sentence: string;
  /** Hasta yoksa cümlenin başı (ör. "Görev oluşturuldu") */
  lead?: string;
  /** Kartın altındaki ayrıntı satırları */
  details: string[];
};

type Row = {
  id: string | null;
  occurred_at: string | null;
  category: string | null;
  event: string | null;
  patient_id: string | null;
  patient_name: string | null;
  actor_user_id: string | null;
  title: string | null;
  detail: string | null;
  amount: number | null;
};

function apptWhen(local: string | null) {
  if (!local) return '';
  return `${formatDayLong(local.slice(0, 10))} ${local.slice(11, 16)}`;
}

/** Olayı Türkçe cümleye çevirir */
function describe(r: Row): Pick<Activity, 'sentence' | 'lead' | 'details'> {
  const title = r.title ?? '';
  const detail = r.detail ?? '';
  const tooth = detail ? `Diş: ${detail}` : null;
  switch (r.event) {
    case 'hasta_eklendi':
      return { sentence: 'isimli hasta sisteme eklendi', details: [] };
    case 'randevu_olusturuldu':
      return {
        sentence: 'için randevu oluşturuldu',
        details: [`${apptWhen(detail)} · ${visitTypeLabels[title as VisitType] ?? title}`],
      };
    case 'randevu_durum':
      return {
        sentence: `randevusu: ${(statusLabels[title as AppointmentStatus] ?? title).toLowerCase()}`,
        details: [apptWhen(detail)],
      };
    case 'tedavi_eklendi':
      return {
        sentence: 'için tedavi planlandı',
        details: [[title, tooth].filter(Boolean).join(' · ')],
      };
    case 'tedavi_tamamlandi':
      return {
        sentence: 'için tedavi tamamlandı',
        details: [[title, tooth].filter(Boolean).join(' · ')],
      };
    case 'gorsel_yuklendi':
      return {
        sentence: 'isimli hasta sayfasına görüntü yüklendi',
        details: [
          `${mediaKindLabels[title as RadiographKind] ?? title} · ${purposeLabels[detail as RadiographPurpose] ?? detail}`,
        ],
      };
    case 'gorsel_incelendi':
      return {
        sentence: 'görüntüsü incelendi',
        details: [
          `${mediaKindLabels[title as RadiographKind] ?? title} · ${reviewLabels[detail as ReviewStatus] ?? detail}`,
        ],
      };
    case 'not_yazildi':
      return {
        sentence: `için ${(noteKindLabels[title as NoteKind] ?? title).toLowerCase()} notu yazıldı`,
        details: detail ? [detail] : [],
      };
    case 'ek_not':
      return { sentence: 'notuna ek not eklendi', details: detail ? [detail] : [] };
    case 'seans_kapatildi':
      return { sentence: 'için seans kapatıldı', details: detail ? [detail] : [] };
    case 'ucret_eklendi':
      return {
        sentence: 'hesabına ücret eklendi',
        details: [
          [title, tooth, r.amount !== null ? formatTL(r.amount) : null].filter(Boolean).join(' · '),
        ],
      };
    case 'odeme_alindi':
      return {
        sentence: 'ödeme yaptı',
        details: [
          `${r.amount !== null ? formatTL(r.amount) : ''} · ${methodLabels[title as PaymentMethod] ?? title}`,
        ],
      };
    case 'stok_giris':
    case 'stok_kullanim':
    case 'stok_fire':
    case 'stok_sayim': {
      const qty = r.amount ?? 0;
      const amount = formatQty(Math.abs(qty), detail || 'adet');
      const verb =
        r.event === 'stok_giris'
          ? `stoğa girildi (+${amount})`
          : r.event === 'stok_kullanim'
            ? `kullanıldı (${amount})`
            : r.event === 'stok_fire'
              ? `fire/imha (${amount})`
              : `sayım düzeltmesi (${qty > 0 ? '+' : '−'}${amount})`;
      return r.patient_id
        ? { sentence: `için ${title} ${verb}`, details: [] }
        : { lead: `${title} ${verb}`, sentence: '', details: [] };
    }
    case 'gorev_olusturuldu':
      return { lead: 'Görev oluşturuldu', sentence: '', details: [title] };
    case 'gorev_tamamlandi':
      return { lead: 'Görev tamamlandı', sentence: '', details: [title] };
    default:
      return { lead: r.event ?? 'Kayıt', sentence: '', details: [] };
  }
}

export const activityRepository = {
  async list(clinicId: string, sinceIso: string): Promise<Activity[]> {
    const [rows, members] = await Promise.all([
      supabase
        .from('activity_feed')
        .select('*')
        .eq('clinic_id', clinicId)
        .gte('occurred_at', sinceIso)
        .lte('occurred_at', new Date(Date.now() + 60_000).toISOString())
        .order('occurred_at', { ascending: false })
        .limit(400),
      supabase.from('clinic_members').select('user_id, display_name').eq('clinic_id', clinicId),
    ]);
    const names = new Map((members.data ?? []).map((m) => [m.user_id, m.display_name]));
    return (unwrap(rows, 'Aktivite akışı yüklenemedi.') as Row[])
      .filter((r) => r.id && r.occurred_at && r.category)
      .map((r) => ({
        id: r.id!,
        iso: r.occurred_at!,
        at: toClinicLocal(r.occurred_at!),
        category: r.category as ActivityCategory,
        patientId: r.patient_id ?? undefined,
        patientName: r.patient_name ?? undefined,
        actorUserId: r.actor_user_id ?? undefined,
        actorName: r.actor_user_id
          ? (names.get(r.actor_user_id) ?? 'Bilinmeyen kullanıcı')
          : 'Sistem (demo verisi)',
        ...describe(r),
      }));
  },
};

export function useActivity(days: number) {
  const { clinic } = useClinicSession();
  const load = useCallback(() => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return activityRepository.list(clinic.id, since);
  }, [clinic.id, days]);
  return useFocusLoad<Activity[]>(load, [], 'Aktivite akışı yüklenemedi.');
}

/** "az önce", "15 dk önce", "3 sa önce", "2 gün önce" */
export function relativeTime(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'az önce';
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} sa önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  return `${Math.floor(d / 30)} ay önce`;
}
