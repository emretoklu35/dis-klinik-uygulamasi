import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Card, gridItem } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatDate } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';

import { formatQty, useStockItems } from './stock';

/** Ana Sayfa stok uyarıları: kritik seviye ve son kullanma tarihi yaklaşanlar. */
export function StockHomeCard() {
  const { can } = useClinicSession();
  const enabled = can('stok.oku');
  const { data } = useStockItems(enabled);
  if (!enabled) return null;

  const active = data.filter((i) => i.active);
  const critical = active.filter((i) => i.isCritical);
  const expiring = active.filter((i) => i.expiringLot);

  return (
    <Card
      title="Stok"
      style={gridItem}
      action={
        <Link href="/stok" style={styles.link}>
          Stoğa git
        </Link>
      }>
      {critical.length === 0 && expiring.length === 0 ? (
        <Text style={styles.muted}>Kritik seviyede ya da süresi yaklaşan malzeme yok.</Text>
      ) : null}
      {critical.slice(0, 4).map((i) => (
        <View key={i.id} style={styles.row}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.text}>
            {i.name}: {formatQty(i.quantity, i.unit)}{' '}
            <Text style={styles.muted}>(kritik {formatQty(i.minLevel, i.unit)})</Text>
          </Text>
        </View>
      ))}
      {expiring.slice(0, 3).map((i) => (
        <View key={`${i.id}-skt`} style={styles.row}>
          <Ionicons name="time" size={18} color={Colors.warning} />
          <Text style={styles.text}>
            {i.name} · parti {i.expiringLot!.lotNo}:{' '}
            {i.expiringLot!.expired
              ? 'süresi geçmiş'
              : `SKT ${formatDate(i.expiringLot!.expiryDate)}`}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  text: { fontSize: 14, color: Colors.text, flexShrink: 1 },
  muted: { fontSize: 13, color: Colors.textSecondary },
});
