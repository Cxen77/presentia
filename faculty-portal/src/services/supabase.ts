import { createClient } from '@supabase/supabase-js';
import { readPortalConfiguration } from './configuration';

export const portalConfiguration=readPortalConfiguration(import.meta.env);
const SUPABASE_URL=portalConfiguration.url;
const SUPABASE_KEY=portalConfiguration.key;

export const isSupabaseConfigured=():boolean=>Boolean(SUPABASE_URL&&SUPABASE_KEY);

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

