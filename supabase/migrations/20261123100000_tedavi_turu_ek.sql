-- Eksik tedavi türleri: röntgen (teşhis, dişi işaretlemez), diş eti tedavisi, beyazlatma.
-- (Enum değeri eklemek ayrı bir migration'da yapılır; aynı işlemde kullanılamaz.)
alter type public.treatment_kind add value if not exists 'rontgen' after 'muayene';
alter type public.treatment_kind add value if not exists 'dis_eti' after 'protez';
alter type public.treatment_kind add value if not exists 'beyazlatma' after 'ortodonti';
