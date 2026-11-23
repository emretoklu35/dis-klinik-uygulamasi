/**
 * Uygulama genelinde kullanılan renkler, yazı tipleri, boşluklar ve ölçüler.
 * Görsel kimlik "Mine": mürekkep lacivert + mine yeşili (tek eylem rengi),
 * kehribar yalnızca dikkat için, kırmızı yalnızca uyarı için.
 */

export const Colors = {
  background: '#F3F5F4',
  surface: '#FFFFFF',
  border: '#E2E7E5',
  text: '#0F1E2C',
  textSecondary: '#56636F',
  textMuted: '#6B7781',
  primary: '#0B6E69',
  primarySoft: '#DDF1EE',
  /** Mine yeşili üzerindeki koyu metin (rozet, etiket) */
  primaryDeep: '#0B5E5A',
  /** Koyu yüzeyler (üst bant, öne çıkan kart) */
  ink: '#0F1E2C',
  inkSoft: '#1A2E3F',
  inkMuted: '#9FB2BC',
  /** Koyu zemin üzerinde mine vurgusu */
  mint: '#5FD3C6',
  success: '#15803D',
  successSoft: '#E3F4EA',
  warning: '#B45309',
  warningSoft: '#FDF0E1',
  danger: '#B42318',
  dangerSoft: '#FDE8E6',
} as const;

/** Yazı tipleri (kök düzende yüklenir). Başlık: Space Grotesk, metin: Inter. */
export const Fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingSemi: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Bu genişlikten itibaren (yalnızca webde) sol menü gösterilir. */
export const WideBreakpoint = 900;

/** Geniş ekranlarda içerik bu genişliği geçmez. */
export const MaxContentWidth = 1100;

export const SidebarWidth = 248;
