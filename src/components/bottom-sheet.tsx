/**
 * Alttan açılan seçim penceresi (telefonda alttan kayar, geniş ekranda ortada pencere).
 * Arka plana dokunmak ya da X ile kapanır.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';

export function BottomSheet({
  title,
  onClose,
  children,
  scroll = true,
  header,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** false: içerik kendi kaydırmasını yönetir (ör. uzun liste) */
  scroll?: boolean;
  /** Başlığın altında sabit kalan alan (ör. arama kutusu) */
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const isWide = useIsWideLayout();
  return (
    <Modal visible transparent animationType={isWide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.backdrop, isWide && styles.backdropWide]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
        />
        <View
          style={[
            styles.sheet,
            isWide ? styles.sheetWide : { paddingBottom: insets.bottom + Spacing.md },
          ]}>
          {!isWide ? <View style={styles.handle} /> : null}
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              hitSlop={10}>
              <Ionicons name="close" size={26} color={Colors.textSecondary} />
            </Pressable>
          </View>
          {header ? <View style={styles.header}>{header}</View> : null}
          {scroll ? (
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, { flexShrink: 1 }]}>{children}</View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Seçim penceresindeki tek satır (renkli nokta / avatar + ad + seçili işareti) */
export function SheetOption({
  label,
  sublabel,
  left,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  sublabel?: string;
  left?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: '#F1F4F8' }]}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={[
            styles.optionLabel,
            selected && { color: Colors.primary },
            disabled && { color: Colors.textMuted },
          ]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.optionSub}>{sublabel}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark" size={24} color={Colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  backdropWide: { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetWide: { width: '100%', maxWidth: 560, borderRadius: 20, paddingBottom: Spacing.md },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D5DAE1',
    marginTop: Spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 20, fontWeight: '600', color: Colors.text },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  content: { padding: Spacing.lg, gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 56,
    paddingHorizontal: Spacing.sm,
    borderRadius: 12,
  },
  optionLabel: { fontSize: 17, color: Colors.text },
  optionSub: { fontSize: 13, color: Colors.textSecondary },
});
