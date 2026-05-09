#!/bin/bash
# ============================================================================
# Zenon Management Portal - Production Deployment Script
# Usage: ./deploy.sh [first-run|update|restart|logs|backup|status]
# ============================================================================

set -e

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[⚠]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Install from https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Install with: npm install -g pnpm"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env.production file not found!"
        log_info "Copy the template: cp .env.production.example .env.production"
        log_info "Then edit it with your production values."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Build the frontend
build_frontend() {
    log_info "Building frontend..."
    
    # Source production env for VITE_API_BASE_URL
    source "$ENV_FILE"
    export VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api/v1}"
    
    # Create production .env for the web app
    echo "VITE_API_BASE_URL=$VITE_API_BASE_URL" > apps/web/.env.production
    
    pnpm --filter @zenon/web build
    
    log_success "Frontend built successfully → apps/web/dist/"
}

# First-time deployment
first_run() {
    check_prerequisites
    
    log_info "=== First-time deployment ==="
    
    # Build frontend first
    build_frontend
    
    # Create necessary directories
    mkdir -p uploads backups postgres-data docker/nginx/ssl
    
    # Start services
    log_info "Starting all services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    
    # Wait for services to be healthy
    log_info "Waiting for services to start (this may take 1-2 minutes)..."
    sleep 30
    
    # Run database migrations
    log_info "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec api sh -c "cd /app && npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma" || true
    
    log_success "=== Deployment complete! ==="
    echo ""
    log_info "Your app is now running at:"
    echo "  → Frontend:  http://your-server-ip"
    echo "  → API:       http://your-server-ip/api/v1"
    echo "  → Health:    http://your-server-ip/health (via nginx)"
    echo ""
    log_warn "Next steps:"
    echo "  1. Point your domain DNS to this server's IP"
    echo "  2. Set up SSL with: ./deploy.sh ssl yourdomain.com"
    echo "  3. Create your first admin user"
}

# Update deployment (pull latest code and redeploy)
update() {
    check_prerequisites
    
    log_info "=== Updating deployment ==="
    
    # Pull latest code
    git pull origin main 2>/dev/null || log_warn "Git pull skipped (no remote configured)"
    
    # Rebuild frontend
    build_frontend
    
    # Rebuild and restart services
    log_info "Rebuilding and restarting services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build
    
    # Run migrations
    log_info "Running database migrations..."
    sleep 15
    docker compose -f "$COMPOSE_FILE" exec api sh -c "cd /app && npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma" || true
    
    log_success "=== Update complete! ==="
}

# Restart services
restart() {
    log_info "Restarting all services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
    log_success "Services restarted"
}

# View logs
logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100
    else
        docker compose -f "$COMPOSE_FILE" logs -f --tail=100 "$service"
    fi
}

# Create database backup
backup() {
    local BACKUP_DIR="./backups"
    local DATE=$(date +%Y%m%d_%H%M%S)
    
    mkdir -p "$BACKUP_DIR"
    
    log_info "Creating database backup..."
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U zenon zenon_croptrial | \
        gzip > "$BACKUP_DIR/zenon_backup_$DATE.sql.gz"
    
    log_success "Backup created: $BACKUP_DIR/zenon_backup_$DATE.sql.gz"
    
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/zenon_backup_*.sql.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null
    log_info "Old backups cleaned (keeping last 7)"
}

# Show status
status() {
    log_info "=== Service Status ==="
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    
    log_info "=== Resource Usage ==="
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(docker compose -f "$COMPOSE_FILE" ps -q) 2>/dev/null || true
    echo ""
    
    # Health checks
    log_info "=== Health Checks ==="
    curl -sf http://localhost:3000/health > /dev/null 2>&1 && log_success "API: Healthy" || log_error "API: Unhealthy"
    curl -sf http://localhost/health > /dev/null 2>&1 && log_success "Nginx: Healthy" || log_warn "Nginx: Not reachable on port 80"
    docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U zenon > /dev/null 2>&1 && log_success "PostgreSQL: Healthy" || log_error "PostgreSQL: Unhealthy"
}

# Setup SSL with Let's Encrypt
setup_ssl() {
    local DOMAIN=$1
    
    if [ -z "$DOMAIN" ]; then
        log_error "Usage: ./deploy.sh ssl yourdomain.com"
        exit 1
    fi
    
    log_info "Setting up SSL for $DOMAIN..."
    
    # Install certbot
    if ! command -v certbot &> /dev/null; then
        log_info "Installing certbot..."
        sudo apt-get update && sudo apt-get install -y certbot
    fi
    
    # Stop nginx temporarily
    docker compose -f "$COMPOSE_FILE" stop nginx
    
    # Get certificate
    sudo certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN"
    
    # Copy certificates
    sudo cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" docker/nginx/ssl/
    sudo cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" docker/nginx/ssl/
    sudo chmod 644 docker/nginx/ssl/*.pem
    
    # Update nginx config to enable HTTPS
    log_info "Enabling HTTPS in nginx config..."
    sed -i "s/server_name _;/server_name $DOMAIN;/" docker/nginx/conf.d/default.conf
    
    # Restart nginx
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx
    
    log_success "SSL configured for $DOMAIN"
    log_info "Your site is now available at https://$DOMAIN"
    
    # Setup auto-renewal
    log_info "Setting up SSL auto-renewal..."
    (crontab -l 2>/dev/null; echo "0 0 1 * * certbot renew --quiet && cp /etc/letsencrypt/live/$DOMAIN/*.pem $(pwd)/docker/nginx/ssl/ && docker compose -f $(pwd)/$COMPOSE_FILE restart nginx") | crontab -
    log_success "SSL auto-renewal configured (monthly)"
}

# Stop all services
stop() {
    log_info "Stopping all services..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "All services stopped"
}

# Main command handler
case "${1:-help}" in
    first-run)
        first_run
        ;;
    update)
        update
        ;;
    restart)
        restart
        ;;
    logs)
        logs "$2"
        ;;
    backup)
        backup
        ;;
    status)
        status
        ;;
    ssl)
        setup_ssl "$2"
        ;;
    stop)
        stop
        ;;
    help|*)
        echo ""
        echo "  Zenon Management Portal - Deployment Script"
        echo "  ============================================"
        echo ""
        echo "  Usage: ./deploy.sh <command>"
        echo ""
        echo "  Commands:"
        echo "    first-run    First-time deployment (build + start + migrate)"
        echo "    update       Pull latest code and redeploy"
        echo "    restart      Restart all services"
        echo "    stop         Stop all services"
        echo "    logs [svc]   View logs (optional: api, postgres, nginx)"
        echo "    backup       Create database backup"
        echo "    status       Show service status and health"
        echo "    ssl <domain> Setup SSL certificate with Let's Encrypt"
        echo ""
        ;;
esac
