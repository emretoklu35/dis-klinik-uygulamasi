# Diş Kliniği Uygulaması

Diş polikliniği yönetimi için iOS / Android uygulaması ve masaüstü web arayüzü.
Expo SDK 58 + React Native + TypeScript + Expo Router.

> Şu an yalnızca arayüz iskeleti vardır. Tüm içerik **sahte demo verisidir** (`src/data/demo.ts`).
> Veritabanı, giriş sistemi ve gerçek hasta bilgisi henüz yoktur.

## Başlatma

```bash
npm install          # ilk kurulumda
npm run web          # tarayıcıda açar (http://localhost:8081)
npm start            # QR kodu gösterir; telefonda Expo Go ile tarayın
npm run ios          # iOS Simülatörü (Mac + Xcode gerekir)
npm run android      # Android Emülatörü (Android Studio gerekir)
```

## Kontroller

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint
npx expo-doctor      # bağımlılık / yapılandırma kontrolü
```

## Yerel Supabase (yalnızca geliştirme, sahte veri)

Gereken: Docker Desktop çalışıyor olmalı. Supabase CLI projeye `devDependency` olarak eklidir.

```bash
npm run db:start     # yerel Supabase'i başlatır (ilk seferde imajları indirir)
npm run db:reset     # şemayı (migrations) ve sahte veriyi (seed.sql) baştan kurar
npm run db:test      # RLS ve iş kuralı testlerini (pgTAP) çalıştırır
npm run db:status    # yerel adresleri gösterir (Studio: http://localhost:54323)
npm run db:stop      # durdurur (veriyi silmez)
```

- Şema, roller, yetkiler ve RLS: `supabase/migrations/`
- Sahte demo kullanıcılar ve veriler: `supabase/seed.sql` (e-postalar `@demo.test`; yerel test şifresi dosyada)
- Testler: `supabase/tests/database/rls.test.sql`
- Bulut projesi YOK. Gerçek hasta verisi kullanılmaz. Gizli anahtarlar (`sb_secret_…`) uygulamaya konmaz.

Roller ve yetkiler: `sahip`, `yonetici`, `hekim`, `resepsiyonist`. Bir üyenin birden çok rolü olabilir.
Sağlık ayrıntıları ve tedavi bilgisi yalnızca `hekim` rolüne açıktır; resepsiyon yalnızca
"alerji kaydı var" işaretini görür. Hekim rolünü yalnızca sahip atayabilir.

## Klasör yapısı

```
src/
  app/                 Ekranlar (her dosya bir sekme)
    _layout.tsx        Sekme düzeni: telefonda alt sekmeler, geniş webde sol menü
    index.tsx          Ana Sayfa
    hastalar.tsx       Hastalar
    takvim.tsx         Takvim
    gorevler.tsx       Görevler
    ayarlar.tsx        Ayarlar
  components/          Ortak bileşenler (kart, sol menü, randevu satırı)
  constants/           Renkler, boşluklar, sekme listesi
  data/demo.ts         SAHTE demo verisi
  hooks/               Geniş ekran tespiti
```
