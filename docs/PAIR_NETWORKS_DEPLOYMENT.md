# Pair Networks Deployment Guide for Stack Blog CMS

## Overview

This guide documents the complete deployment process for Stack Blog CMS on Pair Networks shared hosting, based on successful TeachMetrics deployment patterns.

## Prerequisites

### Required Access
- ✅ Pair Networks hosting account with SSH access enabled
- ✅ SSH public key configured in Pair Networks control panel
- ✅ Domain configured to point to Pair Networks servers

### Required Tools
- ✅ SSH client with key authentication
- ✅ rsync for file synchronization
- ✅ Node.js project with proper structure

## SSH Key Configuration

### Step 1: Generate SSH Key (if needed)
```bash
# Generate RSA key for Pair Networks compatibility
ssh-keygen -t rsa -b 4096 -C "your-deployment@pair.com" -f ~/.ssh/pair_networks_rsa

# Or use existing key
ls ~/.ssh/teachmetrics_pair_rsa.pub
```

### Step 2: Add SSH Key to Pair Networks
1. Login to Pair Networks control panel
2. Navigate to "Manage SSH Access"
3. Paste public key content in "SSH Key" field
4. Set descriptive title (e.g., "Stack Blog Deployment Key")
5. Wait 20 minutes for key activation

### Step 3: Verify Key Configuration
```bash
# Check key fingerprint
ssh-keygen -lf ~/.ssh/teachmetrics_pair_rsa.pub

# Expected output:
# 4096 SHA256:Lk+sjKohlm9WRfncgfDO1MFgKCLmYIk+/pwlkNiwXq8 teachmetrics-deployment@pair.com (RSA)

# Verify key is loaded in SSH agent
ssh-add -l | grep "teachmetrics-deployment@pair.com"
```

## Deployment Process

### Automated Deployment Script

The complete deployment is handled by `deploy-pair-networks.sh`:

```bash
#!/bin/bash
# Stack Blog MVP Deployment Script for Pair Networks

set -e  # Exit on any error

echo "🚀 Starting Stack Blog MVP deployment to Pair Networks..."

# Configuration
REMOTE_USER="certifiedhq"
REMOTE_HOST="certifiedhq.pairserver.com"  
REMOTE_PATH="~/public_html/cpeio.online"
LOCAL_PATH="."

# Pre-deployment checks
echo "🔍 Running pre-deployment checks..."
[[ $(git status --porcelain) ]] && echo "⚠️ Uncommitted changes detected"

# Prepare deployment package
DEPLOY_DIR="/tmp/stack_blog_deploy_$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# Copy application files (excluding dev files)
rsync -av --progress \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='__tests__' \
    "$LOCAL_PATH/" "$DEPLOY_DIR/"

# Copy production environment
cp .env.production "$DEPLOY_DIR/.env"

# Deploy to server
echo "🌐 Deploying to Pair Networks server..."
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_PATH"

# Upload files
rsync -avz --progress --delete \
    "$DEPLOY_DIR/" \
    "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"

# Server setup and start
ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
    cd ~/public_html/cpeio.online
    
    # Install dependencies
    npm install --production
    
    # Setup directories
    mkdir -p content/pages content/media logs
    chmod -R 755 .
    chmod -R 766 content/
    
    # Stop existing process
    pkill -f "node.*app.js" || true
    
    # Start application
    nohup npm start > app.log 2>&1 &
    
    # Verify startup
    sleep 5
    pgrep -f "node.*app.js" && echo "✅ Application started"
EOF

# Cleanup
rm -rf "$DEPLOY_DIR"
echo "✅ Deployment completed successfully!"
```

### Manual Deployment Steps

If automated deployment fails, follow these manual steps:

#### 1. Prepare Local Package
```bash
# Create deployment package
mkdir -p /tmp/stack_blog_manual
rsync -av --exclude='.git' --exclude='node_modules' ./ /tmp/stack_blog_manual/
cp .env.production /tmp/stack_blog_manual/.env
```

#### 2. Upload to Server
```bash
# Upload via rsync
rsync -avz /tmp/stack_blog_manual/ certifiedhq@certifiedhq.pairserver.com:~/public_html/cpeio.online/

# Or upload via SFTP
sftp certifiedhq@certifiedhq.pairserver.com
cd public_html/cpeio.online
put -r /tmp/stack_blog_manual/*
```

#### 3. Server Configuration
```bash
# Connect to server
ssh certifiedhq@certifiedhq.pairserver.com

# Navigate to application directory
cd ~/public_html/cpeio.online

# Install dependencies
npm install --production

# Create required directories
mkdir -p content/pages content/media logs

# Set permissions
chmod -R 755 .
chmod -R 766 content/ logs/

# Check Node.js version
node --version  # Should be 16+ for Stack Blog compatibility
```

#### 4. Application Startup
```bash
# Stop any existing processes
pkill -f "node.*app.js" || true
pkill -f "npm.*start" || true

# Start application with nohup for persistence
nohup npm start > app.log 2>&1 &

# Verify application is running
ps aux | grep node
pgrep -f "node.*app.js"

# Check application logs
tail -f app.log

# Test local connectivity
curl http://localhost:3000/api/status
```

## Production Configuration

