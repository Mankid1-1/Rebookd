/**
 * 🚀 SENTRY REACT CONFIGURATION
 * AI-assisted frontend error tracking
 */

import * as Sentry from '@sentry/react';

// Initialize Sentry for React
export function initSentryReact() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
  });
}

// Export Sentry for manual error reporting
export { Sentry };
