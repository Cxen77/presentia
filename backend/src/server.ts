import express from 'express';
import cors from 'cors';
import { env } from './config/env';
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

const app = express();

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
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));

// --- Request Logging ---
app.use((req, _res, next) => {
  logger.debug({ method: req.method, path: req.path }, 'Incoming request');
  next();
});

// --- Routes ---
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/enrollment', enrollmentRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);

// --- Error Handling ---
app.use(errorHandler);

// --- Start ---
const port = parseInt(env.PORT, 10);
app.listen(port, () => {
  logger.info({ port, env: env.NODE_ENV }, '🚀 Backend server started');
});

export default app;
