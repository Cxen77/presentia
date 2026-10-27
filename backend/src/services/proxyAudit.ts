import { supabaseAdmin } from './supabase';
import { analyzeSubmission, type AuditInput, type PhotoVerificationProvider } from './proxySignals';
import { logger } from '../utils/logger';
import { attendancePhotoDeliveryUrl, profilePhotoDeliveryUrl } from './cloudinary';

let running=false;
/** A claim processes at most 30 records, sequentially. Progress and lease fencing
 * live in Postgres, so restarts and multiple Render instances are safe. */
export async function runAuditBatch(client:any=supabaseAdmin,provider?:PhotoVerificationProvider) {
  const claimed=await client.rpc('claim_attendance_audit');
  if(claimed.error)throw new Error('Audit queue unavailable');
  const job=claimed.data?.[0];
  if(!job)return false;
  try {
    const batch=await client.rpc('attendance_audit_batch',{p_session:job.session_id,p_lease:job.lease_id});
    if(batch.error)throw new Error('Audit batch unavailable');
    const results=[];
    for(const record of batch.data as AuditInput[]) {
      const input=provider ? {...record,avatar_url:profilePhotoDeliveryUrl(record.avatar_url),verification_photo_url:attendancePhotoDeliveryUrl(record.verification_photo_url)} : record;
      results.push({id:record.id,findings:await analyzeSubmission(input,provider)});
    }
    const saved=await client.rpc('save_attendance_audit_batch',{p_session:job.session_id,p_lease:job.lease_id,p_results:results});
    if(saved.error || !saved.data)throw new Error('Audit lease lost or progress could not be saved');
    return true;
  } catch {
    // No URLs, precise locations or vendor error bodies enter logs.
    await client.rpc('save_attendance_audit_batch',{p_session:job.session_id,p_lease:job.lease_id,p_results:[],p_error:'Audit interrupted; retry scheduled'});
    throw new Error('Audit interrupted; retry scheduled');
  }
}
export async function wakeProxyAudit(provider?:PhotoVerificationProvider) {
  if(running)return;
  running=true;
  try {
    // Bound each wake to four batches. The next recovery tick resumes large classes.
    for(let i=0;i<4;i++)if(!await runAuditBatch(supabaseAdmin,provider))break;
  } catch {logger.warn('Post-session audit will retry from saved progress');}
  finally {running=false;}
}
export function startProxyAuditWorker(provider?:PhotoVerificationProvider) {
  void wakeProxyAudit(provider);
  // Recovery/deadline sweep only: portal reads never enqueue or start an audit.
  const timer=setInterval(()=>void wakeProxyAudit(provider),60000);
  timer.unref();
  return ()=>clearInterval(timer);
}
