import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Randevu sayfası doğrudan bağlantıyla açılsa bile altta haftalık takvim olsun,
 * böylece geri düğmesi her zaman takvime döner.
 */
export const unstable_settings = { anchor: 'index' };

/** Takvim sekmesi kendi içinde yığın (hafta → randevu → yeni randevu) olarak çalışır. */
export default function CalendarLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Takvim' }} />
      <Stack.Screen name="[id]" options={{ title: 'Randevu' }} />
      <Stack.Screen name="yeni" options={{ title: 'Yeni Randevu' }} />
    </Stack>
  );
}
