#!/usr/bin/env node

/**
 * 🚀 Complete Backend Setup for Rebooked
 * 
 * This script configures the entire backend including:
 * - Database connection
 * - SMS communications (Telnyx/Twilio)
 * - Email services (SendGrid/SMTP)
 * - Webhook configurations
 * - API keys and security
 * - OAuth and authentication
 * - All communication channels
 * 
 * Run with: node backend-setup.js
 */

import fs from 'fs';
import readline from 'readline';
import { spawn } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Complete Backend Setup for Rebooked\n');
console.log('This will configure ALL backend services and communications\n');

function ask(question, defaultValue = '') {
  return new Promise(resolve => {
    const prompt = defaultValue ? `${question} (default: ${defaultValue}): ` : `${question}: `;
    rl.question(prompt, answer => resolve(answer || defaultValue));
  });
}

function askPassword(question) {
  return new Promise(resolve => {
    // Hide password input
    const stdin = process.stdin;
    stdin.setRawMode(true);
    process.stdout.write(question + ': ');
    
    let password = '';
    stdin.on('data', function(char) {
      char = char.toString();
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          stdin.setRawMode(false);
          stdin.removeAllListeners('data');
          console.log();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          console.log('\nSetup cancelled');
          process.exit(0);
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

function runCommand(command, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔧 ${description}...`);
    
    const child = spawn(command, { shell: true, stdio: 'inherit' });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${description} completed`);
        resolve();
      } else {
        console.log(`⚠️  ${description} completed with warnings`);
        resolve();
      }
    });
    
    child.on('error', (error) => {
      console.log(`❌ ${description} error:`, error.message);
      reject(error);
    });
  });
}

