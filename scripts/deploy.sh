#!/bin/bash

# Stack Blog Deployment Script
# This script automates the deployment process for Stack Blog

set -e  # Exit on any error

# Configuration
APP_NAME="stack-blog"
APP_DIR="/home/stackblog/stack_blog"
BACKUP_DIR="/backup/stack-blog"
NODE_VERSION="18"
PM2_ECOSYSTEM="ecosystem.config.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check system requirements
check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Node.js
    if ! command_exists node; then
        log_error "Node.js is not installed. Please install Node.js $NODE_VERSION or higher."
        exit 1
    fi
    
    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt "$NODE_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        log_error "npm is not installed."
        exit 1
    fi
    
    # Check PM2
    if ! command_exists pm2; then
        log_warning "PM2 is not installed. Installing PM2..."
        npm install -g pm2
    fi
    
    # Check git
    if ! command_exists git; then
        log_error "git is not installed."
        exit 1
    fi
    
    log_success "System requirements check passed"
}

# Function to create application user
create_app_user() {
    if ! id "stackblog" &>/dev/null; then
        log_info "Creating stackblog user..."
        sudo useradd -m -s /bin/bash stackblog
        sudo usermod -aG sudo stackblog
        log_success "stackblog user created"
    else
        log_info "stackblog user already exists"
    fi
}

# Function to setup directories
setup_directories() {
    log_info "Setting up directories..."
    
    sudo -u stackblog mkdir -p "$APP_DIR"
    sudo -u stackblog mkdir -p "$APP_DIR/logs"
    sudo -u stackblog mkdir -p "$APP_DIR/content/media"
    sudo -u stackblog mkdir -p "$BACKUP_DIR"
    
    # Set proper permissions
    sudo chmod 755 "$APP_DIR"
    sudo chmod 755 "$APP_DIR/content"
    sudo chmod 755 "$APP_DIR/content/media"
    sudo chmod 700 "$APP_DIR/logs"
    
    log_success "Directories setup completed"
}

# Function to clone or update repository
setup_repository() {
    log_info "Setting up repository..."
    
    if [ -d "$APP_DIR/.git" ]; then
        log_info "Repository exists, pulling latest changes..."
        cd "$APP_DIR"
        sudo -u stackblog git fetch origin
        sudo -u stackblog git reset --hard origin/main
    else
        log_info "Cloning repository..."
        sudo -u stackblog git clone https://github.com/audit-brands/stack_blog.git "$APP_DIR"
        cd "$APP_DIR"
    fi
    
    log_success "Repository setup completed"
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$APP_DIR"
    sudo -u stackblog npm ci --production
    
    log_success "Dependencies installed"
}

# Function to setup environment configuration
setup_environment() {
    log_info "Setting up environment configuration..."
    
    if [ ! -f "$APP_DIR/.env" ]; then
        log_warning ".env file not found. Creating from template..."
        
        sudo -u stackblog cat > "$APP_DIR/.env" << 'EOF'
NODE_ENV=production
PORT=3000

# Security Configuration (CHANGE THESE!)
SESSION_SECRET=CHANGE-THIS-TO-A-SECURE-64-CHAR-SECRET
API_KEY=CHANGE-THIS-TO-A-SECURE-32-CHAR-KEY
ADMIN_PASSWORD_HASH=CHANGE-THIS-TO-BCRYPT-HASH

# Application Configuration
CONTENT_PATH=./content
MEDIA_PATH=./content/media
CACHE_TTL=300000

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF
        
        sudo chmod 600 "$APP_DIR/.env"
        sudo chown stackblog:stackblog "$APP_DIR/.env"
        
        log_warning "Please edit $APP_DIR/.env with your configuration before continuing!"
        log_warning "Run: sudo -u stackblog nano $APP_DIR/.env"
        exit 1
    else
        log_success "Environment configuration found"
    fi
}

# Function to generate secrets
generate_secrets() {
    log_info "Generating secure secrets..."
    
    # Generate session secret
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    log_info "Generated session secret: $SESSION_SECRET"
    
    # Generate API key
    API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    log_info "Generated API key: $API_KEY"
    
    log_warning "Please save these secrets and update your .env file!"
    log_warning "You will also need to generate an admin password hash using: npm run setup"
}

