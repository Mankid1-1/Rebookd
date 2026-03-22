/**
 * Global Input Validation & Sanitization
 * Prevents injection attacks, XSS, and invalid data
 */

import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// ─── Input Sanitization ────────────────────────────────────────────────────────
export function sanitizeInput(input: string, type: 'text' | 'html' | 'email' | 'phone' = 'text'): string {
  if (typeof input !== 'string') return '';
  
  const trimmed = input.trim();
  
  switch (type) {
    case 'email':
      return trimmed.toLowerCase().slice(0, 320);
    
    case 'phone':
      // Remove all non-digits and allow + for international
      return trimmed.replace(/[^\d+\-()]/g, '').slice(0, 20);
    
    case 'html':
      // Use DOMPurify to remove dangerous HTML
      return DOMPurify.sanitize(trimmed, { 
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
        ALLOWED_ATTR: ['href'],
        MAX_DOM_TREE_DEPTH: 2,
      });
    
    case 'text':
    default:
      // Remove control characters and limit length
      return trimmed
        .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
        .slice(0, 5000);
  }
}

// ─── Zod Schemas with Sanitization ─────────────────────────────────────────────
export const schemas = {
  email: z.string()
    .email('Invalid email format')
    .max(320, 'Email too long')
    .transform(v => sanitizeInput(v, 'email')),
  
  phone: z.string()
    .min(10, 'Phone number too short')
    .max(20, 'Phone number too long')
    .transform(v => sanitizeInput(v, 'phone')),
  
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/\d/, 'Password must contain digit')
    .regex(/[@$!%*?&]/, 'Password must contain special character'),
  
  name: z.string()
    .min(1, 'Name required')
    .max(255, 'Name too long')
    .transform(v => sanitizeInput(v, 'text')),
  
  message: z.string()
    .min(1, 'Message required')
    .max(160, 'Message too long')
    .transform(v => sanitizeInput(v, 'text')),
  
  url: z.string()
    .url('Invalid URL')
    .max(500, 'URL too long'),
  
  slug: z.string()
    .regex(/^[a-z0-9\-_]+$/, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores')
    .max(100, 'Slug too long'),
};

// ─── Rate Limit Validation ─────────────────────────────────────────────────────
export function validateRateLimit(attempts: number, maxAttempts: number = 10, windowMinutes: number = 15): { allowed: boolean; retryAfter?: number } {
  if (attempts < maxAttempts) {
    return { allowed: true };
  }
  
  // Return estimated retry time in seconds
  const retryAfter = Math.ceil((windowMinutes * 60) / Math.max(1, attempts - maxAttempts));
  return { 
    allowed: false, 
    retryAfter: Math.min(retryAfter, windowMinutes * 60) 
  };
}

// ─── SQL Injection Prevention ──────────────────────────────────────────────────
export function validateSqlSafe(input: string): boolean {
  // Reject if contains suspicious SQL patterns
  const suspiciousPatterns = [
    /(\b(DROP|DELETE|TRUNCATE|ALTER|INSERT|UPDATE|EXEC|EXECUTE)\b)/i,
    /(-{2}|\/\*|\*\/|xp_|sp_)/,
    /(UNION.*SELECT|SELECT.*FROM)/i,
  ];
  
  return !suspiciousPatterns.some(pattern => pattern.test(input));
}

// ─── XSS Prevention ────────────────────────────────────────────────────────────
export function preventXSS(input: string): string {
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

// ─── Request Size Validation ──────────────────────────────────────────────────
export const maxRequestSize = {
  message: 160,
  bulkImport: 10000, // rows
  fileUpload: 50 * 1024 * 1024, // 50MB
};
