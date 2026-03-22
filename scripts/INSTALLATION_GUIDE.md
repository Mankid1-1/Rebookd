# 🚀 REBOOKED PERMISSION LEVEL INSTALLATION

## 📋 OVERVIEW
Automated installation script for different permission levels and use cases.

## 🎯 PERMISSION LEVELS

### 🟢 **MINIMAL** (Level 1)
- Install basic dependencies
- Setup environment variables
- Start development server
- **Use for**: Quick testing, basic development

### 🔵 **BASIC** (Level 2)
- Install development dependencies
- Setup complete environment
- Database audit and fix
- Build client application
- Start development services
- **Use for**: Standard development setup

### 🟡 **DEVELOPMENT** (Level 3)
- Install all dependencies (dev + prod)
- Complete environment setup
- Full database audit and fix
- Build client and server
- Start all services (dev + worker + client watch)
- **Use for**: Full development environment

### 🔴 **PRODUCTION** (Level 4)
- Install production dependencies only
- Production environment setup
- Database audit and fix
- Production build
- Start production services
- **Use for**: Production deployment

### 🟣 **FULL** (Level 5)
- Install all dependencies
- Complete environment setup
- Database audit and fix
- Sentry integration
- Full build
- Start all services
- **Use for**: Complete installation

---

## 🚀 USAGE

### 📦 **INTERACTIVE MODE**
```bash
npm run install
```
This will show a menu with all options.

### 📦 **COMMAND LINE MODE**
```bash
# Install specific level
npm run install minimal
npm run install basic
npm run install development
npm run install production
npm run install full

# Individual steps
npm run install deps
npm run install env
npm run install db
npm run install build
npm run install start

# Utilities
npm run install check
npm run install clean
npm run install help
```

---

## 🎯 INDIVIDUAL COMMANDS

### 📦 **deps** - Dependencies Only
Installs packages based on level:
- `minimal`: Basic dependencies
- `basic`: Development dependencies
- `development`: All dependencies
- `production`: Production dependencies
- `full`: All dependencies

### 🔧 **env** - Environment Setup
Runs environment configuration:
- `minimal`: Basic environment setup
- `basic`: Standard environment setup
- `development`: Full environment setup
- `production`: Production environment setup
- `full`: Complete environment setup

### 🗄️ **db** - Database Setup
Database operations:
- `minimal`: Database audit only
- `basic`: Database audit + fix
- `development`: Database audit + fix
- `production`: Database audit + fix
- `full`: Database audit + fix

### 🏗️ **build** - Build Project
Build operations:
- `minimal`: Client build only
- `basic`: Client build
- `development`: Client + server build
- `production`: Full production build
- `full`: Full build

### 🚀 **start** - Start Services
Service management:
- `minimal`: Development server
- `basic`: Development server
- `development`: All services
- `production`: Production services
- `full`: All services

---

## 🛠️ **UTILITIES**

### 🔍 **check** - Environment Check
- Validates package.json exists
- Validates .env file exists
- Checks project structure
- Reports environment status

### 🧹 **clean** - Clean Project
- Removes node_modules
- Removes lock files (pnpm-lock.yaml, package-lock.json, yarn.lock)
- Cleans build artifacts
- Prepares fresh installation

### 📋 **help** - Show Menu
- Displays all available options
- Shows permission levels
- Lists individual commands
- Provides usage examples

---

## 🎯 EXAMPLES

### 🚀 **Quick Start**
```bash
# Interactive mode - choose your level
npm run install

# Or specify level directly
npm run install basic
```

### 🚀 **Development Setup**
```bash
# Full development environment
npm run install development

# Equivalent individual steps
npm run install deps
npm run install env
npm run install db
npm run install build
npm run install start
```

### 🚀 **Production Deployment**
```bash
# Production-ready setup
npm run install production

# Clean first
npm run install clean
npm run install production
```

### 🚀 **Troubleshooting**
```bash
# Check environment
npm run install check

# Clean and reinstall
npm run install clean
npm run install basic
```

---

## 🎯 WHAT EACH LEVEL DOES

### 🟢 **MINIMAL**
```bash
# Equivalent to:
pnpm install --no-optional
node scripts/fix-env-simple.cjs
npm run dev
```

### 🔵 **BASIC**
```bash
# Equivalent to:
pnpm install --no-optional
node scripts/fix-env-simple.cjs
npm run db:audit
npm run build:app
npm run dev
```

### 🟡 **DEVELOPMENT**
```bash
# Equivalent to:
pnpm install --no-optional
node scripts/fix-env-simple.cjs
npm run db:audit
npm run db:fix
npm run build:app
npm run build:server
npm run dev:all
```

### 🔴 **PRODUCTION**
```bash
# Equivalent to:
pnpm install --prod --no-optional
node scripts/fix-env-simple.cjs
npm run db:audit
npm run db:fix
npm run build
npm run start:prod
```

### 🟣 **FULL**
```bash
# Equivalent to:
pnpm install --include=dev,prod
node scripts/fix-env-simple.cjs
npm run db:audit
npm run db:fix
npm run setup-sentry
npm run build
npm run dev:all
```

---

## 🎯 AFTER INSTALLATION

### ✅ **SUCCESS INDICATORS**
- All steps show ✅ status
- Services start without errors
- Application accessible at http://localhost:3000
- Stripe Connect available at http://localhost:3000/stripe-connect
- Health check at http://localhost:3000/admin/health

### 📋 **NEXT STEPS**
1. **Access Application**: Navigate to http://localhost:3000
2. **Create Account**: Sign up and configure your profile
3. **Test Stripe Connect**: Visit /stripe-connect to set up payments
4. **Monitor Health**: Check /admin/health for system status
5. **Review Logs**: Check console for any errors

### 🔧 **COMMON ISSUES**
- **Port conflicts**: Change ports in environment variables
- **Database errors**: Run `npm run install db` separately
- **Permission errors**: Use administrator terminal
- **Memory issues**: Increase Node.js memory limit

---

## 🎯 ADVANCED USAGE

### 🔄 **AUTOMATION**
```bash
# Automated deployment script
npm run install production && npm run start:prod
```

### 🐳 **DOCKER INTEGRATION**
```bash
# For Docker environments
npm run install minimal
# Then use your Docker commands
```

### 🌐 **CI/CD INTEGRATION**
```bash
# For CI/CD pipelines
npm run install production
npm run build
# Deploy build artifacts
```

---

**🚀 Use `npm run install` for interactive, permission-based installation!** 🎉

This script provides the most flexible and comprehensive installation experience for your Rebooked application.
