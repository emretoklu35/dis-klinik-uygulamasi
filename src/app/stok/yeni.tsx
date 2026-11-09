import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, CenteredMessage, Chip, Screen, Segmented, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useClinicSession } from '@/features/session/session-context';
import {
  categoryLabels,
  LOT_TRACKED_CATEGORIES,
  stockRepository,
  type StockCategory,
} from '@/features/stock/stock';

const unitSuggestions = ['adet', 'karpül', 'şırınga', 'ml', 'paket', 'rulo'];

export default function NewStockItemScreen() {
  const router = useRouter();
  const { clinic, can } = useClinicSession();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockCategory>('sarf');
  const [unit, setUnit] = useState('adet');
  const [packName, setPackName] = useState('');
  const [packSizeText, setPackSizeText] = useState('');
  const [minText, setMinText] = useState('');
  const [trackLots, setTrackLots] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!can('stok.yonet')) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="lock-closed-outline" title="Malzeme kartı açma yetkiniz yok." />
        </Card>
      </Screen>
    );
  }

  const pickCategory = (c: StockCategory) => {
    setCategory(c);
    setTrackLots(LOT_TRACKED_CATEGORIES.includes(c));
  };

  const save = async () => {
    const min = minText.trim() ? Number(minText) : 0;
    const packSize = packSizeText.trim() ? Number(packSizeText) : 1;
    if (!name.trim()) return setError('Malzeme adını yazın.');
    if (!unit.trim()) return setError('Birim yazın.');
    if (!Number.isInteger(min) || min < 0)
      return setError('Kritik seviyeyi tam sayı olarak girin.');
    if (!Number.isInteger(packSize) || packSize < 1)
      return setError('Paket içeriğini tam sayı olarak girin.');
    if (packSize > 1 && !packName.trim()) return setError('Paket adını yazın (ör. kutu).');
    setSaving(true);
    setError(null);
    try {
      const id = await stockRepository.createItem(clinic.id, {
        name: name.trim(),
        category,
        unit: unit.trim(),
        packName: packSize > 1 ? packName.trim() : undefined,
        packSize,
        minLevel: min,
        trackLots,
        supplier: supplier.trim() || undefined,
      });
      router.replace({ pathname: '/stok/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Malzeme eklenemedi.');
      setSaving(false);
    }
  };

  return (
    <Screen inStack>
      <Card title="Malzeme">
        <TextField
          label="Ad"
          required
          value={name}
          onChangeText={setName}
          placeholder="Ör. Muayene eldiveni (L)"
        />
        <Segmented
          label="Kategori"
          value={category}
          options={(Object.keys(categoryLabels) as StockCategory[]).map((c) => ({
            value: c,
            label: categoryLabels[c],
          }))}
          onChange={pickCategory}
        />
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Temel birim (stok bu birimle tutulur)</Text>
          <View style={styles.chips}>
            {unitSuggestions.map((u) => (
              <Chip key={u} label={u} selected={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
          <TextField label="Birim" value={unit} onChangeText={setUnit} />
        </View>
        <View style={styles.row}>
          <View style={styles.col}>
            <TextField
              label="Paket adı"
              value={packName}
              onChangeText={setPackName}
              placeholder="Ör. kutu (isteğe bağlı)"
            />
          </View>
          <View style={styles.col}>
            <TextField
              label={`1 paket kaç ${unit || 'birim'}?`}
              value={packSizeText}
              onChangeText={setPackSizeText}
              keyboardType="number-pad"
              placeholder="Ör. 100"
            />
          </View>
          <View style={styles.col}>
            <TextField
              label={`Kritik seviye (${unit || 'birim'})`}
              value={minText}
              onChangeText={setMinText}
              keyboardType="number-pad"
              placeholder="Ör. 200"
              hint="Bunun altına düşünce uyarı ve sipariş listesine eklenir."
            />
          </View>
        </View>
        <TextField
          label="Tedarikçi"
          value={supplier}
          onChangeText={setSupplier}
          placeholder="İsteğe bağlı"
        />
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Parti ve son kullanma tarihi takibi</Text>
            <Text style={styles.hint}>
              Anestezik, dolgu malzemesi ve implantta varsayılan olarak açıktır.
            </Text>
          </View>
          <Switch
            value={trackLots}
            onValueChange={setTrackLots}
            trackColor={{ true: Colors.primary, false: Colors.border }}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <Button
            label="Vazgeç"
            variant="secondary"
            onPress={() => router.back()}
            disabled={saving}
          />
          <Button
            label={saving ? 'Kaydediliyor…' : 'Malzemeyi ekle'}
            icon="checkmark"
            onPress={save}
            disabled={saving}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 180 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  error: { fontSize: 13, color: Colors.danger },
});