# Function to create PM2 ecosystem file
create_pm2_config() {
    log_info "Creating PM2 configuration..."
    
    sudo -u stackblog cat > "$APP_DIR/$PM2_ECOSYSTEM" << 'EOF'
module.exports = {
  apps: [{
    name: 'stack-blog',
    script: './app.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '512M',
    node_args: '--max-old-space-size=512',
    
    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Auto restart on file changes (disable in production)
    watch: false,
    ignore_watch: ['node_modules', 'logs', 'content/media'],
    
    // Source map support
    source_map_support: true,
    
    // Merge logs
    merge_logs: true,
    
    // Auto restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
EOF
    
    log_success "PM2 configuration created"
}

# Function to setup log rotation
setup_log_rotation() {
    log_info "Setting up log rotation..."
    
    sudo cat > /etc/logrotate.d/stack-blog << 'EOF'
/home/stackblog/stack_blog/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 stackblog stackblog
    postrotate
        /usr/bin/pm2 reloadLogs
    endscript
}
EOF
    
    log_success "Log rotation configured"
}

# Function to create backup script
create_backup_script() {
    log_info "Creating backup script..."
    
    sudo -u stackblog cat > "$APP_DIR/backup.sh" << 'EOF'
#!/bin/bash

# Stack Blog Backup Script
BACKUP_DIR="/backup/stack-blog"
APP_DIR="/home/stackblog/stack_blog"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup content and configuration
tar -czf "$BACKUP_DIR/content_$DATE.tar.gz" -C "$APP_DIR" content/
cp "$APP_DIR/.env" "$BACKUP_DIR/env_$DATE.backup"

# Backup application code (optional)
tar -czf "$BACKUP_DIR/app_$DATE.tar.gz" -C "$APP_DIR" --exclude=node_modules --exclude=logs .

# Clean old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.backup" -mtime +30 -delete

echo "Backup completed: $DATE"
EOF
    
    sudo chmod +x "$APP_DIR/backup.sh"
    sudo chown stackblog:stackblog "$APP_DIR/backup.sh"
    
    # Add to crontab for daily backups
    (sudo -u stackblog crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | sudo -u stackblog crontab -
    
    log_success "Backup script created and scheduled"
}

# Function to create health check script
create_health_check() {
    log_info "Creating health check script..."
    
    sudo -u stackblog cat > "$APP_DIR/healthcheck.js" << 'EOF'
const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/api/status',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(`Health check failed: ${res.statusCode}`);
    process.exit(1);
  }
});

request.on('error', (error) => {
  console.log(`Health check failed: ${error.message}`);
  process.exit(1);
});

request.end();
EOF
    
    log_success "Health check script created"
}

# Function to setup systemd service (alternative to PM2)
setup_systemd_service() {
    log_info "Creating systemd service..."
    
    sudo cat > /etc/systemd/system/stack-blog.service << 'EOF'
[Unit]
Description=Stack Blog CMS
After=network.target

[Service]
Type=simple
User=stackblog
WorkingDirectory=/home/stackblog/stack_blog
ExecStart=/usr/bin/node app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

# Logging
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=stack-blog

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/stackblog/stack_blog

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable stack-blog
    
    log_success "Systemd service created and enabled"
}

# Function to setup firewall
setup_firewall() {
    log_info "Setting up firewall..."
    
    if command_exists ufw; then
        sudo ufw --force reset
        sudo ufw default deny incoming
        sudo ufw default allow outgoing
        sudo ufw allow ssh
        sudo ufw allow 80
        sudo ufw allow 443
        sudo ufw --force enable
        
        log_success "UFW firewall configured"
    else
        log_warning "UFW not available, please configure firewall manually"
    fi
}

# Function to install and configure nginx
setup_nginx() {
    log_info "Setting up Nginx..."
    
    if ! command_exists nginx; then
        sudo apt update
        sudo apt install -y nginx
    fi
    
    # Create nginx configuration
    sudo cat > /etc/nginx/sites-available/stack-blog << 'EOF'
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (update paths)
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Enable site
    sudo ln -sf /etc/nginx/sites-available/stack-blog /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl enable nginx
    sudo systemctl restart nginx
    
    log_success "Nginx configured"
    log_warning "Please update SSL certificate paths in /etc/nginx/sites-available/stack-blog"
}

