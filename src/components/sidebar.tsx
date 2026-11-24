import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DentumiLogo } from '@/components/brand';
import { NavItems } from '@/constants/navigation';
import { Colors, Radius, SidebarWidth, Spacing } from '@/constants/theme';

/** Geniş web ekranları için sol menü. */
export function Sidebar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const home = state.routes.find((r) => r.name === 'index');
  const onHome = home !== undefined && state.routes[state.index]?.key === home.key;

  return (
    <View style={styles.container}>
      {/* Logoya tıklayınca Ana Sayfa (zaten oradaysa bir şey olmaz) */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Dentumi · Ana Sayfa'ya git"
        onPress={() => {
          if (home && !onHome) navigateToTab(home.key);
        }}
        style={({ pressed }) => [styles.brand, pressed && !onHome && { opacity: 0.7 }]}>
        {/* Logodaki gibi: "D" işareti, lacivert yazı ve turkuaz "i" noktası */}
        <DentumiLogo width={150} />
        <Text style={styles.brandSubtitle}>Yönetim Paneli</Text>
      </Pressable>

      <View style={styles.nav}>
        {state.routes.map((route, index) => {
          const item = NavItems.find((n) => n.name === route.name);
          if (!item) return null;
          const focused = state.index === index;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                // Varsayılan alt sekme çubuğuyla aynı davranış: zaten açık sekmeye
                // tıklanınca iç yığın (ör. hasta kartı) en başa (listeye) döner.
                const event = emitter.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                !focused && pressed && styles.itemHover,
              ]}>
              <Ionicons
                name={focused ? item.activeIcon : item.icon}
                size={20}
                color={focused ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.itemLabel, focused && styles.itemLabelActive]}>
                {item.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.footer}>Demo sürüm · v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SidebarWidth,
    height: '100%',
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  brand: {
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  brandSubtitle: { fontSize: 12, color: Colors.textMuted },
  nav: { gap: Spacing.xs, flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  itemActive: { backgroundColor: Colors.primarySoft },
  itemHover: { backgroundColor: Colors.background },
  itemLabel: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  itemLabelActive: { color: Colors.primary, fontWeight: '700' },
  footer: { fontSize: 12, color: Colors.textMuted, paddingHorizontal: Spacing.sm },
});
