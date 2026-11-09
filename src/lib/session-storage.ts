// Web: tarayıcının kendi localStorage'ı. (iOS/Android için .native.ts dosyasına bakın.)
export const sessionStorage = typeof window !== 'undefined' ? window.localStorage : undefined;
