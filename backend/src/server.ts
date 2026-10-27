import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { startSelfieCleanupWorker } from './services/selfieCleanup';
import { startProxyAuditWorker } from './services/proxyAudit';
import deviceRoutes from './routes/devices';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import profileRoutes from './routes/profiles';
import classRoutes from './routes/classes';
import enrollmentRoutes from './routes/enrollment';
import sessionRoutes from './routes/sessions';
import attendanceRoutes from './routes/attendance';
import reportRoutes from './routes/reports';
import cloudinaryRoutes from './routes/cloudinary';
import managementRoutes from './routes/management';

const app = express();
// Render terminates TLS for us; rate limiting needs the real client IP.
app.set('trust proxy', 1);

// --- Security headers ---
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// --- CORS ---
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn({ origin }, 'Blocked by CORS');
      // false (not an Error) rejects the request without tripping the 500
      // error handler; the browser sees no allow-origin header and blocks it.
      return callback(null, false);
    },
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  })
);

// Generous global backstop: a classroom of devices can share one NAT address,
// so the ceiling stays far above legitimate polling traffic while still
// throttling scripted abuse. Sign-in keeps its own stricter limiter.
app.use('/api', rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 2000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down and retry in a few minutes.' },
}));

app.use(express.json({ limit: '256kb' }));

// --- Request Logging ---
app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

// --- Routes ---
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/management',managementRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);

// --- Error Handling ---
app.use(errorHandler);

// --- Start ---
const port = parseInt(env.PORT, 10);
// No host argument: Node binds dual-stack (::), so both 127.0.0.1 and ::1
// connect instantly. Binding 0.0.0.0 left ::1 hanging ~200ms per connection.
app.listen(port, () => {
  if(env.NODE_ENV!=='test') {
    startSelfieCleanupWorker();
    startProxyAuditWorker();
  }
  logger.info({ port, env: env.NODE_ENV }, '🚀 Backend server started');
});

export default app;
