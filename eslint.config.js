// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/functions: Deno ile çalışan sunucu kodu (uygulama paketine girmez)
    ignores: ['dist/*', '.expo/*', 'supabase/functions/*'],
  },
]);
