import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/** Raporlar kendi içinde yığın: liste → rapor. Ana Sayfa → Hızlı İşlemler'den açılır. */
export const unstable_settings = { anchor: 'index' };

export default function ReportsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.primary,
        headerTitleStyle: { color: Colors.text, fontWeight: '600' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: '#F3F5F4' },
      }}>
      <Stack.Screen name="index" options={{ title: 'Raporlar' }} />
      <Stack.Screen name="gun-sonu" options={{ title: 'Gün sonu Raporu' }} />
      <Stack.Screen name="tedavi" options={{ title: 'Tamamlanan Tedavi Raporu' }} />
      <Stack.Screen name="prim" options={{ title: 'Doktor Prim Raporu' }} />
    </Stack>
  );
}
