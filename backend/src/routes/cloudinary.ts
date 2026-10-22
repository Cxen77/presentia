import { Router } from 'express';
import { z } from 'zod';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuth } from '../middleware/auth';
import { env } from '../config/env';

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const ALLOWED_FOLDERS = ['student_profiles', 'attendance_verification'];

const signatureSchema = z.object({
  folder: z.string().refine((f) => ALLOWED_FOLDERS.includes(f), {
    message: `Folder must be one of: ${ALLOWED_FOLDERS.join(', ')}`,
  }),
  publicId: z.string().optional(),
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

  const { folder, publicId } = parsed.data;
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign: Record<string, string | number> = { timestamp, folder };
  if (publicId) paramsToSign.public_id = publicId;

  // Restrict attendance verification images to authenticated access type
  if (folder === 'attendance_verification') {
    paramsToSign.type = 'authenticated';
  }

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET
  );

  return res.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
    publicId: publicId || null,
  });
});

export default router;
