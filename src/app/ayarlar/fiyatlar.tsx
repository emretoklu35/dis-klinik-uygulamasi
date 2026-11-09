import { Fragment, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, CenteredMessage, Divider, Screen, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  paymentRepository,
  usePriceList,
  type AmountChange,
  type PriceItem,
} from '@/features/payments/payments';
import { formatDateTime } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import { formatTL, kurusToInput, parseTL } from '@/lib/money';
import { useFocusLoad } from '@/lib/use-focus-load';

/** Kalem ayrıntısı: fiyat değiştir (not ile), kullanımdan kaldır/geri al, değişiklik geçmişi. */
function ItemEditor({
  item,
  onChanged,
  onClose,
}: {
  item: PriceItem;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { clinic, can } = useClinicSession();
  const canWrite = can('fiyat.yaz');
  const [amountText, setAmountText] = useState(kurusToInput(item.amount));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadHistory = useCallback(
    () => paymentRepository.priceHistory(clinic.id, item.id),
    [clinic.id, item.id],
  );
  const { data: history, reload: reloadHistory } = useFocusLoad<AmountChange[] | null>(
    loadHistory,
    null,
    'Geçmiş yüklenemedi.',
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
      setNote('');
      reloadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem yapılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const saveAmount = () => {
    const amount = parseTL(amountText);
    if (amount === null) return setError('Geçerli bir tutar girin (ör. 4.000 veya 4.000,50).');
    if (amount === item.amount) return setError('Tutar aynı.');
    void run(() =>
      paymentRepository.updatePriceItem(item.id, { amount, note: note.trim() || undefined }),
    );
  };

  return (
    <View style={styles.editor}>
      {canWrite ? (
        <>
          <View style={styles.row}>
            <View style={styles.col}>
              <TextField
                label="Yeni fiyat (TL)"
                value={amountText}
                onChangeText={setAmountText}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.col, { flexBasis: 280 }]}>
              <TextField
                label="Not (isteğe bağlı)"
                value={note}
                onChangeText={setNote}
                placeholder="Ör. Malzeme zammı"
                hint="Yeni fiyat bundan sonra eklenen borçlara uygulanır; eski borçlar değişmez."
              />
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              label={item.active ? 'Kullanımdan kaldır' : 'Yeniden kullan'}
              variant="secondary"
              disabled={busy}
              onPress={() =>
                void run(() => paymentRepository.updatePriceItem(item.id, { active: !item.active }))
              }
            />
            <Button label="Kapat" variant="secondary" onPress={onClose} />
            <Button label="Fiyatı kaydet" icon="checkmark" disabled={busy} onPress={saveAmount} />
          </View>
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.historyTitle}>Değişiklik geçmişi</Text>
      {history === null ? (
        <ActivityIndicator color={Colors.primary} />
      ) : history.length === 0 ? (
        <Text style={styles.muted}>Henüz fiyat değişikliği yok.</Text>
      ) : (
        history.map((h, i) => (
          <Text key={i} style={styles.historyText}>
            {formatDateTime(h.changedAt)} · {h.changedByName}: {formatTL(h.oldAmount)} →{' '}
            {formatTL(h.newAmount)}
            {h.note ? ` (${h.note})` : ''}
          </Text>
        ))
      )}
    </View>
  );
}

function NewItem({ onDone }: { onDone: () => void }) {
  const { clinic } = useClinicSession();
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const amount = parseTL(amountText);
    if (!name.trim()) return setError('Kalem adını yazın.');
    if (amount === null) return setError('Geçerli bir tutar girin.');
    setBusy(true);
    setError(null);
    try {
      await paymentRepository.createPriceItem(clinic.id, name.trim(), amount);
      setName('');
      setAmountText('');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kalem eklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Yeni fiyat kalemi">
      <View style={styles.row}>
        <View style={[styles.col, { flexBasis: 280 }]}>
          <TextField label="Ad" value={name} onChangeText={setName} placeholder="Ör. Gece plağı" />
        </View>
        <View style={styles.col}>
          <TextField
            label="Fiyat (TL)"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="Ör. 3.500"
          />
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={busy ? 'Ekleniyor…' : 'Kalemi ekle'}
          icon="add"
          onPress={save}
          disabled={busy}
        />
      </View>
    </Card>
  );
}

export default function PriceListScreen() {
  const { can } = useClinicSession();
  const { data, loading, error, reload } = usePriceList(can('odeme.oku'));
  const [openId, setOpenId] = useState<string | null>(null);

  if (!can('odeme.oku')) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="lock-closed-outline" title="Fiyat listesini görme yetkiniz yok." />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen inStack>
      {can('fiyat.yaz') ? <NewItem onDone={reload} /> : null}
      <Card title="Fiyatlar">
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          data.map((item, i) => (
            <Fragment key={item.id}>
              {i > 0 && <Divider />}
              <Pressable
                onPress={() => setOpenId(openId === item.id ? null : item.id)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.name, !item.active && styles.inactive]}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.updatedByName
                      ? `Son değişiklik: ${item.updatedByName} · ${formatDateTime(item.updatedAt)}`
                      : 'Başlangıç fiyatı'}
                  </Text>
                </View>
                {!item.active ? <Badge label="Kullanımda değil" tone="muted" /> : null}
                <Text style={[styles.amount, !item.active && styles.inactive]}>
                  {formatTL(item.amount)}
                </Text>
              </Pressable>
              {openId === item.id ? (
                <ItemEditor item={item} onChanged={reload} onClose={() => setOpenId(null)} />
              ) : null}
            </Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  amount: { fontSize: 15, fontWeight: '700', color: Colors.text },
  inactive: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  muted: { fontSize: 12, color: Colors.textSecondary },
  editor: {
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 180 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginTop: Spacing.xs },
  historyText: { fontSize: 12, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
});
