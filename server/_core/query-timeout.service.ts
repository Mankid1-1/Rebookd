/**
 * Query Timeout Service
 * 
 * Adds timeout protection to database queries
 * Prevents hanging queries and memory leaks
 */

import { sql } from 'drizzle-orm';
import type { Db } from './context';

interface QueryOptions {
  timeout?: number;
  errorMessage?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Wrap database query with timeout protection
 */
export async function withQueryTimeout<T>(
  query: Promise<T>,
  timeoutMs: number = 10000,
  errorMessage: string = 'Query timeout'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`${errorMessage} after ${timeoutMs}ms`));
    }, timeoutMs);

    query
      .then(result => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Wrap query with retry logic and timeout
 */
export async function withQueryRetry<T>(
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const {
    timeout = 10000,
    errorMessage = 'Query failed',
    retryAttempts = 3,
    retryDelay = 1000
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const result = await withQueryTimeout(queryFn(), timeout, errorMessage);
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error && (
        error.message.includes('UNIQUE constraint') ||
        error.message.includes('FOREIGN KEY constraint') ||
        error.message.includes('syntax error')
      )) {
        throw error;
      }

      if (attempt < retryAttempts) {
        console.warn(`Query attempt ${attempt} failed, retrying in ${retryDelay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw lastError!;
}

/**
 * Batch query with timeout protection
 */
export async function withBatchTimeout<T>(
  queries: Array<Promise<T>>,
  timeoutMs: number = 30000,
  errorMessage: string = 'Batch query timeout'
): Promise<T[]> {
  return Promise.all(
    queries.map(query => withQueryTimeout(query, timeoutMs, errorMessage))
  );
}

/**
 * Database health check with timeout
 */
export async function checkDatabaseHealth(
  db: Db,
  timeoutMs: number = 5000
): Promise<{ status: string; latency: number }> {
  const startTime = Date.now();
  
  try {
    await withQueryTimeout(
      db.select({ count: sql`1` }).from(sql`dual`),
      timeoutMs,
      'Database health check timeout'
    );
    
    const latency = Date.now() - startTime;
    
    return {
      status: 'healthy',
      latency
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - startTime
    };
  }
}

/**
 * Circuit breaker pattern for database queries
 */
export class QueryCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly failureThreshold = 5,
    private readonly timeoutMs = 60000, // 1 minute
    private readonly successThreshold = 3
  ) {}

  async execute<T>(query: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeoutMs) {
        this.state = 'half-open';
        console.log('🔄 Circuit breaker moving to half-open state');
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await query();
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    
    if (this.state === 'half-open') {
      this.state = 'closed';
      console.log('✅ Circuit breaker closed after successful request');
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      console.log('🚫 Circuit breaker opened due to failures');
    }
  }

  getState(): string {
    return this.state;
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    console.log('🔄 Circuit breaker reset');
  }
}

// Global circuit breaker instance
const globalCircuitBreaker = new QueryCircuitBreaker();

/**
 * Execute query with circuit breaker protection
 */
export function withCircuitBreaker<T>(query: () => Promise<T>): Promise<T> {
  return globalCircuitBreaker.execute(query);
}

/**
 * Query performance monitoring
 */
export class QueryPerformanceMonitor {
  private static metrics = {
    totalQueries: 0,
    slowQueries: 0,
    timeouts: 0,
    averageLatency: 0,
    maxLatency: 0
  };

  static async trackQuery<T>(
    query: () => Promise<T>,
    queryName: string,
    slowThresholdMs: number = 1000
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      this.metrics.totalQueries++;
      const result = await query();
      
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);
      
      if (latency > slowThresholdMs) {
        this.metrics.slowQueries++;
        console.warn(`🐌 Slow query detected: ${queryName} took ${latency}ms`);
      }
      
      return result;
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateMetrics(latency, true);
      
      if (latency > 5000) { // Consider 5s+ as timeout
        this.metrics.timeouts++;
        console.error(`⏰ Query timeout: ${queryName} after ${latency}ms`);
      }
      
      throw error;
    }
  }

  private static updateMetrics(latency: number, isError: boolean): void {
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalQueries - 1) + latency) / 
      this.metrics.totalQueries;
  }

  static getMetrics() {
    return { ...this.metrics };
  }

  static resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      slowQueries: 0,
      timeouts: 0,
      averageLatency: 0,
      maxLatency: 0
    };
  }
}
