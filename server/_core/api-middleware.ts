/**
 * Production-Grade API Middleware
 * Request validation, rate limiting, security headers, logging
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { schemas, sanitizeInput, validateRateLimit } from './validation';
import crypto from 'crypto';

// ─── Request ID Middleware ────────────────────────────────────────────────────
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

// ─── Security Headers Middleware ──────────────────────────────────────────────
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
  );
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Feature Policy (Permissions Policy)
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );
  
  // HSTS (Strict Transport Security)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  next();
}

// ─── Request Logging Middleware ────────────────────────────────────────────────
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Log incoming request
  logger.info(`${req.method} ${req.path}`, {
    requestId: req.id,
    ip: req.ip,
    method: req.method,
    path: req.path,
    query: req.query,
    userId: (req as any).user?.id,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    
    logger.info(`${req.method} ${req.path} - ${res.statusCode}`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: (req as any).user?.id,
    });

    return originalSend.call(this, data);
  };

  next();
}

// ─── Rate Limiting Middleware ──────────────────────────────────────────────────
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Prevent unbounded memory growth: purge expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime <= now) rateLimitStore.delete(key);
  }
}, 60_000).unref();

export function createRateLimitMiddleware(
  windowMs: number = 60 * 1000, // 1 minute
  maxRequests: number = 100,
  keyGenerator: (req: Request) => string = (req) => req.ip || 'unknown',
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const limit = rateLimitStore.get(key);

    if (limit && limit.resetTime > now) {
      // Window still active
      limit.count++;
      
      if (limit.count > maxRequests) {
        logger.warn('Rate limit exceeded', { key, count: limit.count });
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((limit.resetTime - now) / 1000),
        });
      }
    } else {
      // New window
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    }

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - (limit?.count || 1));
    next();
  };
}

// ─── CORS Middleware ──────────────────────────────────────────────────────────
export function corsMiddleware(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    next();
  };
}

// ─── Input Validation Middleware ──────────────────────────────────────────────
export function validateRequestBody(schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      logger.warn('Request validation failed', {
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
      });
      
      return res.status(400).json({
        error: 'Invalid request body',
        details: error instanceof Error ? error.message : undefined,
      });
    }
  };
}

// ─── Compression Middleware ───────────────────────────────────────────────────
export function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
  } else if (acceptEncoding.includes('deflate')) {
    res.setHeader('Content-Encoding', 'deflate');
  }

  next();
}

// ─── Trust Proxy Middleware ───────────────────────────────────────────────────
export function trustProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get real IP from X-Forwarded-For header (set by reverse proxy like Nginx)
  if (req.headers['x-forwarded-for']) {
    const ips = (req.headers['x-forwarded-for'] as string).split(',');
    req.ip = ips[0].trim();
  }

  if (req.headers['x-forwarded-proto']) {
    req.protocol = req.headers['x-forwarded-proto'] as any;
  }

  next();
}

// ─── Health Check Middleware ──────────────────────────────────────────────────
export function healthCheckMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') {
    return res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
    });
  }

  next();
}

// ─── Error Handling Middleware ────────────────────────────────────────────────
export function errorHandlingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  logger.error('Unhandled error', {
    requestId: req.id,
    path: req.path,
    method: req.method,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  const statusCode = err.statusCode || 500;
  const message = err.userMessage || 'Internal server error';

  res.status(statusCode).json({
    error: message,
    requestId: req.id,
    timestamp: new Date().toISOString(),
  });
}

// ─── 404 Middleware ───────────────────────────────────────────────────────────
export function notFoundMiddleware(req: Request, res: Response) {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
  });

  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
