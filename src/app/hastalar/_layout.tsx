import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Detay sayfası doğrudan bağlantıyla açılsa bile altta liste ekranı olsun,
 * böylece geri düğmesi her zaman listeye döner.
 */
export const unstable_settings = { anchor: 'index' };

/** Hastalar sekmesi kendi içinde yığın (liste → detay → yeni hasta) olarak çalışır. */
export default function PatientsLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, title: 'Hastalar' }} />
      <Stack.Screen name="[id]" options={{ title: 'Hasta Kartı' }} />
      <Stack.Screen name="yeni" options={{ title: 'Yeni Hasta' }} />
      <Stack.Screen name="seans/[id]" options={{ title: 'Seansı Kapat' }} />
      <Stack.Screen name="proforma/[planId]" options={{ title: 'Proforma' }} />
    </Stack>
  );
}
