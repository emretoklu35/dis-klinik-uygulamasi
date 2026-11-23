-- Tür tahmini yeni türlerle güncellenir. Röntgen önce gelir ("Kontrol röntgeni" röntgendir);
-- "plak" artık ortodonti sayılmaz ("plak temizliği" gibi adlar yanlış eşleşiyordu).
create or replace function private.guess_treatment_kind(p_procedure text)
returns public.treatment_kind
language sql immutable set search_path = ''
as $$
  select case
    when p_procedure ~* '(r[öo]ntgen|panoramik|periapikal|tomografi|bitewing)' then 'rontgen'
    when p_procedure ~* '(kontrol|muayene|de[gğ]erlendirme)' then 'muayene'
    when p_procedure ~* 'mplant' then 'implant'
    when p_procedure ~* '(kanal|endodont)' then 'kanal'
    when p_procedure ~* '(dolgu|fiss[üu]r|kompozit|amalgam)' then 'dolgu'
    when p_procedure ~* '([çc]ek[iı]m|ekstraksiyon)' then 'cekim'
    when p_procedure ~* '(kron|k[öo]pr[üu]|zirkon|lamina|veneer)' then 'kron_kopru'
    when p_procedure ~* 'protez' then 'protez'
    when p_procedure ~* '(di[sş] eti|periodont|k[üu]retaj|gingiv)' then 'dis_eti'
    when p_procedure ~* '(ortodont|braket|[şs]effaf plak)' then 'ortodonti'
    when p_procedure ~* 'beyazlat' then 'beyazlatma'
    when p_procedure ~* '(ta[sş][ıi] temizli|temizli|detertraj|polisaj)' then 'temizlik'
    when p_procedure ~* '(cerrah|apse|kist|rezeksiyon|sin[üu]s|greft)' then 'cerrahi'
    else 'diger'
  end::public.treatment_kind
$$;

-- Önceden "diğer/muayene/temizlik/ortodonti" sayılmış kayıtlar yeni türlere taşınır.
update public.treatments
   set kind = private.guess_treatment_kind(procedure)
 where kind in ('diger', 'muayene', 'temizlik', 'ortodonti')
   and private.guess_treatment_kind(procedure) in ('rontgen', 'dis_eti', 'beyazlatma');
