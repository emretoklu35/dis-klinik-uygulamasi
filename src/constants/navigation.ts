import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type NavItem = {
  /** `src/app` içindeki dosya adı */
  name: string;
  title: string;
  icon: IconName;
  activeIcon: IconName;
};

/** Sekmelerin tek kaynağı: hem alt sekmeler hem sol menü buradan beslenir. */
export const NavItems: NavItem[] = [
  { name: 'index', title: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  { name: 'hastalar', title: 'Hastalar', icon: 'people-outline', activeIcon: 'people' },
  { name: 'takvim', title: 'Takvim', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'gorevler', title: 'Görevler', icon: 'checkbox-outline', activeIcon: 'checkbox' },
  { name: 'stok', title: 'Stok', icon: 'cube-outline', activeIcon: 'cube' },
  { name: 'ayarlar', title: 'Ayarlar', icon: 'settings-outline', activeIcon: 'settings' },
];
