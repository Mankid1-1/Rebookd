#!/usr/bin/env bash

# REBOOKD v2 - PRE-DEPLOYMENT VERIFICATION
# Comprehensive checklist for production readiness

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

log_pass() {
  echo -e "${GREEN}✅${NC} $1"
  ((PASS++))
}

log_fail() {
  echo -e "${RED}❌${NC} $1"
  ((FAIL++))
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARN++))
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# ─── Section: Code Quality ────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 1: CODE QUALITY & COMPILATION"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# TypeScript compilation
log_info "Checking TypeScript compilation..."
if npm run check:types > /dev/null 2>&1; then
  log_pass "TypeScript compilation successful"
else
  log_fail "TypeScript compilation failed"
fi

# Build
log_info "Checking application build..."
if [ -d "dist-build/public" ]; then
  log_pass "Application build exists"
  log_info "  - Build size: $(du -sh dist-build | cut -f1)"
else
  log_fail "Application build not found"
fi

# ─── Section: Dependencies ────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 2: DEPENDENCIES & MODULES"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Check critical dependencies
log_info "Checking critical dependencies..."
deps=("express" "@trpc/server" "drizzle-orm" "mysql2" "redis" "bcryptjs" "nodemailer")
for dep in "${deps[@]}"; do
  if grep -q "\"$dep\"" package.json; then
    log_pass "  - $dep found"
  else
    log_fail "  - $dep missing"
  fi
done

