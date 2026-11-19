import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';

import { Button, Card, CenteredMessage } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';

import { KioskScreen } from '@/features/attendance/kiosk-screen';

import { useSession } from './session-context';
import { SignInScreen } from './sign-in-screen';

/** Giriş yapılmadıysa giriş ekranını, klinik yüklenmediyse durum mesajını gösterir. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { state, signOut, reload } = useSession();

  switch (state.status) {
    case 'ready':
      // Resepsiyon tableti (Mesai Ekranı): uygulamanın geri kalanı hiç açılmaz
      if (state.roles.length > 0 && state.roles.every((r) => r === 'ekran')) {
        return <KioskScreen deviceName={state.member.name} />;
      }
      return <>{children}</>;
    case 'signedOut':
      return <SignInScreen />;
    case 'loading':
      return (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      );
    case 'noClinic':
      return (
        <View style={styles.center}>
          <Card style={styles.card}>
            <CenteredMessage
              icon="business-outline"
              title="Bu hesap bir kliniğe bağlı değil"
              text={`${state.email} hesabının aktif bir klinik üyeliği yok. Klinik sahibinden davet isteyin.`}>
              <Button label="Çıkış yap" variant="secondary" onPress={signOut} />
            </CenteredMessage>
          </Card>
        </View>
      );
    case 'error':
      return (
        <View style={styles.center}>
          <Card style={styles.card}>
            <CenteredMessage icon="alert-circle-outline" title="Bağlantı kurulamadı">
              <Text style={styles.error}>{state.message}</Text>
              <View style={styles.actions}>
                <Button label="Tekrar dene" onPress={reload} />
                <Button label="Çıkış yap" variant="secondary" onPress={signOut} />
              </View>
            </CenteredMessage>
          </Card>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.lg,
  },
  card: { width: '100%', maxWidth: 460 },
  error: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
});
