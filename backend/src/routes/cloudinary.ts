import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { createUploadPayload, isCloudinaryConfigured } from '../services/cloudinary';

const router = Router();

const signatureSchema = z.object({
  folder: z.enum(['student_profiles', 'attendance_verification']),
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
  return res.json(createUploadPayload(req.user!.authUserId, parsed.data.folder));
});

export default router;
