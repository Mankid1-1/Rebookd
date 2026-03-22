#!/usr/bin/env node

/**
 * 🚀 REBOOKED ENVIRONMENT FIX SCRIPT (CommonJS Version)
 * Fixes missing environment variables for smooth startup
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class EnvFixer {
  constructor() {
    // Get the project root by going up from scripts directory
    this.projectRoot = path.resolve(__dirname, '..');
    this.envFile = path.join(this.projectRoot, '.env');
    this.envExample = path.join(this.projectRoot, '.env.example');
    
    // Colors for console output
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      cyan: '\x1b[36m'
    };
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  generateEncryptionKey() {
    // Generate 64 hex chars (32 bytes) for encryption
    return crypto.randomBytes(32).toString('hex');
  }

  generateJwtSecret() {
    // Generate 32+ character random string for JWT
    return crypto.randomBytes(32).toString('hex');
  }

  readEnvFile() {
    this.log(`🔍 Looking for files in: ${this.projectRoot}`, 'cyan');
    this.log(`🔍 .env path: ${this.envFile}`, 'cyan');
    this.log(`� .env.example path: ${this.envExample}`, 'cyan');
    
    if (!fs.existsSync(this.envExample)) {
      this.log(`❌ .env.example file not found at: ${this.envExample}`, 'red');
      this.log('Available files in project root:', 'yellow');
      
      try {
        const files = fs.readdirSync(this.projectRoot);
        files.forEach(file => {
          if (file.includes('.env')) {
            this.log(`  Found: ${file}`, 'green');
          }
        });
      } catch (error) {
        this.log(`Could not list directory: ${error.message}`, 'red');
      }
      
      process.exit(1);
    }
    
    if (!fs.existsSync(this.envFile)) {
      this.log('📝 Creating .env file from example...', 'yellow');
      fs.copyFileSync(this.envExample, this.envFile);
      this.log('✅ .env file created from example', 'green');
    }

    return fs.readFileSync(this.envFile, 'utf8');
  }

  updateEnvFile(content) {
    const updates = [];

    // Check and add ENCRYPTION_KEY
    if (!content.includes('ENCRYPTION_KEY=')) {
      const encryptionKey = this.generateEncryptionKey();
      content += `\n# Generated encryption key for PII encryption\nENCRYPTION_KEY=${encryptionKey}\n`;
      updates.push('ENCRYPTION_KEY');
    } else if (content.includes('ENCRYPTION_KEY=')) {
      const match = content.match(/ENCRYPTION_KEY=(.*)/);
      if (match && (!match[1] || match[1].trim() === '')) {
        const encryptionKey = this.generateEncryptionKey();
        content = content.replace(/ENCRYPTION_KEY=.*/, `ENCRYPTION_KEY=${encryptionKey}`);
        updates.push('ENCRYPTION_KEY (updated)');
      }
    }

    // Check and add JWT_SECRET
    if (!content.includes('JWT_SECRET=') || content.includes('JWT_SECRET=replace-with-a-long-random-secret')) {
      const jwtSecret = this.generateJwtSecret();
      content = content.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
      updates.push('JWT_SECRET');
    }

    // Check and add other essential variables
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
    fs.writeFileSync(this.envFile, content);
    
    return updates;
  }

  async fix() {
    try {
      this.log('🚀 REBOOKED ENVIRONMENT FIX', 'bright');
      this.log('=====================================', 'bright');
      
      // Check if .env exists and read it
      const content = this.readEnvFile();
      
      // Update environment file
      const updates = this.updateEnvFile(content);
      
      if (updates.length > 0) {
        this.log(`✅ Updated environment variables:`, 'green');
        updates.forEach(update => {
          this.log(`  ✓ ${update}`, 'green');
        });
      } else {
        this.log('✅ All environment variables are already set!', 'green');
      }
      
      this.log('', 'reset');
      this.log('🎉 ENVIRONMENT FIX COMPLETE!', 'bright');
      this.log('=====================================', 'bright');
      this.log('✅ Your .env file is now ready for development!', 'green');
      this.log('', 'reset');
      this.log('Next steps:', 'yellow');
      this.log('1. Restart your server with: npm run dev', 'white');
      this.log('2. Or run: ./quick-start', 'white');
      this.log('3. Server will be available at: http://localhost:3000', 'white');
      this.log('', 'reset');
      this.log('🌐 Your Rebooked application should start successfully now!', 'green');
      
    } catch (error) {
      this.log(`❌ ENVIRONMENT FIX FAILED: ${error.message}`, 'red');
      this.log('Please check the error above and try again.', 'red');
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const fixer = new EnvFixer();
  fixer.fix().catch(console.error);
}

module.exports = EnvFixer;
