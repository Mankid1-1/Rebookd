/**
 * Global Error Handling & Recovery
 * Centralized error processing for production reliability
 */

import { TRPCError } from '@trpc/server';
import { logger } from './logger';

export class ProductionError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public statusCode: number = 500,
    public retryable: boolean = false,
    public details?: Record<string, any>,
  ) {
    super(userMessage);
    this.name = 'ProductionError';
  }
}

// ─── Error Classification ──────────────────────────────────────────────────────
export function classifyError(error: unknown): {
  code: string;
  userMessage: string;
  statusCode: number;
  retryable: boolean;
  logLevel: 'error' | 'warn' | 'info';
} {
  // Database errors
  if (error instanceof Error && error.message.includes('database')) {
    return {
      code: 'DB_ERROR',
      userMessage: 'Database operation failed. Please try again.',
      statusCode: 503,
      retryable: true,
      logLevel: 'warn',
    };
  }

  // Timeout errors
  if (error instanceof Error && error.message.includes('timeout')) {
    return {
      code: 'TIMEOUT',
      userMessage: 'Request took too long. Please try again.',
      statusCode: 504,
      retryable: true,
      logLevel: 'warn',
    };
  }

  // Rate limiting
  if (error instanceof Error && error.message.includes('rate')) {
    return {
      code: 'RATE_LIMITED',
      userMessage: 'Too many requests. Please wait before trying again.',
      statusCode: 429,
      retryable: true,
      logLevel: 'info',
    };
  }

  // Validation errors
  if (error instanceof Error && error.message.includes('validation')) {
    return {
      code: 'VALIDATION_ERROR',
      userMessage: 'Invalid input. Please check your request.',
      statusCode: 400,
      retryable: false,
      logLevel: 'info',
    };
  }

  // Authentication errors
  if (error instanceof Error && error.message.includes('unauthorized')) {
    return {
      code: 'UNAUTHORIZED',
      userMessage: 'Authentication failed. Please log in again.',
      statusCode: 401,
      retryable: false,
      logLevel: 'info',
    };
  }

  // Permission errors
  if (error instanceof Error && error.message.includes('forbidden')) {
    return {
      code: 'FORBIDDEN',
      userMessage: 'You do not have permission to perform this action.',
      statusCode: 403,
      retryable: false,
      logLevel: 'info',
    };
  }

  // Not found errors
  if (error instanceof Error && error.message.includes('not found')) {
    return {
      code: 'NOT_FOUND',
      userMessage: 'Resource not found.',
      statusCode: 404,
      retryable: false,
      logLevel: 'info',
    };
  }

  // Default: Internal server error
  return {
    code: 'INTERNAL_ERROR',
    userMessage: 'An unexpected error occurred. Our team has been notified.',
    statusCode: 500,
    retryable: false,
    logLevel: 'error',
  };
}

// ─── Safe Error Response ──────────────────────────────────────────────────────
export function getSafeErrorResponse(error: unknown) {
  const classified = classifyError(error);
  
  logger[classified.logLevel]('Error classified', {
    code: classified.code,
    statusCode: classified.statusCode,
    retryable: classified.retryable,
    originalError: error instanceof Error ? error.message : String(error),
  });

  return {
    error: {
      code: classified.code,
      message: classified.userMessage,
      statusCode: classified.statusCode,
      retryable: classified.retryable,
      timestamp: new Date().toISOString(),
    },
  };
}

// ─── TRPC Error Converter ──────────────────────────────────────────────────────
export function toTRPCError(error: unknown): TRPCError {
  const classified = classifyError(error);
  
  const codeMap: Record<string, any> = {
    'DB_ERROR': 'INTERNAL_SERVER_ERROR',
    'TIMEOUT': 'TIMEOUT',
    'RATE_LIMITED': 'TOO_MANY_REQUESTS',
    'VALIDATION_ERROR': 'BAD_REQUEST',
    'UNAUTHORIZED': 'UNAUTHORIZED',
    'FORBIDDEN': 'FORBIDDEN',
    'NOT_FOUND': 'NOT_FOUND',
    'INTERNAL_ERROR': 'INTERNAL_SERVER_ERROR',
  };

  return new TRPCError({
    code: codeMap[classified.code],
    message: classified.userMessage,
  });
}

// ─── Retry Logic ──────────────────────────────────────────────────────────────
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const classified = classifyError(error);
      
      if (!classified.retryable || attempt === maxAttempts) {
        throw error;
      }

      const backoffDelay = delayMs * Math.pow(2, attempt - 1);
      logger.warn(`Retry attempt ${attempt} after ${backoffDelay}ms`, {
        code: classified.code,
        error: error instanceof Error ? error.message : String(error),
      });

      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }

  throw new Error('Retry logic failed');
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime: number | null = null;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private maxFailures: number = 5,
    private resetTimeMs: number = 60000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      if (timeSinceLastFailure > this.resetTimeMs) {
        this.state = 'half-open';
        this.failures = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
      logger.error('Circuit breaker opened', { failures: this.failures });
    }
  }

  getState() {
    return this.state;
  }
}
