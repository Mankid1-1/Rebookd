/**
 * 🔍 ENVIRONMENT VERIFICATION SCRIPT
 * Ensures all required environment variables are set for production launch
 */

const requiredVars = {
  // Database
  DATABASE_URL: "MySQL connection string",
  
  // Authentication
  JWT_SECRET: "32+ character random string for JWT signing",
  
  // Application URLs
  FRONTEND_URL: "Frontend application URL (e.g., https://app.rebooked.com)",
  BACKEND_URL: "Backend API URL (e.g., https://api.rebooked.com)",
  
  // Stripe - CRITICAL FOR BILLING
  STRIPE_SECRET_KEY: "Stripe secret key (sk_live_... for production)",
  STRIPE_PUBLISHABLE_KEY: "Stripe publishable key (pk_live_... for production)",
  STRIPE_WEBHOOK_SECRET: "Stripe webhook signing secret",
  STRIPE_FIXED_PRICE_ID: "Fixed price ID (price_FIXED_199)",
  STRIPE_METERED_PRICE_ID: "Metered price ID (price_METERED_15)",
  
  // Referral System
  REFERRAL_REWARD_AMOUNT: "Referral reward amount (50)",
  REFERRAL_MINIMUM_MONTHS: "Minimum months for reward (6)",
  REFERRAL_EXPIRY_DAYS: "Referral code expiry days (90)",
  REFERRAL_PROGRAM_ENABLED: "Enable referral program (true)",
  
  // Email (Recommended)
  SENDGRID_API_KEY: "SendGrid API key for emails",
  EMAIL_FROM_ADDRESS: "From email address (e.g., hello@rebooked.com)",
  
  // SMS (Required for core functionality)
  TELNYX_API_KEY: "Telnyx API key for SMS",
  TELNYX_FROM_NUMBER: "Telnyx phone number",
  
  // Security
  ENCRYPTION_KEY: "64 hex chars for PII encryption",
  WEBHOOK_SECRET: "Webhook signing secret",
  
  // Monitoring
  SENTRY_DSN: "Sentry DSN for error tracking"
};

const optionalVars = {
  // SMTP (alternative to SendGrid)
  SMTP_HOST: "SMTP server host",
  SMTP_PORT: "SMTP server port",
  SMTP_USER: "SMTP username",
  SMTP_PASS: "SMTP password",
  
  // AI Features
  OPENAI_API_KEY: "OpenAI API key for AI features",
  
  // Rate Limiting
  SMS_HOURLY_CAP: "SMS hourly cap (0 = disabled)",
  SMS_DAILY_CAP_PER_TENANT: "SMS daily cap per tenant",
  
  // Development
  WEBHOOK_ALLOW_UNSIGNED: "Allow unsigned webhooks in dev (true/false)"
};

function checkEnvironmentVariables() {
  console.log("🔍 Checking environment variables...\n");
  
  const missing = [];
  const present = [];
  
  // Check required variables
  console.log("📋 REQUIRED VARIABLES:");
  for (const [key, description] of Object.entries(requiredVars)) {
    const value = process.env[key];
    if (!value) {
      missing.push({ key, description });
      console.log(`❌ ${key}: ${description} - MISSING`);
    } else {
      present.push({ key, description, value: maskValue(key, value) });
      console.log(`✅ ${key}: ${description} - SET`);
    }
  }
  
  // Check optional variables
  console.log("\n📋 OPTIONAL VARIABLES:");
  for (const [key, description] of Object.entries(optionalVars)) {
    const value = process.env[key];
    if (!value) {
      console.log(`⚪ ${key}: ${description} - NOT SET (optional)`);
    } else {
      console.log(`✅ ${key}: ${description} - SET`);
    }
  }
  
  // Summary
  console.log("\n📊 SUMMARY:");
  console.log(`✅ Present: ${present.length}/${Object.keys(requiredVars).length} required variables`);
  console.log(`❌ Missing: ${missing.length}/${Object.keys(requiredVars).length} required variables`);
  
  if (missing.length > 0) {
    console.log("\n🚨 CRITICAL - Missing required variables:");
    missing.forEach(({ key, description }) => {
      console.log(`   - ${key}: ${description}`);
    });
    console.log("\n❌ CANNOT PROCEED WITH LAUNCH - Fix missing variables first!");
    return false;
  }
  
  console.log("\n✅ All required environment variables are set!");
  
  // Production-specific checks
  if (process.env.NODE_ENV === 'production') {
    console.log("\n🔒 PRODUCTION SECURITY CHECKS:");
    
    // Check for test keys in production
    const testKeys = [
      { key: 'STRIPE_SECRET_KEY', pattern: /^sk_test_/ },
      { key: 'STRIPE_PUBLISHABLE_KEY', pattern: /^pk_test_/ }
    ];
    
    let securityIssues = 0;
    testKeys.forEach(({ key, pattern }) => {
      const value = process.env[key];
      if (value && pattern.test(value)) {
        console.log(`🚨 ${key}: Using TEST key in production!`);
        securityIssues++;
      }
    });
    
    if (securityIssues > 0) {
      console.log(`❌ ${securityIssues} security issues found - CANNOT LAUNCH IN PRODUCTION!`);
      return false;
    }
    
    console.log("✅ Production security checks passed!");
  }
  
  return true;
}

