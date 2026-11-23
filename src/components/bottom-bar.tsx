import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavItems } from '@/constants/navigation';
import { Colors, Fonts } from '@/constants/theme';

/** Telefon alt menüsü: seçili sekmenin üstünde ince çizgi (görsel kimlik). */
export function BottomBar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const item = NavItems.find((n) => n.name === route.name);
        if (!item) return null;
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.title}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (state.index !== index && !event.defaultPrevented) navigateToTab(route.key);
            }}
            style={[styles.item, focused && styles.itemActive]}>
            <Ionicons
              name={focused ? item.activeIcon : item.icon}
              size={22}
              color={focused ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {item.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  item: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  itemActive: { borderTopColor: Colors.primary },
  label: { fontSize: 11, fontFamily: Fonts.bodyMedium, color: Colors.textSecondary },
  labelActive: { fontFamily: Fonts.bodySemi, color: Colors.primary },
});
