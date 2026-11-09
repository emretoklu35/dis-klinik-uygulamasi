/**
 * SAHTE DEMO VERİSİ
 * Buradaki isimler ve kayıtlar gerçek kişilere ait değildir; yalnızca
 * arayüzü göstermek içindir. Veritabanı bağlandığında bu dosya kaldırılacak.
 */

export type DemoTask = {
  id: string;
  title: string;
  due: string;
  priority: 'yuksek' | 'normal';
  done: boolean;
};

export const demoTasks: DemoTask[] = [
  { id: 't1', title: 'Yarınki randevular için hatırlatma listesi hazırla', due: 'Bugün', priority: 'yuksek', done: false },
  { id: 't2', title: 'Sterilizasyon cihazı haftalık kontrolü', due: 'Bugün', priority: 'yuksek', done: false },
  { id: 't3', title: 'Sarf malzeme siparişini gözden geçir', due: 'Yarın', priority: 'normal', done: false },
  { id: 't4', title: 'Laboratuvara ölçü gönderimi', due: 'Perşembe', priority: 'normal', done: true },
];
