/**
 * SAHTE DEMO VERİSİ
 * Buradaki isimler ve kayıtlar gerçek kişilere ait değildir; yalnızca
 * arayüzü göstermek içindir. Veritabanı bağlandığında bu dosya kaldırılacak.
 */

export type DemoAppointment = {
  id: string;
  day: number; // 0 = Pazartesi … 5 = Cumartesi
  time: string;
  patient: string;
  procedure: string;
  doctor: string;
  status: 'onaylandi' | 'bekliyor';
};

export type DemoTask = {
  id: string;
  title: string;
  due: string;
  priority: 'yuksek' | 'normal';
  done: boolean;
};

export const demoClinic = {
  name: 'Örnek Diş Polikliniği',
  doctors: ['Dr. Demo A', 'Dr. Demo B'],
  chairs: 3,
  workingHours: '09:00 – 18:00',
};

export const demoAppointments: DemoAppointment[] = [
  { id: 'r1', day: 0, time: '09:30', patient: 'Demo Hasta 1', procedure: 'Kontrol muayenesi', doctor: 'Dr. Demo A', status: 'onaylandi' },
  { id: 'r2', day: 0, time: '10:15', patient: 'Demo Hasta 2', procedure: 'Diş taşı temizliği', doctor: 'Dr. Demo B', status: 'onaylandi' },
  { id: 'r3', day: 0, time: '11:00', patient: 'Demo Hasta 3', procedure: 'Dolgu', doctor: 'Dr. Demo A', status: 'bekliyor' },
  { id: 'r4', day: 0, time: '14:00', patient: 'Demo Hasta 4', procedure: 'Kanal tedavisi (2. seans)', doctor: 'Dr. Demo A', status: 'onaylandi' },
  { id: 'r5', day: 1, time: '09:00', patient: 'Demo Hasta 5', procedure: 'Panoramik röntgen', doctor: 'Dr. Demo B', status: 'onaylandi' },
  { id: 'r6', day: 1, time: '13:30', patient: 'Demo Hasta 6', procedure: 'İmplant kontrolü', doctor: 'Dr. Demo A', status: 'bekliyor' },
  { id: 'r7', day: 2, time: '10:00', patient: 'Demo Hasta 7', procedure: 'Beyazlatma', doctor: 'Dr. Demo B', status: 'onaylandi' },
  { id: 'r8', day: 3, time: '15:30', patient: 'Demo Hasta 8', procedure: 'Diş çekimi', doctor: 'Dr. Demo A', status: 'onaylandi' },
  { id: 'r9', day: 4, time: '11:45', patient: 'Demo Hasta 9', procedure: 'Ortodonti kontrolü', doctor: 'Dr. Demo B', status: 'bekliyor' },
];

export const demoTasks: DemoTask[] = [
  { id: 't1', title: 'Yarınki randevular için hatırlatma listesi hazırla', due: 'Bugün', priority: 'yuksek', done: false },
  { id: 't2', title: 'Sterilizasyon cihazı haftalık kontrolü', due: 'Bugün', priority: 'yuksek', done: false },
  { id: 't3', title: 'Sarf malzeme siparişini gözden geçir', due: 'Yarın', priority: 'normal', done: false },
  { id: 't4', title: 'Laboratuvara ölçü gönderimi', due: 'Perşembe', priority: 'normal', done: true },
];

export const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const weekDaysLong = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
