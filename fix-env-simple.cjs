#!/usr/bin/env node

/**
 * 🚀 REBOOKED ENVIRONMENT FIX (Simple Version)
 * Run from project root: node fix-env-simple.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Colors for console output
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

const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

const generateJwtSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

const fixEnvironment = () => {
  try {
    log('🚀 REBOOKED ENVIRONMENT FIX', 'bright');
    log('=====================================', 'bright');
    
    const projectRoot = process.cwd();
    const envFile = path.join(projectRoot, '.env');
    const envExample = path.join(projectRoot, '.env.example');
    
    log(`🔍 Current directory: ${projectRoot}`, 'cyan');
    log(`🔍 Looking for .env.example at: ${envExample}`, 'cyan');
    
    // Check if .env.example exists
    if (!fs.existsSync(envExample)) {
      log(`❌ .env.example file not found!`, 'red');
      log('Please run this script from the project root directory.', 'yellow');
      log('Project root should contain the .env.example file.', 'yellow');
      
      // Show available files
      try {
        const files = fs.readdirSync(projectRoot);
        log('Files in current directory:', 'yellow');
        files.slice(0, 10).forEach(file => {
          if (file.includes('.env') || file === 'package.json') {
            log(`  ${file}`, file.includes('.env') ? 'green' : 'white');
          }
        });
      } catch (error) {
        log(`Could not list directory: ${error.message}`, 'red');
      }
      
      process.exit(1);
    }
    
    // Read or create .env file
    let content;
    if (fs.existsSync(envFile)) {
      content = fs.readFileSync(envFile, 'utf8');
      log('✅ Found existing .env file', 'green');
    } else {
      content = fs.readFileSync(envExample, 'utf8');
      fs.writeFileSync(envFile, content);
      log('✅ Created .env file from example', 'green');
    }
    
    const updates = [];
    
    // Check and add ENCRYPTION_KEY
    if (!content.includes('ENCRYPTION_KEY=') || content.includes('ENCRYPTION_KEY=')) {
      const match = content.match(/ENCRYPTION_KEY=(.*)/);
      if (!match || !match[1] || match[1].trim() === '') {
        const encryptionKey = generateEncryptionKey();
        content = content.replace(/ENCRYPTION_KEY=.*/, `ENCRYPTION_KEY=${encryptionKey}`);
        updates.push('ENCRYPTION_KEY');
      }
    }
    
    // Check and add JWT_SECRET
    if (!content.includes('JWT_SECRET=') || content.includes('JWT_SECRET=replace-with-a-long-random-secret')) {
      const jwtSecret = generateJwtSecret();
      content = content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
      updates.push('JWT_SECRET');
    }
    
    // Add other essential variables if missing
    const essentialVars = {
      'DATABASE_URL': 'mysql://root:password@localhost:3306/rebooked',
      'VITE_APP_ID': 'rebooked',
      'OAUTH_SERVER_URL': 'http://localhost:3000',
      'VITE_OAUTH_PORTAL_URL': 'http://localhost:3000',
      'OWNER_OPEN_ID': 'dev-owner-' + crypto.randomBytes(8).toString('hex'),
      'APP_URL': 'http://localhost:3000'
    };
    
    for (const [key, defaultValue] of Object.entries(essentialVars)) {
      if (!content.includes(`${key}=`)) {
        content += `\n${key}=${defaultValue}\n`;
        updates.push(key);
      }
    }
    
    // Write updated content
    fs.writeFileSync(envFile, content);
    
    if (updates.length > 0) {
      log(`✅ Updated environment variables:`, 'green');
      updates.forEach(update => {
        log(`  ✓ ${update}`, 'green');
      });
    } else {
      log('✅ All environment variables are already set!', 'green');
    }
    
    log('', 'reset');
    log('🎉 ENVIRONMENT FIX COMPLETE!', 'bright');
    log('=====================================', 'bright');
    log('✅ Your .env file is now ready for development!', 'green');
    log('', 'reset');
    log('Next steps:', 'yellow');
    log('1. Restart your server with: npm run dev', 'white');
    log('2. Or run: ./quick-start', 'white');
    log('3. Server will be available at: http://localhost:3000', 'white');
    log('', 'reset');
    log('🌐 Your Rebooked application should start successfully now!', 'green');
    
  } catch (error) {
    log(`❌ ENVIRONMENT FIX FAILED: ${error.message}`, 'red');
    log('Please check the error above and try again.', 'red');
    process.exit(1);
  }
};

// Run the fix
fixEnvironment();
