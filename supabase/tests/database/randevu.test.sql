-- =============================================================================
-- Yeni randevu türleri ve hastasız randevu testleri (pgTAP).
-- a..4 resepsiyon
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(7);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select lives_ok(
  $$insert into appointments (clinic_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type, desk_note)
    values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
            'd0000000-0000-4000-8000-000000000003', '2031-03-03 07:00+00', '2031-03-03 07:30+00',
            'cerrahi', 'test-hastasiz')$$,
  'Resepsiyon hastasız (hasta sonra eklenecek) cerrahi randevusu açabilir');
select isnt_empty($$select 1 from activity_feed where event = 'randevu_olusturuldu' and patient_id is null$$,
  'Hastasız randevu aktivite akışında görünür');
select throws_ok(
  $$update appointments set status = 'tamamlandi' where desk_note = 'test-hastasiz'$$,
  '23514', null, 'Hastasız randevu tamamlanamaz');
select lives_ok(
  $$update appointments set patient_id = 'e0000000-0000-4000-8000-000000000001' where desk_note = 'test-hastasiz'$$,
  'Hasta sonradan bağlanır');
select throws_ok(
  $$update appointments set patient_id = 'e0000000-0000-4000-8000-000000000002' where desk_note = 'test-hastasiz'$$,
  '23514', null, 'Bağlanan hasta sonradan değiştirilemez');
select lives_ok(
  $$insert into appointments (clinic_id, patient_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002',
            'b0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000003',
            '2031-03-03 08:00+00', '2031-03-03 08:30+00', 'diger')$$,
  '"Diğer" türünde randevu açılabilir');
select throws_ok(
  $$insert into appointments (clinic_id, doctor_member_id, chair_id, starts_at, ends_at, visit_type)
    values ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002',
            'd0000000-0000-4000-8000-000000000003', '2031-03-03 07:10+00', '2031-03-03 07:40+00', 'muayene')$$,
  '23P01', null, 'Hastasız randevu da hekim/koltuk çakışmasına dahildir');

select * from finish();
rollback;
