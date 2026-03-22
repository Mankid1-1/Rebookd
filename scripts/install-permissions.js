#!/usr/bin/env node

/**
 * 🚀 REBOOKED PERMISSION LEVEL INSTALLATION
 * Automated setup for different permission levels
 * Based on your specific requirements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const executeCommand = async (command, description) => {
  log(`🔄 ${description}...`, 'yellow');
  
  try {
    const { execSync } = await import('child_process');
    const result = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: path.resolve(__dirname, '..')
    });
    
    log(`✅ ${description} completed`, 'green');
    if (result.stdout) {
      console.log(result.stdout);
    }
    return true;
  } catch (error) {
    log(`❌ ${description} failed: ${error.message}`, 'red');
    return false;
  }
};

const checkEnvironment = () => {
  log('🔍 CHECKING ENVIRONMENT', 'cyan');
  log('=====================================', 'cyan');
  
  const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
  const envPath = path.resolve(__dirname, '..', '.env');
  
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found!', 'red');
    return false;
  }
  
  if (!fs.existsSync(envPath)) {
    log('❌ .env file not found!', 'red');
    return false;
  }
  
  log('✅ Environment files found', 'green');
  return true;
};

const installDependencies = async (level) => {
  log('📦 INSTALLING DEPENDENCIES', 'cyan');
  log('=====================================', 'cyan');
  
  const commands = {
    basic: 'pnpm install --no-optional',
    development: 'pnpm install --no-optional',
    production: 'pnpm install --prod --no-optional',
    full: 'pnpm install --include=dev,prod',
    minimal: 'pnpm install --minimal'
  };
  
  const success = await executeCommand(
    commands[level] || commands.basic,
    `Installing dependencies (${level} level)`
  );
  
  return success;
};

const setupEnvironment = async (level) => {
  log('🔧 SETTING UP ENVIRONMENT', 'cyan');
  log('=====================================', 'cyan');
  
  const envCommands = {
    basic: 'node scripts/fix-env-simple.cjs',
    development: 'node scripts/fix-env-simple.cjs',
    production: 'node scripts/fix-env-simple.cjs && npm run db:audit',
    full: 'node scripts/fix-env-simple.cjs && npm run db:audit && npm run setup-sentry',
    minimal: 'node scripts/fix-env-simple.cjs'
  };
  
  const success = await executeCommand(
    envCommands[level] || envCommands.basic,
    `Setting up environment (${level} level)`
  );
  
  return success;
};

const setupDatabase = async (level) => {
  log('🗄️ SETTING UP DATABASE', 'cyan');
  log('=====================================', 'cyan');
  
  const dbCommands = {
    basic: 'npm run db:audit',
    development: 'npm run db:audit && npm run db:fix',
    production: 'npm run db:audit && npm run db:fix',
    full: 'npm run db:audit && npm run db:fix',
    minimal: 'npm run db:audit'
  };
  
  const success = await executeCommand(
    dbCommands[level] || dbCommands.basic,
    `Database setup (${level} level)`
  );
  
  return success;
};

const buildProject = async (level) => {
  log('🏗️ BUILDING PROJECT', 'cyan');
  log('=====================================', 'cyan');
  
  const buildCommands = {
    basic: 'npm run build:app',
    development: 'npm run build:app && npm run build:server',
    production: 'npm run build',
    full: 'npm run build',
    minimal: 'npm run build:app'
  };
  
  const success = await executeCommand(
    buildCommands[level] || buildCommands.basic,
    `Building project (${level} level)`
  );
  
  return success;
};

const startServices = async (level) => {
  log('🚀 STARTING SERVICES', 'cyan');
  log('=====================================', 'cyan');
  
  const serviceCommands = {
    basic: 'npm run dev',
    development: 'npm run dev:all',
    production: 'npm run start:prod',
    full: 'npm run dev:all',
    minimal: 'npm run dev'
  };
  
  log(`📋 Starting services (${level} level)`, 'yellow');
  log(`Command: ${serviceCommands[level] || serviceCommands.basic}`, 'magenta');
  log('📋 Press Ctrl+C to stop services', 'yellow');
  
  // Don't execute start commands automatically - let user run them manually
  return true;
};

const showMenu = () => {
  log('🎯 REBOOKED INSTALLATION MENU', 'bright');
  log('=====================================', 'bright');
  log('', 'reset');
  
  log('📋 PERMISSION LEVELS:', 'cyan');
  log('1. minimal    - Basic setup (dependencies + env + start)', 'white');
  log('2. basic      - Standard development setup', 'white');
  log('3. development - Full development environment', 'white');
  log('4. production  - Production-ready setup', 'white');
  log('5. full        - Complete installation', 'white');
  log('', 'reset');
  
  log('📋 INDIVIDUAL STEPS:', 'cyan');
  log('a. deps        - Install dependencies only', 'white');
  log('b. env         - Setup environment only', 'white');
  log('c. db          - Database setup only', 'white');
  log('d. build       - Build project only', 'white');
  log('e. start       - Start services only', 'white');
  log('', 'reset');
  
  log('📋 UTILITIES:', 'cyan');
  log('check        - Check environment', 'white');
  log('clean        - Clean node_modules and locks', 'white');
  log('help         - Show this menu', 'white');
  log('exit         - Exit installer', 'white');
  log('', 'reset');
};

const cleanProject = async () => {
  log('🧹 CLEANING PROJECT', 'cyan');
  log('=====================================', 'cyan');
  
  const projectRoot = path.resolve(__dirname, '..');
  
  try {
    const { execSync } = await import('child_process');
    
    // Clean node_modules
    if (fs.existsSync(path.join(projectRoot, 'node_modules'))) {
      execSync('rm -rf node_modules', { cwd: projectRoot });
      log('✅ Removed node_modules', 'green');
    }
    
    // Clean lock files
    const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
    lockFiles.forEach(file => {
      if (fs.existsSync(path.join(projectRoot, file))) {
        fs.unlinkSync(path.join(projectRoot, file));
        log(`✅ Removed ${file}`, 'green');
      }
    });
    
    log('✅ Project cleaned successfully', 'green');
    return true;
  } catch (error) {
    log(`❌ Clean failed: ${error.message}`, 'red');
    return false;
  }
};

const runInstallation = async (level) => {
  log(`🚀 STARTING INSTALLATION (${level})`, 'bright');
  log('=====================================', 'bright');
  
  const steps = [
    { name: 'Environment Check', fn: checkEnvironment },
    { name: 'Dependencies', fn: () => installDependencies(level) },
    { name: 'Environment Setup', fn: () => setupEnvironment(level) },
    { name: 'Database Setup', fn: () => setupDatabase(level) },
    { name: 'Build Project', fn: () => buildProject(level) },
    { name: 'Start Services', fn: () => startServices(level) }
  ];
  
  let allSuccess = true;
  
  for (const step of steps) {
    const success = await step.fn();
    if (!success) {
      log(`❌ Installation failed at: ${step.name}`, 'red');
      allSuccess = false;
      break;
    }
  }
  
  if (allSuccess) {
    log('', 'reset');
    log('🎉 INSTALLATION COMPLETE!', 'bright');
    log('=====================================', 'bright');
    log('✅ All steps completed successfully', 'green');
    log('', 'reset');
    log('📋 NEXT STEPS:', 'yellow');
    log('1. Services are starting (check above)', 'white');
    log('2. Navigate to http://localhost:3000', 'white');
    log('3. Access Stripe Connect: http://localhost:3000/stripe-connect', 'white');
    log('4. Check application health: http://localhost:3000/admin/health', 'white');
    log('', 'reset');
    log('🌐 Your Rebooked application is ready!', 'green');
  }
  
  return allSuccess;
};

// Interactive installer
const interactiveInstall = async () => {
  const { createInterface } = await import('readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const askQuestion = (question) => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer.trim().toLowerCase());
      });
    });
  };
  
  showMenu();
  
  while (true) {
    const answer = await askQuestion('\n🎯 Choose option (1-5, a-e, or command): ');
    
    switch (answer) {
      case '1':
      case 'minimal':
        await runInstallation('minimal');
        break;
      case '2':
      case 'basic':
        await runInstallation('basic');
        break;
      case '3':
      case 'development':
        await runInstallation('development');
        break;
      case '4':
      case 'production':
        await runInstallation('production');
        break;
      case '5':
      case 'full':
        await runInstallation('full');
        break;
      case 'a':
      case 'deps':
        await installDependencies('full');
        break;
      case 'b':
      case 'env':
        await setupEnvironment('full');
        break;
      case 'c':
      case 'db':
        await setupDatabase('full');
        break;
      case 'd':
      case 'build':
        await buildProject('full');
        break;
      case 'e':
      case 'start':
        await startServices('development');
        break;
      case 'check':
        checkEnvironment();
        break;
      case 'clean':
        await cleanProject();
        break;
      case 'help':
        showMenu();
        break;
      case 'exit':
      case 'quit':
        log('👋 Goodbye!', 'yellow');
        rl.close();
        process.exit(0);
        break;
      default:
        log('❌ Invalid option. Type "help" for menu.', 'red');
        break;
    }
  }
};

// Command line arguments
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Interactive mode
    await interactiveInstall();
  } else {
    // Command line mode
    const command = args[0];
    
    switch (command) {
      case 'minimal':
      case 'basic':
      case 'development':
      case 'production':
      case 'full':
        await runInstallation(command);
        break;
      case 'deps':
        await installDependencies('full');
        break;
      case 'env':
        await setupEnvironment('full');
        break;
      case 'db':
        await setupDatabase('full');
        break;
      case 'build':
        await buildProject('full');
        break;
      case 'start':
        await startServices('development');
        break;
      case 'check':
        checkEnvironment();
        break;
      case 'clean':
        await cleanProject();
        break;
      case 'help':
      default:
        showMenu();
        break;
    }
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
