import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchStudentData, readStudentCache } from '../services/studentCache';

// One poller per data name, shared by every mounted hook: the home notice and
// the attendance tab observe the same 'attendance' loop instead of each
// hammering the backend. The timer lives in the shared entry and dies with its
// last subscriber. Jitter keeps a classroom of devices from firing in
// synchronized waves.
interface SharedQuery<T> {
  data: T;
  updatedAt: number | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  subscribers: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
  appStateListener: { remove: () => void } | null;
  refresh: () => Promise<void>;
}
const registry = new Map<string, SharedQuery<unknown>>();

function jitter(ms: number) {
  return ms * (0.85 + Math.random() * 0.3);
}

export function useStudentQuery<T>(
  name: string,
  fetcher: () => Promise<T>,
  initial: T,
  interval = 45000,
) {
  const empty = useRef(initial);
  const [data, setData] = useState<T>(initial),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [error, setError] = useState<string | null>(null),
    [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const sync = useCallback((shared: SharedQuery<T>) => {
    setData(shared.data);
    setUpdatedAt(shared.updatedAt);
    setError(shared.error);
    setLoading(shared.loading);
    setRefreshing(shared.refreshing);
  }, []);

  useEffect(() => {
    let active = true;
    let shared = registry.get(name) as SharedQuery<T> | undefined;
    const notify = () => {
      if (!active) return;
      const current = registry.get(name) as SharedQuery<T> | undefined;
      if (current) sync(current);
    };

    if (!shared) {
      const created: SharedQuery<T> = {
        data: empty.current,
        updatedAt: null,
        error: null,
        loading: true,
        refreshing: false,
        subscribers: new Set(),
        timer: null,
        appStateListener: null,
        refresh: async () => {
          const current = registry.get(name) as SharedQuery<T> | undefined;
          if (!current || current.refreshing) return;
          current.refreshing = true;
          current.subscribers.forEach(sub => sub());
          try {
            const fresh = await fetchStudentData(name, fetcher);
            current.data = fresh;
            current.updatedAt = Date.now();
            current.error = null;
          } catch (err) {
            current.error =
              err instanceof Error ? err.message : 'Could not refresh. Please retry.';
          } finally {
            current.loading = false;
            current.refreshing = false;
            current.subscribers.forEach(sub => sub());
          }
        },
      };
      registry.set(name, created as SharedQuery<unknown>);
      shared = created;
      shared.timer = setInterval(() => {
        if (AppState.currentState === 'active') void shared!.refresh();
      }, jitter(interval));
      shared.appStateListener = AppState.addEventListener('change', state => {
        if (state === 'active') void shared!.refresh();
      });
    }

    shared.subscribers.add(notify);
    sync(shared);

    const start = async () => {
      const cached = await readStudentCache<T>(name);
      if (!active) return;
      const current = registry.get(name) as SharedQuery<T>;
      if (!current) return;
      // Adopt the cache only when nothing fresher has arrived yet.
      if (cached && !current.updatedAt) {
        current.data = cached.data;
        current.updatedAt = cached.updatedAt;
        current.loading = false;
        notify();
      }
      if (!current.updatedAt) void current.refresh();
    };
    void start();

    return () => {
      active = false;
      const current = registry.get(name) as SharedQuery<T> | undefined;
      if (!current) return;
      current.subscribers.delete(notify);
      if (current.subscribers.size === 0) {
        if (current.timer) clearInterval(current.timer);
        current.appStateListener?.remove();
        registry.delete(name);
      }
    };
  }, [name, fetcher, interval, sync]);

  const refresh = useCallback(async () => {
    const shared = registry.get(name) as SharedQuery<T> | undefined;
    await shared?.refresh();
  }, [name]);

  return { data, loading, refreshing, error, updatedAt, refresh };
}
