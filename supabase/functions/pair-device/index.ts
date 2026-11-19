// =============================================================================
// Mesai ekranı (tablet) eşleştirme — sunucu tarafı
//
// Tablet, yöneticinin ürettiği eşleştirme kodunu gönderir. Bu fonksiyon:
//   1) kodun geçerli olduğunu kontrol eder,
//   2) cihaz için rastgele e-posta/şifreli bir hesap açar (kayıt olma kapalı kalır;
//      hesabı yalnızca sunucu anahtarı açabilir),
//   3) claim_device_pairing ile o hesabı klinikte "Mesai Ekranı" yapar,
//   4) tablete bir kerelik giriş bilgisini döndürür; tablet bununla oturum açar.
// Sunucu anahtarı (service role) yalnızca burada, sunucuda kullanılır; uygulamaya gitmez.
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Yalnızca POST.' }, 405);

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!code || typeof code !== 'string' || code.length > 20) {
    return json({ error: 'Eşleştirme kodunu girin.' }, 400);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: valid, error: checkError } = await admin.rpc('device_pairing_valid', { p_code: code });
  if (checkError) return json({ error: 'Sunucu hatası. Tekrar deneyin.' }, 500);
  if (!valid) return json({ error: 'Eşleştirme kodu geçersiz ya da süresi doldu. Yeni kod alın.' }, 400);

  const email = `ekran-${crypto.randomUUID()}@mesai-ekrani.local`;
  const password = randomHex(24);
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { kiosk: true },
  });
  if (createError || !created.user) return json({ error: 'Cihaz hesabı açılamadı.' }, 500);

  const { error: claimError } = await admin.rpc('claim_device_pairing', {
    p_code: code,
    p_user: created.user.id,
  });
  if (claimError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return json({ error: claimError.message || 'Eşleştirme yapılamadı.' }, 400);
  }

  return json({ email, password });
});
