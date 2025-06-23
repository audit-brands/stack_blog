#!/bin/bash

# Stack Blog - Simple Deployment Script (No Docker)
# This script deploys Stack Blog to a VPS or server without Docker dependencies

set -e

# Configuration
APP_NAME="stack_blog"
APP_USER="stackblog"
APP_DIR="/home/$APP_USER/$APP_NAME"
BACKUP_DIR="/home/$APP_USER/backups"
LOG_FILE="/tmp/stack_blog_deploy.log"
SYSTEMD_SERVICE="stack-blog"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root. Run as a regular user with sudo privileges."
    fi
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 16+ first."
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node -v | sed 's/v//')
    REQUIRED_VERSION="16.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
        error "Node.js version $NODE_VERSION is too old. Please install Node.js 16 or higher."
    fi
    
    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
    fi
    
    # Check if git is installed
    if ! command -v git &> /dev/null; then
        error "git is not installed. Please install git first."
    fi
    
    # Check if systemctl is available
    if ! command -v systemctl &> /dev/null; then
        warning "systemctl not available. Service management will be skipped."
        SYSTEMD_AVAILABLE=false
    else
        SYSTEMD_AVAILABLE=true
    fi
    
    info "System requirements check passed"
}

# Create application user
create_app_user() {
    if id "$APP_USER" &>/dev/null; then
        info "User $APP_USER already exists"
    else
        log "Creating application user: $APP_USER"
        sudo useradd -m -s /bin/bash "$APP_USER"
        sudo usermod -aG www-data "$APP_USER" 2>/dev/null || true
    fi
}

# Setup application directory
setup_app_directory() {
    log "Setting up application directory..."
    
    sudo mkdir -p "$APP_DIR"
    sudo mkdir -p "$BACKUP_DIR"
    sudo chown -R "$APP_USER:$APP_USER" "/home/$APP_USER"
}

# Install or update application
install_application() {
    log "Installing/updating Stack Blog application..."
    
    if [ -d "$APP_DIR/.git" ]; then
        info "Updating existing installation..."
        sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin
        sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
    else
        info "Fresh installation..."
        sudo -u "$APP_USER" git clone https://github.com/audit-brands/stack_blog.git "$APP_DIR"
    fi
    
    # Install dependencies
    log "Installing Node.js dependencies..."
    sudo -u "$APP_USER" bash -c "cd $APP_DIR && npm ci --production"
    
    # Create required directories
    sudo -u "$APP_USER" mkdir -p "$APP_DIR/content/pages"
    sudo -u "$APP_USER" mkdir -p "$APP_DIR/content/media"
    sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"
}

# Create environment file
create_env_file() {
    log "Creating environment configuration..."
    
    ENV_FILE="$APP_DIR/.env"
    
    if [ ! -f "$ENV_FILE" ]; then
        info "Creating new .env file..."
        sudo -u "$APP_USER" cp "$APP_DIR/.env.example" "$ENV_FILE"
        
        # Generate random secrets
        SESSION_SECRET=$(openssl rand -hex 32)
        API_KEY=$(openssl rand -hex 16)
        
        # Update .env file with generated values
        sudo -u "$APP_USER" sed -i "s/your-session-secret-here/$SESSION_SECRET/" "$ENV_FILE"
        sudo -u "$APP_USER" sed -i "s/your-api-key-here/$API_KEY/" "$ENV_FILE"
        sudo -u "$APP_USER" sed -i "s/NODE_ENV=development/NODE_ENV=production/" "$ENV_FILE"
        
        warning "Please edit $ENV_FILE to configure your application settings"
        warning "Run 'sudo -u $APP_USER node $APP_DIR/scripts/setup.js' for interactive setup"
    else
        info "Environment file already exists"
    fi
}

# Create systemd service
create_systemd_service() {
    if [ "$SYSTEMD_AVAILABLE" = false ]; then
        warning "Skipping systemd service creation (systemctl not available)"
        return
    fi
    
    log "Creating systemd service..."
    
    SERVICE_FILE="/etc/systemd/system/$SYSTEMD_SERVICE.service"
    
    sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Stack Blog CMS
Documentation=https://github.com/audit-brands/stack_blog
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node app.js
Restart=on-failure
RestartSec=10
KillMode=process
StandardOutput=append:$APP_DIR/logs/app.log
StandardError=append:$APP_DIR/logs/error.log

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable "$SYSTEMD_SERVICE"
    
    info "Systemd service created and enabled"
}

# Setup nginx (optional)
setup_nginx() {
    if ! command -v nginx &> /dev/null; then
        warning "Nginx not installed. Skipping nginx configuration."
        return
    fi
    
    read -p "Do you want to configure Nginx reverse proxy? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        warning "No domain provided. Skipping Nginx configuration."
        return
    fi
    
    log "Configuring Nginx for domain: $DOMAIN"
    
    NGINX_CONFIG="/etc/nginx/sites-available/$APP_NAME"
    
    sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;
    limit_req_zone \$binary_remote_addr zone=api:10m rate=100r/m;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Rate limiting for admin login
    location /admin/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Rate limiting for API
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Static files with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Enable the site
    sudo ln -sf "$NGINX_CONFIG" "/etc/nginx/sites-enabled/$APP_NAME"
    
    # Test nginx configuration
    if sudo nginx -t; then
        sudo systemctl reload nginx
        info "Nginx configuration created and reloaded"
        info "Your site will be available at: http://$DOMAIN"
        info "Consider setting up SSL with certbot: sudo certbot --nginx -d $DOMAIN"
    else
        error "Nginx configuration test failed"
    fi
}

