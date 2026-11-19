-- Mesai Ekranı: resepsiyondaki tablete (bir kişiye değil, cihaza) verilen rol.
-- Yeni enum değeri aynı işlemde kullanılamadığı için ayrı migration'dadır.
alter type public.clinic_role add value if not exists 'ekran';
