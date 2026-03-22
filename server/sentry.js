/**
 * 🚀 SENTRY CONFIGURATION
 * AI-assisted error tracking and performance monitoring
 */

import * as Sentry from '@sentry/node';

// Initialize Sentry
export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Performance Monitoring
    tracesSampleRate: 1.0,
    // Environment
    environment: process.env.NODE_ENV || 'development',
    // Release
    release: process.env.npm_package_version || '1.0.0',
  });
}

// Export Sentry for manual error reporting
export { Sentry };
