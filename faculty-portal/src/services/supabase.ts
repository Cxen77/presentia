import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://yurdfoblkaclivxqfpjt.supabase.co';
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_09vpSjKr9plhLhD--p_pWQ_Z3z6tauZ';

export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    SUPABASE_KEY;
  return (
    Boolean(url) &&
    url !== 'https://xyzcompany.supabase.co' &&
    Boolean(key) &&
    !key.includes('mock-key')
  );
};

const runtime = globalThis as typeof globalThis & {
  __presentiaPortalAuth?: {url:string;key:string;client:ReturnType<typeof createClient>};
};
const existing=runtime.__presentiaPortalAuth;
if(existing && (existing.url!==SUPABASE_URL || existing.key!==SUPABASE_KEY)) {
  throw new Error('Authentication configuration changed. Reload the portal.');
}
export const supabase = existing?.client || createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{persistSession:true,autoRefreshToken:true},
});
runtime.__presentiaPortalAuth={url:SUPABASE_URL,key:SUPABASE_KEY,client:supabase};

