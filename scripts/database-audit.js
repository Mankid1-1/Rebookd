#!/usr/bin/env node

/**
 * 🚀 REBOOKED DATABASE AUDIT & FIX (Node.js Version)
 * Complete database health check and repair for smooth sailing
 * Cross-platform compatibility (Windows, Mac, Linux)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const mysql = require('mysql2/promise');

class DatabaseAudit {
  constructor() {
    this.projectRoot = process.cwd();
    this.sqlFile = path.join(this.projectRoot, 'scripts', 'database-audit-fix.sql');
    
    // Colors for console output
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m'
    };
  }

  log(message, color = 'reset') {
    console.log(`${this.colors[color]}${message}${this.colors.reset}`);
  }

  async getDatabaseCredentials() {
    this.log('📋 DATABASE CONNECTION REQUIRED', 'cyan');
    this.log('Please provide your MySQL database credentials:', 'yellow');

    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt, defaultValue = '') => {
      return new Promise((resolve) => {
        rl.question(prompt + (defaultValue ? ` (${defaultValue}): ` : ': '), (answer) => {
          resolve(answer || defaultValue);
        });
      });
    };

    const questionPassword = (prompt) => {
      return new Promise((resolve) => {
        // Hide password input
        const stdin = process.stdin;
        stdin.setRawMode(true);
        
        let password = '';
        process.stdout.write(prompt + ': ');
        
        stdin.on('data', (char) => {
          char = char.toString();
          switch (char) {
            case '\n':
            case '\r':
            case '\u0004': // Ctrl+D
              stdin.setRawMode(false);
              stdin.removeAllListeners('data');
              console.log();
              rl.close();
              resolve(password);
              break;
            case '\u0003': // Ctrl+C
              console.log();
              process.exit(0);
              break;
            case '\u007F': // Backspace
              if (password.length > 0) {
                password = password.slice(0, -1);
                process.stdout.write('\b \b');
              }
              break;
            default:
              password += char;
              process.stdout.write('*');
              break;
          }
        });
      });
    };

    const credentials = {
      host: await question('Database Host', 'localhost'),
      port: await question('Database Port', '3306'),
      database: await question('Database Name', 'rebooked'),
      user: await question('Database Username', 'root'),
      password: await questionPassword('Database Password')
    };

    return credentials;
  }

  async testConnection(credentials) {
    this.log('🔍 TESTING DATABASE CONNECTION...', 'cyan');
    
    try {
      const connection = await mysql.createConnection(credentials);
      await connection.ping();
      await connection.end();
      
      this.log('✅ Database connection successful', 'green');
      return true;
    } catch (error) {
      this.log(`❌ Database connection failed: ${error.message}`, 'red');
      this.log('Please check your credentials and try again', 'yellow');
      return false;
    }
  }

  async createDatabase(credentials) {
    this.log('🗄️ ENSURING DATABASE EXISTS...', 'cyan');
    
    try {
      const connection = await mysql.createConnection(credentials);
      
      // Create database if it doesn't exist
      await connection.execute(`
        CREATE DATABASE IF NOT EXISTS \`${credentials.database}\` 
        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);
      
      await connection.end();
      this.log('✅ Database ensured', 'green');
    } catch (error) {
      this.log(`❌ Database creation failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async runSqlScript(credentials) {
    this.log('🔧 RUNNING DATABASE AUDIT AND FIX...', 'cyan');
    this.log('This may take a few minutes...', 'yellow');
    
    try {
      // Read SQL file
      const sqlContent = fs.readFileSync(this.sqlFile, 'utf8');
      
      // Split into individual statements
      const statements = sqlContent
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      const connection = await mysql.createConnection(credentials);
      
      // Execute statements in batches
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        
        if (statement.trim()) {
          try {
            await connection.execute(statement);
            
            // Progress indicator
            const progress = Math.round(((i + 1) / statements.length) * 100);
            process.stdout.write(`\r${this.colors.blue}Progress: ${progress}%${this.colors.reset}`);
          } catch (error) {
            // Some statements might fail due to existing constraints, that's okay
            if (!error.message.includes('already exists') && 
                !error.message.includes('Duplicate entry') &&
                !error.message.includes('Check that column') &&
                !error.message.includes('Foreign key constraint')) {
              throw error;
            }
          }
        }
      }
      
      await connection.end();
      console.log(); // New line after progress
      
      this.log('✅ Database audit and fix completed successfully!', 'green');
    } catch (error) {
      this.log(`❌ Database audit and fix failed: ${error.message}`, 'red');
      throw error;
    }
  }

  async getDatabaseStats(credentials) {
    this.log('📊 DATABASE STATISTICS:', 'cyan');
    
    try {
      const connection = await mysql.createConnection(credentials);
      
      const [stats] = await connection.execute(`
        SELECT 
          'Tables' as Metric,
          COUNT(*) as Count
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ?
        
        UNION ALL
        
        SELECT 
          'Foreign Keys' as Metric,
          COUNT(*) as Count
        FROM information_schema.TABLE_CONSTRAINTS 
        WHERE TABLE_SCHEMA = ? 
        AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        
        UNION ALL
        
        SELECT 
          'Plans Seeded' as Metric,
          COUNT(*) as Count
        FROM plans
        
        UNION ALL
        
        SELECT 
          'Total Size (MB)' as Metric,
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as Count
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = ?
      `, [credentials.database, credentials.database, credentials.database]);
      
      await connection.end();
      
      stats.forEach(row => {
        this.log(`  ${row.Metric}: ${row.Count}`, 'green');
      });
      
      return stats;
    } catch (error) {
      this.log(`⚠ Could not retrieve statistics: ${error.message}`, 'yellow');
      return [];
    }
  }

  async run() {
    try {
      this.log('🚀 REBOOKED DATABASE AUDIT & FIX', 'bright');
      this.log('=====================================', 'bright');
      
      // Check if SQL file exists
      if (!fs.existsSync(this.sqlFile)) {
        this.log(`❌ SQL file not found: ${this.sqlFile}`, 'red');
        process.exit(1);
      }
      
      // Get database credentials
      const credentials = await this.getDatabaseCredentials();
      
      // Test connection
      const connected = await this.testConnection(credentials);
      if (!connected) {
        process.exit(1);
      }
      
      // Create database if needed
      await this.createDatabase(credentials);
      
      // Run SQL script
      await this.runSqlScript(credentials);
      
      // Show statistics
      await this.getDatabaseStats(credentials);
      
      this.log('🎉 DATABASE AUDIT AND FIX COMPLETE!', 'bright');
      this.log('=====================================', 'bright');
      this.log('✅ Your Rebooked database is now optimized and ready for smooth sailing!', 'green');
      this.log('', 'reset');
      this.log('Next steps:', 'yellow');
      this.log('1. Update your application\'s database connection string', 'white');
      this.log('2. Run your application migrations if needed', 'white');
      this.log('3. Test your application functionality', 'white');
      this.log('', 'reset');
      this.log('🌐 Your database is ready for production!', 'green');
      
    } catch (error) {
      this.log(`❌ SETUP FAILED: ${error.message}`, 'red');
      this.log('Please check the error above and try again.', 'red');
      process.exit(1);
    }
  }
}

// Check if mysql2 is available
try {
  require('mysql2');
} catch (error) {
  console.log('❌ Error: mysql2 package not found');
  console.log('Please install it with: npm install mysql2');
  process.exit(1);
}

// Run if called directly
if (require.main === module) {
  const audit = new DatabaseAudit();
  audit.run().catch(console.error);
}

module.exports = DatabaseAudit;
