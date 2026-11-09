/**
 * Röntgenler: tipler, veri erişimi (Supabase tablo + herkese kapalı Storage klasörü) ve kanca.
 *
 * Güvenlik:
 *  - Dosyalar "radiographs" klasöründe, <klinik>/<hasta>/<rastgele>.jpg yolunda durur.
 *  - Görüntüler yalnızca birkaç dakika geçerli imzalı bağlantıyla açılır.
 *  - Yüklemeden önce görüntü küçültülüp yeniden kodlanır; bu, dosyaya gömülü bilgileri
 *    (konum, cihazın yazdığı hasta adı vb.) temizler.
 *  - Görme/yükleme yetkisi yalnızca hekimde (veritabanı ve Storage kuralları denetler).
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCallback } from 'react';

import { useClinicSession } from '@/features/session/session-context';
import type { Database } from '@/lib/database.types';
import { toAppError, unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';
import { useFocusLoad } from '@/lib/use-focus-load';

type Enums = Database['public']['Enums'];
export type RadiographPurpose = Enums['radiograph_purpose'];
export type RadiographKind = Enums['radiograph_kind'];
export type ReviewStatus = Enums['media_review_status'];

export const reviewLabels: Record<ReviewStatus, string> = {
  inceleme_bekliyor: 'İnceleme bekliyor',
  onaylandi: 'Onaylandı',
  tekrar_istendi: 'Tekrar istendi',
};

export const BUCKET = 'radiographs';
const MAX_SIDE = 2000;
const SIGNED_URL_SECONDS = 300;

export const purposeLabels: Record<RadiographPurpose, string> = {
  tedavi_oncesi: 'Tedavi öncesi',
  tedavi_sonrasi: 'Bitim (sonrası)',
  kontrol: 'Kontrol',
  teshis: 'Teşhis',
};

export const kindLabels: Record<RadiographKind, string> = {
  panoramik: 'Panoramik',
  periapikal: 'Periapikal',
  bitewing: 'Bitewing',
  sefalometrik: 'Sefalometrik',
  agiz_ici_fotograf: 'Ağız içi fotoğraf',
  diger: 'Diğer',
};

export type Radiograph = {
  id: string;
  patientId: string;
  treatmentId?: string;
  purpose: RadiographPurpose;
  kind: RadiographKind;
  tooth?: string;
  takenOn: string; // gün anahtarı
  note?: string;
  storagePath: string;
  invalid: boolean;
  reviewStatus: ReviewStatus;
  reviewNote?: string;
  /** Yükleyen personelin adı */
  uploadedByName?: string;
  /** Kısa süreli imzalı bağlantı (birkaç dakika geçerli). */
  url?: string;
};

export type NewRadiographInput = {
  /** Cihazdan seçilen görüntünün yerel adresi (ImagePicker sonucu). */
  sourceUri: string;
  sourceWidth?: number;
  purpose: RadiographPurpose;
  kind: RadiographKind;
  treatmentId?: string;
  tooth?: string;
  takenOn: string;
  note?: string;
  /** Hekimin tekrar çekim isteğine karşılık yükleniyorsa */
  requestId?: string;
};

/** Hekimin tekrar çekim isteği. Görüntü yolu içermez; asistan da görür. */
export type MediaRequest = {
  id: string;
  patientId: string;
  patientName: string;
  kind: RadiographKind;
  purpose: RadiographPurpose;
  tooth?: string;
  reason: string;
  requestedAt: string;
};

