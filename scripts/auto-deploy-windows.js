#!/usr/bin/env node

/**
 * 🚀 COMPREHENSIVE AUTO-DEPLOY SCRIPT - WINDOWS VERSION
 * Handles complete deployment from rebooked.zip to production-ready system
 * Supports Windows development with remote Linux deployment
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  zipName: 'rebooked.zip',
  deployDir: './deploy-temp',
  appDir: './rebooked-app',
  // Remote server configuration
  remoteHost: process.env.REMOTE_HOST || 'your-server.com',
  remoteUser: process.env.REMOTE_USER || 'root',
  remotePath: process.env.REMOTE_PATH || '/root/rebooked',
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || 5432,
  dbName: process.env.DB_NAME || 'rebooked',
  dbUser: process.env.DB_USER || 'rebooked_user',
  dbPassword: process.env.DB_PASSWORD || 'secure_password_here',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@rebooked.org',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123!',
  domain: process.env.DOMAIN || 'rebooked.org',
  sslEmail: process.env.SSL_EMAIL || 'admin@rebooked.org'
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n📍 Step ${step}: ${message}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function runCommand(command, description, cwd = process.cwd()) {
  logInfo(`Running: ${description}`);
  try {
    const result = execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8',
      shell: true
    });
    logSuccess(`Command completed: ${description}`);
    return result;
  } catch (error) {
    logError(`Command failed: ${description} - ${error.message}`);
    throw error;
  }
}

function runRemoteCommand(command, description) {
  logInfo(`Running on remote server: ${description}`);
  try {
    const fullCommand = `ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "${command}"`;
    const result = execSync(fullCommand, { 
      stdio: 'inherit',
      encoding: 'utf8',
      shell: true
    });
    logSuccess(`Remote command completed: ${description}`);
    return result;
  } catch (error) {
    logError(`Remote command failed: ${description} - ${error.message}`);
    throw error;
  }
}

async function uploadFile(localPath, remotePath) {
  logInfo(`Uploading: ${localPath} -> ${remotePath}`);
  try {
    runCommand(`scp "${localPath}" "${CONFIG.remoteUser}@${CONFIG.remoteHost}:${remotePath}"`, 'Upload file');
    logSuccess(`File uploaded: ${localPath}`);
  } catch (error) {
    logError(`File upload failed: ${error.message}`);
    throw error;
  }
}

async function askQuestion(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function checkSystem() {
  logStep(1, 'System Requirements Check');
  
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    logInfo(`Node.js version: ${nodeVersion}`);
    
    // Check if running on Windows
    logInfo('Windows system detected - will deploy to remote Linux server');
    
    // Check if rebooked.zip exists
    if (!await fs.access(CONFIG.zipName).then(() => true).catch(() => false)) {
      throw new Error(`${CONFIG.zipName} not found in current directory`);
    }
    
    logSuccess('Local system check passed');
  } catch (error) {
    logError(`System check failed: ${error.message}`);
    throw error;
  }
}

async function extractZip() {
  logStep(2, 'Extract Application from rebooked.zip');
  
  try {
    // Clean up any existing temporary directory
    if (await fs.access(CONFIG.deployDir).then(() => true).catch(() => false)) {
      runCommand(`rmdir /s /q "${CONFIG.deployDir}"`, 'Remove existing temp directory');
    }
    
    // Create temporary directory
    await fs.mkdir(CONFIG.deployDir, { recursive: true });
    
    // Extract zip file using Windows command
    runCommand(`powershell -Command "Expand-Archive -Path '${CONFIG.zipName}' -DestinationPath '${CONFIG.deployDir}' -Force"`, 'Extract zip file');
    
    // Check if extraction was successful
    const extractedFiles = await fs.readdir(CONFIG.deployDir);
    if (extractedFiles.length === 0) {
      throw new Error('Zip extraction failed - no files found');
    }
    
    logSuccess(`Extracted ${extractedFiles.length} files from zip`);
  } catch (error) {
    logError(`Extraction failed: ${error.message}`);
    throw error;
  }
}

async function setupRemoteServer() {
  logStep(3, 'Setup Remote Server Environment');
  
  try {
    // Create remote directory
    runRemoteCommand(`mkdir -p ${CONFIG.remotePath}`, 'Create remote directory');
    
    // Upload the deployment script
    await uploadFile('./scripts/auto-deploy.js', `${CONFIG.remotePath}/auto-deploy.js`);
    await uploadFile(CONFIG.zipName, `${CONFIG.remotePath}/rebooked.zip`);
    
    logSuccess('Remote server setup completed');
  } catch (error) {
    logError(`Remote server setup failed: ${error.message}`);
    throw error;
  }
}

async function deployToRemote() {
  logStep(4, 'Deploy Application to Remote Server');
  
  try {
    // Run deployment on remote server
    const deployCommand = `
      cd ${CONFIG.remotePath} && 
      chmod +x auto-deploy.js && 
      node auto-deploy.js
    `;
    
    runRemoteCommand(deployCommand, 'Execute remote deployment');
    
    logSuccess('Remote deployment completed');
  } catch (error) {
    logError(`Remote deployment failed: ${error.message}`);
    throw error;
  }
}

async function testRemoteConnection() {
  logStep(5, 'Test Remote Connection');
  
  try {
    runRemoteCommand('echo "Connection test successful"', 'Test SSH connection');
    logSuccess('Remote connection test passed');
  } catch (error) {
    logError(`Remote connection test failed: ${error.message}`);
    throw error;
  }
}

async function generateDeploymentReport() {
  logStep(6, 'Generate Deployment Report');
  
  const report = `
🎉 REBOOKED WINDOWS DEPLOYMENT REPORT
=====================================

📅 Deployment Date: ${new Date().toISOString()}
🌐 Remote Server: ${CONFIG.remoteHost}
👤 Remote User: ${CONFIG.remoteUser}
📁 Remote Path: ${CONFIG.remotePath}
🗄️  Database: PostgreSQL on ${CONFIG.dbHost}:${CONFIG.dbPort}
🔒 SSL: Let's Encrypt certificate
🌐 Web Server: Nginx with reverse proxy
⚙️  Process Manager: Systemd

📊 ACCESS INFORMATION:
------------------
Admin Panel: https://${CONFIG.domain}/admin
API Endpoint: https://${CONFIG.domain}/api
Database: ${CONFIG.dbHost}:${CONFIG.dbPort}

🔑 ADMIN CREDENTIALS:
------------------
Email: ${CONFIG.adminEmail}
Password: ${CONFIG.adminPassword}

📋 NEXT STEPS:
---------------
1. Access admin panel at https://${CONFIG.domain}/admin
2. Login with admin credentials
3. Configure your business settings
4. Test all functionality
5. Setup backup procedures

🔧 REMOTE MANAGEMENT COMMANDS:
--------------------------------
View logs: ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "journalctl -u rebooked -f"
Restart app: ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "systemctl restart rebooked"
Check status: ssh ${CONFIG.remoteUser}@${CONFIG.remoteHost} "systemctl status rebooked"

⚠️  SECURITY NOTES:
------------------
1. Change default admin password immediately
2. Setup regular database backups
3. Monitor SSL certificate renewal
4. Review firewall rules regularly
5. Keep system updated

=====================================
Windows deployment completed successfully! 🚀
`;
  
  console.log(report);
  
  // Save report to file
  await fs.writeFile('./windows-deployment-report.txt', report);
  logSuccess('Deployment report saved to windows-deployment-report.txt');
}

async function cleanup() {
  logInfo('Cleaning up temporary files...');
  try {
    if (await fs.access(CONFIG.deployDir).then(() => true).catch(() => false)) {
      runCommand(`rmdir /s /q "${CONFIG.deployDir}"`, 'Clean up temp directory');
    }
  } catch (error) {
    logWarning(`Cleanup failed: ${error.message}`);
  }
}

// Main deployment function
async function main() {
  console.log(`${colors.bright}${colors.cyan}
🚀 REBOOKED WINDOWS AUTO-DEPLOYMENT SCRIPT 🚀
===============================================
This script will deploy rebooked.zip from Windows to a remote Linux server
including database, SSL, web server, and monitoring setup.
===============================================${colors.reset}
  `);

  try {
    // Get remote server info if not configured
    if (CONFIG.remoteHost === 'your-server.com') {
      logInfo('Please provide remote server information:');
      CONFIG.remoteHost = await askQuestion('Remote server hostname or IP: ');
      CONFIG.remoteUser = await askQuestion('Remote username (default: root): ') || 'root';
      CONFIG.remotePath = await askQuestion('Remote deployment path (default: /root/rebooked): ') || '/root/rebooked';
    }

    await checkSystem();
    await extractZip();
    await testRemoteConnection();
    await setupRemoteServer();
    await deployToRemote();
    await generateDeploymentReport();
    await cleanup();
    
    logSuccess('\n🎉 WINDOWS DEPLOYMENT COMPLETED SUCCESSFULLY!');
    logInfo('Your Rebooked application is now running on the remote server.');
    
  } catch (error) {
    logError(`\n💥 DEPLOYMENT FAILED: ${error.message}`);
    logInfo('Please check the error above and try again.');
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', () => {
  logWarning('\n⚠️  Deployment interrupted by user');
  cleanup();
  process.exit(1);
});

process.on('SIGTERM', () => {
  logWarning('\n⚠️  Deployment terminated');
  cleanup();
  process.exit(1);
});

// Run main function
if (import.meta.url) {
  // Running as ES module
  main().catch(console.error);
} else {
  // Running as CommonJS
  require.main === module && main().catch(console.error);
}
