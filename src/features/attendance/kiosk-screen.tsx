/**
 * Resepsiyondaki tablet: yalnızca mesai QR kodunu gösterir (rol: Mesai Ekranı).
 * Kod 30 saniyede bir değişir; süresi dolunca yenisi sunucudan alınır.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/features/session/session-context';

import { attendanceRepository } from './attendance';
import { QrCode } from './qr-code';

type Code = Awaited<ReturnType<typeof attendanceRepository.kioskCode>>;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function KioskScreen({ deviceName }: { deviceName: string }) {
  const { signOut } = useSession();
  const { width, height } = useWindowDimensions();
  const now = useNow(1000);
  const [code, setCode] = useState<Code | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Kodu al; süresi dolunca (ya da hata olursa birkaç saniye sonra) yeniden al
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const fetchCode = async () => {
      try {
        const c = await attendanceRepository.kioskCode();
        if (!active) return;
        setCode(c);
        setError(null);
        const wait = Math.max(1000, new Date(c.expiresAt).getTime() - Date.now() + 300);
        timer = setTimeout(fetchCode, wait);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Kod alınamadı.');
        timer = setTimeout(fetchCode, 5000);
      }
    };
    fetchCode();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  const left = code ? Math.max(0, Math.ceil((new Date(code.expiresAt).getTime() - now) / 1000)) : 0;
  const qrSize = Math.min(width * 0.7, height * 0.45, 420);
  const d = new Date(now);
  const date = d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <Text style={styles.clinic}>{code?.clinicName ?? 'Mesai Ekranı'}</Text>
        <Text style={styles.time}>{time}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>

      <View style={styles.center}>
        {code ? (
          <>
            <View style={styles.qrBox}>
              <QrCode value={code.qr} size={qrSize} />
            </View>
            <Text style={styles.label}>Kameranız yoksa bu kodu yazın</Text>
            <Text style={styles.code} accessibilityLabel={`Kod ${code.code.split('').join(' ')}`}>
              {code.code.slice(0, 3)} {code.code.slice(3)}
            </Text>
            <View style={styles.progress}>
              <View style={[styles.progressFill, { width: `${(left / 30) * 100}%` }]} />
            </View>
            <Text style={styles.left}>Yeni kod {left} sn sonra</Text>
          </>
        ) : (
          <Text style={styles.label}>{error ?? 'Kod hazırlanıyor…'}</Text>
        )}
        {error && code ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.bottom}>
        <View style={styles.howto}>
          <Ionicons name="phone-portrait-outline" size={22} color={Colors.primary} />
          <Text style={styles.howtoText}>
            Telefonunuzda Mesai → <Text style={{ fontWeight: '700' }}>QR okut</Text>. Gelirken
            giriş, çıkarken çıkış kaydedilir.
          </Text>
        </View>
        {confirmLeave ? (
          <View style={styles.leave}>
            <Text style={styles.leaveText}>
              Bu cihaz mesai ekranı olmaktan çıkarılsın mı? Tekrar kurmak için yönetici yeni bir
              eşleştirme kodu üretmeli.
            </Text>
            <View style={styles.leaveActions}>
              <Button label="Vazgeç" variant="secondary" onPress={() => setConfirmLeave(false)} />
              <Button label="Ekranı kapat" variant="danger" onPress={signOut} />
            </View>
          </View>
        ) : (
          // Yanlışlıkla kapanmasın: uzun basınca sorar
          <Pressable
            onLongPress={() => setConfirmLeave(true)}
            delayLongPress={1200}
            accessibilityRole="button"
            accessibilityHint="Ekranı kapatmak için uzun basın"
            hitSlop={8}>
            <Text style={styles.device}>Mesai Ekranı · {deviceName}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Tablet ilk kez açıldığında: yöneticinin verdiği eşleştirme kodunu girer */
export function PairDeviceScreen({ onCancel }: { onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      setError('8 karakterlik eşleştirme kodunu girin (ör. K7QM-2XDP).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Başarılıysa oturum açılır; uygulama kendiliğinden Mesai Ekranı'na geçer
      await attendanceRepository.pairDevice(code);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Eşleştirme yapılamadı.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { justifyContent: 'center', padding: Spacing.lg }]}>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: Spacing.lg }}>
        <View style={{ alignItems: 'center', gap: Spacing.sm }}>
          <View style={styles.icon}>
            <Ionicons name="qr-code-outline" size={30} color="#FFFFFF" />
          </View>
          <Text style={styles.pairTitle}>Mesai ekranı olarak kur</Text>
          <Text style={styles.pairText}>
            Yönetici ya da klinik sahibi kendi telefonunda Ayarlar → Mesai Ekranı → “Yeni ekran
            ekle” ile kod üretir. O kodu buraya yazın.
          </Text>
        </View>
        <Card>
          <Text style={styles.fieldLabel}>Eşleştirme kodu</Text>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase())}
            placeholder="K7QM-2XDP"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={9}
            accessibilityLabel="Eşleştirme kodu"
            style={styles.pairInput}
            onSubmitEditing={submit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={busy ? 'Bağlanıyor…' : 'Bu cihazı bağla'}
            icon="link-outline"
            onPress={submit}
            disabled={busy}
          />
          <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={busy} />
        </Card>
        <Text style={styles.pairNote}>
          Bu cihaz yalnızca mesai QR kodunu gösterir; hasta, randevu ya da ödeme bilgisine erişemez.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F8F7' },
  top: { alignItems: 'center', paddingTop: Spacing.xl, gap: 2 },
  clinic: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
  time: { fontSize: 48, fontWeight: '700', color: Colors.text, fontVariant: ['tabular-nums'] },
  date: { fontSize: 16, color: Colors.textSecondary },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  qrBox: {
    padding: Spacing.md,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E7E5',
  },
  label: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  code: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 6,
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  progress: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E7E5',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  left: { fontSize: 13, color: Colors.textMuted },
  error: { fontSize: 13, color: Colors.danger, textAlign: 'center' },
  bottom: { alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  howto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 560,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
  },
  howtoText: { flexShrink: 1, fontSize: 15, color: Colors.primary },
  device: { fontSize: 12, color: Colors.textMuted },
  leave: { gap: Spacing.sm, maxWidth: 440, alignItems: 'center' },
  leaveText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  leaveActions: { flexDirection: 'row', gap: Spacing.sm },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairTitle: { fontSize: 22, fontWeight: '700', color: Colors.text },
  pairText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: Colors.text },
  pairInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
    color: Colors.text,
  },
  pairNote: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
});