### Environment Variables (.env.production)
```bash
# Application Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true

# Security Configuration
SESSION_SECRET=your-64-character-session-secret-here
API_KEY=your-32-character-api-key-here
ADMIN_PASSWORD_HASH=your-bcrypt-password-hash-here

# Content & Media Paths
CONTENT_PATH=./content
MEDIA_PATH=./content/media
UPLOAD_MAX_SIZE=10485760

# Performance & Caching
CACHE_TTL=300000
CACHE_ENABLED=true
TEMPLATE_CACHE_ENABLED=true

# Security Features
RATE_LIMIT_ENABLED=true
SECURITY_HEADERS_ENABLED=true

# RSS Configuration
RSS_ANALYTICS_ENABLED=true
PERFORMANCE_MONITORING=true

# Pair Networks Specific
HOSTING_PROVIDER=pair_networks
```

### Apache Reverse Proxy (.htaccess)

Create `.htaccess` in domain root (not in cpeio.online subdirectory):

```apache
# Stack Blog CMS Reverse Proxy Configuration
RewriteEngine On

# Redirect all requests to Node.js application
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://localhost:3000/$1 [P,L]

# Enable proxy module
ProxyPreserveHost On
ProxyRequests Off

# Set headers for backend
ProxyPassMatch ^/(.*)$ http://localhost:3000/$1
ProxyPassReverse / http://localhost:3000/

# Security headers
Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
Header always set X-Frame-Options DENY
Header always set X-Content-Type-Options nosniff
```

## Process Management

### Using nohup (Recommended for Pair Networks)
```bash
# Start application
nohup npm start > logs/app.log 2>&1 &

# Check if running
pgrep -f "node.*app.js"

# View logs
tail -f logs/app.log

# Stop application
pkill -f "node.*app.js"
```

### Using screen (Alternative)
```bash
# Start in screen session
screen -dmS stackblog npm start

# List sessions
screen -list

# Attach to session
screen -r stackblog

# Detach: Ctrl+A, then D
```

### Using PM2 (If available)
```bash
# Install PM2 globally (if permitted)
npm install -g pm2

# Start application
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs

# Auto-restart on reboot
pm2 startup
pm2 save
```

## Health Monitoring

### Application Health Check
```bash
# API status endpoint
curl https://cpeio.online/api/status

# Expected response:
# {"success":true,"data":{"status":"operational","version":"MVP"}}

# Local health check
curl http://localhost:3000/api/status
```

### System Monitoring
```bash
# Check application process
ps aux | grep node

# Check memory usage
free -h

# Check disk space
df -h

# Check application logs
tail -n 50 ~/public_html/cpeio.online/logs/app.log
```

### Automated Health Monitoring
```bash
# Add to crontab for health checks
crontab -e

# Add line for 5-minute health checks:
*/5 * * * * curl -f http://localhost:3000/api/status > /dev/null 2>&1 || (pkill -f "node.*app.js"; cd ~/public_html/cpeio.online && nohup npm start > logs/app.log 2>&1 &)
```

## Troubleshooting

### Common Issues

#### SSH Connection Timeout
```bash
# Check if SSH is enabled in Pair Networks control panel
# Verify SSH key is properly configured
# Try different network/VPN if connection blocked

# Test connectivity
ping certifiedhq.pairserver.com
telnet certifiedhq.pairserver.com 22
```

#### Application Won't Start
```bash
# Check Node.js version compatibility
node --version  # Must be 16+

# Check npm installation
npm --version

# Verify dependencies
npm list --depth=0

# Check for port conflicts
lsof -i :3000

# Review application logs
cat logs/app.log
```

#### 500 Errors on Admin Panel
```bash
# Check for template rendering issues
grep -i error logs/app.log

# Verify environment configuration
grep ADMIN_PASSWORD_HASH .env

# Check file permissions
ls -la content/
```

#### Memory/Performance Issues
```bash
# Monitor memory usage
ps aux | grep node

# Check available memory
free -h

# Restart application if memory leak suspected
pkill -f "node.*app.js"
nohup npm start > logs/app.log 2>&1 &
```

### Log Analysis
```bash
# View recent application logs
tail -n 100 logs/app.log

# Search for errors
grep -i error logs/app.log

# Monitor real-time logs
tail -f logs/app.log

# Check system logs (if accessible)
tail /var/log/apache2/error.log
```

## Success Validation

### Deployment Verification Checklist
- [ ] Application starts without errors
- [ ] API status endpoint returns 200
- [ ] Admin panel accessible (after MVP deployment)
- [ ] Content pages render correctly
- [ ] RSS feeds generate properly
- [ ] Media uploads work
- [ ] Performance meets targets (<200ms)

### MVP Feature Validation
- [ ] Ghost theme compatibility active
- [ ] RSS analytics platform functional
- [ ] Sponsor management available
- [ ] Enhanced admin interface working
- [ ] Performance optimization enabled

## Replication Template

This deployment process can be replicated for other Node.js projects by:

1. **Adapting Configuration**: Update domain, paths, and environment variables
2. **Modifying Scripts**: Adjust deployment script for project specifics
3. **Environment Setup**: Copy .env.production template
4. **Process Management**: Use same nohup/screen approach
5. **Health Monitoring**: Implement similar health check system

## Security Considerations

### Production Security
- SSH key-only authentication
- Environment variable protection (.env not in git)
- Rate limiting enabled
- Security headers configured
- Regular security updates

### Monitoring
- Application health checks
- Log monitoring for errors
- Performance monitoring
- Security event tracking

---

**Based on successful TeachMetrics deployment to Pair Networks with SSH key authentication, Node.js service management, and Apache reverse proxy configuration.**