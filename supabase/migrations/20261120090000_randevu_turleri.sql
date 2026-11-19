-- Randevu türleri: Cerrahi ve Diğer eklendi (Muayene, Tedavi, Kontrol mevcut).
-- Yeni enum değerleri aynı işlemde kullanılamadığı için ayrı migration'dadır.
alter type public.visit_type add value if not exists 'cerrahi';
alter type public.visit_type add value if not exists 'diger';
