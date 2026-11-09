import Ionicons from '@expo/vector-icons/Ionicons';
import { DefaultTheme, ThemeProvider } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { StatusBar } from 'expo-status-bar';

import { Sidebar } from '@/components/sidebar';
import { NavItems } from '@/constants/navigation';
import { Colors } from '@/constants/theme';
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
  const isWide = useIsWideLayout();

  return (
    <ThemeProvider value={AppTheme}>
      <StatusBar style="dark" />
      <Tabs
        // Geniş web ekranında özel sol menü; aksi halde standart alt sekme çubuğu.
        tabBar={isWide ? (props) => <Sidebar {...props} /> : undefined}
        screenOptions={{
          headerShown: false,
          tabBarPosition: isWide ? 'left' : 'bottom',
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            backgroundColor: Colors.surface,
            borderTopColor: Colors.border,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
      </Tabs>
    </ThemeProvider>
  );
}
