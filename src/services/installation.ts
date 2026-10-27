import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const key='presentia.installation.v1';
let pending:Promise<string>|undefined;
/** Never clear on logout. A web storage ID is a weaker, resettable browser signal. */
export function getInstallationId():Promise<string> {
  if(!pending)pending=(async()=>{
    const stored=Platform.OS==='web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key);
    if(stored && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(stored))return stored;
    const id=Crypto.randomUUID();
    if(Platform.OS==='web')localStorage.setItem(key,id);
    else await SecureStore.setItemAsync(key,id,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
    return id;
  })().catch(()=>{pending=undefined;throw new Error('Device storage is unavailable. Enable storage and retry attendance.');});
  return pending;
}
export const installationPlatform=()=>Platform.OS==='android'?'android':Platform.OS==='ios'?'ios':'web';
