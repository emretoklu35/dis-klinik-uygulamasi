-- Muhasebe rolü (enum değeri ayrı migration'da eklenir; aynı işlemde kullanılamaz)
alter type public.clinic_role add value if not exists 'muhasebe';