# Setup logrotate
setup_logrotate() {
    log "Setting up log rotation..."
    
    sudo tee "/etc/logrotate.d/$APP_NAME" > /dev/null <<EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 $APP_USER $APP_USER
    postrotate
        if [ -f /var/run/$SYSTEMD_SERVICE.pid ]; then
            systemctl reload $SYSTEMD_SERVICE
        fi
    endscript
}
EOF

    info "Log rotation configured"
}

# Create backup script
create_backup_script() {
    log "Creating backup script..."
    
    BACKUP_SCRIPT="$APP_DIR/scripts/backup.sh"
    
    sudo -u "$APP_USER" tee "$BACKUP_SCRIPT" > /dev/null <<'EOF'
#!/bin/bash

# Stack Blog Backup Script

APP_DIR="/home/stackblog/stack_blog"
BACKUP_DIR="/home/stackblog/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="stack_blog_backup_$DATE"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
cd "$APP_DIR"
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=logs \
    content/ .env

# Keep only last 7 backups
cd "$BACKUP_DIR"
ls -t stack_blog_backup_*.tar.gz | tail -n +8 | xargs -r rm

echo "Backup created: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
EOF

    sudo chmod +x "$BACKUP_SCRIPT"
    
    # Add to crontab
    (sudo -u "$APP_USER" crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_SCRIPT") | sudo -u "$APP_USER" crontab -
    
    info "Backup script created and scheduled daily at 2 AM"
}

# Start services
start_services() {
    if [ "$SYSTEMD_AVAILABLE" = false ]; then
        warning "Starting application manually (systemctl not available)"
        info "To start the application manually:"
        info "  sudo -u $APP_USER bash -c 'cd $APP_DIR && NODE_ENV=production nohup node app.js > logs/app.log 2>&1 &'"
        return
    fi
    
    log "Starting Stack Blog service..."
    
    if sudo systemctl start "$SYSTEMD_SERVICE"; then
        sleep 5
        if sudo systemctl is-active --quiet "$SYSTEMD_SERVICE"; then
            info "Stack Blog service started successfully"
        else
            error "Failed to start Stack Blog service. Check logs: sudo journalctl -u $SYSTEMD_SERVICE"
        fi
    else
        error "Failed to start Stack Blog service"
    fi
}

# Setup firewall (optional)
setup_firewall() {
    if ! command -v ufw &> /dev/null; then
        warning "UFW not installed. Skipping firewall configuration."
        return
    fi
    
    read -p "Do you want to configure UFW firewall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        return
    fi
    
    log "Configuring UFW firewall..."
    
    # Enable UFW
    sudo ufw --force enable
    
    # Allow SSH
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # If nginx is not configured, allow port 3000
    if ! command -v nginx &> /dev/null; then
        sudo ufw allow 3000/tcp
    fi
    
    info "Firewall configured"
}

# Display final instructions
final_instructions() {
    log "Deployment completed successfully!"
    
    echo
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}                                    STACK BLOG DEPLOYMENT COMPLETE                                     ${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "${BLUE}Application Details:${NC}"
    echo "  • Installation Path: $APP_DIR"
    echo "  • Application User: $APP_USER"
    echo "  • Log Files: $APP_DIR/logs/"
    echo "  • Backup Directory: $BACKUP_DIR"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Configure your application:"
    echo -e "     ${YELLOW}sudo -u $APP_USER node $APP_DIR/scripts/setup.js${NC}"
    echo
    echo "  2. Edit environment file if needed:"
    echo -e "     ${YELLOW}sudo -u $APP_USER nano $APP_DIR/.env${NC}"
    echo
    
    if [ "$SYSTEMD_AVAILABLE" = true ]; then
        echo "  3. Manage the service:"
        echo -e "     ${YELLOW}sudo systemctl status $SYSTEMD_SERVICE${NC}    # Check status"
        echo -e "     ${YELLOW}sudo systemctl restart $SYSTEMD_SERVICE${NC}   # Restart service"
        echo -e "     ${YELLOW}sudo systemctl stop $SYSTEMD_SERVICE${NC}      # Stop service"
        echo -e "     ${YELLOW}sudo journalctl -u $SYSTEMD_SERVICE -f${NC}    # View logs"
    fi
    echo
    echo "  4. Access your site:"
    if command -v nginx &> /dev/null && [ -f "/etc/nginx/sites-enabled/$APP_NAME" ]; then
        echo "     • Your configured domain"
    else
        echo "     • http://your-server-ip:3000"
    fi
    echo "     • Admin panel: /admin"
    echo
    echo -e "${BLUE}Security Recommendations:${NC}"
    echo "  • Set up SSL/TLS certificates (Let's Encrypt recommended)"
    echo "  • Configure fail2ban for additional protection"
    echo "  • Regularly update the system and application"
    echo "  • Monitor logs for suspicious activity"
    echo
    echo -e "${GREEN}Deployment log saved to: $LOG_FILE${NC}"
    echo
}

# Main deployment function
main() {
    echo -e "${GREEN}Stack Blog - Simple Deployment Script${NC}"
    echo -e "${BLUE}This script will deploy Stack Blog without Docker dependencies${NC}"
    echo
    
    # Confirmation
    read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    check_root
    check_requirements
    create_app_user
    setup_app_directory
    install_application
    create_env_file
    create_systemd_service
    setup_nginx
    setup_logrotate
    create_backup_script
    start_services
    setup_firewall
    final_instructions
}

# Handle script interruption
trap 'error "Deployment interrupted by user"' INT TERM

# Run main function
main "$@"