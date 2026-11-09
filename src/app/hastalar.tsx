import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { demoPatients } from '@/data/demo';

export default function PatientsScreen() {
  return (
    <Screen title="Hastalar" subtitle="Hasta kayıtları burada listelenecek.">
      <Card title="Son görülen hastalar (örnek)">
        {demoPatients.map((p, i) => (
          <Fragment key={p.id}>
            {i > 0 && <Divider />}
            <View style={styles.row}>
              <View style={styles.avatar}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.body}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>
                  Son ziyaret: {p.lastVisit} · Sıradaki: {p.nextStep}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </View>
          </Fragment>
        ))}
      </Card>

      <Card>
        <View style={styles.empty}>
          <Ionicons name="folder-open-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Hasta kartları yakında</Text>
          <Text style={styles.emptyText}>
            Hasta ekleme, arama ve tedavi geçmişi bir sonraki aşamada eklenecek.
          </Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 13, color: Colors.textSecondary },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