/** Tahmin edilemeyen, hasta bilgisi içermeyen dosya adı. */
function randomName() {
  const rnd = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rnd()}${rnd()}`;
}

/** Küçültür (en fazla 2000 px) ve JPEG olarak yeniden kodlar; gömülü bilgiler bu sırada silinir. */
async function prepareImage(uri: string, width?: number) {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > MAX_SIDE) ctx.resize({ width: MAX_SIDE });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  const body = await (await fetch(saved.uri)).arrayBuffer();
  if (body.byteLength > 10 * 1024 * 1024) {
    throw toAppError(null, 'Görüntü çok büyük (en fazla 10 MB).');
  }
  return body;
}

export const radiographRepository = {
  async listForPatient(clinicId: string, patientId: string): Promise<Radiograph[]> {
    const rows = unwrap(
      await supabase
        .from('radiographs')
        .select(
          'id, patient_id, treatment_id, purpose, kind, tooth, taken_on, note, storage_path, invalidated_at, review_status, review_note, uploaded_by',
        )
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: false }),
      'Röntgenler yüklenemedi.',
    );
    // Yükleyen adını göstermek için üye listesi (klinik.oku yetkisiyle okunur)
    const { data: members } = await supabase
      .from('clinic_members')
      .select('user_id, display_name')
      .eq('clinic_id', clinicId);
    const nameOf = new Map((members ?? []).map((m) => [m.user_id, m.display_name]));

    const items: Radiograph[] = rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      treatmentId: r.treatment_id ?? undefined,
      purpose: r.purpose,
      kind: r.kind,
      tooth: r.tooth ?? undefined,
      takenOn: r.taken_on,
      note: r.note ?? undefined,
      storagePath: r.storage_path,
      invalid: r.invalidated_at !== null,
      reviewStatus: r.review_status,
      reviewNote: r.review_note ?? undefined,
      uploadedByName: r.uploaded_by ? nameOf.get(r.uploaded_by) : undefined,
    }));
    if (items.length === 0) return items;

    const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrls(
      items.map((i) => i.storagePath),
      SIGNED_URL_SECONDS,
    );
    if (error) throw toAppError(error, 'Röntgen görüntüleri açılamadı.');
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return items.map((i) => ({ ...i, url: byPath.get(i.storagePath) ?? undefined }));
  },

  /**
   * canSeeMedia: hekim mi? Asistan yüklediği kaydı geri OKUYAMAZ (RLS), bu yüzden
   * onun için kayıt "geri döndürmeden" eklenir.
   */
  async upload(
    clinicId: string,
    patientId: string,
    input: NewRadiographInput,
    canSeeMedia: boolean,
  ) {
    const body = await prepareImage(input.sourceUri, input.sourceWidth);
    const path = `${clinicId}/${patientId}/${randomName()}.jpg`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: 'image/jpeg', upsert: false });
    if (upErr) {
      const msg = upErr.message.toLowerCase();
      if (msg.includes('row-level security') || msg.includes('unauthorized')) {
        throw toAppError({ code: '42501' }, 'Röntgen yüklenemedi.');
      }
      throw toAppError(upErr, 'Röntgen yüklenemedi.');
    }

    const row = {
      clinic_id: clinicId,
      patient_id: patientId,
      treatment_id: input.treatmentId ?? null,
      request_id: input.requestId ?? null,
      purpose: input.purpose,
      kind: input.kind,
      tooth: input.tooth ?? null,
      taken_on: input.takenOn,
      note: input.note ?? null,
      storage_path: path,
      content_type: 'image/jpeg',
    };
    // Dosya yüklendi ama kayıt oluşmazsa dosya klasörde sahipsiz kalır (silme yetkisi yok).
    const failMsg = 'Görüntü yüklendi ama kayıt oluşturulamadı.';
    if (canSeeMedia) {
      unwrap(await supabase.from('radiographs').insert(row).select('id').single(), failMsg);
    } else {
      const { error } = await supabase.from('radiographs').insert(row);
      if (error) throw toAppError(error, failMsg);
    }
  },

  /** Hekim incelemesi. "tekrar_istendi" için sebep zorunlu; veritabanı otomatik istek açar. */
  async review(id: string, status: ReviewStatus, note?: string) {
    unwrap(
      await supabase
        .from('radiographs')
        .update({ review_status: status, review_note: note ?? null })
        .eq('id', id)
        .select('id')
        .single(),
      'İnceleme kaydedilemedi.',
    );
  },

  /** Açık tekrar çekim istekleri (hasta verilirse yalnızca o hasta). */
  async listOpenRequests(clinicId: string, patientId?: string): Promise<MediaRequest[]> {
    let q = supabase
      .from('media_requests')
      .select(
        'id, patient_id, kind, purpose, tooth, reason, requested_at, patients(first_name, last_name)',
      )
      .eq('clinic_id', clinicId)
      .is('fulfilled_at', null)
      .order('requested_at');
    if (patientId) q = q.eq('patient_id', patientId);
    const rows = unwrap(await q, 'Çekim istekleri yüklenemedi.');
    return rows.map((r) => ({
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : '—',
      kind: r.kind,
      purpose: r.purpose,
      tooth: r.tooth ?? undefined,
      reason: r.reason,
      requestedAt: r.requested_at,
    }));
  },

  /** Hekim için: incelenmeyi bekleyen görüntü sayısı. */
  async countPendingReview(clinicId: string) {
    const { count, error } = await supabase
      .from('radiographs')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('review_status', 'inceleme_bekliyor')
      .is('invalidated_at', null);
    if (error) throw toAppError(error, 'İnceleme sayısı alınamadı.');
    return count ?? 0;
  },

  /** Yanlış hastaya/yanlış görüntü: silinmez, geçersiz işaretlenir. */
  async invalidate(id: string) {
    unwrap(
      await supabase
        .from('radiographs')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .single(),
      'Röntgen güncellenemedi.',
    );
  },
};

export function usePatientRadiographs(patientId: string | undefined, enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () =>
      enabled && patientId
        ? radiographRepository.listForPatient(clinic.id, patientId)
        : Promise.resolve([] as Radiograph[]),
    [clinic.id, patientId, enabled],
  );
  return useFocusLoad<Radiograph[]>(load, [], 'Röntgenler yüklenemedi.');
}

export function useOpenMediaRequests(patientId: string | undefined, enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () =>
      enabled
        ? radiographRepository.listOpenRequests(clinic.id, patientId)
        : Promise.resolve([] as MediaRequest[]),
    [clinic.id, patientId, enabled],
  );
  return useFocusLoad<MediaRequest[]>(load, [], 'Çekim istekleri yüklenemedi.');
}

export function usePendingReviewCount(enabled: boolean) {
  const { clinic } = useClinicSession();
  const load = useCallback(
    () => (enabled ? radiographRepository.countPendingReview(clinic.id) : Promise.resolve(0)),
    [clinic.id, enabled],
  );
  return useFocusLoad<number>(load, 0, 'İnceleme sayısı alınamadı.');
}

/** Bitim röntgeni beklenen işlemler (tamamlanırken uyarı gösterilir). */
export function needsCompletionRadiograph(procedure: string) {
  const p = procedure.toLocaleLowerCase('tr-TR');
  return p.includes('kanal') || p.includes('implant') || p.includes('çekim');
}
