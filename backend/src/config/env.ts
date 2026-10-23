import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const rawEnvSchema = z.object({
  PORT: z.string().regex(/^\d+$/, 'PORT must be numeric')
    .refine((value) => Number(value) > 0 && Number(value) <= 65535, 'PORT is out of range')
    .default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SUPABASE_URL: z.string().url().default('https://yurdfoblkaclivxqfpjt.supabase.co'),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  CLOUDINARY_CLOUD_NAME: z.string().default('placeholder'),
  CLOUDINARY_API_KEY: z.string().default('placeholder'),
  CLOUDINARY_API_SECRET: z.string().default('placeholder'),

  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),
  QR_TOKEN_TTL_SECONDS: z.string().default('25'),
});

function loadEnv() {
  const parsed = rawEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  const data = parsed.data;
  const publishableKey = data.SUPABASE_PUBLISHABLE_KEY || data.SUPABASE_ANON_KEY;
  const secretKey = data.SUPABASE_SECRET_KEY || data.SUPABASE_SERVICE_ROLE_KEY;
  if (data.SUPABASE_URL.replace(/\/$/, '') !== 'https://yurdfoblkaclivxqfpjt.supabase.co') {
    throw new Error('SUPABASE_URL must use the intended attendance project.');
  }
  function validKey(key: string | undefined, role: 'anon' | 'service_role'): key is string {
    if (!key) return false;
    if (key.startsWith(role === 'anon' ? 'sb_publishable_' : 'sb_secret_')) return true;
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      return payload.ref === 'yurdfoblkaclivxqfpjt' && payload.role === role;
    } catch { return false; }
  }
  if (!validKey(publishableKey, 'anon') || !validKey(secretKey, 'service_role')) {
    throw new Error('Configure a public Supabase key and a separate server-only secret/service-role key from the intended project.');
  }

  return {
    ...data,
    SUPABASE_ANON_KEY: publishableKey,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
    SUPABASE_SECRET_KEY: secretKey,
  };
}

export const env = loadEnv();
