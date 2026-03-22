#!/usr/bin/env bash

# ════════════════════════════════════════════════════════════════════════════════
# REBOOKD v2 - PRODUCTION DEPLOYMENT SCRIPT
# Complete setup, validation, and deployment automation
# ════════════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✅${NC} $1"
}

log_error() {
  echo -e "${RED}❌${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# ─── Phase 1: Pre-flight Checks ────────────────────────────────────────────────
log_info "Starting Rebookd v2 Production Deployment..."
log_info "Phase 1: Pre-flight Checks"

# Check Docker
if ! command -v docker &> /dev/null; then
  log_error "Docker not found. Please install Docker."
  exit 1
fi
log_success "Docker found: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
  log_error "Docker Compose not found. Please install Docker Compose."
  exit 1
fi
log_success "Docker Compose found: $(docker-compose --version)"

# Check environment file
if [ ! -f .env.production ]; then
  log_error ".env.production not found"
  log_warn "Creating template .env.production..."
  cp .env.production.example .env.production 2>/dev/null || {
    log_error "Could not create .env.production. Please ensure .env.production.example exists."
    exit 1
  }
  log_warn "Please edit .env.production with your configuration before proceeding"
  exit 1
fi
log_success ".env.production found"

# ─── Phase 2: Configuration Validation ─────────────────────────────────────────
log_info "Phase 2: Configuration Validation"

# Check required environment variables
required_vars=("DB_PASSWORD" "ENCRYPTION_KEY" "JWT_SECRET" "WEBHOOK_SECRET")
missing_vars=()

for var in "${required_vars[@]}"; do
  if ! grep -q "^$var=" .env.production || grep "^$var=CHANGE_ME" .env.production > /dev/null; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  log_error "Missing or unconfigured variables: ${missing_vars[*]}"
  log_warn "Please edit .env.production and set all required variables"
  exit 1
fi
log_success "Environment variables validated"

# ─── Phase 3: Cleanup Old Containers ──────────────────────────────────────────
log_info "Phase 3: Cleanup (stopping old containers)"

docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
log_success "Old containers stopped"

# ─── Phase 4: Build Docker Images ─────────────────────────────────────────────
log_info "Phase 4: Building Docker Images"

docker-compose -f docker-compose.prod.yml build --no-cache

if [ $? -eq 0 ]; then
  log_success "Docker images built successfully"
else
  log_error "Docker build failed"
  exit 1
fi

# ─── Phase 5: Start Services ──────────────────────────────────────────────────
log_info "Phase 5: Starting Services"

docker-compose -f docker-compose.prod.yml up -d

if [ $? -eq 0 ]; then
  log_success "Services started"
else
  log_error "Failed to start services"
  exit 1
fi

# ─── Phase 6: Wait for Service Health ─────────────────────────────────────────
log_info "Phase 6: Waiting for Services to be Healthy"

max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  db_health=$(docker-compose -f docker-compose.prod.yml exec -T db mysqladmin ping -h localhost 2>/dev/null || echo "failed")
  
  if [ "$db_health" = "mysqld is alive" ]; then
    log_success "Database is healthy"
    break
  fi
  
  log_info "Waiting for database... ($((attempt + 1))/$max_attempts)"
  sleep 2
  ((attempt++))
done

if [ $attempt -eq $max_attempts ]; then
  log_error "Database failed to become healthy"
  docker-compose -f docker-compose.prod.yml logs db
  exit 1
fi

# ─── Phase 7: Database Migrations ─────────────────────────────────────────────
log_info "Phase 7: Running Database Migrations"

docker-compose -f docker-compose.prod.yml exec -T app npm run db:migrate

if [ $? -eq 0 ]; then
  log_success "Database migrations completed"
else
  log_error "Database migrations failed"
  docker-compose -f docker-compose.prod.yml logs app
  exit 1
fi

# ─── Phase 8: Seed Initial Data ────────────────────────────────────────────────
log_info "Phase 8: Seeding Initial Data"

docker-compose -f docker-compose.prod.yml exec -T app npm run db:seed:all

if [ $? -eq 0 ]; then
  log_success "Initial data seeded"
else
  log_warn "Initial data seeding skipped or failed (non-critical)"
fi

# ─── Phase 9: Verify Services ─────────────────────────────────────────────────
log_info "Phase 9: Verifying Services"

sleep 5

# Check if app is responding
http_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")

if [ "$http_status" = "200" ]; then
  log_success "Application is responding"
else
  log_warn "Application health check returned status $http_status"
fi

# ─── Phase 10: Final Status ────────────────────────────────────────────────────
log_info "Phase 10: Final Status"

docker-compose -f docker-compose.prod.yml ps

log_success "════════════════════════════════════════════════════════════════════"
log_success "🎉 Rebookd v2 Deployment Complete!"
log_success "════════════════════════════════════════════════════════════════════"
log_success ""
log_success "Access your application:"
log_success "  URL: http://localhost:3000"
log_success ""
log_success "Test Credentials:"
log_success "  Email: brendanjj96@outlook.com"
log_success "  Password: password1"
log_success ""
log_success "Services:"
log_success "  App:    http://localhost:3000"
log_success "  API:    http://localhost:3000/api/trpc"
log_success "  Nginx:  http://localhost (reverse proxy)"
log_success ""
log_success "Database:"
log_success "  Host:    localhost"
log_success "  Port:    3306"
log_success "  User:    rebookd"
log_success ""
log_success "Redis:"
log_success "  URL:     redis://localhost:6379"
log_success ""
log_success "Useful Commands:"
log_success "  View logs:        docker-compose -f docker-compose.prod.yml logs -f"
log_success "  Stop services:    docker-compose -f docker-compose.prod.yml down"
log_success "  Restart app:      docker-compose -f docker-compose.prod.yml restart app"
log_success "  Database CLI:     docker-compose -f docker-compose.prod.yml exec db mysql -u rebookd -p rebookd"
log_success ""
log_success "Next Steps:"
log_success "  1. Configure your email server in .env.production (SMTP_HOST, SMTP_PASSWORD)"
log_success "  2. Set up SMS provider (Telnyx or Twilio API keys)"
log_success "  3. Configure Stripe keys for billing (optional)"
log_success "  4. Set up monitoring and backups"
log_success ""
log_success "Documentation: See DOCKER_DEPLOYMENT_GUIDE.md"
log_success "════════════════════════════════════════════════════════════════════"
