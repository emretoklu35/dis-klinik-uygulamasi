/**
 * Uygulama genelinde kullanılan renkler, boşluklar ve ölçüler.
 * Açık arka plan + mavi vurgu rengi.
 */

export const Colors = {
  background: '#F5F7FB',
  surface: '#FFFFFF',
  border: '#E3E8F0',
  text: '#111827',
  textSecondary: '#5B6475',
  textMuted: '#8A93A5',
  primary: '#1E6FE8',
  primarySoft: '#E8F0FD',
  success: '#16A34A',
  successSoft: '#E7F6EC',
  warning: '#D97706',
  warningSoft: '#FDF3E3',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
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
