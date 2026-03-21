#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════════
# REBOOKD v2 - PRODUCTION DOCKER STARTUP SCRIPT
# ════════════════════════════════════════════════════════════════════════════════
# Usage: ./scripts/docker-start.sh [up|down|restart|logs|ps|stop]

set -e

PROJECT_NAME="rebookd"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ─── FUNCTIONS ─────────────────────────────────────────────────────────────────

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file not found: $ENV_FILE"
        print_info "Creating from template..."
        if [ -f ".env.production.example" ]; then
            cp .env.production.example "$ENV_FILE"
            print_warn "Please edit $ENV_FILE with your actual values!"
            exit 1
        else
            print_error "No .env template found!"
            exit 1
        fi
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "docker-compose is not installed!"
        exit 1
    fi
    
    print_info "Docker and docker-compose verified ✓"
}

build_images() {
    print_info "Building Docker images..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --no-cache
    print_info "Build complete ✓"
}

start_services() {
    print_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    print_info "Services started ✓"
    
    print_info "Waiting for services to be ready..."
    sleep 10
    
    # Check service health
    check_service_health
}

stop_services() {
    print_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    print_info "Services stopped ✓"
}

restart_services() {
    stop_services
    sleep 2
    start_services
}

run_migrations() {
    print_info "Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T app npm run db:migrate
    print_info "Migrations complete ✓"
}

seed_database() {
    print_info "Seeding database with initial data..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T app npm run db:seed:plans
    print_info "Database seeded ✓"
}

check_service_health() {
    print_info "Checking service health..."
    
    local services=("db" "redis" "app" "worker" "nginx")
    local failed=0
    
    for service in "${services[@]}"; do
        if docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps "$service" | grep -q "Up"; then
            print_info "✓ $service is running"
        else
            print_error "✗ $service is NOT running"
            failed=$((failed + 1))
        fi
    done
    
    if [ $failed -gt 0 ]; then
        print_error "Some services failed to start!"
        print_info "Showing logs..."
        docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=50
        exit 1
    fi
    
    print_info "All services healthy ✓"
}

show_status() {
    print_info "Container Status:"
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

show_logs() {
    local service=${1:-app}
    print_info "Showing logs for $service (last 100 lines)..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs --tail=100 -f "$service"
}

cleanup() {
    print_warn "Removing all containers and volumes..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
    print_info "Cleanup complete ✓"
}

backup_database() {
    local backup_file="backups/rebookd_$(date +%Y%m%d_%H%M%S).sql"
    mkdir -p backups
    
    print_info "Backing up database to $backup_file..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T db \
        mysqldump -u root -p"$DB_ROOT_PASSWORD" rebookd > "$backup_file"
    
    print_info "Backup complete: $backup_file ✓"
    
    # Compress backup
    gzip "$backup_file"
    print_info "Compressed backup ✓"
}

update_certs() {
    print_info "Updating SSL certificates..."
    docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec nginx \
        certbot renew --quiet
    print_info "Certificates updated ✓"
}

init_setup() {
    print_info "Setting up Rebookd v2..."
    
    check_docker
    check_env_file
    
    # Create directories
    mkdir -p nginx/ssl backups logs
    
    print_info "Building images..."
    build_images
    
    print_info "Starting services..."
    start_services
    
    print_info "Running migrations..."
    run_migrations
    
    print_info "Seeding database..."
    seed_database
    
    print_info ""
    print_info "════════════════════════════════════════════════════════════════"
    print_info "✓ Rebookd v2 is now running!"
    print_info "════════════════════════════════════════════════════════════════"
    print_info "Application:  http://localhost:3000"
    print_info "Admin Panel:  http://localhost:3000/admin"
    print_info "Database:     localhost:3306"
    print_info "Redis:        localhost:6379"
    print_info ""
    print_warn "NEXT STEPS:"
    print_warn "1. Configure SSL certificates in nginx/ssl/"
    print_warn "2. Update DNS records to point to this server"
    print_warn "3. Update .env.production with your actual values"
    print_warn "4. Monitor logs: docker-compose -f $COMPOSE_FILE logs -f app"
    print_info ""
}

# ─── MAIN ──────────────────────────────────────────────────────────────────────

case "${1:-up}" in
    up)
        check_env_file
        check_docker
        start_services
        check_service_health
        show_status
        print_info "Services are running! View logs: $0 logs"
        ;;
    down)
        stop_services
        ;;
    restart)
        restart_services
        show_status
        ;;
    logs)
        show_logs "${2:-app}"
        ;;
    ps|status)
        show_status
        ;;
    build)
        check_docker
        build_images
        ;;
    init|setup)
        init_setup
        ;;
    migrate)
        print_info "Running migrations..."
        run_migrations
        ;;
    seed)
        print_info "Seeding database..."
        seed_database
        ;;
    backup)
        check_env_file
        backup_database
        ;;
    restore)
        if [ -z "$2" ]; then
            print_error "Usage: $0 restore <backup_file>"
            exit 1
        fi
        print_info "Restoring from $2..."
        gunzip -c "$2" | docker-compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T db \
            mysql -u root -p"$DB_ROOT_PASSWORD" rebookd
        print_info "Restore complete ✓"
        ;;
    clean)
        cleanup
        ;;
    health)
        check_service_health
        ;;
    certs|renew)
        update_certs
        ;;
    *)
        cat << EOF
Usage: $0 [COMMAND]

Commands:
    up              Start all services (default)
    down            Stop all services
    restart         Restart all services
    logs [service]  Show logs for service (default: app)
    ps|status       Show container status
    build           Build Docker images
    init|setup      Initial setup and configuration
    migrate         Run database migrations
    seed            Seed database with initial data
    backup          Create database backup
    restore FILE    Restore database from backup
    clean           Remove all containers and volumes
    health          Check service health
    certs|renew     Renew SSL certificates

Examples:
    $0 init              # Initial setup
    $0 logs app          # View app logs
    $0 backup            # Backup database
    $0 restore backups/rebookd_20240101_120000.sql.gz  # Restore backup
EOF
        exit 1
        ;;
esac
