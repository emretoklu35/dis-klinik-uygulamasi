import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Fragment, useDeferredValue, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, CenteredMessage, Divider, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { PatientListItem } from '@/features/patients/components';
import { usePatientList } from '@/features/patients/hooks';
import { useClinicSession } from '@/features/session/session-context';

export default function PatientsScreen() {
  const router = useRouter();
  const { can } = useClinicSession();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const { data, loading, error } = usePatientList(deferredQuery);

  return (
    <Screen
      title="Hastalar"
      subtitle={loading ? 'Yükleniyor…' : `${data.length} hasta`}
      headerRight={
        can('hasta.temel.yaz') ? (
          <Button
            label="Yeni hasta"
            icon="person-add-outline"
            onPress={() => router.push('/hastalar/yeni')}
          />
        ) : null
      }>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ad, soyad veya telefon ile ara"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Hasta ara"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} accessibilityLabel="Aramayı temizle" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Card>
        {error ? (
          <CenteredMessage icon="alert-circle-outline" title={error} />
        ) : loading && data.length === 0 ? (
          <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.xl }} />
        ) : data.length === 0 ? (
          <CenteredMessage
            icon="search-outline"
            title="Sonuç bulunamadı"
            text={query ? `"${query}" ile eşleşen hasta yok.` : 'Henüz hasta eklenmemiş.'}
          />
        ) : (
          data.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <Divider />}
              <PatientListItem patient={p} />
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
});
