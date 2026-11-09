import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

export type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  /** Veriyi elle yeniden yükler (ör. bir işlemden sonra). */
  reload: () => void;
};

/**
 * Ekran her odaklandığında (ve `load` değiştiğinde) veriyi yeniden yükler.
 * Böylece başka bir ekranda yapılan değişiklik geri dönülünce görünür.
 *
 * `load` mutlaka `useCallback` ile sabitlenmeli; aksi halde her çizimde yeniden yüklenir.
 */
export function useFocusLoad<T>(
  load: () => Promise<T>,
  initial: T,
  errorMessage = 'Veri yüklenemedi.',
): LoadState<T> {
  const [state, setState] = useState({
    data: initial,
    loading: true,
    error: null as string | null,
  });
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setState((s) => ({ ...s, loading: true }));
      load()
        .then((data) => active && setState({ data, loading: false, error: null }))
        .catch(() => active && setState((s) => ({ ...s, loading: false, error: errorMessage })));
      return () => {
        active = false;
      };
      // `version` değişince yeniden yüklemek için bağımlılıkta duruyor.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, errorMessage, version]),
  );

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}
