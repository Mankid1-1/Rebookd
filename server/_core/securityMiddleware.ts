/**
 * Security Middleware Implementation
 * 
 * Enforces industry-standard security policies and compliance requirements
 * References securityPolicy.ts and SECURITY_COMPLIANCE_GUIDE.md
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "./logger";
import { 
  AUTHENTICATION_POLICY, 
  SECURITY_MONITORING_POLICY,
  SMS_COMPLIANCE_POLICY 
} from "./securityPolicy";
import { SecurityMonitoringService } from "./securityCompliance.service";
import type { Db } from "./context";

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      db?: Db;
      session?: {
        id?: string;
        userId?: number;
        tenantId?: number;
        createdAt?: number;
        lastActivity?: number;
        destroy?: (callback?: (err?: any) => void) => void;
      } & any;
    }
  }
}

// ============================================================================
// SECURITY HEADERS MIDDLEWARE
// ============================================================================

export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://alb.reddit.com https://www.redditstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https://api.stripe.com",
    "frame-ancestors 'none'",
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', csp);
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), ' +
    'microphone=(), ' +
    'camera=(), ' +
    'payment=(), ' +
    'usb=(), ' +
    'magnetometer=(), ' +
    'gyroscope=(), ' +
    'accelerometer=()'
  );
  
  next();
};

// ============================================================================
// RATE LIMITING MIDDLEWARE
// ============================================================================

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    lastAccess: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export const createRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}) => {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.ip || 'unknown',
    message = 'Too many requests, please try again later.'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up expired entries
    if (rateLimitStore[key] && rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }

    // Initialize or update counter
    if (!rateLimitStore[key]) {
      rateLimitStore[key] = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now,
      };
    } else {
      rateLimitStore[key].count++;
      rateLimitStore[key].lastAccess = now;
    }

    // Check if limit exceeded
    if (rateLimitStore[key].count > maxRequests) {
      logger.warn('Rate limit exceeded', {
        key,
        count: rateLimitStore[key].count,
        maxRequests,
        windowMs,
      });

      // Log security event
      if (req.db) {
        SecurityMonitoringService.logSecurityEvent(req.db, {
          type: 'rate_limit_exceeded',
          action: 'api_request',
          outcome: 'failure',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            key,
            count: rateLimitStore[key].count,
            limit: maxRequests,
          },
        }).catch((error: any) => {
          logger.error('Failed to log rate limit event', { error });
        });
      }

      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((rateLimitStore[key].resetTime - now) / 1000),
      });
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimitStore[key].count));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitStore[key].resetTime).toISOString());

    next();
  };
};

// Pre-configured rate limiters
export const authRateLimit = createRateLimit({
  windowMs: AUTHENTICATION_POLICY.RATE_LIMITING.authentication.windowMs,
  maxRequests: AUTHENTICATION_POLICY.RATE_LIMITING.authentication.maxAttempts,
  message: 'Too many authentication attempts, please try again later.',
});

export const apiRateLimit = createRateLimit({
  windowMs: AUTHENTICATION_POLICY.RATE_LIMITING.apiCalls.windowMs,
  maxRequests: AUTHENTICATION_POLICY.RATE_LIMITING.apiCalls.maxRequests,
  message: 'API rate limit exceeded, please try again later.',
});

export const passwordResetRateLimit = createRateLimit({
  windowMs: AUTHENTICATION_POLICY.RATE_LIMITING.passwordReset.windowMs,
  maxRequests: AUTHENTICATION_POLICY.RATE_LIMITING.passwordReset.maxAttempts,
  message: 'Too many password reset attempts, please try again later.',
});

// ============================================================================
// SESSION SECURITY MIDDLEWARE
// ============================================================================

export const sessionSecurity = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session) {
    return next();
  }

  const now = Date.now();
  const session = req.session as any;

  // Check session duration
  if (session.createdAt && (now - session.createdAt) > AUTHENTICATION_POLICY.SESSION_POLICY.maxDuration) {
    logger.warn('Session expired due to duration', { 
      sessionId: session.id,
      userId: session.userId,
      duration: now - session.createdAt,
    });

    req.session.destroy((err: any) => {
      if (err) {
        logger.error('Failed to destroy expired session', { error: err });
      }
    });

    return res.status(401).json({ error: 'Session expired, please login again' });
  }

  // Check inactivity timeout
  if (session.lastActivity && (now - session.lastActivity) > AUTHENTICATION_POLICY.SESSION_POLICY.inactivityTimeout) {
    logger.warn('Session expired due to inactivity', {
      sessionId: session.id,
      userId: session.userId,
      inactivityTime: now - session.lastActivity,
    });

    req.session.destroy((err: any) => {
      if (err) {
        logger.error('Failed to destroy inactive session', { error: err });
      }
    });

    return res.status(401).json({ error: 'Session expired due to inactivity' });
  }

  // Update last activity
  session.lastActivity = now;

  next();
};

// ============================================================================
// IP SECURITY MIDDLEWARE
// ============================================================================

interface IpSecurityStore {
  [ip: string]: {
    requests: number;
    lastRequest: number;
    blocked: boolean;
    blockedUntil?: number;
  };
}

const ipSecurityStore: IpSecurityStore = {};

export const ipSecurity = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  // Initialize IP record
  if (!ipSecurityStore[ip]) {
    ipSecurityStore[ip] = {
      requests: 0,
      lastRequest: now,
      blocked: false,
    };
  }

  const ipRecord = ipSecurityStore[ip];

  // Check if IP is blocked
  if (ipRecord.blocked && ipRecord.blockedUntil && now < ipRecord.blockedUntil) {
    logger.warn('Blocked IP attempted access', {
      ip,
      blockedUntil: ipRecord.blockedUntil,
      userAgent: req.get('User-Agent'),
    });

    return res.status(403).json({ error: 'Access denied' });
  }

  // Unblock if block period expired
  if (ipRecord.blocked && ipRecord.blockedUntil && now >= ipRecord.blockedUntil) {
    ipRecord.blocked = false;
    ipRecord.blockedUntil = undefined;
    ipRecord.requests = 0;
    logger.info('IP block expired', { ip });
  }

  // Update request count
  ipRecord.requests++;
  ipRecord.lastRequest = now;

  // Check for suspicious activity
  const timeWindow = 60 * 1000; // 1 minute
  const suspiciousThreshold = SECURITY_MONITORING_POLICY.THREAT_DETECTION.alertThresholds.apiCallsPerMinute;

  if (ipRecord.requests > suspiciousThreshold) {
    logger.warn('Suspicious IP activity detected', {
      ip,
      requests: ipRecord.requests,
      threshold: suspiciousThreshold,
      userAgent: req.get('User-Agent'),
    });

    // Block IP for 1 hour
    ipRecord.blocked = true;
    ipRecord.blockedUntil = now + (60 * 60 * 1000);

    // Log security event
    if (req.db) {
      SecurityMonitoringService.logSecurityEvent(req.db, {
        type: 'ip_blocked',
        action: 'api_abuse',
        outcome: 'failure',
        ipAddress: ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          requests: ipRecord.requests,
          threshold: suspiciousThreshold,
          blockedUntil: ipRecord.blockedUntil,
        },
      }).catch((error: any) => {
        logger.error('Failed to log IP block event', { error });
      });
    }

    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  next();
};

// ============================================================================
// DATA ACCESS LOGGING MIDDLEWARE
// ============================================================================

export const dataAccessLogger = (req: Request, res: Response, next: NextFunction) => {
  // Only log data access requests
  const dataAccessPatterns = [
    /\/api\/.*\/leads/,
    /\/api\/.*\/messages/,
    /\/api\/.*\/users/,
    /\/api\/.*\/analytics/,
    /\/api\/.*\/export/,
  ];

  const isDataAccess = dataAccessPatterns.some(pattern => pattern.test(req.path));

  if (isDataAccess) {
    // Log after response to capture outcome
    res.on('finish', () => {
      if (req.db) {
        SecurityMonitoringService.logSecurityEvent(req.db, {
          type: 'data_access',
          action: `${req.method} ${req.path}`,
          outcome: res.statusCode < 400 ? 'success' : 'failure',
          userId: (req.session as any)?.userId,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          metadata: {
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
            query: req.query,
          },
        }).catch((error: any) => {
          logger.error('Failed to log data access event', { error });
        });
      }
    });
  }

  next();
};

// ============================================================================
// SMS COMPLIANCE MIDDLEWARE
// ============================================================================

export const smsComplianceCheck = async (req: Request, res: Response, next: NextFunction) => {
  // Only apply to SMS sending endpoints
  if (!req.path.includes('/send-sms') && !req.path.includes('/messages')) {
    return next();
  }

  try {
    const { leadId, messageType = 'marketing' } = req.body;
    const tenantId = (req.session as any)?.tenantId;

    if (!leadId || !tenantId) {
      return next(); // Let the route handler validate required fields
    }

    // Check TCPA compliance
    const { CommunicationsComplianceService } = await import('./securityCompliance.service');
    const compliance = await CommunicationsComplianceService.validateSmsCompliance(
      req.db!,
      tenantId,
      leadId,
      messageType
    );

    if (!compliance.compliant) {
      logger.warn('SMS compliance check failed', {
        tenantId,
        leadId,
        messageType,
        reason: compliance.reason,
      });

      return res.status(403).json({
        error: 'SMS compliance check failed',
        reason: compliance.reason,
      });
    }

    next();
  } catch (error) {
    logger.error('SMS compliance check error', { error });
    // Don't block the request on compliance check failure, but log it
    next();
  }
};

// ============================================================================
// SECURITY MONITORING MIDDLEWARE
// ============================================================================

export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Monitor for security events
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection attempts
    /javascript:/i,  // JavaScript protocol
  ];

  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.query)) ||
    pattern.test(JSON.stringify(req.body))
  );

  if (isSuspicious) {
    logger.warn('Suspicious request detected', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      query: req.query,
      body: req.body,
    });

    // Log security event
    if (req.db) {
      SecurityMonitoringService.logSecurityEvent(req.db, {
        type: 'suspicious_request',
        action: 'potential_attack',
        outcome: 'failure',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        metadata: {
          method: req.method,
          url: req.url,
          query: req.query,
          body: req.body,
        },
      }).catch((error: any) => {
        logger.error('Failed to log suspicious request event', { error });
      });
    }

    // Block suspicious requests
    return res.status(400).json({ error: 'Invalid request' });
  }

  next();
};

// ============================================================================
// CLEANUP FUNCTIONS
// ============================================================================

export const cleanupExpiredData = () => {
  // Clean up rate limit store
  const now = Date.now();
  Object.keys(rateLimitStore).forEach(key => {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  });

  // Clean up IP security store
  Object.keys(ipSecurityStore).forEach(ip => {
    const record = ipSecurityStore[ip];
    if (record.blockedUntil && record.blockedUntil < now) {
      delete ipSecurityStore[ip];
    } else if (!record.blocked && now - record.lastRequest > 24 * 60 * 60 * 1000) {
      // Clean up old inactive records
      delete ipSecurityStore[ip];
    }
  });
};

// Schedule cleanup every hour
setInterval(cleanupExpiredData, 60 * 60 * 1000);
