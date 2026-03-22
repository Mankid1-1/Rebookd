#!/usr/bin/env node

/**
 * 🚀 Complete Setup Automation for Rebooked
 * 
 * This script handles all setup tasks in one go:
 * - Database configuration
 * - Environment setup
 * - Dependencies installation
 * - Database migrations
 * - Server startup
 * 
 * Run with: node setup.js
 */

import fs from 'fs';
import readline from 'readline';
import { spawn, exec } from 'child_process';
import path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Complete Rebooked Setup\n');
console.log('This will configure everything needed to run the application\n');

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
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
        console.log(`❌ ${description} failed`);
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.log(`❌ ${description} error:`, error.message);
      reject(error);
    });
  });
}

async function setupDatabase() {
  console.log('\n📋 Database Configuration\n');
  
  const username = await ask('Database username (default: root): ') || 'root';
  const password = await ask('Database password: ');
  const host = await ask('Database host (default: localhost): ') || 'localhost';
  const port = await ask('Database port (default: 3306): ') || '3306';
  const database = await ask('Database name (default: rebooked): ') || 'rebooked';
  
  const databaseUrl = `mysql://${username}:${password}@${host}:${port}/${database}`;
  
  console.log('\n📋 Your DATABASE_URL:');
  console.log(databaseUrl);
  
  const confirm = await ask('\nIs this correct? (y/n): ');
  
  if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
    // Update .env file
    let envContent = '';
    try {
      envContent = fs.readFileSync('.env', 'utf8');
    } catch (error) {
      console.log('Creating new .env file from template...');
      envContent = fs.readFileSync('.env.example', 'utf8');
    }
    
    const lines = envContent.split('\n');
    let updated = false;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('DATABASE_URL=')) {
        lines[i] = `DATABASE_URL=${databaseUrl}`;
        updated = true;
        break;
      }
    }
    
    if (!updated) {
      lines.unshift(`DATABASE_URL=${databaseUrl}`);
    }
    
    fs.writeFileSync('.env', lines.join('\n'));
    console.log('✅ DATABASE_URL updated in .env file');
    return true;
  }
  
  return false;
}

async function checkDependencies() {
  console.log('\n📦 Checking Dependencies\n');
  
  // Check if node_modules exists
  if (!fs.existsSync('node_modules')) {
    console.log('📦 Installing dependencies...');
    await runCommand('npm install', 'Installing dependencies');
  } else {
    console.log('✅ Dependencies already installed');
  }
  
  // Check if dist directory exists
  if (!fs.existsSync('dist')) {
    console.log('🔨 Building application...');
    await runCommand('npm run build', 'Building application');
  } else {
    console.log('✅ Application already built');
  }
}

async function setupDatabaseSchema() {
  console.log('\n🗄️ Database Schema Setup\n');
  
  try {
    await runCommand('npm run db:migrate', 'Running database migrations');
    console.log('✅ Database schema updated');
  } catch (error) {
    console.log('⚠️  Migration failed - this might be okay if database is already set up');
  }
}

async function startServer() {
  console.log('\n🚀 Starting Server\n');
  
  console.log('Starting the development server...');
  console.log('The server will be available at: http://localhost:3000');
  console.log('Press Ctrl+C to stop the server\n');
  
  const server = spawn('npm', ['run', 'dev'], { 
    stdio: 'inherit',
    shell: true 
  });
  
  server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
  });
  
  // Don't close readline interface so server can continue running
  return server;
}

async function main() {
  try {
    console.log('🎯 Setup Options:');
    console.log('1. Complete setup (database + dependencies + server)');
    console.log('2. Database configuration only');
    console.log('3. Dependencies only');
    console.log('4. Start server only');
    
    const option = await ask('\nChoose option (1-4): ');
    
    switch (option) {
      case '1':
        // Complete setup
        const dbConfigured = await setupDatabase();
        if (dbConfigured) {
          await checkDependencies();
          await setupDatabaseSchema();
          await startServer();
        }
        break;
        
      case '2':
        await setupDatabase();
        break;
        
      case '3':
        await checkDependencies();
        break;
        
      case '4':
        await startServer();
        break;
        
      default:
        console.log('❌ Invalid option');
        break;
    }
    
    if (option !== '4') {
      rl.close();
    }
    
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
