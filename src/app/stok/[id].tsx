import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  CenteredMessage,
  Chip,
  Divider,
  Screen,
  TextField,
} from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate, formatDateTime } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import {
  categoryLabels,
  formatQty,
  kindLabels,
  stockRepository,
  useStockItem,
  type Lot,
  type MovementKind,
  type StockItem,
} from '@/features/stock/stock';
import { parseDateInput, todayKey } from '@/lib/dates';
import { formatTL, parseTL } from '@/lib/money';

const kindTone: Record<MovementKind, 'success' | 'primary' | 'warning' | 'danger'> = {
  giris: 'success',
  kullanim: 'primary',
  sayim: 'warning',
  fire: 'danger',
};

function parseCount(text: string) {
  const t = text.trim().replace(/\./g, '');
  return /^\d+$/.test(t) ? Number(t) : null;
}

// ----------------------------------------------------------------------------
// Hareket formu
// ----------------------------------------------------------------------------
function MovementForm({
  item,
  kind,
  onDone,
  onCancel,
}: {
  item: StockItem;
  kind: MovementKind;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { clinic, can } = useClinicSession();
  const canCost = can('stok.maliyet');
  const lots = item.lots; // son kullanma tarihine göre sıralı (en yakın önce)
  const [byPack, setByPack] = useState(kind === 'giris' && item.packSize > 1);
  const [qtyText, setQtyText] = useState('');
  const [lotNo, setLotNo] = useState<string>(kind === 'giris' ? '' : (lots[0]?.lotNo ?? ''));
  const [expiryText, setExpiryText] = useState('');
  const [costText, setCostText] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedLot: Lot | undefined = lots.find((l) => l.lotNo === lotNo);
  const current = item.trackLots && kind !== 'giris' ? (selectedLot?.quantity ?? 0) : item.quantity;
  const needsLot = item.trackLots;
  const noteRequired = kind === 'fire' || kind === 'sayim';

  const save = async () => {
    const n = parseCount(qtyText);
    if (n === null || (kind !== 'sayim' && n === 0))
      return setError('Geçerli bir miktar girin (tam sayı).');
    if (needsLot && !lotNo.trim())
      return setError(kind === 'giris' ? 'Parti numarasını yazın.' : 'Parti seçin.');
    let expiry: string | undefined;
    if (kind === 'giris' && (needsLot || expiryText.trim())) {
      const d = parseDateInput(expiryText);
      if (!d) return setError('Son kullanma tarihini GG.AA.YYYY biçiminde girin.');
      if (d < todayKey()) return setError('Son kullanma tarihi geçmiş malzeme stoğa giremez.');
      expiry = d;
    }
    if (noteRequired && !note.trim()) {
      return setError(
        kind === 'fire' ? 'Fire/imha sebebini yazın.' : 'Sayım farkı için açıklama yazın.',
      );
    }
    const units = kind === 'giris' && byPack ? n * item.packSize : n;
    if ((kind === 'kullanim' || kind === 'fire') && units > current) {
      return setError(`Stokta yeterli miktar yok (mevcut: ${formatQty(current, item.unit)}).`);
    }
    if (kind === 'sayim' && units === current) {
      return setError('Sayılan miktar sistemdekiyle aynı; düzeltme gerekmiyor.');
    }
    let unitCost: number | undefined;
    if (kind === 'giris' && canCost && costText.trim()) {
      const c = parseTL(costText);
      if (c === null) return setError('Maliyeti geçerli bir tutar olarak girin.');
      unitCost = c;
    }

    setSaving(true);
    setError(null);
    try {
      await stockRepository.addMovement(
        clinic.id,
        {
          itemId: item.id,
          kind,
          quantity: kind === 'giris' ? units : -units,
          countedQuantity: kind === 'sayim' ? units : undefined,
          lotNo: lotNo.trim() || undefined,
          expiryDate: expiry,
          note: note.trim() || undefined,
          unitCost,
        },
        canCost,
      );
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hareket kaydedilemedi.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{kindLabels[kind]}</Text>

      {/* Parti seçimi (kullanım, fire, sayım) */}
      {needsLot && kind !== 'giris' ? (
        lots.length === 0 ? (
          <Text style={styles.error}>Elde parti yok.</Text>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Parti (son kullanma tarihi en yakın önce)</Text>
            <View style={styles.chips}>
              {lots.map((l) => (
                <Chip
                  key={l.lotNo}
                  label={`${l.lotNo} · ${formatQty(l.quantity, item.unit)}${l.expiryDate ? ` · SKT ${formatDate(l.expiryDate)}` : ''}`}
                  selected={lotNo === l.lotNo}
                  onPress={() => setLotNo(l.lotNo)}
                />
              ))}
            </View>
          </View>
        )
      ) : null}

      {kind === 'giris' && item.packSize > 1 ? (
        <View style={styles.chips}>
          <Chip
            label={`${item.packName ?? 'Paket'} (${item.packSize} ${item.unit})`}
            selected={byPack}
            onPress={() => setByPack(true)}
          />
          <Chip label={item.unit} selected={!byPack} onPress={() => setByPack(false)} />
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label={
              kind === 'sayim'
                ? `Rafta sayılan (${item.unit})`
                : `Miktar (${kind === 'giris' && byPack ? (item.packName ?? 'paket') : item.unit})`
            }
            value={qtyText}
            onChangeText={setQtyText}
            keyboardType="number-pad"
            hint={
              kind === 'sayim'
                ? `Sistemde: ${formatQty(current, item.unit)}`
                : kind === 'giris' && byPack && parseCount(qtyText)
                  ? `= ${formatQty(parseCount(qtyText)! * item.packSize, item.unit)}`
                  : kind !== 'giris'
                    ? `Mevcut: ${formatQty(current, item.unit)}`
                    : undefined
            }
          />
        </View>
        {kind === 'giris' ? (
          <>
            <View style={styles.col}>
              <TextField
                label={`Parti no${needsLot ? ' *' : ''}`}
                value={lotNo}
                onChangeText={setLotNo}
                placeholder="Ör. ART-2412"
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.col}>
              <TextField
                label={`Son kullanma tarihi${needsLot ? ' *' : ''}`}
                value={expiryText}
                onChangeText={setExpiryText}
                placeholder="GG.AA.YYYY"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
            </View>
            {canCost ? (
              <View style={styles.col}>
                <TextField
                  label={`Birim maliyet (TL / ${item.unit})`}
                  value={costText}
                  onChangeText={setCostText}
                  keyboardType="decimal-pad"
                  placeholder="İsteğe bağlı"
                  hint="Yalnızca sahip ve yönetici görür."
                />
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      <TextField
        label={noteRequired ? (kind === 'fire' ? 'Sebep *' : 'Açıklama *') : 'Not'}
        value={note}
        onChangeText={setNote}
        placeholder={
          kind === 'fire'
            ? 'Ör. Son kullanma tarihi geçti'
            : kind === 'sayim'
              ? 'Ör. Aylık sayım'
              : kind === 'giris'
                ? 'Ör. Demo Medikal teslimatı'
                : 'İsteğe bağlı'
        }
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button label="Vazgeç" variant="secondary" onPress={onCancel} disabled={saving} />
        <Button
          label={saving ? 'Kaydediliyor…' : 'Kaydet'}
          icon="checkmark"
          variant={kind === 'fire' ? 'danger' : 'primary'}
          onPress={save}
          disabled={saving}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Kart ayarları (kritik seviye, tedarikçi, kullanım durumu)
// ----------------------------------------------------------------------------
function ItemSettings({ item, onDone }: { item: StockItem; onDone: () => void }) {
  const [minText, setMinText] = useState(String(item.minLevel));
  const [supplier, setSupplier] = useState(item.supplier ?? '');
  const [active, setActive] = useState(item.active);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const min = parseCount(minText);
    if (min === null) return setError('Kritik seviyeyi tam sayı olarak girin.');
    setBusy(true);
    setError(null);
    try {
      await stockRepository.updateItem(item.id, {
        minLevel: min,
        supplier: supplier.trim() || null,
        active,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label={`Kritik seviye (${item.unit})`}
            value={minText}
            onChangeText={setMinText}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.col}>
          <TextField label="Tedarikçi" value={supplier} onChangeText={setSupplier} />
        </View>
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.label}>Kullanımda</Text>
        <Switch
          value={active}
          onValueChange={setActive}
          trackColor={{ true: Colors.primary, false: Colors.border }}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button
          label={busy ? 'Kaydediliyor…' : 'Kaydet'}
          icon="checkmark"
          onPress={save}
          disabled={busy}
        />
      </View>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Ekran
// ----------------------------------------------------------------------------
export default function StockItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can } = useClinicSession();
  const { data, loading, error, reload } = useStockItem(id);
  const [form, setForm] = useState<MovementKind | 'ayar' | null>(null);

  if (loading && !data) {
    return (
      <Screen inStack>
        <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xxl }} />
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen inStack>
        <Card>
          <CenteredMessage icon="cube-outline" title={error ?? 'Malzeme bulunamadı'}>
            <Button
              label="Stok listesine dön"
              variant="secondary"
              onPress={() => router.replace('/stok')}
            />
          </CenteredMessage>
        </Card>
      </Screen>
    );
  }

  const { item, movements } = data;
  const done = () => {
    setForm(null);
    reload();
  };
  const kinds: MovementKind[] = [
    ...(can('stok.giris') ? (['giris'] as const) : []),
    ...(can('stok.kullanim') ? (['kullanim', 'sayim', 'fire'] as const) : []),
  ];
  const today = todayKey();

  return (
    <Screen inStack>
      <Stack.Screen options={{ title: item.name }} />

      <Card>
        <View style={styles.summary}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.muted}>
              {categoryLabels[item.category]}
              {item.supplier ? ` · ${item.supplier}` : ''}
              {item.packSize > 1
                ? ` · 1 ${item.packName ?? 'paket'} = ${formatQty(item.packSize, item.unit)}`
                : ''}
            </Text>
            <View style={styles.badges}>
              {!item.active ? <Badge label="Kullanımda değil" tone="muted" /> : null}
              {item.isCritical ? <Badge label="Kritik seviyenin altında" tone="danger" /> : null}
              {item.trackLots ? <Badge label="Parti takipli" tone="primary" /> : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.bigQty, item.isCritical && { color: Colors.danger }]}>
              {formatQty(item.quantity, item.unit)}
            </Text>
            <Text style={styles.muted}>Kritik seviye: {formatQty(item.minLevel, item.unit)}</Text>
          </View>
        </View>

        {item.lots.length > 0 ? (
          <>
            <Divider />
            <Text style={styles.label}>Partiler</Text>
            {item.lots.map((l) => {
              const expired = !!l.expiryDate && l.expiryDate < today;
              const soon = item.expiringLot?.lotNo === l.lotNo;
              return (
                <View key={l.lotNo} style={styles.lotRow}>
                  <Text style={styles.lotText}>{l.lotNo}</Text>
                  <Text style={styles.muted}>
                    {l.expiryDate ? `SKT ${formatDate(l.expiryDate)}` : 'SKT yok'}
                  </Text>
                  {expired ? (
                    <Badge label="Süresi geçmiş" tone="danger" />
                  ) : soon ? (
                    <Badge label="Yaklaşıyor" tone="warning" />
                  ) : null}
                  <Text style={[styles.lotText, { marginLeft: 'auto' }]}>
                    {formatQty(l.quantity, item.unit)}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        {!form ? (
          <View style={styles.actions}>
            {kinds.map((k) => (
              <Button
                key={k}
                label={kindLabels[k]}
                variant={k === 'giris' ? 'primary' : k === 'fire' ? 'danger' : 'secondary'}
                onPress={() => setForm(k)}
              />
            ))}
            {can('stok.yonet') ? (
              <Button
                label="Ayarlar"
                icon="settings-outline"
                variant="secondary"
                onPress={() => setForm('ayar')}
              />
            ) : null}
          </View>
        ) : form === 'ayar' ? (
          <ItemSettings item={item} onDone={done} />
        ) : (
          <MovementForm
            key={form}
            item={item}
            kind={form}
            onDone={done}
            onCancel={() => setForm(null)}
          />
        )}
        {form === 'ayar' ? (
          <Button label="Kapat" variant="secondary" onPress={() => setForm(null)} />
        ) : null}
      </Card>

      <Card title="Hareket geçmişi">
        {movements.length === 0 ? (
          <Text style={styles.muted}>Henüz hareket yok.</Text>
        ) : (
          movements.map((m, i) => (
            <Fragment key={m.id}>
              {i > 0 && <Divider />}
              <View style={styles.move}>
                <View style={styles.moveTop}>
                  <Badge label={kindLabels[m.kind]} tone={kindTone[m.kind]} />
                  <Text
                    style={[
                      styles.moveQty,
                      { color: m.quantity >= 0 ? Colors.success : Colors.text },
                    ]}>
                    {m.quantity > 0 ? '+' : ''}
                    {formatQty(m.quantity, item.unit)}
                  </Text>
                </View>
                <Text style={styles.muted}>
                  {m.createdByName} · {formatDateTime(m.createdAt)}
                  {m.lotNo ? ` · Parti ${m.lotNo}` : ''}
                  {m.expiryDate && m.kind === 'giris' ? ` · SKT ${formatDate(m.expiryDate)}` : ''}
                  {m.kind === 'sayim' && m.countedQuantity !== undefined
                    ? ` · Sayılan ${formatQty(m.countedQuantity, item.unit)}`
                    : ''}
                  {m.unitCost !== undefined ? ` · Birim maliyet ${formatTL(m.unitCost)}` : ''}
                </Text>
                {m.note ? <Text style={styles.note}>{m.note}</Text> : null}
              </View>
            </Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: Spacing.lg, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: '700', color: Colors.text },
  bigQty: { fontSize: 26, fontWeight: '700', color: Colors.text },
  muted: { fontSize: 12, color: Colors.textSecondary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.text },
  lotRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  lotText: { fontSize: 14, fontWeight: '600', color: Colors.text },
  form: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  col: { flexGrow: 1, flexBasis: 180 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  error: { fontSize: 13, color: Colors.danger },
  move: { gap: 3 },
  moveTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  moveQty: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, color: Colors.text },
});