# ─── Section: Environment Configuration ────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 3: ENVIRONMENT CONFIGURATION"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Check .env.production exists
if [ -f ".env.production" ]; then
  log_pass ".env.production file exists"
  
  # Check critical variables
  log_info "Checking critical environment variables..."
  critical_vars=("DB_PASSWORD" "ENCRYPTION_KEY" "JWT_SECRET" "WEBHOOK_SECRET")
  
  for var in "${critical_vars[@]}"; do
    if grep -q "^$var=" .env.production; then
      if grep "^$var=CHANGE_ME" .env.production > /dev/null; then
        log_fail "  - $var still set to CHANGE_ME"
      else
        value=$(grep "^$var=" .env.production | cut -d'=' -f2)
        if [ ${#value} -lt 8 ]; then
          log_warn "  - $var value too short (${#value} chars)"
        else
          log_pass "  - $var configured"
        fi
      fi
    else
      log_fail "  - $var not found"
    fi
  done
else
  log_fail ".env.production file not found"
fi

# ─── Section: Docker Setup ────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 4: DOCKER CONFIGURATION"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Check Docker
if command -v docker &> /dev/null; then
  log_pass "Docker installed: $(docker --version)"
else
  log_fail "Docker not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
  log_pass "Docker Compose installed: $(docker-compose --version)"
else
  log_fail "Docker Compose not installed"
fi

# Check Dockerfile
if [ -f "Dockerfile" ]; then
  log_pass "Dockerfile exists"
  # Check for multi-stage build
  if grep -q "FROM.*as builder" Dockerfile; then
    log_pass "  - Multi-stage build detected"
  else
    log_warn "  - Not using multi-stage build (optimization opportunity)"
  fi
else
  log_fail "Dockerfile not found"
fi

# Check docker-compose.prod.yml
if [ -f "docker-compose.prod.yml" ]; then
  log_pass "docker-compose.prod.yml exists"
  
  # Check for required services
  services=("db" "redis" "app" "worker" "nginx")
  for service in "${services[@]}"; do
    if grep -q "^  $service:" docker-compose.prod.yml; then
      log_pass "  - Service '$service' defined"
    else
      log_fail "  - Service '$service' missing"
    fi
  done
  
  # Check for health checks
  if grep -q "healthcheck:" docker-compose.prod.yml; then
    log_pass "  - Health checks configured"
  else
    log_warn "  - Health checks not configured"
  fi
else
  log_fail "docker-compose.prod.yml not found"
fi

# ─── Section: Database Setup ──────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 5: DATABASE SCHEMA"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

if [ -f "drizzle/schema.ts" ]; then
  log_pass "Database schema file exists"
  
  # Check for critical tables
  tables=("users" "tenants" "leads" "messages" "automations" "subscriptions")
  for table in "${tables[@]}"; do
    if grep -q "mysqlTable(\"$table\"" drizzle/schema.ts; then
      log_pass "  - Table '$table' defined"
    else
      log_fail "  - Table '$table' missing"
    fi
  done
else
  log_fail "Database schema file not found"
fi

# ─── Section: API Configuration ────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 6: API ENDPOINTS"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

if [ -f "server/routers.ts" ]; then
  log_pass "API router file exists"
  
  # Check for critical routers
  routers=("auth" "leads" "templates" "automations" "tenant" "billing" "admin")
  for router in "${routers[@]}"; do
    if grep -q "$router: router(" server/routers.ts; then
      log_pass "  - Router '$router' defined"
    else
      log_fail "  - Router '$router' missing"
    fi
  done
else
  log_fail "API router file not found"
fi

# ─── Section: Security ────────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 7: SECURITY FEATURES"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

# Check encryption implementation
if [ -f "server/_core/crypto.ts" ]; then
  log_pass "Encryption module exists"
  if grep -q "AES-256-GCM" server/_core/crypto.ts; then
    log_pass "  - AES-256-GCM encryption implemented"
  else
    log_warn "  - AES-256-GCM not found"
  fi
else
  log_fail "Encryption module not found"
fi

# Check validation
if [ -f "server/_core/validation.ts" ]; then
  log_pass "Validation module exists"
  if grep -q "sanitizeInput\|DOMPurify" server/_core/validation.ts; then
    log_pass "  - Input sanitization implemented"
  else
    log_warn "  - Input sanitization not found"
  fi
else
  log_warn "Validation module not found"
fi

# Check error handling
if [ -f "server/_core/error-handling.ts" ]; then
  log_pass "Error handling module exists"
else
  log_warn "Error handling module not found (non-critical)"
fi

# Check rate limiting
if grep -q "createRateLimitMiddleware\|rateLimitStore" server/_core/api-middleware.ts 2>/dev/null; then
  log_pass "Rate limiting implemented"
else
  log_warn "Rate limiting may not be fully implemented"
fi

# ─── Section: Monitoring & Logging ────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 8: MONITORING & LOGGING"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

if [ -f "server/_core/logger.ts" ]; then
  log_pass "Logger module exists"
else
  log_fail "Logger module not found"
fi

if [ -f "server/_core/health-check.ts" ]; then
  log_pass "Health check module exists"
else
  log_warn "Health check module not found"
fi

if [ -f "server/_core/graceful-shutdown.ts" ]; then
  log_pass "Graceful shutdown handler exists"
else
  log_fail "Graceful shutdown handler not found"
fi

# ─── Section: Documentation ───────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 9: DOCUMENTATION"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

docs=("PRODUCTION_README.md" "PRODUCTION_OPERATIONS_GUIDE.md" "DOCKER_DEPLOYMENT_GUIDE.md")
for doc in "${docs[@]}"; do
  if [ -f "$doc" ]; then
    size=$(wc -l < "$doc")
    log_pass "$doc exists ($size lines)"
  else
    log_warn "$doc not found"
  fi
done

# ─── Section: Scripts ──────────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "PHASE 10: DEPLOYMENT SCRIPTS"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

scripts=("scripts/deploy.sh" "scripts/docker-start.sh" "scripts/mysql-init.sql")
for script in "${scripts[@]}"; do
  if [ -f "$script" ]; then
    log_pass "$script exists"
  else
    log_warn "$script not found"
  fi
done

# ─── Final Summary ─────────────────────────────────────────────────────────────
echo ""
echo "═════════════════════════════════════════════════════════════════════════════"
echo "VERIFICATION SUMMARY"
echo "═════════════════════════════════════════════════════════════════════════════"
echo ""

echo -e "${GREEN}Passed:${NC}  $PASS"
echo -e "${RED}Failed:${NC}  $FAIL"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ ALL CRITICAL CHECKS PASSED${NC}"
  echo ""
  echo "Your application is ready for production deployment!"
  echo ""
  echo "Next steps:"
  echo "  1. Review all warnings above"
  echo "  2. Run: bash scripts/deploy.sh"
  echo "  3. Verify: curl http://localhost:3000/health"
  echo "  4. Check: docker-compose -f docker-compose.prod.yml ps"
  echo ""
  exit 0
else
  echo -e "${RED}❌ CRITICAL CHECKS FAILED${NC}"
  echo ""
  echo "Please fix the issues above before deployment."
  echo ""
  exit 1
fi
