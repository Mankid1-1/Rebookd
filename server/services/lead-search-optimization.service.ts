/**
 * Lead Search Optimization Service
 *
 * Fixes lead search memory leaks and improves performance
 * Implements proper query timeouts and memory management
 */

import { eq, and, desc, sql, like, or } from "drizzle-orm";
import { leads, messages } from "../../drizzle/schema";
import type { Db } from "../_core/context";
import { withQueryTimeout } from "./query.service";

// Search result cache with TTL
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Memory usage monitoring
let memoryUsage = {
  queries: 0,
  cacheHits: 0,
  cacheMisses: 0,
  lastCleanup: Date.now()
};

/**
 * Optimized lead search with memory leak prevention
 */
export async function searchLeads(
  db: Db,
  tenantId: number,
  options: {
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const cacheKey = `leads_${tenantId}_${JSON.stringify(options)}`;
  const now = Date.now();

  // Check cache first
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      memoryUsage.cacheHits++;
      return cached.data;
    }
  }

  memoryUsage.cacheMisses++;

  try {
    const query = db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        status: leads.status,
        appointmentAt: leads.appointmentAt,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        messageCount: sql<number>`(SELECT COUNT(*) FROM messages WHERE messages.leadId = ${leads.id})`.as('messageCount')
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          options.status ? eq(leads.status, options.status as any) : undefined,
          options.search ?
            or(
              like(leads.name, `%${options.search}%`),
              like(leads.phone, `%${options.search}%`),
              like(leads.email, `%${options.search}%`)
            ) : undefined
        )
      )
      .orderBy(desc(leads.createdAt))
      .limit(options.limit || 20)
      .offset(((options.page || 1) - 1) * (options.limit || 20));

    const result = await withQueryTimeout(
      'Lead search query',
      query,
      10000
    );

    // Cache the result
    searchCache.set(cacheKey, { data: result, timestamp: now });
    memoryUsage.queries++;

    // Periodic cache cleanup
    if (now - memoryUsage.lastCleanup > 60000) {
      cleanupCache();
      memoryUsage.lastCleanup = now;
    }

    return result;

  } catch (error: any) {
    console.error('Lead search error:', error);
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Get lead by ID with memory optimization
 */
export async function getLeadByIdOptimized(
  db: Db,
  tenantId: number,
  leadId: number
) {
  const cacheKey = `lead_${tenantId}_${leadId}`;
  const now = Date.now();

  // Check cache
  if (searchCache.has(cacheKey)) {
    const cached = searchCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL) {
      memoryUsage.cacheHits++;
      return cached.data;
    }
  }

  memoryUsage.cacheMisses++;

  try {
    const query = db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        email: leads.email,
        status: leads.status,
        appointmentAt: leads.appointmentAt,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, tenantId),
          eq(leads.id, leadId)
        )
      )
      .limit(1);

    const result = await withQueryTimeout(
      'Get lead by ID',
      query,
      5000
    );

    const lead = result[0] || null;

    if (lead) {
      searchCache.set(cacheKey, { data: lead, timestamp: now });
    }

    memoryUsage.queries++;
    return lead;

  } catch (error: any) {
    console.error('Get lead by ID error:', error);
    throw new Error(`Failed to get lead: ${error.message}`);
  }
}

/**
 * Search memory usage statistics
 */
export function getSearchMemoryStats() {
  return {
    ...memoryUsage,
    cacheSize: searchCache.size,
    cacheHitRate: memoryUsage.cacheHits / (memoryUsage.cacheHits + memoryUsage.cacheMisses) * 100
  };
}

/**
 * Clean up expired cache entries
 */
function cleanupCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach(key => searchCache.delete(key));

  if (keysToDelete.length > 0) {
    console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}

/**
 * Force clear cache (for testing/memory management)
 */
export function clearSearchCache() {
  searchCache.clear();
  memoryUsage = {
    queries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    lastCleanup: Date.now()
  };
  console.log('Lead search cache cleared');
}
