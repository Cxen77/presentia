import { createClient, processLock, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';

const PROJECT_URL = 'https://yurdfoblkaclivxqfpjt.supabase.co';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  if (url !== PROJECT_URL || !key) return false;
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const payload = JSON.parse(globalThis.atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.ref === 'yurdfoblkaclivxqfpjt' && payload.role === 'anon';
  } catch {
    return false;
  }
}

if (!isSupabaseConfigured()) {
  throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL for the intended project and its public publishable/anon key. Never use a secret/service-role key in the app.');
}

// Keep one client and native lifecycle listener even across Fast Refresh.
const runtime = globalThis as typeof globalThis & {
  __attendanceSupabase?: { client: SupabaseClient; url: string; key: string };
};
if (runtime.__attendanceSupabase &&
    (runtime.__attendanceSupabase.url !== url || runtime.__attendanceSupabase.key !== key)) {
  throw new Error('Supabase configuration changed. Fully reload the app to apply it.');
}
if (!runtime.__attendanceSupabase) {
  const client = createClient(url!, key!, {
    auth: {
      ...(Platform.OS !== 'web' ? { storage: AsyncStorage, lock: processLock } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  runtime.__attendanceSupabase = { client, url: url!, key: key! };
  if (Platform.OS !== 'web') {
    const updateRefresh = (state: string | null) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    };
    updateRefresh(AppState.currentState ?? null);
    AppState.addEventListener('change', updateRefresh);
  }
}
export const supabase = runtime.__attendanceSupabase.client;
