import { Platform, useWindowDimensions } from 'react-native';

import { WideBreakpoint } from '@/constants/theme';

/**
 * Webde ve geniş ekranda `true` döner (sol menü düzeni).
 * Telefonlarda ve dar tarayıcı pencerelerinde alt sekmeler kullanılır.
 */
export function useIsWideLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WideBreakpoint;
}
