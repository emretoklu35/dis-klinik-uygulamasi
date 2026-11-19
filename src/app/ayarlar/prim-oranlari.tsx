import { Fragment, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, CenteredMessage, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Initials } from '@/features/reports/components';
import { reportsRepository, useCommissionRates } from '@/features/reports/reports';
import { useClinicSession } from '@/features/session/session-context';

function RateRow({
  id,
  name,
  rate,
  onSaved,
}: {
  id: string;
  name: string;
  rate: number;
  onSaved: () => void;
}) {
  const [text, setText] = useState(String(rate));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const value = Number(text.replace(',', '.'));
  const changed = text.trim() !== '' && value !== rate;

  const save = async () => {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      setMsg({ ok: false, text: '0 ile 100 arasında bir oran yazın.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await reportsRepository.setRate(id, value);
      setMsg({ ok: true, text: 'Kaydedildi.' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Initials name={name} size={44} />
        <Text style={styles.name}>{name}</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.pct}>%</Text>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, '').slice(0, 6))}
            keyboardType="decimal-pad"
            accessibilityLabel={`${name} prim oranı`}
            style={styles.input}
          />
        </View>
        <Button label={busy ? '…' : 'Kaydet'} onPress={save} disabled={busy || !changed} />
      </View>
      {msg ? (
        <Text style={[styles.msg, { color: msg.ok ? Colors.success : Colors.danger }]}>
          {msg.text}
        </Text>
      ) : null}
    </View>
  );
}

export default function CommissionRatesScreen() {
  const { doctors, can } = useClinicSession();
  const allowed = can('prim.yonet');
  const { data: rates, reload, loading } = useCommissionRates(allowed);

  if (!allowed) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage
            icon="lock-closed-outline"
            title="Prim oranlarını yalnızca klinik sahibi girer."
          />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen inStack>
      <Card title="Hekim prim oranları">
        <Text style={styles.hint}>
          Doktor Prim Raporu bu oranlarla hesaplanır. Oran girilmemiş hekim %0 sayılır. Her
          değişiklik kim/ne zaman bilgisiyle denetim kaydına yazılır.
        </Text>
        {loading && rates.size === 0
          ? null
          : doctors.map((d, i) => (
              <Fragment key={d.id}>
                {i > 0 ? <Divider /> : null}
                <RateRow id={d.id} name={d.name} rate={rates.get(d.id) ?? 0} onSaved={reload} />
              </Fragment>
            ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  name: { flex: 1, minWidth: 120, fontSize: 16, color: Colors.text },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
  pct: { fontSize: 16, color: Colors.textSecondary },
  input: { width: 64, minHeight: 44, fontSize: 18, color: Colors.text, textAlign: 'right' },
  msg: { fontSize: 13 },
});
