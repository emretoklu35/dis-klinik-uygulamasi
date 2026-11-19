import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Divider, gridItem } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { formatDate } from '@/features/patients/utils';
import { useClinicSession } from '@/features/session/session-context';

import { kindLabels, useOpenMediaRequests, usePendingReviewCount } from './radiographs';

/**
 * Ana Sayfa medya kartı.
 *  - Asistan/hekim: açık tekrar çekim istekleri (hastaya gidilir, oradan yüklenir)
 *  - Hekim: incelenmeyi bekleyen görüntü sayısı
 * Yetkisi olmayan rollerde hiç çizilmez.
 */
export function MediaHomeCard() {
  const { can } = useClinicSession();
  const canRequests = can('medya.istek.oku');
  const canReview = can('rontgen.yaz');
  const { data: requests } = useOpenMediaRequests(undefined, canRequests);
  const { data: pending } = usePendingReviewCount(canReview);
  if (!canRequests && !canReview) return null;
  // Ana Sayfa'da yalnızca yapılacak bir şey varsa görünür
  if ((!canReview || pending === 0) && (!canRequests || requests.length === 0)) return null;

  return (
    <Card title="Medya" style={gridItem}>
      {canReview ? (
        <Text style={pending > 0 ? styles.pending : styles.muted}>
          {pending > 0
            ? `${pending} görüntü incelemenizi bekliyor.`
            : 'İnceleme bekleyen görüntü yok.'}
        </Text>
      ) : null}
      {canRequests ? (
        requests.length === 0 ? (
          <Text style={styles.muted}>Açık tekrar çekim isteği yok.</Text>
        ) : (
          <>
            <Text style={styles.heading}>Tekrar çekim istekleri ({requests.length})</Text>
            {requests.slice(0, 5).map((q, i) => (
              <Fragment key={q.id}>
                {i > 0 && <Divider />}
                <Link
                  href={{ pathname: '/hastalar/[id]', params: { id: q.patientId } }}
                  withAnchor
                  asChild>
                  <Pressable accessibilityRole="link">
                    {({ pressed }) => (
                      <View style={[styles.row, pressed && { opacity: 0.6 }]}>
                        <Ionicons name="refresh-circle" size={20} color={Colors.danger} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.title}>
                            {q.patientName} · {kindLabels[q.kind]}
                            {q.tooth ? ` · Diş ${q.tooth}` : ''}
                          </Text>
                          <Text style={styles.muted} numberOfLines={1}>
                            “{q.reason}” · {formatDate(q.requestedAt)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                      </View>
                    )}
                  </Pressable>
                </Link>
              </Fragment>
            ))}
          </>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heading: { fontSize: 14, fontWeight: '700', color: Colors.text },
  title: { fontSize: 14, fontWeight: '600', color: Colors.text },
  muted: { fontSize: 13, color: Colors.textSecondary },
  pending: { fontSize: 14, fontWeight: '700', color: Colors.warning },
});
