/** Kamerayla mesai QR kodunu okutma penceresi (telefon ve web). */

import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';

export function QrScanner({
  onScanned,
  onClose,
}: {
  onScanned: (data: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // Kamera aynı kodu saniyede birkaç kez okur; yalnızca ilkini kullan
  const done = useRef(false);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>QR okut</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={10}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        {!permission ? (
          <View style={styles.center} />
        ) : !permission.granted ? (
          <View style={styles.center}>
            <Ionicons name="camera-outline" size={48} color="#FFFFFF" />
            <Text style={styles.text}>
              Resepsiyondaki QR kodu okutmak için kameraya izin verin. Kamera yalnızca okutma
              sırasında açılır; görüntü kaydedilmez.
            </Text>
            {permission.canAskAgain ? (
              <Button label="Kameraya izin ver" icon="camera-outline" onPress={requestPermission} />
            ) : (
              <Text style={styles.text}>
                İzin daha önce reddedilmiş. Telefon ayarlarından kamerayı açın ya da kodu elle
                yazın.
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={(r) => {
                if (done.current) return;
                if (!r.data?.startsWith('DKMESAI:')) return;
                done.current = true;
                onScanned(r.data);
              }}
            />
            <View style={styles.frame} pointerEvents="none" />
            <Text style={styles.hint}>Resepsiyondaki ekrandaki QR kodu çerçeveye getirin</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.xl,
  },
  text: { fontSize: 15, color: '#E5E7EB', textAlign: 'center', lineHeight: 21 },
  cameraWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: {
    width: 240,
    height: 240,
    borderRadius: Radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  hint: {
    position: 'absolute',
    bottom: Spacing.xxl,
    left: Spacing.lg,
    right: Spacing.lg,
    textAlign: 'center',
    fontSize: 15,
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
});
