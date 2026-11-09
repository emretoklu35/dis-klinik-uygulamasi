/**
 * Hasta modülünün veri tipleri.
 * Veritabanı (ör. Supabase) bağlandığında tablo yapısı bu tiplerle eşleşecek.
 */

export type Gender = 'kadin' | 'erkek' | 'belirtilmedi';

export type TreatmentStatus = 'planlandi' | 'devam' | 'tamamlandi';

export type Treatment = {
  id: string;
  date: string; // ISO tarih: 2026-10-14
  procedure: string;
  /** FDI diş numarası, ör. "36". Genel işlemlerde boş. */
  tooth?: string;
  doctor: string;
  status: TreatmentStatus;
  note?: string;
};

export type Patient = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  birthDate?: string; // ISO tarih
  gender: Gender;
  /** Alerjiler: tedavi öncesi mutlaka görünmeli. */
  allergies: string[];
  /** Kronik hastalıklar / sürekli kullanılan ilaçlar. */
  medicalNotes: string[];
  notes?: string;
  createdAt: string; // ISO tarih-saat
  lastVisit?: string; // ISO tarih
  treatments: Treatment[];
};

/** Yeni hasta oluştururken formdan gelen alanlar. */
export type NewPatientInput = Pick<
  Patient,
  'firstName' | 'lastName' | 'phone' | 'email' | 'birthDate' | 'gender' | 'notes'
> & {
  allergies: string[];
  medicalNotes: string[];
};

/** Listede gösterilen özet (detay ekranına göre daha hafif). */
export type PatientSummary = Pick<Patient, 'id' | 'firstName' | 'lastName' | 'phone' | 'lastVisit'> & {
  /** Randevu kayıtlarından hesaplanır (yerel tarih-saat). */
  nextAppointment?: string;
  hasAllergy: boolean;
  activeTreatments: number;
};
