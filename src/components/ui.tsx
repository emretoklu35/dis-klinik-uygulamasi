import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Her sekmenin ortak sayfa çerçevesi: başlık + kaydırılabilir içerik. */
export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const isWide = useIsWideLayout();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={[styles.title, isWide && styles.titleWide]}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <DemoNotice />
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoNotice() {
  return (
    <View style={styles.notice}>
      <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
      <Text style={styles.noticeText}>
        Bu ekrandaki tüm bilgiler sahte demo verisidir.
      </Text>
    </View>
  );
}

export function Card({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function StatCard({
  label,
  value,
  icon,
  tint = Colors.primary,
  tintSoft = Colors.primarySoft,
}: {
  label: string;
  value: string | number;
  icon: IconName;
  tint?: string;
  tintSoft?: string;
}) {
  return (
    <View style={[styles.card, styles.stat]}>
      <View style={[styles.statIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Kartları geniş ekranda yan yana, dar ekranda alt alta dizer. */
export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Grid içindeki kartlar için: geniş ekranda yan yana, dar ekranda tam genişlik. */
export const gridItem: ViewStyle = { flexGrow: 1, flexBasis: 320 };

export function Badge({ label, tone = 'primary' }: { label: string; tone?: 'primary' | 'success' | 'warning' | 'muted' }) {
  const palette = {
    primary: [Colors.primarySoft, Colors.primary],
    success: [Colors.successSoft, Colors.success],
    warning: [Colors.warningSoft, Colors.warning],
    muted: [Colors.background, Colors.textSecondary],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  scrollWide: { padding: Spacing.xxl },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.lg },
  header: { gap: Spacing.xs },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text },
  titleWide: { fontSize: 30 },
  subtitle: { fontSize: 15, color: Colors.textSecondary },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  noticeText: { fontSize: 13, color: Colors.primary, flexShrink: 1 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  stat: { flexGrow: 1, flexBasis: 150, gap: Spacing.xs },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: { fontSize: 26, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: 13, color: Colors.textSecondary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border },
});
