import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { roleLabels, useClinicSession, useSession } from '@/features/session/session-context';
import { useIsWideLayout } from '@/hooks/use-is-wide-layout';
import { minutesToTime, weekDayShort } from '@/lib/dates';

type IconName = ComponentProps<typeof Ionicons>['name'];

const SOON_MESSAGE = 'Bu bölüm daha sonra eklenecek.';

/** [1,2,3,4,5,6] → "Pzt–Cmt" ; ardışık değilse "Pzt, Çar, Cum" */
function workingDaysLabel(days: number[]) {
  const names = days.map((d) => weekDayShort[d - 1]);
  const consecutive = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  return consecutive && days.length > 2
    ? `${names[0]}–${names[names.length - 1]}`
    : names.join(', ');
}

// ----------------------------------------------------------------------------
// Satır bileşenleri
// ----------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  chevron = true,
  last = false,
  disabled = false,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: ReactNode;
  onPress?: () => void;
  /** Ok yerine sağda gösterilecek öğe (ör. anahtar) */
  right?: ReactNode;
  chevron?: boolean;
  last?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      <Ionicons
        name={icon}
        size={24}
        color={disabled ? Colors.textMuted : Colors.primary}
        style={styles.rowIcon}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, disabled && { color: Colors.textSecondary }]}>{title}</Text>
        {typeof subtitle === 'string' ? (
          <Text style={styles.rowSubtitle}>{subtitle}</Text>
        ) : (
          subtitle
        )}
      </View>
      {right}
      {chevron && !right ? (
        <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
      ) : null}
    </>
  );

  return (
    <View style={[styles.rowWrap, !last && styles.rowDivider]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
          {content}
        </Pressable>
      ) : (
        <View style={styles.row} accessibilityLabel={accessibilityLabel}>
          {content}
        </View>
      )}
    </View>
  );
}

