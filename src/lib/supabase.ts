import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';
import { sessionStorage } from './session-storage';

/**
 * Supabase istemcisi. YALNIZCA publishable anahtar kullanılır; tüm erişim
 * kontrolü veritabanındaki RLS kurallarıyla yapılır.
 * Secret anahtar (sb_secret_…) uygulamaya asla konmaz.
 */
const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError =
  !rawUrl || !publishableKey
    ? '.env.local dosyasında EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY tanımlı değil (bkz. .env.example).'
    : publishableKey.startsWith('sb_secret_')
      ? 'Uygulamaya secret anahtar konmuş! Yalnızca publishable anahtar (sb_publishable_…) kullanılmalı.'
      : null;

/**
 * Yerel geliştirmede adres 127.0.0.1 ise, telefon/emülatör kendi kendine bağlanmaya
 * çalışır. Bu durumda Expo geliştirme sunucusunun (bilgisayarın) adresi kullanılır.
 */
function resolveUrl(url: string) {
  if (Platform.OS === 'web') return url;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? url.replace(/\/\/(127\.0\.0\.1|localhost)(?=[:/])/, `//${host}`) : url;
}

export const supabase = createClient<Database>(
  resolveUrl(rawUrl ?? 'http://127.0.0.1:54321'),
  supabaseConfigError ? 'eksik-anahtar' : publishableKey!,
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Uygulama arka plandayken oturum yenilemeyi durdur, öne gelince sürdür.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