async function setupDatabase() {
  console.log('\n🗄️ Database Configuration\n');
  
  const dbHost = await ask('Database host', 'localhost');
  const dbPort = await ask('Database port', '3306');
  const dbUser = await ask('Database username', 'root');
  const dbPassword = await askPassword('Database password');
  const dbName = await ask('Database name', 'rebooked');
  
  const databaseUrl = `mysql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;
  
  console.log('\n📋 DATABASE_URL configured');
  return databaseUrl;
}

async function setupAuthentication() {
  console.log('\n🔐 Authentication Setup\n');
  
  // Generate JWT secret
  const crypto = await import('crypto');
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  
  console.log('🔑 JWT Secret generated');
  
  const appUrl = await ask('Application URL', 'http://localhost:3000');
  const oauthUrl = await ask('OAuth server URL', 'http://localhost:3000');
  
  return {
    jwtSecret,
    appUrl,
    oauthUrl
  };
}

async function setupSMS() {
  console.log('\n📱 SMS Configuration\n');
  console.log('Choose SMS provider:');
  console.log('1. Telnyx (recommended)');
  console.log('2. Twilio');
  console.log('3. Skip SMS setup');
  
  const smsChoice = await ask('SMS provider (1-3)', '3');
  
  if (smsChoice === '1') {
    const telnyxKey = await ask('Telnyx API Key');
    const telnyxNumber = await ask('Telnyx From Number (+15550000000)');
    
    return {
      provider: 'telnyx',
      apiKey: telnyxKey,
      fromNumber: telnyxNumber
    };
  } else if (smsChoice === '2') {
    const twilioSid = await ask('Twilio Account SID');
    const twilioToken = await askPassword('Twilio Auth Token');
    const twilioNumber = await ask('Twilio From Number (+15550000001)');
    
    return {
      provider: 'twilio',
      accountSid: twilioSid,
      authToken: twilioToken,
      fromNumber: twilioNumber
    };
  }
  
  return null;
}

async function setupEmail() {
  console.log('\n📧 Email Configuration\n');
  console.log('Choose email provider:');
  console.log('1. SendGrid (recommended)');
  console.log('2. SMTP (custom server)');
  console.log('3. Skip email setup');
  
  const emailChoice = await ask('Email provider (1-3)', '3');
  
  if (emailChoice === '1') {
    const sendgridKey = await ask('SendGrid API Key');
    const emailFrom = await ask('From email address', 'hello@rebooked.com');
    
    return {
      provider: 'sendgrid',
      apiKey: sendgridKey,
      fromAddress: emailFrom
    };
  } else if (emailChoice === '2') {
    const smtpHost = await ask('SMTP host', 'mail.rebooked.org');
    const smtpPort = await ask('SMTP port', '587');
    const smtpSecure = await ask('Use SSL/TLS (true/false)', 'false');
    const smtpUser = await ask('SMTP username', 'noreply@rebooked.org');
    const smtpPass = await askPassword('SMTP password');
    
    return {
      provider: 'smtp',
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure === 'true',
      user: smtpUser,
      pass: smtpPass
    };
  }
  
  return null;
}

async function setupStripe() {
  console.log('\n💳 Stripe Configuration\n');
  console.log('Skip if not using billing features');
  
  const useStripe = await ask('Enable Stripe billing (y/n)', 'n');
  
  if (useStripe.toLowerCase() === 'y') {
    const stripeSecret = await ask('Stripe Secret Key (sk_test_...)');
    const stripeWebhook = await ask('Stripe Webhook Secret (whsec_...)');
    
    return {
      secretKey: stripeSecret,
      webhookSecret: stripeWebhook
    };
  }
  
  return null;
}

async function setupSecurity() {
  console.log('\n🔒 Security Configuration\n');
  
  // Generate encryption key
  const crypto = await import('crypto');
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  
  console.log('🔑 Encryption key generated');
  
  const webhookSecret = crypto.randomBytes(32).toString('hex');
  console.log('🔑 Webhook secret generated');
  
  return {
    encryptionKey,
    webhookSecret
  };
}

async function setupObservability() {
  console.log('\n📊 Observability Configuration\n');
  
  const useSentry = await ask('Enable Sentry error tracking (y/n)', 'n');
  
  if (useSentry.toLowerCase() === 'y') {
    const sentryDsn = await ask('Sentry DSN');
    return sentryDsn;
  }
  
  return null;
}

async function updateEnvFile(config) {
  console.log('\n📝 Updating .env file\n');
  
  let envContent = '';
  try {
    envContent = fs.readFileSync('.env', 'utf8');
  } catch (error) {
    console.log('Creating new .env file from template...');
    envContent = fs.readFileSync('.env.example', 'utf8');
  }
  
  const lines = envContent.split('\n');
  
  // Update or add each configuration
  const updates = [
    { key: 'DATABASE_URL', value: config.database },
    { key: 'JWT_SECRET', value: config.auth.jwtSecret },
    { key: 'APP_URL', value: config.auth.appUrl },
    { key: 'OAUTH_SERVER_URL', value: config.auth.oauthUrl },
    { key: 'ENCRYPTION_KEY', value: config.security.encryptionKey },
    { key: 'WEBHOOK_SECRET', value: config.security.webhookSecret }
  ];
  
  // Add SMS configuration
  if (config.sms) {
    if (config.sms.provider === 'telnyx') {
      updates.push(
        { key: 'TELNYX_API_KEY', value: config.sms.apiKey },
        { key: 'TELNYX_FROM_NUMBER', value: config.sms.fromNumber }
      );
    } else if (config.sms.provider === 'twilio') {
      updates.push(
        { key: 'TWILIO_ACCOUNT_SID', value: config.sms.accountSid },
        { key: 'TWILIO_AUTH_TOKEN', value: config.sms.authToken },
        { key: 'TWILIO_FROM_NUMBER', value: config.sms.fromNumber }
      );
    }
  }
  
  // Add email configuration
  if (config.email) {
    if (config.email.provider === 'sendgrid') {
      updates.push(
        { key: 'SENDGRID_API_KEY', value: config.email.apiKey },
        { key: 'EMAIL_FROM_ADDRESS', value: config.email.fromAddress }
      );
    } else if (config.email.provider === 'smtp') {
      updates.push(
        { key: 'SMTP_HOST', value: config.email.host },
        { key: 'SMTP_PORT', value: config.email.port },
        { key: 'SMTP_SECURE', value: config.email.secure.toString() },
        { key: 'SMTP_USER', value: config.email.user },
        { key: 'SMTP_PASS', value: config.email.pass }
      );
    }
  }
  
  // Add Stripe configuration
  if (config.stripe) {
    updates.push(
      { key: 'STRIPE_SECRET_KEY', value: config.stripe.secretKey },
      { key: 'STRIPE_WEBHOOK_SECRET', value: config.stripe.webhookSecret }
    );
  }
  
  // Add Sentry configuration
  if (config.sentry) {
    updates.push({ key: 'SENTRY_DSN', value: config.sentry });
  }
  
  // Apply updates
  for (const update of updates) {
    const index = lines.findIndex(line => line.startsWith(`${update.key}=`));
    if (index >= 0) {
      lines[index] = `${update.key}=${update.value}`;
    } else {
      lines.push(`${update.key}=${update.value}`);
    }
  }
  
  fs.writeFileSync('.env', lines.join('\n'));
  console.log('✅ .env file updated successfully');
}

async function setupDependencies() {
  console.log('\n📦 Installing Dependencies\n');
  
  if (!fs.existsSync('node_modules')) {
    await runCommand('npm install', 'Installing dependencies');
  } else {
    console.log('✅ Dependencies already installed');
  }
  
  if (!fs.existsSync('dist')) {
    await runCommand('npm run build', 'Building application');
  } else {
    console.log('✅ Application already built');
  }
}

async function setupDatabase() {
  console.log('\n🗄️ Setting Up Database\n');
  
  try {
    await runCommand('npm run db:migrate', 'Running database migrations');
    console.log('✅ Database schema updated');
  } catch (error) {
    console.log('⚠️  Migration failed - database might already be set up');
  }
}

async function testConfiguration() {
  console.log('\n🧪 Testing Configuration\n');
  
  console.log('Testing database connection...');
  try {
    await runCommand('curl -s http://localhost:3000/health', 'Testing health endpoint');
  } catch (error) {
    console.log('⚠️  Server not running - start with: npm run dev');
  }
}

async function main() {
  try {
    console.log('🎯 Backend Setup Options:');
    console.log('1. Complete backend setup (all services)');
    console.log('2. Database only');
    console.log('3. Communications only (SMS/Email)');
    console.log('4. Security only');
    console.log('5. Test current configuration');
    
    const option = await ask('\nChoose option (1-5)', '1');
    
    const config = {};
    
    switch (option) {
      case '1':
        // Complete setup
        config.database = await setupDatabase();
        config.auth = await setupAuthentication();
        config.sms = await setupSMS();
        config.email = await setupEmail();
        config.stripe = await setupStripe();
        config.security = await setupSecurity();
        config.sentry = await setupObservability();
        
        await updateEnvFile(config);
        await setupDependencies();
        await setupDatabase();
        await testConfiguration();
        break;
        
      case '2':
        config.database = await setupDatabase();
        await updateEnvFile(config);
        await setupDependencies();
        await setupDatabase();
        break;
        
      case '3':
        config.sms = await setupSMS();
        config.email = await setupEmail();
        await updateEnvFile(config);
        break;
        
      case '4':
        config.auth = await setupAuthentication();
        config.security = await setupSecurity();
        await updateEnvFile(config);
        break;
        
      case '5':
        await testConfiguration();
        break;
        
      default:
        console.log('❌ Invalid option');
        break;
    }
    
    console.log('\n🎉 Backend setup completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Test at: http://localhost:3000/health');
    console.log('3. Check configuration in .env file');
    
    rl.close();
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled by user');
  rl.close();
  process.exit(0);
});

// Run the setup
main();
