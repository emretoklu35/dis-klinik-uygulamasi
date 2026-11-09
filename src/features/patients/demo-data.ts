/**
 * SAHTE DEMO HASTALARI
 * İsimler, telefonlar ve tedaviler uydurmadır; gerçek kişilere ait değildir.
 * Telefon numaraları bilerek "0500 000 .." biçimindedir.
 */

import type { Patient } from './types';

export const demoPatients: Patient[] = [
  {
    id: 'h1',
    firstName: 'Demo',
    lastName: 'Hasta 1',
    phone: '0500 000 00 01',
    email: 'demo1@ornek.test',
    birthDate: '1988-04-12',
    gender: 'kadin',
    allergies: ['Penisilin'],
    medicalNotes: [],
    notes: 'Diş hekimi kaygısı var; işlemleri önceden anlatmak iyi geliyor.',
    createdAt: '2025-02-03T10:00:00',
    lastVisit: '2026-10-26',
    treatments: [
      { id: 't1', date: '2026-10-26', procedure: 'Kontrol muayenesi', doctor: 'Dr. Demo A', status: 'tamamlandi' },
      { id: 't2', date: '2026-11-09', procedure: 'Dolgu', tooth: '26', doctor: 'Dr. Demo A', status: 'planlandi' },
    ],
  },
  {
    id: 'h2',
    firstName: 'Demo',
    lastName: 'Hasta 2',
    phone: '0500 000 00 02',
    birthDate: '1975-09-30',
    gender: 'erkek',
    allergies: [],
    medicalNotes: ['Hipertansiyon', 'Kan sulandırıcı kullanıyor'],
    createdAt: '2024-11-18T14:20:00',
    lastVisit: '2026-10-09',
    treatments: [
      { id: 't3', date: '2026-09-02', procedure: 'Panoramik röntgen', doctor: 'Dr. Demo B', status: 'tamamlandi' },
      { id: 't4', date: '2026-10-09', procedure: 'Diş taşı temizliği', doctor: 'Dr. Demo B', status: 'tamamlandi' },
    ],
  },
  {
    id: 'h3',
    firstName: 'Demo',
    lastName: 'Hasta 3',
    phone: '0500 000 00 03',
    birthDate: '2001-01-22',
    gender: 'kadin',
    allergies: ['Lateks'],
    medicalNotes: [],
    createdAt: '2026-06-11T09:00:00',
    lastVisit: '2026-11-06',
    treatments: [
      { id: 't5', date: '2026-10-20', procedure: 'Kanal tedavisi (1. seans)', tooth: '36', doctor: 'Dr. Demo A', status: 'devam' },
      { id: 't6', date: '2026-11-06', procedure: 'Kanal tedavisi (2. seans)', tooth: '36', doctor: 'Dr. Demo A', status: 'devam' },
      { id: 't7', date: '2026-11-20', procedure: 'Kron ölçüsü', tooth: '36', doctor: 'Dr. Demo A', status: 'planlandi' },
    ],
  },
  {
    id: 'h4',
    firstName: 'Örnek',
    lastName: 'Kişi',
    phone: '0500 000 00 04',
    birthDate: '1962-07-05',
    gender: 'erkek',
    allergies: [],
    medicalNotes: ['Diyabet (Tip 2)'],
    notes: 'İmplant tedavisi planlanıyor.',
    createdAt: '2023-03-27T16:45:00',
    lastVisit: '2026-08-14',
    treatments: [
      { id: 't8', date: '2026-08-14', procedure: 'İmplant değerlendirmesi', tooth: '46', doctor: 'Dr. Demo A', status: 'tamamlandi' },
      { id: 't9', date: '2026-11-25', procedure: 'İmplant cerrahisi', tooth: '46', doctor: 'Dr. Demo A', status: 'planlandi' },
    ],
  },
  {
    id: 'h5',
    firstName: 'Test',
    lastName: 'Çocuk',
    phone: '0500 000 00 05',
    birthDate: '2016-12-01',
    gender: 'belirtilmedi',
    allergies: [],
    medicalNotes: [],
    notes: 'Veli ile birlikte geliyor.',
    createdAt: '2026-01-09T11:30:00',
    lastVisit: '2026-07-01',
    treatments: [
      { id: 't10', date: '2026-07-01', procedure: 'Fissür örtücü', doctor: 'Dr. Demo B', status: 'tamamlandi' },
    ],
  },
  {
    id: 'h6',
    firstName: 'Şule',
    lastName: 'Örnekoğlu',
    phone: '0500 000 00 06',
    birthDate: '1993-03-17',
    gender: 'kadin',
    allergies: [],
    medicalNotes: [],
    createdAt: '2025-09-14T13:00:00',
    lastVisit: '2026-05-21',
    treatments: [
      { id: 't11', date: '2026-05-21', procedure: 'Ortodonti kontrolü', doctor: 'Dr. Demo B', status: 'devam' },
    ],
  },
];
