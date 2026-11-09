import type { Database } from '@/lib/database.types';

type Enums = Database['public']['Enums'];

export type AppointmentStatus = Enums['appointment_status'];
export type VisitType = Enums['visit_type'];

/** Randevunun klinik ayrıntısı: yalnızca hekim görür/yazar. */
export type AppointmentClinical = {
  procedure?: string;
  tooth?: string;
  clinicalNote?: string;
};

export type Appointment = {
  id: string;
  patientId: string;
  patientName: string;
  /** Klinik yerel tarih-saat: 'YYYY-AA-GGTSS:DD' */
  start: string;
  durationMin: number;
  /** Herkesin gördüğü genel tür. */
  visitType: VisitType;
  doctorMemberId: string;
  doctorName: string;
  chairId: string;
  chairName: string;
  status: AppointmentStatus;
  /** İdari not; tüm personel görür. */
  deskNote?: string;
  /** Yetki yoksa ya da henüz girilmediyse null. */
  clinical: AppointmentClinical | null;
  createdAt: string;
};

export type AppointmentInput = {
  patientId: string;
  start: string;
  durationMin: number;
  visitType: VisitType;
  doctorMemberId: string;
  chairId: string;
  deskNote?: string;
  /** Yalnızca hekim yetkisiyle gönderilir. */
  clinical?: AppointmentClinical;
};
