#!/usr/bin/env node

/**
 * Database Setup Helper
 * 
 * This script helps you configure your database connection.
 * Run it with: node setup-database.js
 */

const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🗄️  Database Connection Setup\n');
console.log('This will help you configure your DATABASE_URL in the .env file\n');

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function setupDatabase() {
  try {
    // Get database connection details
    const username = await ask('Enter database username (e.g., root): ');
    const password = await ask('Enter database password: ');
    const host = await ask('Enter database host (e.g., localhost, 192.168.1.100): ');
    const port = await ask('Enter database port (default 3306): ') || '3306';
    const database = await ask('Enter database name (e.g., rebooked): ') || 'rebooked';

    // Construct DATABASE_URL
    const databaseUrl = `mysql://${username}:${password}@${host}:${port}/${database}`;
    
    console.log('\n📋 Your DATABASE_URL will be:');
    console.log(databaseUrl);
    console.log('');

    const confirm = await ask('Is this correct? (y/n): ');
    
    if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
      // Read existing .env file
      let envContent = '';
      try {
        envContent = fs.readFileSync('.env', 'utf8');
      } catch (error) {
        console.log('No existing .env file found, creating new one...');
        envContent = fs.readFileSync('.env.example', 'utf8');
      }

      // Update DATABASE_URL
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

      // Write back to .env file
      fs.writeFileSync('.env', lines.join('\n'));
      
      console.log('✅ DATABASE_URL updated in .env file!');
      console.log('\n🚀 Next steps:');
      console.log('1. Restart the server: npm run dev');
      console.log('2. Check health: curl http://localhost:3001/health');
      console.log('3. Run migrations if needed: npm run db:migrate');
      
    } else {
      console.log('❌ Setup cancelled. No changes made.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run the setup
setupDatabase();
