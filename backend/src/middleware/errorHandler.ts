import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Global Express error handler — catches unhandled errors from routes
 * and returns a structured JSON response.
 */
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled route error');

  const statusCode = (err as any).statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
}
