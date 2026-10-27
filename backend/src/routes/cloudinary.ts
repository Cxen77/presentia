import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../services/supabase';
import { readScanTicket } from '../services/scanTicket';
import { ownsDevice, installationSchema, deviceMessage } from '../services/deviceBinding';
import { createUploadPayload, isCloudinaryConfigured } from '../services/cloudinary';

const router = Router();

const signatureSchema = z.object({
  folder: z.enum(['student_profiles', 'attendance_verification']),
  qrToken:z.string().max(512).optional(),scanTicket:z.string().max(2048).optional(),installationId:installationSchema.optional(),
});

/**
 * POST /api/cloudinary/signature
 * Returns a signed upload payload so the client can upload directly to Cloudinary
 * without having the API secret.
 */
router.post('/signature', requireAuth, async (req, res) => {
  const parsed = signatureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid upload parameters', details: parsed.error.flatten().fieldErrors });
  }

  if (!isCloudinaryConfigured()) return res.status(503).json({ error: 'Photo uploads are not configured on the backend yet.' });
  let sessionId:string|undefined;
  if(parsed.data.folder==='attendance_verification') {
    const user=req.user!;
    if(user.role!=='student'||!user.profileId||!parsed.data.qrToken||!parsed.data.scanTicket||!parsed.data.installationId)
      return res.status(403).json({error:'Scan a classroom QR from your registered installation first.'});
    const {data:token,error}=await supabaseAdmin.from('qr_tokens').select('id,session_id,session:session_id(status,submission_deadline)').eq('token',parsed.data.qrToken).maybeSingle();
    if(error)return res.status(503).json({error:'Could not validate upload session.'});
    const session=token?.session as any;
    const ticket=token&&readScanTicket(parsed.data.scanTicket,user.authUserId,token.id,token.session_id);
    if(!ticket||ticket.installationId!==parsed.data.installationId||session?.status!=='ACTIVE'||(session.submission_deadline&&Date.parse(session.submission_deadline)<=Date.now()))return res.status(409).json({error:'Check-in expired or closed. Scan again before uploading.'});
    if(!await ownsDevice(parsed.data.installationId,user.profileId))return res.status(409).json({error:deviceMessage('DEVICE_CONFLICT')});
    sessionId=token.session_id;
  }
  return res.json(createUploadPayload(req.user!.authUserId, parsed.data.folder,sessionId));
});

export default router;
