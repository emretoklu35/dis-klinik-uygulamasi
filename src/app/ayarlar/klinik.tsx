/**
 * Klinik bilgileri: proformanın başlığında görünen adres, telefon, e-posta (klinik yönetimi)
 * ve hekim/yönetici indirim sınırı (yalnızca klinik sahibi).
 */

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Screen, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useClinicSession, useSession } from '@/features/session/session-context';
import { unwrap } from '@/lib/db-errors';
import { supabase } from '@/lib/supabase';

export default function ClinicSettingsScreen() {
  const { clinic, can } = useClinicSession();
  // Kaydedince klinik bilgisi yeniden yüklensin (proforma ve indirim sınırı güncellensin)
  const { reload } = useSession();
  const canEdit = can('klinik.yonet');
  const canLimit = can('indirim.sinirsiz');

  const [address, setAddress] = useState(clinic.address ?? '');
  const [phone, setPhone] = useState(clinic.phone ?? '');
  const [email, setEmail] = useState(clinic.email ?? '');
  const [contactMsg, setContactMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [limitText, setLimitText] = useState(String(clinic.discountLimitPct));
  const [limitMsg, setLimitMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const saveContact = async () => {
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setContactMsg({ ok: false, text: 'Geçerli bir e-posta adresi yazın.' });
      return;
    }
    setBusy(true);
    setContactMsg(null);
    try {
      unwrap(
        await supabase
          .from('clinics')
          .update({
            address: address.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
          })
          .eq('id', clinic.id)
          .select('id')
          .single(),
        'Klinik bilgileri kaydedilemedi.',
      );
      setContactMsg({ ok: true, text: 'Kaydedildi. Proformalarda bu bilgiler görünür.' });
      reload();
    } catch (e) {
      setContactMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  const saveLimit = async () => {
    const pct = Number(limitText.replace(',', '.'));
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      setLimitMsg({ ok: false, text: '0 ile 100 arasında tam sayı yazın.' });
      return;
    }
    setBusy(true);
    setLimitMsg(null);
    try {
      const { error } = await supabase.rpc('set_discount_limit', {
        p_clinic: clinic.id,
        p_pct: pct,
      });
      if (error) throw new Error(error.message);
      setLimitMsg({ ok: true, text: 'Kaydedildi.' });
      reload();
    } catch (e) {
      setLimitMsg({ ok: false, text: e instanceof Error ? e.message : 'Kaydedilemedi.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen inStack>
      <Card title="İletişim bilgileri">
        <Text style={styles.hint}>
          {clinic.name} adının altında proformanın başlığında görünür.
        </Text>
        <TextField
          label="Adres"
          value={address}
          onChangeText={setAddress}
          placeholder="Ör. Bağdat Cad. No: 1, Kadıköy / İstanbul"
          editable={canEdit}
        />
        <TextField
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="Ör. 0216 000 00 00"
          keyboardType="phone-pad"
          editable={canEdit}
        />
        <TextField
          label="E-posta"
          value={email}
          onChangeText={setEmail}
          placeholder="Ör. info@klinik.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={canEdit}
        />
        {contactMsg ? (
          <Text style={{ color: contactMsg.ok ? Colors.success : Colors.danger, fontSize: 13 }}>
            {contactMsg.text}
          </Text>
        ) : null}
        {canEdit ? (
          <View style={styles.actions}>
            <Button label="Kaydet" icon="checkmark" onPress={saveContact} disabled={busy} />
          </View>
        ) : (
          <Text style={styles.hint}>Bu bilgileri klinik yönetimi değiştirebilir.</Text>
        )}
      </Card>

      <Card title="İndirim sınırı">
        <Text style={styles.hint}>
          Hekimler ve yöneticiler tedavi planlarında en fazla bu oranda indirim yapabilir; sınırın
          içindeki indirim anında uygulanır, onay beklenmez. Klinik sahibi sınıra takılmaz. 0
          yazarsanız hekimler indirim yapamaz, 100 yazarsanız sınır kalkar.
        </Text>
        <TextField
          label="En yüksek indirim (%)"
          value={limitText}
          onChangeText={(t) => setLimitText(t.replace(/[^0-9]/g, '').slice(0, 3))}
          keyboardType="number-pad"
          editable={canLimit}
        />
        {limitMsg ? (
          <Text style={{ color: limitMsg.ok ? Colors.success : Colors.danger, fontSize: 13 }}>
            {limitMsg.text}
          </Text>
        ) : null}
        {canLimit ? (
          <View style={styles.actions}>
            <Button label="Kaydet" icon="checkmark" onPress={saveLimit} disabled={busy} />
          </View>
        ) : (
          <Text style={styles.hint}>İndirim sınırını yalnızca klinik sahibi değiştirebilir.</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, color: Colors.textSecondary },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
});
