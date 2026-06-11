#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="/opt/lingjing"
LOG_DIR="/var/log/lingjing"
BACKUP_DIR="/opt/lingjing/backups"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js >= 18"
        exit 1
    fi
    
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2 not found. Installing..."
        npm install -g pm2
    fi
    
    if ! command -v nginx &> /dev/null; then
        log_error "Nginx not found. Please install nginx"
        exit 1
    fi
    
    log_info "Prerequisites OK"
}

check_env_vars() {
    local env_file="${DEPLOY_DIR}/cloud-server/.env"
    
    if [ ! -f "$env_file" ]; then
        log_error ".env file not found at $env_file"
        log_error "Create .env from .env.example and fill in all required variables"
        exit 1
    fi
    
    local required_vars=("API_KEY" "JWT_SECRET" "DEEPSEEK_API_KEY")
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=$" "$env_file" || ! grep -q "^${var}=" "$env_file"; then
            log_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    log_info "Environment variables OK"
}

create_dirs() {
    log_info "Creating directories..."
    mkdir -p "$LOG_DIR" "$BACKUP_DIR"
    log_info "Directories created"
}

backup_database() {
    log_info "Backing up database..."
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local db_file="${DEPLOY_DIR}/cloud-server/data/lingjing.db"
    
    if [ -f "$db_file" ]; then
        cp "$db_file" "${BACKUP_DIR}/lingjing_${timestamp}.db"
        log_info "Database backed up to ${BACKUP_DIR}/lingjing_${timestamp}.db"
        
        local count=$(ls -1 ${BACKUP_DIR}/lingjing_*.db 2>/dev/null | wc -l)
        if [ "$count" -gt 7 ]; then
            ls -1t ${BACKUP_DIR}/lingjing_*.db | tail -n +8 | xargs rm -f
            log_info "Cleaned up old backups (keeping last 7)"
        fi
    else
        log_warn "Database file not found, skipping backup"
    fi
}

deploy_application() {
    log_info "Deploying application..."
    
    cd "${DEPLOY_DIR}/cloud-server"
    
    if [ -f "package.json" ]; then
        log_info "Installing dependencies..."
        npm install --production --no-optional
    fi
    
    log_info "Starting application with PM2..."
    pm2 start "${SCRIPT_DIR}/ecosystem.config.json" --env production
    
    log_info "Application deployed"
}

configure_nginx() {
    log_info "Configuring Nginx..."
    
    local nginx_conf="${SCRIPT_DIR}/nginx.conf"
    local sites_available="/etc/nginx/sites-available/lingjing"
    local sites_enabled="/etc/nginx/sites-enabled/lingjing"
    
    cp "$nginx_conf" "$sites_available"
    
    if [ ! -L "$sites_enabled" ]; then
        ln -s "$sites_available" "$sites_enabled"
    fi
    
    nginx -t
    
    if [ $? -eq 0 ]; then
        systemctl reload nginx
        log_info "Nginx configured and reloaded"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

setup_health_check() {
    log_info "Setting up health check cron..."
    
    local cron_script="${SCRIPT_DIR}/health-check.sh"
    
    cat > "$cron_script" << 'HEALTH_EOF'
#!/bin/bash
HEALTH_URL="https://ide.zhejiangjinmo.com/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$HEALTH_URL")

if [ "$RESPONSE" != "200" ]; then
    echo "[$(date)] Health check FAILED (HTTP $RESPONSE), restarting..." >> /var/log/lingjing/health-check.log
    pm2 restart lingjing-cloud
else
    echo "[$(date)] Health check OK" >> /var/log/lingjing/health-check.log
fi
HEALTH_EOF
    
    chmod +x "$cron_script"
    
    (crontab -l 2>/dev/null; echo "*/5 * * * * ${cron_script}") | crontab -
    
    log_info "Health check cron configured (every 5 minutes)"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    sleep 5
    
    local max_retries=10
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:8000/health")
        
        if [ "$response" = "200" ]; then
            log_info "Deployment verified successfully!"
            return 0
        fi
        
        log_warn "Health check returned HTTP $response, retrying... ($((retry+1))/$max_retries)"
        retry=$((retry+1))
        sleep 3
    done
    
    log_error "Deployment verification failed after $max_retries retries"
    return 1
}

main() {
    log_info "Starting deployment..."
    
    check_prerequisites
    check_env_vars
    create_dirs
    backup_database
    deploy_application
    configure_nginx
    setup_health_check
    verify_deployment
    
    log_info "Deployment complete!"
    log_info "Application status:"
    pm2 status
}

main "$@"
