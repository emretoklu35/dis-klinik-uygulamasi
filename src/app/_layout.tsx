import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

import { BottomBar } from '@/components/bottom-bar';
import { Sidebar } from '@/components/sidebar';
import { NavItems } from '@/constants/navigation';
import { Colors } from '@/constants/theme';
import { SessionProvider } from '@/features/session/session-context';
import { SessionGate } from '@/features/session/session-gate';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  // Görsel kimliğin yazı tipleri (Inter + Space Grotesk). Yüklenene kadar kısa süre boş ekran.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={AppTheme}>
      <StatusBar style="dark" />
      <SessionProvider>
        {/* Giriş yapılmadan hiçbir sekme açılmaz. */}
        <SessionGate>
          <AppTabs />
        </SessionGate>
      </SessionProvider>
    </ThemeProvider>
  );
}

function AppTabs() {
  const isWide = useIsWideLayout();

  return (
    <Tabs
      // Geniş web ekranında özel sol menü; aksi halde standart alt sekme çubuğu.
      tabBar={(props) => (isWide ? <Sidebar {...props} /> : <BottomBar {...props} />)}
      screenOptions={{
        headerShown: false,
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      {NavItems.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? item.activeIcon : item.icon}
                size={size}
                color={color as string}
              />
            ),
          }}
        />
      ))}
      {/* Sekme çubuğunda görünmeyen ekran: Ana Sayfa → Hızlı İşlemler'den açılır */}
      {/* href: null bu sürümde ekranı yönlendirir; bunun yerine yalnızca düğmesi gizlenir */}
      {['aktivite', 'mesai', 'raporlar'].map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title:
              name === 'aktivite'
                ? 'Aktivite Akışı'
                : name === 'mesai'
                  ? 'Mesai Takibi'
                  : 'Raporlar',
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none' },
          }}
        />
      ))}
    </Tabs>
  );
}
