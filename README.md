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