# Function to start application
start_application() {
    log_info "Starting Stack Blog..."
    
    cd "$APP_DIR"
    
    # Start with PM2
    sudo -u stackblog pm2 start "$PM2_ECOSYSTEM" --env production
    sudo -u stackblog pm2 save
    
    # Setup PM2 startup script
    sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u stackblog --hp /home/stackblog
    
    log_success "Stack Blog started with PM2"
}

# Function to run post-deployment checks
post_deployment_checks() {
    log_info "Running post-deployment checks..."
    
    # Check if application is running
    if sudo -u stackblog pm2 show stack-blog > /dev/null 2>&1; then
        log_success "Application is running"
    else
        log_error "Application is not running"
        return 1
    fi
    
    # Health check
    sleep 5
    if cd "$APP_DIR" && sudo -u stackblog node healthcheck.js; then
        log_success "Health check passed"
    else
        log_warning "Health check failed, check application logs"
    fi
    
    # Check logs
    log_info "Recent application logs:"
    sudo -u stackblog pm2 logs stack-blog --lines 5 --nostream
}

# Function to display summary
display_summary() {
    log_success "Deployment completed!"
    echo
    log_info "Application Details:"
    echo "  - Application: Stack Blog CMS"
    echo "  - Directory: $APP_DIR"
    echo "  - User: stackblog"
    echo "  - Port: 3000"
    echo "  - Process Manager: PM2"
    echo
    log_info "Next Steps:"
    echo "  1. Update .env file with your configuration: sudo -u stackblog nano $APP_DIR/.env"
    echo "  2. Generate admin password: cd $APP_DIR && sudo -u stackblog npm run setup"
    echo "  3. Configure SSL certificates in Nginx"
    echo "  4. Update domain names in Nginx configuration"
    echo "  5. Test your deployment: https://yourdomain.com"
    echo
    log_info "Management Commands:"
    echo "  - View logs: sudo -u stackblog pm2 logs stack-blog"
    echo "  - Restart app: sudo -u stackblog pm2 restart stack-blog"
    echo "  - Stop app: sudo -u stackblog pm2 stop stack-blog"
    echo "  - App status: sudo -u stackblog pm2 status"
    echo "  - Run backup: sudo -u stackblog $APP_DIR/backup.sh"
}

# Main deployment function
main() {
    log_info "Starting Stack Blog deployment..."
    
    # Check if running as root or with sudo
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root or with sudo"
        exit 1
    fi
    
    # Update system packages
    log_info "Updating system packages..."
    apt update && apt upgrade -y
    
    # Install required packages
    log_info "Installing required packages..."
    apt install -y curl git build-essential
    
    # Install Node.js if not present
    if ! command_exists node; then
        log_info "Installing Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    fi
    
    # Run deployment steps
    check_requirements
    create_app_user
    setup_directories
    setup_repository
    install_dependencies
    setup_environment
    create_pm2_config
    setup_log_rotation
    create_backup_script
    create_health_check
    setup_firewall
    setup_nginx
    
    # Only start if environment is configured
    if grep -q "CHANGE-THIS" "$APP_DIR/.env"; then
        log_warning "Environment not configured. Please update .env file before starting."
        log_info "Run this script again after configuring .env to start the application."
    else
        start_application
        post_deployment_checks
    fi
    
    display_summary
}

# Script options
case "${1:-}" in
    --generate-secrets)
        generate_secrets
        ;;
    --start)
        start_application
        ;;
    --health-check)
        cd "$APP_DIR" && sudo -u stackblog node healthcheck.js
        ;;
    --backup)
        sudo -u stackblog "$APP_DIR/backup.sh"
        ;;
    --help)
        echo "Stack Blog Deployment Script"
        echo
        echo "Usage: $0 [option]"
        echo
        echo "Options:"
        echo "  (no option)        Run full deployment"
        echo "  --generate-secrets Generate secure secrets"
        echo "  --start           Start application only"
        echo "  --health-check    Run health check"
        echo "  --backup          Run backup"
        echo "  --help            Show this help"
        ;;
    *)
        main
        ;;
esac