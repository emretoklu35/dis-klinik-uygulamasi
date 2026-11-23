-- =============================================================================
-- Tedavi türü
--
-- Diş şeması rengi işlem adındaki kelimelerden tahmin edilmek yerine sabit bir
-- türden okunur (ör. "İmplant" → mavi). Tür formda seçilir; seçilmeden eklenen
-- kayıtlarda (seans kapatma, eski kayıtlar) işlem adından tahmin edilir.
-- =============================================================================

create type public.treatment_kind as enum (
  'muayene',     -- muayene / kontrol / değerlendirme: dişi işaretlemez
  'temizlik',
  'dolgu',
  'kanal',
  'cekim',
  'implant',
  'kron_kopru',
  'protez',
  'ortodonti',
  'cerrahi',
  'diger'
);

-- İşlem adından tür tahmini. Sıra önemli: "İmplant kontrolü" muayenedir,
-- "İmplant cerrahisi" implanttır. Baş harfteki İ/ı sorununa karşı kökler harf
-- ortasından aranır.
create function private.guess_treatment_kind(p_procedure text)
returns public.treatment_kind
language sql immutable set search_path = ''
as $$
  select case
    when p_procedure ~* '(kontrol|muayene|de[gğ]erlendirme)' then 'muayene'
    when p_procedure ~* 'mplant' then 'implant'
    when p_procedure ~* '(kanal|endodont)' then 'kanal'
    when p_procedure ~* '(dolgu|fiss[üu]r|kompozit|amalgam)' then 'dolgu'
    when p_procedure ~* '([çc]ek[iı]m|ekstraksiyon)' then 'cekim'
    when p_procedure ~* '(kron|k[öo]pr[üu]|zirkon|lamina|veneer)' then 'kron_kopru'
    when p_procedure ~* 'protez' then 'protez'
    when p_procedure ~* '(ortodont|braket|plak|tel tedavi)' then 'ortodonti'
    when p_procedure ~* '(temizli|detertraj|polisaj|beyazlat)' then 'temizlik'
    when p_procedure ~* '(cerrah|apse|kist|rezeksiyon|sin[üu]s|greft)' then 'cerrahi'
    else 'diger'
  end::public.treatment_kind
$$;
revoke execute on function private.guess_treatment_kind(text) from public, anon;
grant execute on function private.guess_treatment_kind(text) to authenticated;

alter table public.treatments add column kind public.treatment_kind;
update public.treatments set kind = private.guess_treatment_kind(procedure);
alter table public.treatments alter column kind set not null;

-- Tür verilmeden eklenen kayıtlarda işlem adından tahmin (NOT NULL, BEFORE
-- tetikleyicisinden sonra denetlenir).
create function private.treatments_default_kind()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.kind is null then
    new.kind := private.guess_treatment_kind(new.procedure);
  end if;
  return new;
end;
$$;

create trigger treatments_default_kind
  before insert on public.treatments
  for each row execute function private.treatments_default_kind();

-- Özet okuma da türü döndürür (yönetici/sahip şemasının rengi için).
drop function public.treatment_summaries(uuid);
create function public.treatment_summaries(p_patient uuid)
returns table (
  id            uuid,
  performed_on  date,
  procedure     text,
  kind          public.treatment_kind,
  tooth         text,
  status        public.treatment_status,
  doctor_name   text
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.performed_on, t.procedure, t.kind, t.tooth, t.status, m.display_name
  from public.treatments t
  join public.clinic_members m on m.id = t.doctor_member_id
  where t.patient_id = p_patient
    and (t.clinic_id in (select private.clinics_with('tedavi.ozet.oku'))
         or t.clinic_id in (select private.clinics_with('tedavi.oku')))
  order by t.performed_on, t.created_at
$$;
revoke execute on function public.treatment_summaries(uuid) from public, anon;
grant execute on function public.treatment_summaries(uuid) to authenticated;
