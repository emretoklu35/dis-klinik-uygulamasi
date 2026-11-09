import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Malzeme sayfası doğrudan açılsa bile geri düğmesi stok listesine dönsün. */
export const unstable_settings = { anchor: 'index' };

/** Stok sekmesi kendi içinde yığın (liste → malzeme → yeni malzeme) olarak çalışır. */
export default function StockLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Stok' }} />
      <Stack.Screen name="[id]" options={{ title: 'Malzeme' }} />
      <Stack.Screen name="yeni" options={{ title: 'Yeni malzeme' }} />
    </Stack>
  );
}
