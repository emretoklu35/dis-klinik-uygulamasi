import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { Fragment, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Badge, Button, Card, CenteredMessage, Chip, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatDate, normalizeForSearch } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';
import {
  categoryLabels,
  formatQty,
  suggestedOrder,
  useStockItems,
  type StockItem,
} from '@/features/stock/stock';
import { taskRepository } from '@/features/tasks/tasks';
import { todayKey } from '@/lib/dates';

type Filter = 'tumu' | 'kritik' | 'skt';

function orderLine(i: StockItem) {
  const s = suggestedOrder(i);
  return s.packs !== undefined
    ? `${i.name}: ${s.packs} ${i.packName ?? 'paket'} (${formatQty(s.units, i.unit)})`
    : `${i.name}: ${formatQty(s.units, i.unit)}`;
}

/** Kritik seviyenin altındaki malzemelerden sipariş listesi */
function OrderList({ items }: { items: StockItem[] }) {
  const { clinic, can } = useClinicSession();
  const [message, setMessage] = useState<string | null>(null);
  const text = `${clinic.name} – sipariş listesi (${formatDate(todayKey())})\n\n${items
    .map((i) => `• ${orderLine(i)}${i.supplier ? ` — ${i.supplier}` : ''}`)
    .join('\n')}`;

  const share = async () => {
    try {
      await Share.share({ message: text });
    } catch {
      setMessage('Paylaşılamadı.');
    }
  };
  const createTask = async () => {
    try {
      await taskRepository.create(clinic.id, {
        title: `Sipariş ver: ${items.map((i) => i.name).join(', ')}`,
        dueDate: todayKey(),
        priority: 'yuksek',
      });
      setMessage('Görevlere eklendi.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Görev oluşturulamadı.');
    }
  };

  return (
    <Card title={`Sipariş listesi · ${items.length} malzeme`}>
      <Text style={styles.muted}>Kritik seviyenin iki katına tamamlayacak şekilde önerilir.</Text>
      {items.map((i) => (
        <Text key={i.id} style={styles.orderLine}>
          • {orderLine(i)}
          {i.supplier ? <Text style={styles.muted}> · {i.supplier}</Text> : null}
        </Text>
      ))}
      <View style={styles.actions}>
        {can('gorev.yaz') ? (
          <Button
            label="Görev oluştur"
            icon="checkbox-outline"
            variant="secondary"
            onPress={createTask}
          />
        ) : null}
        <Button label="Listeyi paylaş" icon="share-outline" onPress={share} />
      </View>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </Card>
  );
}

export default function StockScreen() {
  const router = useRouter();
  const { can } = useClinicSession();
  const { data, loading, error } = useStockItems(can('stok.oku'));
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('tumu');

  if (!can('stok.oku')) {
    return (
      <Screen title="Stok">
        <Card>
          <CenteredMessage icon="lock-closed-outline" title="Stoğu görme yetkiniz yok." />
        </Card>
      </Screen>
    );
  }

  const active = data.filter((i) => i.active);
  const critical = active.filter((i) => i.isCritical);
  const expiring = active.filter((i) => i.expiringLot);
  const q = normalizeForSearch(query);
  const shown = (filter === 'kritik' ? critical : filter === 'skt' ? expiring : data).filter(
    (i) =>
      !q ||
      normalizeForSearch(i.name).includes(q) ||
      normalizeForSearch(i.supplier ?? '').includes(q),
  );

  return (
    <Screen
      title="Stok"
      subtitle={
        loading && data.length === 0
          ? 'Yükleniyor…'
          : `${active.length} malzeme · ${critical.length} kritik · ${expiring.length} son kullanma uyarısı`
      }
      headerRight={
        can('stok.yonet') ? (
          <Button label="Yeni malzeme" icon="add" onPress={() => router.push('/stok/yeni')} />
        ) : null
      }>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Malzeme veya tedarikçi ara"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          accessibilityLabel="Malzeme ara"
        />
      </View>
      <View style={styles.chips}>
        <Chip
          label={`Tümü (${data.length})`}
          selected={filter === 'tumu'}
          onPress={() => setFilter('tumu')}
        />
        <Chip
          label={`Kritik (${critical.length})`}
          selected={filter === 'kritik'}
          onPress={() => setFilter('kritik')}
        />
        <Chip
          label={`Son kullanma yaklaşan (${expiring.length})`}
          selected={filter === 'skt'}
          onPress={() => setFilter('skt')}
        />
      </View>

      {critical.length > 0 && filter !== 'skt' ? <OrderList items={critical} /> : null}

      <Card>
        {error ? (
          <CenteredMessage icon="alert-circle-outline" title={error} />
        ) : loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} />
        ) : shown.length === 0 ? (
          <Text style={styles.muted}>Eşleşen malzeme yok.</Text>
        ) : (
          shown.map((i, idx) => (
            <Fragment key={i.id}>
              {idx > 0 && <Divider />}
              <Link href={{ pathname: '/stok/[id]', params: { id: i.id } }} asChild>
                <Pressable accessibilityRole="link">
                  {({ pressed }) => (
                    <View
                      style={[
                        styles.row,
                        pressed && { opacity: 0.6 },
                        !i.active && { opacity: 0.5 },
                      ]}>
                      <View style={styles.icon}>
                        <Ionicons name="cube-outline" size={18} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                        <Text style={styles.name} numberOfLines={1}>
                          {i.name}
                        </Text>
                        <Text style={styles.muted} numberOfLines={1}>
                          {categoryLabels[i.category]}
                          {i.supplier ? ` · ${i.supplier}` : ''} · Kritik seviye{' '}
                          {formatQty(i.minLevel, i.unit)}
                        </Text>
                        <View style={styles.badges}>
                          {!i.active ? <Badge label="Kullanımda değil" tone="muted" /> : null}
                          {i.isCritical ? <Badge label="Kritik" tone="danger" /> : null}
                          {i.expiringLot ? (
                            <Badge
                              label={
                                i.expiringLot.expired
                                  ? `Süresi geçmiş: ${i.expiringLot.lotNo}`
                                  : `SKT ${formatDate(i.expiringLot.expiryDate)} · ${i.expiringLot.lotNo}`
                              }
                              tone={i.expiringLot.expired ? 'danger' : 'warning'}
                            />
                          ) : null}
                        </View>
                      </View>
                      <Text style={[styles.qty, i.isCritical && { color: Colors.danger }]}>
                        {formatQty(i.quantity, i.unit)}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </View>
                  )}
                </Pressable>
              </Link>
            </Fragment>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
    minHeight: 44,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  icon: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  qty: { fontSize: 15, fontWeight: '700', color: Colors.text },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  muted: { fontSize: 12, color: Colors.textSecondary },
  orderLine: { fontSize: 14, color: Colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
});
