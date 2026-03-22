/**
 * Production Server Entry Point
 * Complete setup with all middleware, error handling, and monitoring
 */

import express, { Express, Request, Response } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createRequestHandler } from '@trpc/server/adapters/express';
import { gracefulShutdown } from './_core/graceful-shutdown';
import { logger } from './_core/logger';
import { appRouter } from './routers';
import { createContext } from './_core/context';
import { ENV } from './_core/env';
import {
  requestIdMiddleware,
  securityHeadersMiddleware,
  requestLoggingMiddleware,
  createRateLimitMiddleware,
  corsMiddleware,
  trustProxyMiddleware,
  healthCheckMiddleware,
  errorHandlingMiddleware,
  notFoundMiddleware,
} from './_core/api-middleware';

// ─── Initialize Express App ───────────────────────────────────────────────────
const app: Express = express();
const port = process.env.PORT || 3000;

// ─── Trust Proxy (for Nginx/reverse proxy) ───────────────────────────────────
app.set('trust proxy', 1);

// ─── Core Middleware ─────────────────────────────────────────────────────────
app.use(trustProxyMiddleware);
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(requestLoggingMiddleware);

// ─── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser(ENV.cookieSecret));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim());
app.use(corsMiddleware(allowedOrigins));

// ─── Rate Limiting ───────────────────────────────────────────────────────────
// Global rate limiting: 100 requests per minute per IP
app.use(createRateLimitMiddleware(60 * 1000, 100));

// ─── Health Check ────────────────────────────────────────────────────────────
app.use(healthCheckMiddleware);

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use(
  '/api/trpc',
  createRequestHandler({
    router: appRouter,
    createContext,
    onError: ({ path, error }) => {
      logger.error(`TRPC error on path "${path}"`, {
        code: error.code,
        message: error.message,
      });
    },
  })
);

// ─── Static Files ────────────────────────────────────────────────────────────
app.use(express.static('dist-build/public'));

// ─── Serve SPA (React) ────────────────────────────────────────────────────────
app.get('*', (req: Request, res: Response) => {
  // Don't redirect API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // Serve React app
  res.sendFile('dist-build/public/index.html', { root: '.' });
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use(notFoundMiddleware);

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandlingMiddleware);

// ─── Graceful Shutdown Setup ─────────────────────────────────────────────────
gracefulShutdown.registerServer(app as any);

// Add shutdown handler for database
gracefulShutdown.addShutdownHandler('SIGTERM', async () => {
  logger.info('Closing database connections...');
  // Database cleanup will be handled by connection pool
});

// ─── Start Server ────────────────────────────────────────────────────────────
const server = app.listen(port, () => {
  logger.info(`✅ Server running on port ${port}`, {
    env: process.env.NODE_ENV,
    port,
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise),
  });
  process.exit(1);
});

export default app;
