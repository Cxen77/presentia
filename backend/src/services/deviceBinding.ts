import { z } from 'zod';
import { supabaseAdmin } from './supabase';

export const installationSchema = z.string().uuid();
export async function registerDevice(installationId: string, studentId: string, platform: string) {
  const {data,error} = await supabaseAdmin.rpc('register_student_device', {
    p_installation:installationId,p_student:studentId,p_platform:platform,
  });
  if (error) throw new Error('Device registration is unavailable. Retry or contact your administrator.');
  return data as {allowed:boolean;code?:string;status?:string};
}
export const deviceMessage = (code?:string) => code === 'DEVICE_CONFLICT'
  ? 'This app installation belongs to another student. Attendance is blocked. Ask your administrator to resolve device ownership; signing out does not transfer it.'
  : 'Attendance is disabled for this installation. Ask your administrator to review its device registration.';

export async function ownsDevice(installationId:string,studentId:string) {
  const {data,error} = await supabaseAdmin.from('student_devices').select('student_id,status')
    .eq('installation_id',installationId).maybeSingle();
  if (error) return false; // Fail closed on an unavailable registry.
  return data?.student_id === studentId && data.status === 'active';
}
