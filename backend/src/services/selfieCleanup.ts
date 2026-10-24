import { supabaseAdmin } from './supabase';
import { deleteAttendanceSelfie, isCloudinaryConfigured } from './cloudinary';
import { logger } from '../utils/logger';

let running = false;
/** The stored selfie URL is retained until deletion succeeds, so a restart can retry. */
export async function cleanupFinalizedSelfies(sessionId?: string) {
  if (running || !isCloudinaryConfigured()) return;
  running = true;
  try {
    const query = supabaseAdmin.from('attendance_records')
      .select('id,verification_photo_url,session:session_id!inner(finalized_at)')
      .not('verification_photo_url','is',null).not('session.finalized_at','is',null)
      .order('verified_at', {ascending:true}).limit(60);
    if (sessionId) query.eq('session_id',sessionId);
    const {data, error} = await query;
    if (error) {logger.warn({code:error.code},'Selfie cleanup could not load finalized records'); return;}
    // Bound external requests; never remove a database pointer before its asset is gone.
    for (let offset = 0; offset < (data || []).length; offset += 3) {
      await Promise.all((data || []).slice(offset, offset + 3).map(async record => {
        try {
          await deleteAttendanceSelfie(record.verification_photo_url);
          const {error: clearError} = await supabaseAdmin.from('attendance_records')
            .update({verification_photo_url:null}).eq('id',record.id).eq('verification_photo_url',record.verification_photo_url);
          if (clearError) logger.warn({recordId:record.id,code:clearError.code},'Selfie removed; database cleanup will retry');
        } catch {
          logger.warn({recordId:record.id},'Selfie deletion pending; retained for retry');
        }
      }));
    }
  } finally { running = false; }
}

export function startSelfieCleanupWorker() {
  void cleanupFinalizedSelfies().catch(() => logger.warn('Selfie cleanup will retry'));
  const timer = setInterval(() => {
    void cleanupFinalizedSelfies().catch(() => logger.warn('Selfie cleanup will retry'));
  }, 15000);
  timer.unref();
  return () => clearInterval(timer);
}
