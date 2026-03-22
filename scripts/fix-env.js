#!/usr/bin/env node

/**
 * 🚀 REBOOKED ENVIRONMENT FIX SCRIPT
 * Fixes missing environment variables for smooth startup
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnvFixer {
  constructor() {
    this.projectRoot = process.cwd();
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
    if (!fs.existsSync(this.envFile)) {
      this.log('📝 Creating .env file from example...', 'yellow');
      
      if (fs.existsSync(this.envExample)) {
        fs.copyFileSync(this.envExample, this.envFile);
        this.log('✅ .env file created from example', 'green');
      } else {
        this.log('❌ .env.example file not found!', 'red');
        process.exit(1);
      }
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new EnvFixer();
  fixer.fix().catch(console.error);
}

export default EnvFixer;
