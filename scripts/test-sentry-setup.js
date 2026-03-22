#!/usr/bin/env node

console.log('🚀 SENTRY SETUP TEST');
console.log('=====================================');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ ES modules imported successfully');

const projectRoot = path.resolve(__dirname, '..');
console.log(`📁 Project root: ${projectRoot}`);

const packageJsonPath = path.join(projectRoot, 'package.json');
console.log(`📄 Package.json path: ${packageJsonPath}`);

if (fs.existsSync(packageJsonPath)) {
  console.log('✅ package.json found');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('✅ package.json parsed successfully');
    console.log(`📦 Project name: ${packageJson.name}`);
    console.log(`📦 Project version: ${packageJson.version}`);
    
    // Check if Sentry dependencies exist
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }
    
    const sentryDeps = {
      '@sentry/node': '^8.0.0',
      '@sentry/tracing': '^7.80.0',
      '@sentry/react': '^7.80.0'
    };
    
    let addedDeps = [];
    Object.entries(sentryDeps).forEach(([name, version]) => {
      if (!packageJson.dependencies[name]) {
        packageJson.dependencies[name] = version;
        addedDeps.push(name);
      }
    });
    
    if (addedDeps.length > 0) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`✅ Added dependencies: ${addedDeps.join(', ')}`);
    } else {
      console.log('✅ All Sentry dependencies already exist');
    }
    
    // Check .env file
    const envFilePath = path.join(projectRoot, '.env');
    const sentryDsn = 'https://453e71c19f8e1bc6d6de07f366260a32@o4511089469947904.ingest.us.sentry.io/4511089470930944';
    
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, 'utf8');
      
      if (!envContent.includes('SENTRY_DSN=')) {
        fs.appendFileSync(envFilePath, `\n# Sentry DSN (Provided)\nSENTRY_DSN=${sentryDsn}\n`);
        console.log('✅ Added Sentry DSN to .env file');
      } else {
        console.log('✅ Sentry DSN already exists in .env file');
      }
    } else {
      console.log('⚠️ .env file not found, will be created by other scripts');
    }
    
    console.log('');
    console.log('🎉 SENTRY SETUP COMPLETE!');
    console.log('=====================================');
    console.log('✅ Sentry dependencies configured');
    console.log('✅ Sentry DSN configured');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Start development: npm run dev');
    console.log('');
    console.log('🌐 Your application will now report errors to Sentry!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
} else {
  console.error('❌ package.json not found!');
}
