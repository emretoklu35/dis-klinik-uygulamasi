-- =============================================================================
-- Tedavi türü testleri (pgTAP).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(12);

select is(private.guess_treatment_kind('İmplant cerrahisi'), 'implant'::treatment_kind,
  'İmplant cerrahisi → implant');
select is(private.guess_treatment_kind('implant yapıldı'), 'implant'::treatment_kind,
  'Küçük harfle "implant yapıldı" → implant');
select is(private.guess_treatment_kind('İmplant kontrolü'), 'muayene'::treatment_kind,
  'İmplant kontrolü → muayene (dişi işaretlemez)');
select is(private.guess_treatment_kind('İmplant değerlendirmesi'), 'muayene'::treatment_kind,
  'İmplant değerlendirmesi → muayene');
select is(private.guess_treatment_kind('Kanal tedavisi'), 'kanal'::treatment_kind, 'Kanal → kanal');
select is(private.guess_treatment_kind('Diş çekimi'), 'cekim'::treatment_kind, 'Diş çekimi → çekim');

select is(private.guess_treatment_kind('Panoramik röntgen'), 'rontgen'::treatment_kind,
  'Panoramik röntgen → röntgen (dişi işaretlemez)');
select is(private.guess_treatment_kind('Diş eti küretajı'), 'dis_eti'::treatment_kind,
  'Diş eti küretajı → diş eti tedavisi');
select is(private.guess_treatment_kind('Ofis tipi beyazlatma'), 'beyazlatma'::treatment_kind,
  'Beyazlatma ayrı türdür');

select is(
  (select count(*)::int from treatments where kind is null), 0,
  'Eski kayıtların hepsine tür verildi');

insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001', '2026-11-01', 'Implant yerleştirme', '46', 'tamamlandi');
select is(
  (select kind from treatments where procedure = 'Implant yerleştirme'), 'implant'::treatment_kind,
  'Tür verilmeden eklenen kayıtta işlem adından tahmin edilir');

insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'b0000000-0000-4000-8000-000000000001', '2026-11-01', 'Vida yerleştirildi', '36', 'tamamlandi', 'implant');
select is(
  (select kind from treatments where procedure = 'Vida yerleştirildi'), 'implant'::treatment_kind,
  'Seçilen tür, işlem adından bağımsız olarak saklanır');

select * from finish();
rollback;
