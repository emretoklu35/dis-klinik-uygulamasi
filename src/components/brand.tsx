import { Image } from 'expo-image';

/** Dentumi marka dosyaları (assets/brand). SVG olduğu için her boyutta keskin kalır. */
const LOGO = require('../../assets/brand/dentumi-logo.svg');
const MARK = require('../../assets/brand/dentumi-d.svg');

/** Tam logo: "D" işareti ve "Dentumi" yazısı (giriş ekranı). */
export function DentumiLogo({ width = 220 }: { width?: number }) {
  return (
    <Image
      source={LOGO}
      style={{ width, height: (width * 355) / 1475 }}
      contentFit="contain"
      accessibilityLabel="Dentumi"
    />
  );
}

/** Yalnızca "D" işareti (uygulama simgesi ile aynı). */
export function DentumiMark({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={MARK}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="Dentumi"
    />
  );
}
