import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, TextField } from '@/components/ui';
import { PairDeviceScreen } from '@/features/attendance/kiosk-screen';
import { Colors, Radius, Spacing } from '@/constants/theme';

import { useSession } from './session-context';

export function SignInScreen() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('E-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    // Başarılıysa oturum değişir ve bu ekran kendiliğinden kapanır.
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  // Resepsiyon tableti: kimsenin şifresi girilmeden, eşleştirme koduyla kurulur
  if (pairing) return <PairDeviceScreen onCancel={() => setPairing(false)} />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="medkit" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>Diş Kliniği</Text>
              <Text style={styles.subtitle}>Yönetim paneline giriş yapın</Text>
            </View>

            <Card>
              <TextField
                label="E-posta"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="username"
                placeholder="ornek@klinik.com"
              />
              <TextField
                label="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label={busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
                icon="log-in-outline"
                onPress={submit}
                disabled={busy}
              />
            </Card>

            <Button
              label="Mesai ekranı olarak kur"
              icon="qr-code-outline"
              variant="secondary"
              disabled={busy}
              onPress={() => setPairing(true)}
            />

            {__DEV__ ? (
              <View style={styles.devNote}>
                <Text style={styles.devTitle}>Yerel geliştirme</Text>
                <Text style={styles.devText}>
                  Sahte demo hesaplar: sahip.hekim@demo.test, hekim@demo.test, yonetici@demo.test,
                  resepsiyon@demo.test, asistan@demo.test, ekran@demo.test (resepsiyon tableti).
                  Şifre: supabase/seed.sql dosyasında.
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  inner: { width: '100%', maxWidth: 420, alignSelf: 'center', gap: Spacing.lg },
  brand: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  logo: {
    width: 52,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 15, color: Colors.textSecondary },
  error: { fontSize: 14, color: Colors.danger },
  devNote: {
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: 4,
  },
  devTitle: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  devText: { fontSize: 13, color: Colors.primary },
});
