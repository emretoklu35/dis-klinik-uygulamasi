import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Divider, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { demoClinic } from '@/data/demo';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.primary, false: Colors.border }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [reminders, setReminders] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  return (
    <Screen title="Ayarlar" subtitle="Klinik ve uygulama tercihleri.">
      <Card title="Klinik bilgileri">
        <InfoRow label="Klinik adı" value={demoClinic.name} />
        <Divider />
        <InfoRow label="Hekimler" value={demoClinic.doctors.join(', ')} />
        <Divider />
        <InfoRow label="Çalışma saatleri" value={demoClinic.workingHours} />
      </Card>

      <Card title="Bildirimler">
        <ToggleRow label="Randevu hatırlatmaları" value={reminders} onChange={setReminders} />
        <Divider />
        <ToggleRow label="Günlük özet" value={dailySummary} onChange={setDailySummary} />
        <Text style={styles.hint}>Bu tercihler henüz kaydedilmiyor.</Text>
      </Card>

      <Card title="Uygulama">
        <InfoRow label="Sürüm" value={Constants.expoConfig?.version ?? '1.0.0'} />
        <Divider />
        <InfoRow label="Dil" value="Türkçe" />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
    minHeight: 32,
  },
  label: { fontSize: 15, color: Colors.text },
  value: { fontSize: 15, color: Colors.textSecondary, flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: 12, color: Colors.textMuted },
});
