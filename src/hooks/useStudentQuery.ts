import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchStudentData, readStudentCache } from '../services/studentCache';
export function useStudentQuery<T>(name:string, fetcher:()=>Promise<T>, initial:T, interval=15000) {
  const [data,setData]=useState<T>(initial), [loading,setLoading]=useState(true), [refreshing,setRefreshing]=useState(false), [error,setError]=useState<string|null>(null), [updatedAt,setUpdatedAt]=useState<number|null>(null);
  const refresh=useCallback(async()=>{setRefreshing(true); try {const fresh=await fetchStudentData(name,fetcher);setData(fresh);setUpdatedAt(Date.now());setError(null);} catch(err){setError(err instanceof Error?err.message:'Could not refresh. Please retry.');}finally{setLoading(false);setRefreshing(false);}},[name,fetcher]);
  useEffect(()=>{let active=true;
    const start=async()=>{const cached=await readStudentCache<T>(name);if(active&&cached){setData(cached.data);setUpdatedAt(cached.updatedAt);setLoading(false);}if(active)await refresh();}; void start();
    const timer=setInterval(()=>{if(AppState.currentState==='active')void refresh();},interval);
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});
    return()=>{active=false;clearInterval(timer);listener.remove();};
  },[name,refresh,interval]);
  return {data,loading,refreshing,error,updatedAt,refresh};
}
