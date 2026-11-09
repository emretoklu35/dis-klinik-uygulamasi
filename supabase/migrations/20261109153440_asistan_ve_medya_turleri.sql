-- Yeni enum değerleri ayrı bir migration'da: PostgreSQL yeni enum değerinin
-- aynı işlem (transaction) içinde kullanılmasına izin vermez.

-- Asistan: röntgen/fotoğraf çeker ve yükler; görüntüleri ve sağlık ayrıntısını görmez.
alter type public.clinic_role add value if not exists 'asistan';

-- Medya bölümü: röntgenlerin yanında ağız içi fotoğraflar
alter type public.radiograph_kind add value if not exists 'agiz_ici_fotograf';