function ProfileDetail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ----------------------------------------------------------------------------
// Ekran
// ----------------------------------------------------------------------------
export default function SettingsScreen() {
  const { clinic, member, email, roles, can } = useClinicSession();
  const { signOut } = useSession();
  const router = useRouter();
  const isWide = useIsWideLayout();
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Kısa bilgi mesajı birkaç saniye sonra kendiliğinden kaybolur
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const soon = () => setToast(SOON_MESSAGE);
  const version = Constants.expoConfig?.version ?? '1.0.0';

  // Biyometrik giriş henüz uygulamada yok; webde zaten desteklenmez. Sahte anahtar yerine kapalı gösterilir.
  const biometricNote =
    Platform.OS === 'web'
      ? 'Web tarayıcısında kullanılamaz.'
      : 'Henüz desteklenmiyor; ileride telefonda açılabilecek.';

  const showUsers = can('uye.yonet');
  const showTreatments = can('odeme.oku');
  const showClinic = can('klinik.yonet') || can('indirim.sinirsiz');
  const clinicRows = [
    showClinic ? 'clinic' : null,
    showUsers ? 'users' : null,
    'files',
    can('mesai.yonet') ? 'kiosk' : null,
    can('prim.yonet') ? 'prim' : null,
    showTreatments ? 'treatments' : null,
  ].filter(Boolean) as string[];
  const lastClinicRow = clinicRows[clinicRows.length - 1];

  const doSignOut = async () => {
    setSigningOut(true);
    await signOut();
    // Oturum kapanınca uygulama giriş ekranına döner; bu bileşen kaldırılır.
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={[styles.header, isWide && styles.headerWide]}>
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Text style={styles.title} accessibilityRole="header">
            Ayarlar
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, isWide && styles.scrollContentWide]}>
        <View style={[styles.inner, isWide && styles.innerWide]}>
          <Section title="Hesabım">
            <SettingRow
              icon="person-circle-outline"
              title="Profil"
              subtitle={`${member.name} · ${roles.map((r) => roleLabels[r]).join(', ')}`}
              onPress={() => setProfileOpen((v) => !v)}
              accessibilityLabel={profileOpen ? 'Profili gizle' : 'Profili göster'}
              right={
                <Ionicons
                  name={profileOpen ? 'chevron-down' : 'chevron-forward'}
                  size={20}
                  color={Colors.textSecondary}
                />
              }
            />
            {profileOpen ? (
              <View style={[styles.profile, styles.rowDivider]}>
                <ProfileDetail label="Ad" value={member.name} />
                <ProfileDetail label="E-posta" value={email} />
                <ProfileDetail label="Roller" value={roles.map((r) => roleLabels[r]).join(', ')} />
                <ProfileDetail label="Klinik" value={clinic.name} />
                <ProfileDetail
                  label="Mesai"
                  value={`${workingDaysLabel(clinic.workingDays)} ${minutesToTime(clinic.openMin)} – ${minutesToTime(clinic.closeMin)}`}
                />
              </View>
            ) : null}
            <SettingRow
              icon="language-outline"
              title="Dil"
              subtitle="Türkçe"
              onPress={soon}
              accessibilityLabel="Dil, Türkçe"
            />
            <SettingRow
              icon="notifications-outline"
              title="İletişim Ayarları"
              subtitle="Bildirim Tercihleri ve Ayarları"
              onPress={soon}
            />
            <SettingRow
              icon="finger-print-outline"
              title="Biyometrik Giriş"
              subtitle={
                <>
                  <Text style={styles.rowSubtitle}>Parmak izi veya yüz tanıma kullan.</Text>
                  <Text style={styles.rowNote}>{biometricNote}</Text>
                </>
              }
              disabled
              last
              accessibilityLabel={`Biyometrik giriş, kapalı. ${biometricNote}`}
              right={
                <Switch
                  value={false}
                  disabled
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                  thumbColor="#FFFFFF"
                />
              }
            />
          </Section>

          <Section title="Klinik Yönetimi">
            {showClinic ? (
              <SettingRow
                icon="business-outline"
                title="Klinik Bilgileri"
                subtitle="Proformadaki adres, telefon, e-posta ve indirim sınırı"
                onPress={() => router.push('/ayarlar/klinik')}
                last={lastClinicRow === 'clinic'}
              />
            ) : null}
            {showUsers ? (
              <SettingRow
                icon="people-outline"
                title="Kullanıcılar"
                onPress={soon}
                last={lastClinicRow === 'users'}
              />
            ) : null}
            <SettingRow
              icon="folder-open-outline"
              title="Klinik Dosyaları"
              onPress={soon}
              last={lastClinicRow === 'files'}
            />
            {can('mesai.yonet') ? (
              <SettingRow
                icon="tablet-portrait-outline"
                title="Mesai Ekranı"
                subtitle="Resepsiyondaki QR tableti"
                onPress={() => router.push('/ayarlar/mesai-ekrani')}
                last={lastClinicRow === 'kiosk'}
              />
            ) : null}
            {can('prim.yonet') ? (
              <SettingRow
                icon="cash-outline"
                title="Prim Oranları"
                subtitle="Doktor prim raporu için hekim oranları"
                onPress={() => router.push('/ayarlar/prim-oranlari')}
                last={lastClinicRow === 'prim'}
              />
            ) : null}
            {showTreatments ? (
              <SettingRow
                icon="medkit-outline"
                title="Tedaviler"
                subtitle="Tedavi fiyat listesi"
                onPress={() => router.push('/ayarlar/fiyatlar')}
                last
              />
            ) : null}
          </Section>

          <Section title="Diğer">
            <SettingRow
              icon="star-outline"
              title="Bizi Değerlendir"
              subtitle="Geri bildirimlerinizi bizimle paylaşın."
              onPress={soon}
            />
            <SettingRow
              icon="share-social-outline"
              title="Uygulamayı Paylaş"
              subtitle="Uygulamayı bir meslektaşınızla paylaşın."
              onPress={soon}
            />
            <SettingRow
              icon="chatbubble-ellipses-outline"
              title="Canlı Destek"
              subtitle="Destek ekibiyle yazışın."
              onPress={soon}
            />
            <SettingRow
              icon="information-circle-outline"
              title="Sürüm"
              subtitle={version}
              chevron={false}
              last
              accessibilityLabel={`Sürüm ${version}`}
            />
          </Section>

          <Pressable
            onPress={() => setConfirmSignOut(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
            <Ionicons name="log-out-outline" size={22} color={Colors.danger} />
            <Text style={styles.signOutText}>Çıkış</Text>
          </Pressable>

          <Text style={styles.demo}>Bu ekrandaki tüm bilgiler sahte demo verisidir.</Text>
        </View>
      </ScrollView>

      {toast ? (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast} accessibilityLiveRegion="polite">
            <Ionicons name="time-outline" size={18} color="#FFFFFF" />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      ) : null}

      {/* Çıkış onayı: Alert webde düğme göstermediği için her platformda aynı pencere */}
      <Modal
        visible={confirmSignOut}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSignOut(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog} accessibilityViewIsModal>
            <Text style={styles.dialogTitle}>Çıkış yapılsın mı?</Text>
            <Text style={styles.dialogText}>
              {email} hesabından çıkış yapılacak. Tekrar girmek için e-posta ve şifreniz gerekir.
            </Text>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setConfirmSignOut(false)}
                disabled={signingOut}
                accessibilityRole="button"
                style={({ pressed }) => [styles.dialogBtn, pressed && { opacity: 0.7 }]}>
                <Text style={styles.dialogBtnText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                onPress={doSignOut}
                disabled={signingOut}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.dialogBtn,
                  styles.dialogBtnDanger,
                  pressed && { opacity: 0.7 },
                ]}>
                {signingOut ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={[styles.dialogBtnText, { color: '#FFFFFF' }]}>Çıkış yap</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GRAY = '#F3F5F4';
const LINE = '#E3E6EB';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
  },
  headerWide: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxl },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1, backgroundColor: GRAY },
  scrollContent: { paddingBottom: Spacing.xxl },
  scrollContentWide: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg },
  inner: { width: '100%', alignSelf: 'center' },
  innerWide: { maxWidth: 760 },

  section: { paddingTop: Spacing.xl },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  sectionBody: { borderBottomWidth: 1, borderBottomColor: LINE },

  rowWrap: { paddingLeft: Spacing.lg },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: 60,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
  },
  rowPressed: { backgroundColor: '#E6EBE9' },
  rowIcon: { width: 28, textAlign: 'center' },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  rowTitle: { fontSize: 17, color: Colors.text },
  rowSubtitle: { fontSize: 14, color: Colors.textSecondary },
  rowNote: { fontSize: 12, color: Colors.textMuted },

  profile: {
    marginLeft: Spacing.lg + 28 + Spacing.lg,
    marginRight: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: LINE,
  },
  detailRow: { flexDirection: 'row', gap: Spacing.md },
  detailLabel: { fontSize: 13, color: Colors.textMuted, width: 112 },
  detailValue: { fontSize: 14, color: Colors.text, flexShrink: 1 },

  signOut: {
    marginTop: Spacing.xl,
    marginHorizontal: Spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#F3A9A9',
    backgroundColor: Colors.dangerSoft,
  },
  signOutText: { fontSize: 17, fontWeight: '600', color: Colors.danger },
  demo: {
    marginTop: Spacing.lg,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  toastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.lg,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: '#1F2937',
  },
  toastText: { fontSize: 14, color: '#FFFFFF' },

  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  dialogText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dialogBtn: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F3F6',
  },
  dialogBtnDanger: { backgroundColor: Colors.danger },
  dialogBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
});
