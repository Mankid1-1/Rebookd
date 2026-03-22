#!/usr/bin/env node

/**
 * 🚀 REBOOKED SERVER SETUP SCRIPT
 * 
 * Automatically organizes project from zip file and sets up complete server
 * Takes into account existing folders: public_html, private_html, logs, stats
 * Runs entire project back-to-back with full functionality
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');
const extract = require('extract-zip');

class ServerSetup {
  constructor() {
    this.projectRoot = process.cwd();
    this.publicHtml = path.join(this.projectRoot, 'public_html');
    this.privateHtml = path.join(this.projectRoot, 'private_html');
    this.logs = path.join(this.projectRoot, 'logs');
    this.stats = path.join(this.projectRoot, 'stats');
    this.backupDir = path.join(this.projectRoot, 'backup');
    
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

  async checkExistingFolders() {
    this.log('📁 CHECKING EXISTING FOLDERS...', 'cyan');
    
    const folders = {
      'public_html': this.publicHtml,
      'private_html': this.privateHtml,
      'logs': this.logs,
      'stats': this.stats
    };

    const existing = {};
    
    for (const [name, path] of Object.entries(folders)) {
      if (fs.existsSync(path)) {
        existing[name] = path;
        this.log(`  ✓ Found: ${name}`, 'green');
      } else {
        this.log(`  ✗ Missing: ${name}`, 'yellow');
      }
    }

    return existing;
  }

  async createBackup() {
    this.log('💾 CREATING BACKUP...', 'cyan');
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.zip`);
    
    const output = fs.createWriteStream(backupFile);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return new Promise((resolve, reject) => {
      output.on('close', () => {
        this.log(`  ✓ Backup created: ${backupFile}`, 'green');
        resolve(backupFile);
      });

      archive.on('error', reject);
      archive.pipe(output);

      // Backup existing folders
      const foldersToBackup = [this.publicHtml, this.privateHtml, this.logs, this.stats];
      
      foldersToBackup.forEach(folder => {
        if (fs.existsSync(folder)) {
          archive.directory(folder, path.basename(folder));
        }
      });

      archive.finalize();
    });
  }

  async extractZipFile(zipPath) {
    this.log(`📦 EXTRACTING ZIP: ${zipPath}`, 'cyan');
    
    const extractDir = path.join(this.projectRoot, 'temp-extract');
    
    // Clean up any existing temp directory
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(extractDir, { recursive: true });
    
    try {
      await extract(zipPath, { dir: extractDir });
      this.log('  ✓ Zip extracted successfully', 'green');
      return extractDir;
    } catch (error) {
      this.log(`  ✗ Error extracting zip: ${error.message}`, 'red');
      throw error;
    }
  }

  async organizeFiles(extractDir) {
    this.log('🗂️  ORGANIZING FILES...', 'cyan');
    
    // Ensure target directories exist
    const dirs = [this.publicHtml, this.privateHtml, this.logs, this.stats];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`  ✓ Created: ${path.basename(dir)}`, 'green');
      }
    });

    // Define file organization rules
    const organizationRules = {
      // Client files go to public_html
      [path.join(extractDir, 'dist', 'public')]: this.publicHtml,
      [path.join(extractDir, 'client', 'dist')]: this.publicHtml,
      [path.join(extractDir, 'public')]: this.publicHtml,
      
      // Server files go to private_html
      [path.join(extractDir, 'server')]: path.join(this.privateHtml, 'server'),
      [path.join(extractDir, 'dist')]: this.privateHtml,
      [path.join(extractDir, 'drizzle')]: path.join(this.privateHtml, 'drizzle'),
      [path.join(extractDir, 'scripts')]: path.join(this.privateHtml, 'scripts'),
      
      // Config files go to private_html
      [path.join(extractDir, 'package.json')]: this.privateHtml,
      [path.join(extractDir, 'pnpm-lock.yaml')]: this.privateHtml,
      [path.join(extractDir, 'ecosystem.config.js')]: this.privateHtml,
      [path.join(extractDir, 'ecosystem.config.cjs')]: this.privateHtml,
      [path.join(extractDir, 'tsconfig.json')]: this.privateHtml,
      [path.join(extractDir, 'vite.config.ts')]: this.privateHtml,
      [path.join(extractDir, 'drizzle.config.ts')]: this.privateHtml,
      
      // Environment files go to private_html
      [path.join(extractDir, '.env.example')]: path.join(this.privateHtml, '.env.example'),
      [path.join(extractDir, '.env.production')]: path.join(this.privateHtml, '.env.production'),
    };

    let movedFiles = 0;
    let movedDirs = 0;

    for (const [source, target] of Object.entries(organizationRules)) {
      if (fs.existsSync(source)) {
        const isDir = fs.statSync(source).isDirectory();
        
        try {
          if (isDir) {
            // Copy directory contents
            this.copyDirectory(source, target);
            movedDirs++;
            this.log(`  ✓ Moved directory: ${path.basename(source)} → ${path.basename(target)}`, 'green');
          } else {
            // Copy single file
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.copyFileSync(source, target);
            movedFiles++;
            this.log(`  ✓ Moved file: ${path.basename(source)} → ${path.basename(target)}`, 'green');
          }
        } catch (error) {
          this.log(`  ⚠ Warning moving ${source}: ${error.message}`, 'yellow');
        }
      }
    }

    this.log(`  ✓ Organized ${movedFiles} files and ${movedDirs} directories`, 'green');
  }

  copyDirectory(source, target) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    const items = fs.readdirSync(source);
    
    items.forEach(item => {
      const sourcePath = path.join(source, item);
      const targetPath = path.join(target, item);
      
      if (fs.statSync(sourcePath).isDirectory()) {
        this.copyDirectory(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }

  async setupEnvironment() {
    this.log('⚙️  SETTING UP ENVIRONMENT...', 'cyan');
    
    const privateDir = this.privateHtml;
    process.chdir(privateDir);

    try {
      // Check if pnpm is installed
      this.log('  📦 Installing dependencies...', 'yellow');
      execSync('npm install -g pnpm', { stdio: 'inherit' });
      
      // Install project dependencies
      this.log('  📦 Installing project dependencies...', 'yellow');
      execSync('pnpm install --production', { stdio: 'inherit' });
      
      // Set up environment file
      const envExample = path.join(privateDir, '.env.example');
      const envFile = path.join(privateDir, '.env');
      
      if (fs.existsSync(envExample) && !fs.existsSync(envFile)) {
        fs.copyFileSync(envExample, envFile);
        this.log('  ✓ Environment file created from example', 'green');
        this.log('  ⚠ Please update .env with your production values', 'yellow');
      }
      
      this.log('  ✓ Environment setup complete', 'green');
      
    } catch (error) {
      this.log(`  ✗ Environment setup error: ${error.message}`, 'red');
      throw error;
    }
  }

  async setupDatabase() {
    this.log('🗄️  SETTING UP DATABASE...', 'cyan');
    
    const privateDir = this.privateHtml;
    process.chdir(privateDir);

    try {
      // Run database migrations
      this.log('  🔄 Running database migrations...', 'yellow');
      execSync('pnpm db:migrate', { stdio: 'inherit' });
      
      // Seed database
      this.log('  🌱 Seeding database...', 'yellow');
      execSync('pnpm db:seed:all', { stdio: 'inherit' });
      
      this.log('  ✓ Database setup complete', 'green');
      
    } catch (error) {
      this.log(`  ⚠ Database setup warning: ${error.message}`, 'yellow');
      this.log('  ⚠ Please check database connection and run manually if needed', 'yellow');
    }
  }

  async setupPM2() {
    this.log('🚀 SETTING UP PM2...', 'cyan');
    
    const privateDir = this.privateHtml;
    process.chdir(privateDir);

    try {
      // Start application with PM2
      this.log('  ▶️ Starting application with PM2...', 'yellow');
      execSync('pnpm pm2:start', { stdio: 'inherit' });
      
      // Save PM2 configuration
      this.log('  💾 Saving PM2 configuration...', 'yellow');
      execSync('pm2 save', { stdio: 'inherit' });
      
      // Setup PM2 startup
      this.log('  ⚙️ Setting up PM2 startup...', 'yellow');
      execSync('pm2 startup', { stdio: 'inherit' });
      
      this.log('  ✓ PM2 setup complete', 'green');
      
    } catch (error) {
      this.log(`  ✗ PM2 setup error: ${error.message}`, 'red');
      throw error;
    }
  }

  async setupNginx() {
    this.log('🌐 SETTING UP NGINX...', 'cyan');
    
    const nginxConfig = `
server {
    listen 80;
    server_name _;
    
    # Client files (public_html)
    root ${this.publicHtml};
    index index.html;
    
    # Handle client routing (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to server
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static asset caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

    const nginxConfigPath = path.join(this.projectRoot, 'nginx-rebooked.conf');
    fs.writeFileSync(nginxConfigPath, nginxConfig);
    
    this.log(`  ✓ Nginx configuration created: ${nginxConfigPath}`, 'green');
    this.log('  ⚠ Please manually copy this config to /etc/nginx/sites-available/', 'yellow');
  }

  async verifySetup() {
    this.log('✅ VERIFYING SETUP...', 'cyan');
    
    const checks = [
      { name: 'public_html', path: this.publicHtml, expected: 'index.html' },
      { name: 'private_html', path: this.privateHtml, expected: 'package.json' },
      { name: 'logs', path: this.logs, expected: null },
      { name: 'stats', path: this.stats, expected: null }
    ];

    let passed = 0;
    
    for (const check of checks) {
      if (fs.existsSync(check.path)) {
        if (check.expected) {
          const expectedPath = path.join(check.path, check.expected);
          if (fs.existsSync(expectedPath)) {
            this.log(`  ✓ ${check.name}: ${check.expected} found`, 'green');
            passed++;
          } else {
            this.log(`  ⚠ ${check.name}: ${check.expected} missing`, 'yellow');
          }
        } else {
          this.log(`  ✓ ${check.name}: directory exists`, 'green');
          passed++;
        }
      } else {
        this.log(`  ✗ ${check.name}: directory missing`, 'red');
      }
    }

    // Check PM2 status
    try {
      const pm2Status = execSync('pm2 status', { encoding: 'utf8' });
      if (pm2Status.includes('rebooked') || pm2Status.includes('online')) {
        this.log('  ✓ PM2: application running', 'green');
        passed++;
      } else {
        this.log('  ⚠ PM2: application not running', 'yellow');
      }
    } catch (error) {
      this.log('  ⚠ PM2: status check failed', 'yellow');
    }

    this.log(`✅ VERIFICATION COMPLETE: ${passed}/${checks.length + 1} checks passed`, passed === checks.length + 1 ? 'green' : 'yellow');
  }

  async cleanup() {
    this.log('🧹 CLEANING UP...', 'cyan');
    
    const extractDir = path.join(this.projectRoot, 'temp-extract');
    
    if (fs.existsSync(extractDir)) {
      fs.rmSync(extractDir, { recursive: true, force: true });
      this.log('  ✓ Temporary files cleaned up', 'green');
    }
  }

  async run(zipFilePath) {
    try {
      this.log('🚀 STARTING REBOOKED SERVER SETUP', 'bright');
      this.log('=====================================', 'bright');
      
      // Check existing folders
      await this.checkExistingFolders();
      
      // Create backup
      await this.createBackup();
      
      // Extract zip file
      const extractDir = await this.extractZipFile(zipFilePath);
      
      // Organize files
      await this.organizeFiles(extractDir);
      
      // Setup environment
      await this.setupEnvironment();
      
      // Setup database
      await this.setupDatabase();
      
      // Setup PM2
      await this.setupPM2();
      
      // Setup nginx
      await this.setupNginx();
      
      // Verify setup
      await this.verifySetup();
      
      // Cleanup
      await this.cleanup();
      
      this.log('🎉 SETUP COMPLETE!', 'bright');
      this.log('=====================================', 'bright');
      this.log('✅ Your Rebooked application is now running!', 'green');
      this.log('🌐 Client files: public_html/', 'cyan');
      this.log('🔧 Server files: private_html/', 'cyan');
      this.log('📊 Logs: logs/', 'cyan');
      this.log('📈 Stats: stats/', 'cyan');
      this.log('', 'reset');
      this.log('Next steps:', 'yellow');
      this.log('1. Update private_html/.env with your production values', 'white');
      this.log('2. Copy nginx-rebooked.conf to your nginx configuration', 'white');
      this.log('3. Set up SSL certificate', 'white');
      this.log('4. Test your application', 'white');
      
    } catch (error) {
      this.log(`❌ SETUP FAILED: ${error.message}`, 'red');
      this.log('Please check the error above and try again.', 'red');
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node server-setup.js <zip-file-path>');
    console.log('');
    console.log('Example: node server-setup.js rebooked-project.zip');
    process.exit(1);
  }
  
  const zipFilePath = args[0];
  
  if (!fs.existsSync(zipFilePath)) {
    console.log(`❌ Error: Zip file not found: ${zipFilePath}`);
    process.exit(1);
  }
  
  const setup = new ServerSetup();
  await setup.run(zipFilePath);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = ServerSetup;
