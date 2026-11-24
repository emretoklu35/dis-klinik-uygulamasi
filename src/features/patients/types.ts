/**
 * Hasta modülünün uygulama içi tipleri. Veritabanı satırlarından repository.ts'de dönüştürülür.
 *
 * Yetki modeli:
 *  - Temel bilgi + alerji İŞARETİ: tüm klinik personeli
 *  - Sağlık ayrıntısı (alerji adları, kronik hastalık, klinik not) ve tedaviler: yalnızca hekim
 * Yetkisi olmayan kullanıcı için `medical` ve `treatments` alanları `null` gelir
 * ("kayıt yok" anlamına gelen boş diziden farklıdır).
 */

import type { Database } from '@/lib/database.types';

type Enums = Database['public']['Enums'];

export type Gender = Enums['gender'];
export type TreatmentStatus = Enums['treatment_status'];
export type TreatmentKind = Enums['treatment_kind'];

export type Treatment = {
  id: string;
  date: string; // gün anahtarı
  procedure: string;
  /** Diş şeması rengi bu türden okunur */
  kind: TreatmentKind;
  tooth?: string;
  doctorMemberId: string;
  doctorName: string;
  status: TreatmentStatus;
  note?: string;
  /** Ait olduğu tedavi planı */
  planId: string;
  /** Plandaki ücret (kuruş); tamamlanınca hastanın borcuna eklenir */
  amount?: number;
  /** İndirimden önceki liste fiyatı (amount'tan büyükse indirim var) */
  listAmount?: number;
  priceItemId?: string;
};

/** Hastanın tedavi planı. Aynı anda yalnızca biri uygulanır. */
export type TreatmentPlan = {
  id: string;
  title: string;
  doctorName: string;
  isActive: boolean;
  createdAt: string;
  /** Kilitliyse: hasta onayladı, fiyatlar ve işlemler değişmez */
  lockedAt?: string;
  lockedByName?: string;
};

/** Elle atılan imza: SVG yol verisi ve çizildiği alanın boyutu */
export type Signature = { w: number; h: number; d: string };

/** Hastanın proformayı imzaladığı an ve o anda onayladığı içerik */
export type PlanApproval = {
  id: string;
  planId: string;
  signature: Signature;
  items: { procedure: string; tooth?: string | null; status: string; amount?: number | null }[];
  total: number;
  signedAt: string;
  recordedByName?: string;
};

/** Tedavi ekleme/düzenleme girdisi (yalnızca hekim). */
export type TreatmentInput = {
  date: string; // gün anahtarı
  procedure: string;
  kind: TreatmentKind;
  tooth?: string;
  status: TreatmentStatus;
  note?: string;
  /** Boşsa uygulanan plana girer */
  planId?: string;
  amount?: number;
  priceItemId?: string;
};

export type PatientMedical = {
  allergies: string[];
  conditions: string[];
  clinicalNotes?: string;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string; // gün anahtarı
  gender: Gender;
  /** İdari not (ör. "veli ile geliyor"). Herkes görür. */
  adminNote?: string;
  /** Alerji kaydı var mı? Ayrıntı yalnızca hekime açık. */
  hasAllergyAlert: boolean;
  createdAt: string;
  /** Yetki yoksa null. */
  medical: PatientMedical | null;
  /** Yetki yoksa null. */
  treatments: Treatment[] | null;
};

export type NewPatientInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string;
  gender: Gender;
  adminNote?: string;
  /** Yalnızca hekim girebilir; diğer roller için gönderilmez. */
  medical?: PatientMedical;
};

/** Listede gösterilen özet. */
export type PatientSummary = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  hasAllergyAlert: boolean;
  /** Son tamamlanan randevunun günü. */
  lastVisit?: string;
  /** Klinik yerel tarih-saat. */
  nextAppointment?: string;
};
