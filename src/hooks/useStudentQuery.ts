import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchStudentData, readStudentCache } from '../services/studentCache';
export function useStudentQuery<T>(
  name: string,
  fetcher: () => Promise<T>,
  initial: T,
  interval = 15000,
) {
  const generation = useRef(0),
    empty = useRef(initial);
  const [data, setData] = useState<T>(initial),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState<string | null>(null),
    [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const refresh = useCallback(async () => {
    const version = generation.current;
    setRefreshing(true);
    try {
      const fresh = await fetchStudentData(name, fetcher);
      if (version !== generation.current) return;
      setData(fresh);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      if (version === generation.current)
        setError(
          err instanceof Error
            ? err.message
            : 'Could not refresh. Please retry.',
        );
    } finally {
      if (version === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [name, fetcher]);
  useEffect(() => {
    let active = true;
    const version=++generation.current;
    const start = async () => {
      const cached = await readStudentCache<T>(name);
      if (!active) return;
      setData(cached ? cached.data : empty.current);
      setUpdatedAt(cached ? cached.updatedAt : null);
      setLoading(!cached);
      setError(null);
      await refresh();
    };
    void start();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, interval);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      active = false;
      generation.current=version+1;
      clearInterval(timer);
      listener.remove();
    };
  }, [name, refresh, interval]);
  return { data, loading, refreshing, error, updatedAt, refresh };
}
