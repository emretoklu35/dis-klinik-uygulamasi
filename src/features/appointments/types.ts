export type AppointmentStatus = 'bekliyor' | 'onaylandi' | 'tamamlandi' | 'gelmedi' | 'iptal';

export type Appointment = {
  id: string;
  patientId: string;
  /**
   * Gösterim için hasta adı. Veritabanına geçince hasta tablosundan
   * birleştirme (join) ile gelecek; şimdilik randevuyla birlikte tutuluyor.
   */
  patientName: string;
  /** Yerel tarih-saat: 'YYYY-AA-GGTSS:DD' */
  start: string;
  durationMin: number;
  procedure: string;
  doctor: string;
  chair: string;
  status: AppointmentStatus;
  note?: string;
  createdAt: string;
};

export type AppointmentInput = Pick<
  Appointment,
  'patientId' | 'patientName' | 'start' | 'durationMin' | 'procedure' | 'doctor' | 'chair' | 'note'
>;
