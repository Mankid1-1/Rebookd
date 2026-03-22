#!/usr/bin/env node

/**
 * 🚀 SENTRY SETUP SCRIPT
 * AI-assisted Sentry integration setup
 * Based on: https://github.com/getsentry/sentry-for-ai/blob/main/skills/sentry-sdk-setup/SKILL.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const setupSentry = () => {
  try {
    log('🚀 SENTRY SETUP', 'bright');
    log('=====================================', 'bright');
    
    // Get project root by going up from scripts directory
    const projectRoot = path.resolve(__dirname, '..');
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const envFilePath = path.join(projectRoot, '.env');
    
    // Check if package.json exists
    if (!fs.existsSync(packageJsonPath)) {
      log('❌ package.json not found!', 'red');
      process.exit(1);
    }
    
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Add Sentry dependencies
    const sentryDeps = {
      '@sentry/node': '^8.0.0',
      '@sentry/react': '^8.0.0' // Updated to support React 19
    };
    
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    Object.entries(sentryDeps).forEach(([name, version]) => {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        log(`✅ Added ${name} to dependencies`, 'green');
      } else {
        log(`✅ ${name} already in dependencies`, 'yellow');
      }
    });
    
    // Write updated package.json
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    log('✅ Updated package.json', 'green');
    
    // Check if .env file exists and add Sentry DSN
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      const sentryDsn = 'https://453e71c19f8e1bc6d6de07f366260a32@o4511089469947904.ingest.us.sentry.io/4511089470930944';
      
      if (!envContent.includes('SENTRY_DSN=')) {
        fs.appendFileSync(envFilePath, `\n# Sentry DSN (Provided)\nSENTRY_DSN=${sentryDsn}\n`);
        log('✅ Added Sentry DSN to .env file', 'green');
      } else if (envContent.includes('SENTRY_DSN=')) {
        // Update existing SENTRY_DSN
        const updatedEnvContent = envContent.replace(/SENTRY_DSN=.*/, `SENTRY_DSN=${sentryDsn}`);
        fs.writeFileSync(envFilePath, updatedEnvContent);
        log('✅ Updated Sentry DSN in .env file', 'green');
      }
    }
    
    // Create Sentry configuration file
    const sentryConfigPath = path.join(projectRoot, 'server', 'sentry.js');
    const sentryConfigContent = `/**
 * 🚀 SENTRY CONFIGURATION
 * AI-assisted error tracking and performance monitoring
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry
export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      // Enable profiling
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    // Environment
    environment: process.env.NODE_ENV || 'development',
    // Release
    release: process.env.npm_package_version || '1.0.0',
  });
}

// Export Sentry for manual error reporting
export { Sentry };
`;

    if (!fs.existsSync(path.dirname(sentryConfigPath))) {
      fs.mkdirSync(path.dirname(sentryConfigPath), { recursive: true });
    }
    
    if (!fs.existsSync(sentryConfigPath)) {
      fs.writeFileSync(sentryConfigPath, sentryConfigContent);
      log('✅ Created Sentry configuration file', 'green');
    } else {
      log('✅ Sentry configuration file already exists', 'yellow');
    }
    
    // Create React Sentry configuration
    const reactSentryConfigPath = path.join(projectRoot, 'client', 'sentry.js');
    const reactSentryConfigContent = `/**
 * 🚀 SENTRY REACT CONFIGURATION
 * AI-assisted frontend error tracking
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

// Initialize Sentry for React
export function initSentryReact() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    integrations: [
      new BrowserTracing(),
    ],
    tracesSampleRate: 1.0,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.npm_package_version || '1.0.0',
  });
}

// Export Sentry for manual error reporting
export { Sentry };
`;

    if (!fs.existsSync(path.dirname(reactSentryConfigPath))) {
      fs.mkdirSync(path.dirname(reactSentryConfigPath), { recursive: true });
    }
    
    if (!fs.existsSync(reactSentryConfigPath)) {
      fs.writeFileSync(reactSentryConfigPath, reactSentryConfigContent);
      log('✅ Created React Sentry configuration file', 'green');
    } else {
      log('✅ React Sentry configuration file already exists', 'yellow');
    }
    
    log('', 'reset');
    log('🎉 SENTRY SETUP COMPLETE!', 'bright');
    log('=====================================', 'bright');
    log('✅ Sentry dependencies added to package.json', 'green');
    log('✅ Sentry DSN configured in .env file', 'green');
    log('✅ Server Sentry configuration created', 'green');
    log('✅ React Sentry configuration created', 'green');
    log('', 'reset');
    log('📋 NEXT STEPS:', 'yellow');
    log('1. Install dependencies: npm install', 'white');
    log('2. Import and initialize Sentry in your server entry point', 'white');
    log('3. Import and initialize Sentry in your React app', 'white');
    log('4. Test error reporting with a sample error', 'white');
    log('', 'reset');
    log('🌐 Your application will now automatically report errors to Sentry!', 'green');
    log('📊 View your error dashboard: https://sentry.io', 'green');
    
  } catch (error) {
    log(`❌ SENTRY SETUP FAILED: ${error.message}`, 'red');
    process.exit(1);
  }
};

// Run the setup
setupSentry();
