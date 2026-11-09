/** Veritabanı/API hatalarını kullanıcıya gösterilecek Türkçe mesaja çevirir. */
export class AppError extends Error {}

type DbError = { code?: string; message?: string } | null | undefined;

export function toAppError(error: DbError, fallback = 'İşlem tamamlanamadı.'): AppError {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  switch (code) {
    case '23P01':
      return new AppError('Bu saat seçili hekim veya koltuk için dolu.');
    case '42501':
      // Kendi tetikleyicilerimiz Türkçe mesajla 42501 fırlatır; RLS'nin İngilizce mesajı yerine genel mesaj.
      return new AppError(/[çğıöşüİ]/i.test(message) ? message : 'Bu işlem için yetkiniz yok.');
    case '23514':
      return new AppError(/[çğıöşüİ]/i.test(message) ? message : 'Girilen bilgiler geçersiz.');
    case '23505':
      return new AppError('Bu kayıt zaten var.');
    case 'PGRST301':
    case 'PGRST303':
      return new AppError('Oturumun süresi doldu. Lütfen yeniden giriş yapın.');
    default:
      if (message.includes('Failed to fetch') || message.includes('Network request failed')) {
        return new AppError(
          'Sunucuya ulaşılamadı. Yerel Supabase çalışıyor mu? (npm run db:start)',
        );
      }
      return new AppError(fallback);
  }
}

/** Supabase yanıtındaki hatayı fırlatır, veriyi döndürür (liste, insert…select().single()). */
export function unwrap<T>(result: { data: T; error: DbError }, fallback?: string): NonNullable<T> {
  if (result.error) throw toAppError(result.error, fallback);
  if (result.data === null || result.data === undefined) throw toAppError(null, fallback);
  return result.data;
}

/** maybeSingle() gibi kaydın olmayabileceği sorgular için: yoksa null döner. */
export function unwrapMaybe<T>(result: { data: T; error: DbError }, fallback?: string): T {
  if (result.error) throw toAppError(result.error, fallback);
  return result.data;
}
