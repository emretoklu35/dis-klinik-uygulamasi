-- =============================================================================
-- Aktivite akışı testleri (pgTAP): herkes yalnızca görmeye yetkili olduğu olayları görür.
-- a..1 sahip+hekim, a..2 hekim, a..3 yönetici, a..4 resepsiyon, a..5 asistan
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(16);

create temp table t_ids as
select (select id from public.treatments
         where patient_id = 'e0000000-0000-4000-8000-000000000003' and procedure = 'Dolgu') as treatment_id,
       (select id from public.tasks where done_at is null limit 1) as task_id;
grant select on t_ids to authenticated;

-- ============================ RESEPSİYON =====================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated"}';

select isnt_empty($$select 1 from activity_feed where event = 'hasta_eklendi'$$,
  'Resepsiyon hasta ekleme olaylarını görür');
select isnt_empty($$select 1 from activity_feed where event = 'odeme_alindi'$$,
  'Resepsiyon ödeme olaylarını görür');
select is_empty($$select 1 from activity_feed where category = 'tedavi'$$,
  'Resepsiyon tedavi olaylarını göremez');
select is_empty($$select 1 from activity_feed where category = 'not' and title = 'klinik'$$,
  'Resepsiyon klinik not olaylarını göremez');
select is((select actor_user_id from activity_feed where event = 'hasta_eklendi' limit 1),
  'a0000000-0000-4000-8000-000000000004'::uuid, 'Olayı yapan kişi akışta görünür');
select lives_ok(
  $$update tasks set done_at = now() where id = (select task_id from t_ids)$$,
  'Resepsiyon görevi tamamlar');
select is((select actor_user_id from activity_feed where id = 'gd-' || (select task_id from t_ids)),
  'a0000000-0000-4000-8000-000000000004'::uuid, 'Görevi kimin tamamladığı kaydedilir');

-- ============================ ASİSTAN ========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated"}';

select is_empty($$select 1 from activity_feed where category = 'odeme'$$,
  'Asistan ödeme olaylarını göremez');
select isnt_empty($$select 1 from activity_feed where category = 'not' and title = 'klinik'$$,
  'Asistan klinik not olaylarını görür');
select is_empty($$select 1 from activity_feed where category = 'tedavi'$$,
  'Asistan tedavi olaylarını göremez');

-- ============================ YÖNETİCİ ========================================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}';

select isnt_empty($$select 1 from activity_feed where category = 'stok'$$,
  'Yönetici stok olaylarını görür');
select is_empty($$select 1 from activity_feed where category = 'not' and title = 'klinik'$$,
  'Yönetici klinik not olaylarını göremez');

-- ============================ HEKİM (Dr. Demo B) ==============================
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';

select isnt_empty($$select 1 from activity_feed where event = 'tedavi_tamamlandi'$$,
  'Hekim tedavi olaylarını görür');
select lives_ok(
  $$update treatments set status = 'tamamlandi' where id = (select treatment_id from t_ids)$$,
  'Hekim tedaviyi tamamlar');
select is((select actor_user_id from activity_feed where id = 'tc-' || (select treatment_id from t_ids)),
  'a0000000-0000-4000-8000-000000000002'::uuid, 'Tedaviyi kimin tamamladığı akışta görünür');
select is_empty($$select 1 from activity_feed where clinic_id <> 'c0000000-0000-4000-8000-000000000001'$$,
  'Başka kliniğin olayları görünmez');

select * from finish();
rollback;
