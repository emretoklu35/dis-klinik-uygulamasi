import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, CenteredMessage, Divider, Screen, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { attendanceRepository, useKioskDevices } from '@/features/attendance/attendance';
import { useClinicSession } from '@/features/session/session-context';

function ago(iso?: string) {
  if (!iso) return 'hiç bağlanmadı';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 2) return 'şu an açık';
  if (min < 60) return `${min} dk önce`;
  const h = Math.floor(min / 60);
  return h < 24 ? `${h} sa önce` : `${Math.floor(h / 24)} gün önce`;
}

/** Eşleştirme kodu ve geri sayım */
function PairingCode({
  code,
  expiresAt,
  onDone,
}: {
  code: string;
  expiresAt: string;
  onDone: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  return (
    <View style={styles.pairBox}>
      <Text style={styles.pairLabel}>Tablette “Mesai ekranı olarak kur”a basıp bu kodu yazın</Text>
      <Text style={styles.pairCode} selectable>
        {code}
      </Text>
      <Text style={styles.muted}>
        {left > 0
          ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} içinde geçerli · tek kullanımlık`
          : 'Süresi doldu; yeni kod üretin.'}
      </Text>
      <Button label="Tamam, tableti bağladım" variant="secondary" onPress={onDone} />
    </View>
  );
}

export default function KioskDevicesScreen() {
  const { clinic, can } = useClinicSession();
  const allowed = can('mesai.yonet');
  const { data, loading, reload } = useKioskDevices(allowed);
  const [name, setName] = useState('Resepsiyon tableti');
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  if (!allowed) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage
            icon="lock-closed-outline"
            title="Mesai ekranlarını yalnızca yönetici ya da sahip yönetir."
          />
        </Card>
      </Screen>
    );
  }

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      setPairing(await attendanceRepository.createPairing(clinic.id, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod üretilemedi.');
    } finally {
      setBusy(false);
    }
  };
  const revoke = async (memberId: string) => {
    setError(null);
    try {
      await attendanceRepository.revoke(memberId);
      setConfirm(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaldırılamadı.');
    }
  };

  const active = data.filter((d) => !d.revoked);
  const revoked = data.filter((d) => d.revoked);

  return (
    <Screen inStack>
      <Card title="Yeni ekran ekle">
        <Text style={styles.muted}>
          Resepsiyondaki tablet, eski bir telefon ya da bilgisayar tarayıcısı olabilir. Ekran
          yalnızca mesai QR kodunu gösterir; hasta, randevu ya da ödeme bilgisine erişemez.
        </Text>
        {pairing ? (
          <PairingCode
            code={pairing.code}
            expiresAt={pairing.expiresAt}
            onDone={() => {
              setPairing(null);
              reload();
            }}
          />
        ) : (
          <>
            <TextField label="Ekranın adı" value={name} onChangeText={setName} />
            <View style={styles.actions}>
              <Button
                label={busy ? 'Üretiliyor…' : 'Eşleştirme kodu üret'}
                icon="qr-code-outline"
                onPress={create}
                disabled={busy}
              />
            </View>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Card>

      <Card title="Bağlı ekranlar">
        {loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} />
        ) : active.length === 0 ? (
          <Text style={styles.muted}>Bağlı mesai ekranı yok.</Text>
        ) : (
          active.map((d, i) => (
            <Fragment key={d.memberId}>
              {i > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <Ionicons name="tablet-portrait-outline" size={24} color={Colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.name}>{d.name}</Text>
                  <Text style={styles.muted}>Son görülme: {ago(d.lastSeenAt)}</Text>
                </View>
                {confirm === d.memberId ? (
                  <View style={styles.actions}>
                    <Button label="Vazgeç" variant="secondary" onPress={() => setConfirm(null)} />
                    <Button label="Kaldır" variant="danger" onPress={() => revoke(d.memberId)} />
                  </View>
                ) : (
                  <Button
                    label="Kaldır"
                    icon="trash-outline"
                    variant="secondary"
                    onPress={() => setConfirm(d.memberId)}
                  />
                )}
              </View>
            </Fragment>
          ))
        )}
        {revoked.length ? (
          <>
            <Divider />
            {revoked.map((d) => (
              <View key={d.memberId} style={styles.row}>
                <Text style={[styles.muted, { flex: 1 }]}>{d.name}</Text>
                <Badge label="Kaldırıldı" tone="muted" />
              </View>
            ))}
          </>
        ) : null}
        <Text style={styles.muted}>
          Kaldırılan ekran anında çalışmayı bırakır. Kaybolan ya da değişen tablet için yeni kod
          üretip yeni cihazı bağlayın.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  error: { fontSize: 13, color: Colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  pairBox: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primarySoft,
  },
  pairLabel: { fontSize: 14, color: Colors.primary, textAlign: 'center' },
  pairCode: { fontSize: 36, fontWeight: '800', letterSpacing: 4, color: Colors.text },
});
