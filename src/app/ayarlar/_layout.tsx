import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Fiyat listesi doğrudan açılsa bile geri düğmesi Ayarlar'a dönsün. */
export const unstable_settings = { anchor: 'index' };

/** Ayarlar sekmesi kendi içinde yığın (ayarlar → fiyat listesi) olarak çalışır. */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.primary,
        headerTitleStyle: { color: Colors.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: Colors.background },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Ayarlar' }} />
      <Stack.Screen name="fiyatlar" options={{ title: 'Fiyat listesi' }} />
    </Stack>
  );
}
