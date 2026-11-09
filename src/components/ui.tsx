import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Her sekmenin ortak sayfa çerçevesi: başlık + kaydırılabilir içerik. */
export function Screen({
  title,
  subtitle,
  headerRight,
  inStack = false,
  children,
}: {
  /** Boş bırakılırsa sayfa başlığı çizilmez (ör. üstte gezinme çubuğu varsa). */
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  /** Üstünde gezinme çubuğu olan sayfalar için: üst güvenli alan boşluğunu çubuk zaten bırakır. */
  inStack?: boolean;
  children: ReactNode;
}) {
  const isWide = useIsWideLayout();

  return (
    <SafeAreaView
      style={styles.safe}
      edges={inStack ? ['left', 'right'] : ['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, isWide && styles.scrollWide]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          {title ? (
            <View style={styles.headerRow}>
              <View style={styles.header}>
                <Text style={[styles.title, isWide && styles.titleWide]}>{title}</Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              {headerRight}
            </View>
          ) : null}
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

export type BadgeTone = 'primary' | 'success' | 'warning' | 'muted' | 'danger';

export function Badge({ label, tone = 'primary' }: { label: string; tone?: BadgeTone }) {
  const palette = {
    primary: [Colors.primarySoft, Colors.primary],
    success: [Colors.successSoft, Colors.success],
    warning: [Colors.warningSoft, Colors.warning],
    muted: [Colors.background, Colors.textSecondary],
    danger: [Colors.dangerSoft, Colors.danger],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette[0] }]}>
      <Text style={[styles.badgeText, { color: palette[1] }]}>{label}</Text>
    </View>
  );
}

/** Seçilebilir küçük düğme (saat, süre, işlem önerisi vb.). */
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  accessibilityHint,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityHint={accessibilityHint}
      style={[
        styles.segment,
        selected && styles.segmentSelected,
        disabled && styles.chipDisabled,
      ]}>
      <Text
        style={[
          styles.segmentText,
          selected && styles.segmentTextSelected,
          disabled && styles.chipDisabledText,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const filled = variant !== 'secondary';
  const fg = filled ? '#FFFFFF' : Colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
      ]}>
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  hint,
  required,
  style,
  ...inputProps
}: TextInputProps & { label: string; error?: string; hint?: string; required?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={{ color: Colors.danger }}> *</Text> : null}
      </Text>
      <TextInput
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={label}
        style={[styles.input, inputProps.multiline && styles.inputMultiline, !!error && styles.inputError, style]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Seçeneklerden birini seçmek için yan yana düğmeler. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.segment, selected && styles.segmentSelected]}>
              <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CenteredMessage({
  icon,
  title,
  text,
  children,
}: {
  icon: IconName;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.centered}>
      <Ionicons name={icon} size={32} color={Colors.textMuted} />
      <Text style={styles.centeredTitle}>{title}</Text>
      {text ? <Text style={styles.centeredText}>{text}</Text> : null}
      {children}
    </View>
  );
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    minHeight: 44,
  },
  buttonPrimary: { backgroundColor: Colors.primary },
  buttonSecondary: { backgroundColor: Colors.primarySoft },
  buttonDanger: { backgroundColor: Colors.danger },
  buttonText: { fontSize: 15, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  inputError: { borderColor: Colors.danger },
  fieldError: { fontSize: 13, color: Colors.danger },
  fieldHint: { fontSize: 12, color: Colors.textMuted },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  segment: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  segmentSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  segmentText: { fontSize: 14, color: Colors.text },
  segmentTextSelected: { color: '#FFFFFF', fontWeight: '600' },
  chipDisabled: { backgroundColor: Colors.background, borderStyle: 'dashed' },
  chipDisabledText: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  centered: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  centeredTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  centeredText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
