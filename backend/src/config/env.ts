import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const rawEnvSchema = z.object({
  PORT: z.string().default('4000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  SUPABASE_URL: z.string().url().default('https://krdykejphzdnatxekerr.supabase.co'),
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
  const publishableKey =
    data.SUPABASE_PUBLISHABLE_KEY ||
    data.SUPABASE_ANON_KEY ||
    'sb_publishable_bRs6RNLcxXULsvopEbP3kw_X8vIUBBP';
  const secretKey =
    data.SUPABASE_SECRET_KEY ||
    data.SUPABASE_SERVICE_ROLE_KEY ||
    publishableKey;

  return {
    ...data,
    SUPABASE_ANON_KEY: publishableKey,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SERVICE_ROLE_KEY: secretKey,
    SUPABASE_SECRET_KEY: secretKey,
  };
}

export const env = loadEnv();
