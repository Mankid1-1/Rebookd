/**
 * Database Query Optimization & Performance Monitoring
 * Prevents OOM, timeouts, and N+1 queries
 */

import { logger } from './logger';

export interface QueryMetrics {
  duration: number;
  rows?: number;
  bytes?: number;
  slow: boolean;
}

class QueryMonitor {
  private metrics: Map<string, QueryMetrics[]> = new Map();
  private slowThreshold = 1000; // 1s

  async trackQuery<T>(
    fn: () => Promise<T>,
    name: string,
    threshold: number = this.slowThreshold,
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await Promise.race([
        fn(),
        this.timeout(30000, `Query "${name}" exceeded 30s timeout`),
      ]);

      const duration = Date.now() - startTime;
      const slow = duration > threshold;

      const metric: QueryMetrics = {
        duration,
        slow,
      };

      this.recordMetric(name, metric);

      if (slow) {
        logger.warn(`Slow query detected: ${name}`, {
          duration,
          threshold,
        });
      }

      return result as T;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Query failed: ${name}`, {
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private recordMetric(name: string, metric: QueryMetrics) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metrics = this.metrics.get(name)!;
    metrics.push(metric);
    
    // Keep only last 100 queries per name
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  private timeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  getMetrics(name?: string) {
    if (name) {
      return this.metrics.get(name) || [];
    }
    return Object.fromEntries(this.metrics);
  }

  getStats(name: string) {
    const metrics = this.metrics.get(name) || [];
    if (metrics.length === 0) return null;

    const durations = metrics.map(m => m.duration);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const max = Math.max(...durations);
    const min = Math.min(...durations);
    const slowCount = metrics.filter(m => m.slow).length;

    return { avg, max, min, total: metrics.length, slowCount };
  }
}

export const QueryPerformanceMonitor = new QueryMonitor();

// ─── Pagination Helper ────────────────────────────────────────────────────────
export function getPaginationParams(page?: number, limit?: number) {
  const p = Math.max(1, page ?? 1);
  const l = Math.min(100, Math.max(1, limit ?? 20)); // Max 100 per page
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
}

// ─── N+1 Query Prevention ─────────────────────────────────────────────────────
export class BatchLoader<K, V> {
  private batch: Map<K, V | Promise<V>> = new Map();
  private loading: boolean = false;

  constructor(private batchFn: (keys: K[]) => Promise<Map<K, V>>) {}

  async load(key: K): Promise<V> {
    if (this.batch.has(key)) {
      return this.batch.get(key)!;
    }

    const promise = new Promise<V>((resolve, reject) => {
      // Defer to next tick
      setImmediate(async () => {
        try {
          const results = await this.batchFn(Array.from(this.batch.keys()));
          results.forEach((v, k) => this.batch.set(k, v));
          resolve(this.batch.get(key)!);
        } catch (error) {
          reject(error);
        }
      });
    });

    this.batch.set(key, promise);
    return promise;
  }

  clear() {
    this.batch.clear();
  }
}

// ─── Memory Usage Monitoring ──────────────────────────────────────────────────
export class MemoryMonitor {
  private threshold = 500 * 1024 * 1024; // 500MB

  getUsage() {
    if (global.gc) {
      global.gc();
    }
    return process.memoryUsage();
  }

  checkMemory(): { ok: boolean; usage: NodeJS.MemoryUsage } {
    const usage = this.getUsage();
    const ok = usage.heapUsed < this.threshold;

    if (!ok) {
      logger.error('Memory threshold exceeded', {
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
        threshold: Math.round(this.threshold / 1024 / 1024) + 'MB',
      });
    }

    return { ok, usage };
  }

  setThreshold(bytes: number) {
    this.threshold = bytes;
  }
}

export const memoryMonitor = new MemoryMonitor();

// ─── Cache with TTL ────────────────────────────────────────────────────────────
export class CacheWithTTL<K, V> {
  private cache: Map<K, { value: V; expiresAt: number }> = new Map();

  set(key: K, value: V, ttlMs: number = 5 * 60 * 1000) {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { value, expiresAt });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  size() {
    return this.cache.size;
  }
}

// ─── Efficient Lead Search (Prevents OOM) ──────────────────────────────────────
export class OptimizedLeadSearch {
  private searchCache = new CacheWithTTL<string, number[]>();

  async searchLeads(
    db: any,
    tenantId: number,
    query: string,
    limit: number = 20,
  ): Promise<number[]> {
    // Use database-level search instead of loading all into memory
    const cacheKey = `${tenantId}:${query}`;
    
    if (this.searchCache.has(cacheKey)) {
      return this.searchCache.get(cacheKey)!.slice(0, limit);
    }

    // Instead of SELECT *, use database FULLTEXT search
    // This prevents loading 10K+ leads into memory
    const results = await db.execute(`
      SELECT id FROM leads 
      WHERE tenantId = ? 
      AND (
        MATCH(phone) AGAINST(? IN BOOLEAN MODE)
        OR MATCH(name) AGAINST(? IN BOOLEAN MODE)
        OR MATCH(email) AGAINST(? IN BOOLEAN MODE)
      )
      LIMIT 100
    `, [tenantId, query, query, query]);

    const ids = results.map((r: any) => r.id);
    this.searchCache.set(cacheKey, ids);

    return ids.slice(0, limit);
  }

  clearCache() {
    this.searchCache.clear();
  }
}

export const optimizedLeadSearch = new OptimizedLeadSearch();
