// iOS/Android: Supabase'in Expo rehberindeki gibi expo-sqlite tabanlı localStorage.
// https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native
import 'expo-sqlite/localStorage/install';

export const sessionStorage = globalThis.localStorage;
