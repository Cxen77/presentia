export const PRESENTIA_SUPABASE_URL='https://yurdfoblkaclivxqfpjt.supabase.co';
export const PRESENTIA_API_URL='https://presentia-6zjr.onrender.com';

type PortalEnvironment = Record<string,string|boolean|undefined>;
/** Shared by the build preflight and browser runtime. Never include values in
 * errors: deployment logs and the sign-in page must not expose credentials. */
export function readPortalConfiguration(env:PortalEnvironment) {
  const url=String(env.VITE_SUPABASE_URL||PRESENTIA_SUPABASE_URL).trim().replace(/\/$/,'');
  const key=String(env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||'').trim();
  const apiBaseUrl=String(env.VITE_API_BASE_URL||PRESENTIA_API_URL).trim().replace(/\/$/,'');
  if(url!==PRESENTIA_SUPABASE_URL)throw new Error('VITE_SUPABASE_URL must use the intended Presentia Supabase project. Correct the deployment environment and redeploy.');
  let publicKey=key.startsWith('sb_publishable_')&&key.length>20;
  if(!publicKey && key.split('.').length===3) {
    try {
      const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      publicKey=payload.role==='anon'&&payload.ref==='yurdfoblkaclivxqfpjt';
    } catch {publicKey=false;}
  }
  if(!publicKey)throw new Error('Configure VITE_SUPABASE_PUBLISHABLE_KEY with a public key from the intended Presentia project. Never use a secret/service-role key in the portal.');
  let allowedApi=apiBaseUrl===PRESENTIA_API_URL;
  if(!allowedApi && env.DEV===true) {
    try {const api=new URL(apiBaseUrl);allowedApi=['http:','https:'].includes(api.protocol)&&['localhost','127.0.0.1','[::1]'].includes(api.hostname)&&!api.username&&!api.password;} catch {allowedApi=false;}
  }
  if(!allowedApi)throw new Error('VITE_API_BASE_URL must use the Presentia Render backend in production. Correct the deployment environment and redeploy.');
  return {url,key,apiBaseUrl};
}
