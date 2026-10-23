import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
const prefix = 'presentia:cache:';
const pending = new Map<string, Promise<unknown>>();
async function cacheKey(name: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Your session expired. Please sign in again.');
  return `${prefix}${session.user.id}:${name}`;
}
export async function readStudentCache<T>(name: string): Promise<{data:T;updatedAt:number}|null> {
  try { const raw=await AsyncStorage.getItem(await cacheKey(name)); if (!raw) return null; const item=JSON.parse(raw); return Date.now()-item.updatedAt<86400000?item:null; } catch { return null; }
}
export async function fetchStudentData<T>(name:string, fetcher:()=>Promise<T>):Promise<T> {
  const key=await cacheKey(name);
  if (pending.has(key)) return pending.get(key) as Promise<T>;
  const request=(async()=>{const data=await fetcher(); await AsyncStorage.setItem(key,JSON.stringify({data,updatedAt:Date.now()})).catch(()=>{}); return data;})();
  pending.set(key,request);
  try { return await request; } finally { pending.delete(key); }
}
export async function clearStudentCache() {
  const keys=(await AsyncStorage.getAllKeys()).filter(key=>key.startsWith(prefix));
  if (keys.length) await AsyncStorage.multiRemove(keys);
}
export async function getAttendanceAlerts() {
  return (await AsyncStorage.getItem((await cacheKey('preferences')).replace(prefix,'presentia:preferences:'))) !== 'off';
}
export async function setAttendanceAlerts(enabled:boolean) {
  await AsyncStorage.setItem((await cacheKey('preferences')).replace(prefix,'presentia:preferences:'),enabled?'on':'off');
}