function maskValue(key, value) {
  // Mask sensitive values
  const sensitiveKeys = [
    'DATABASE_URL', 'JWT_SECRET', 'STRIPE_SECRET_KEY', 
    'STRIPE_WEBHOOK_SECRET', 'SENDGRID_API_KEY', 'ENCRYPTION_KEY',
    'WEBHOOK_SECRET', 'SENTRY_DSN', 'TELNYX_API_KEY'
  ];
  
  if (sensitiveKeys.includes(key)) {
    return value.substring(0, 8) + '...';
  }
  
  return value;
}

function generateEnvTemplate() {
  console.log("📝 Generating .env template...\n");
  
  let template = "# Rebooked Environment Variables\n";
  template += "# Copy this file to .env and fill in your values\n";
  template += "# ===========================================\n\n";
  
  template += "# Database\n";
  template += "DATABASE_URL=mysql://user:password@localhost:3306/rebooked\n\n";
  
  template += "# Authentication\n";
  template += "JWT_SECRET=your-32-character-random-secret\n\n";
  
  template += "# Application URLs\n";
  template += "FRONTEND_URL=https://app.rebooked.com\n";
  template += "BACKEND_URL=https://api.rebooked.com\n\n";
  
  template += "# Stripe - CRITICAL FOR BILLING\n";
  template += "STRIPE_SECRET_KEY=sk_live_...\n";
  template += "STRIPE_PUBLISHABLE_KEY=pk_live_...\n";
  template += "STRIPE_WEBHOOK_SECRET=whsec_...\n";
  template += "STRIPE_FIXED_PRICE_ID=price_FIXED_199\n";
  template += "STRIPE_METERED_PRICE_ID=price_METERED_15\n\n";
  
  template += "# Referral System\n";
  template += "REFERRAL_REWARD_AMOUNT=50\n";
  template += "REFERRAL_MINIMUM_MONTHS=6\n";
  template += "REFERRAL_EXPIRY_DAYS=90\n";
  template += "REFERRAL_PROGRAM_ENABLED=true\n\n";
  
  template += "# Email\n";
  template += "SENDGRID_API_KEY=SG...\n";
  template += "EMAIL_FROM_ADDRESS=hello@rebooked.com\n\n";
  
  template += "# SMS\n";
  template += "TELNYX_API_KEY=KEY0...\n";
  template += "TELNYX_FROM_NUMBER=+15550000000\n\n";
  
  template += "# Security\n";
  template += "ENCRYPTION_KEY=your-64-hex-encryption-key\n";
  template += "WEBHOOK_SECRET=your-webhook-secret\n\n";
  
  template += "# Monitoring\n";
  template += "SENTRY_DSN=https://your-sentry-dsn\n";
  
  console.log(template);
}

// Run checks
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);

if (args.includes('--template')) {
  generateEnvTemplate();
} else {
  const isReady = checkEnvironmentVariables();
  
  if (!isReady) {
    process.exit(1);
  }
  
  console.log("\n🎉 Environment is ready for launch!");
}

export {
  checkEnvironmentVariables,
  generateEnvTemplate,
  requiredVars,
  optionalVars
};
