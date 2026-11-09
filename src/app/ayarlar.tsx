import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Divider, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { roleLabels, useClinicSession, useSession } from '@/features/session/session-context';
import { minutesToTime, weekDayShort } from '@/lib/dates';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
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

/** [1,2,3,4,5,6] → "Pzt–Cmt" ; ardışık değilse "Pzt, Çar, Cum" */
function workingDaysLabel(days: number[]) {
  const names = days.map((d) => weekDayShort[d - 1]);
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  return consecutive && days.length > 2
    ? `${names[0]}–${names[names.length - 1]}`
    : names.join(', ');
}

export default function SettingsScreen() {
  const { clinic, doctors, chairs, member, email, roles } = useClinicSession();
  const { signOut } = useSession();
  const [reminders, setReminders] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  return (
    <Screen title="Ayarlar" subtitle="Klinik ve uygulama tercihleri.">
      <Card title="Klinik bilgileri">
        <InfoRow label="Klinik adı" value={clinic.name} />
        <Divider />
        <InfoRow label="Hekimler" value={doctors.map((d) => d.name).join(', ') || '—'} />
        <Divider />
        <InfoRow label="Koltuklar" value={chairs.map((c) => c.name).join(', ') || '—'} />
        <Divider />
        <InfoRow
          label="Çalışma saatleri"
          value={`${workingDaysLabel(clinic.workingDays)} ${minutesToTime(clinic.openMin)} – ${minutesToTime(clinic.closeMin)}`}
        />
      </Card>

      <Card title="Hesabım">
        <InfoRow label="Ad" value={member.name} />
        <Divider />
        <InfoRow label="E-posta" value={email} />
        <Divider />
        <InfoRow label="Roller" value={roles.map((r) => roleLabels[r]).join(', ')} />
        <View style={styles.signOut}>
          <Button label="Çıkış yap" icon="log-out-outline" variant="secondary" onPress={signOut} />
        </View>
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
  signOut: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.sm },
});
