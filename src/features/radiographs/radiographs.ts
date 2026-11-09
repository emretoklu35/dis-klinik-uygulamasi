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
          'id, patient_id, treatment_id, purpose, kind, tooth, taken_on, note, storage_path, invalidated_at',
        )
        .eq('clinic_id', clinicId)
        .eq('patient_id', patientId)
        .order('taken_on', { ascending: false })
        .order('created_at', { ascending: false }),
      'Röntgenler yüklenemedi.',
    );
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

  async upload(clinicId: string, patientId: string, input: NewRadiographInput) {
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

    unwrap(
      await supabase
        .from('radiographs')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          treatment_id: input.treatmentId ?? null,
          purpose: input.purpose,
          kind: input.kind,
          tooth: input.tooth ?? null,
          taken_on: input.takenOn,
          note: input.note ?? null,
          storage_path: path,
          content_type: 'image/jpeg',
        })
        .select('id')
        .single(),
      // Dosya yüklendi ama kayıt oluşmadı: dosya klasörde sahipsiz kalır (silme yetkisi yok).
      'Görüntü yüklendi ama röntgen kaydı oluşturulamadı.',
    );
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

/** Bitim röntgeni beklenen işlemler (tamamlanırken uyarı gösterilir). */
export function needsCompletionRadiograph(procedure: string) {
  const p = procedure.toLocaleLowerCase('tr-TR');
  return p.includes('kanal') || p.includes('implant') || p.includes('çekim');
}
