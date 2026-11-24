-- =============================================================================
-- Tedavi planları testleri (pgTAP).
-- a..1 sahip + hekim (Dr. Demo A, üye b..1); hasta e..1
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(15);

select is((select count(*)::int from treatments where plan_id is null), 0,
  'Mevcut tedavilerin hepsi bir plana bağlandı');
select is(
  (select count(*)::int from (select patient_id from treatment_plans where is_active
                               group by patient_id having count(*) > 1) x), 0,
  'Her hastanın en fazla bir uygulanan planı var');
select is(
  (select count(*)::int from treatments t
    where t.amount is null
      and exists (select 1 from patient_charges c where c.treatment_id = t.id and c.cancelled_at is null)), 0,
  'Borç kaydı olan eski tedavilerin ücreti plana aktarıldı');

-- Uygulamadaki gibi oturum açmış hekim
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select lives_ok(
  $$insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, status, kind)
    values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
            'b0000000-0000-4000-8000-000000000001', current_date, 'test-tur', 'planlandi', 'dolgu')$$,
  'Hekim tedavi türüyle birlikte tedavi ekleyebilir (yazma izni)');
select is(
  (select t.plan_id from treatments t where t.procedure = 'test-tur'),
  (select p.id from treatment_plans p where p.patient_id = 'e0000000-0000-4000-8000-000000000001' and p.is_active),
  'Planı verilmeyen tedavi uygulanan plana girer');

-- Alternatif plan: iki işlem, biri ücretli
insert into treatment_plans (clinic_id, patient_id, title, doctor_member_id)
values ('c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
        'test-alternatif', 'b0000000-0000-4000-8000-000000000001');
insert into treatments (clinic_id, patient_id, doctor_member_id, performed_on, procedure, tooth, status, kind, plan_id, amount)
select 'c0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001',
       'b0000000-0000-4000-8000-000000000001', current_date, x.proc, '46', 'planlandi', x.kind::treatment_kind, p.id, x.amount
  from treatment_plans p,
       (values ('test-cekim', 'cekim', 250000), ('test-implant', 'implant', 2200000)) as x(proc, kind, amount)
 where p.title = 'test-alternatif';

select lives_ok($$select set_active_treatment_plan((select id from treatment_plans where title = 'test-alternatif'))$$,
  'Alternatif plan uygulanır');
select is(
  (select title from treatment_plans where patient_id = 'e0000000-0000-4000-8000-000000000001' and is_active),
  'test-alternatif', 'Uygulanan plan değişti, eskisi kapandı');

-- Tamamlanan ücretli işlem borca eklenir (işlem sonu tetikleyicisi)
update treatments set status = 'tamamlandi' where procedure = 'test-cekim';
set constraints all immediate;
select is(
  (select count(*)::int from patient_charges c join treatments t on t.id = c.treatment_id
    where t.procedure = 'test-cekim' and c.amount = 250000), 1,
  'Tamamlanan işlemin ücreti hastanın borcuna eklendi');
set constraints all deferred;

-- Aynı tedavi için borç zaten girildiyse ikinci kez eklenmez (seans kapatmadaki gibi)
update treatments set status = 'tamamlandi' where procedure = 'test-implant';
insert into patient_charges (clinic_id, patient_id, treatment_id, description, tooth, amount)
select clinic_id, patient_id, id, procedure, tooth, 2200000 from treatments where procedure = 'test-implant';
set constraints all immediate;
select is(
  (select count(*)::int from patient_charges c join treatments t on t.id = c.treatment_id
    where t.procedure = 'test-implant'), 1,
  'Ücret iki kez borca eklenmez');
set constraints all deferred;

select throws_ok(
  $$select delete_treatment_plan((select id from treatment_plans where title = 'test-alternatif'))$$,
  '23514', null, 'Tamamlanmış işlemi olan plan silinemez');

-- Kopyalama: işlemler "planlandı" olarak ve ücretleriyle gelir, yeni plan uygulanmaz
select lives_ok(
  $$select copy_treatment_plan((select id from treatment_plans where title = 'test-alternatif'), 'test-kopya')$$,
  'Plan kopyalanır');
select results_eq(
  $$select status::text, amount from treatments t join treatment_plans p on p.id = t.plan_id
     where p.title = 'test-kopya' order by amount$$,
  $$values ('planlandi', 250000), ('planlandi', 2200000)$$,
  'Kopyadaki işlemler planlandı durumunda ve ücretleriyle');
select is((select is_active from treatment_plans where title = 'test-kopya'), false,
  'Kopya plan uygulanmaz');
select lives_ok($$select delete_treatment_plan((select id from treatment_plans where title = 'test-kopya'))$$,
  'Başlanmamış plan silinir');
select is((select count(*)::int from treatments t join treatment_plans p on p.id = t.plan_id where p.title = 'test-kopya'), 0,
  'Silinen planın işlemleri de silinir');

select * from finish();
rollback;
