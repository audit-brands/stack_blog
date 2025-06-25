# Deployment Guide

This guide covers deploying Stack Blog to production environments with proper security, performance, and monitoring configurations.

## 🎯 Pre-Deployment Checklist

### Security Requirements
- [ ] Strong session secret (64+ random characters)
- [ ] Secure API key (32+ random characters) 
- [ ] Admin password hash generated with bcrypt
- [ ] HTTPS SSL certificate configured
- [ ] Environment variables properly set
- [ ] Rate limiting configured for your traffic
- [ ] CORS origins restricted to your domains
- [ ] Firewall rules configured
- [ ] Log monitoring set up

### Performance Requirements
- [ ] Node.js 18+ installed
- [ ] Sufficient RAM (minimum 512MB, recommended 2GB+)
- [ ] SSD storage for better I/O performance
- [ ] Reverse proxy configured (Nginx/Apache)
- [ ] Process manager configured (PM2/systemd)
- [ ] Content caching enabled
- [ ] Static file serving optimized

## 🚀 Deployment Methods

### Method 1: Pair Networks Deployment (Production Ready)

**Status**: ✅ **Live and Working at [cpeio.online](https://cpeio.online/)**

For Pair Networks hosting, see our comprehensive guide:
- **Quick Start**: Use `./deploy-pair-networks.sh`
- **Detailed Guide**: [PAIR_NETWORKS_LESSONS_LEARNED.md](./PAIR_NETWORKS_LESSONS_LEARNED.md)
- **Key Requirement**: Configure reverse proxy to port 8080 in control panel

### Method 2: Universal Deployment (Any Platform)

**Best for:** Most users who want a quick, automated setup without Docker.

This method uses our automated deployment script that handles everything for you:

```bash
# Download and run the simple deployment script
curl -fsSL https://raw.githubusercontent.com/audit-brands/stack_blog/main/scripts/deploy-simple.sh | bash
```

**What it does:**
- ✅ Checks system requirements (Node.js 16+, npm, git)
- ✅ Creates dedicated application user (`stackblog`)
- ✅ Clones and installs the application
- ✅ Generates secure environment configuration
- ✅ Sets up systemd service for automatic startup
- ✅ Configures Nginx reverse proxy (optional)
- ✅ Sets up log rotation and daily backups
- ✅ Configures UFW firewall (optional)

**After deployment:**
1. Run the interactive setup: `sudo -u stackblog node /home/stackblog/stack_blog/scripts/setup.js`
2. Access your site at `http://your-server-ip:3000` (or your domain if Nginx is configured)
3. Admin panel: `http://your-server-ip:3000/admin`

**Service Management:**
```bash
sudo systemctl status stack-blog    # Check status
sudo systemctl restart stack-blog   # Restart
sudo systemctl stop stack-blog      # Stop
sudo journalctl -u stack-blog -f    # View logs
```

### Method 2: Traditional VPS/Server Deployment

#### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 process manager
sudo npm install -g pm2

# Create application user
sudo useradd -m -s /bin/bash stackblog
sudo usermod -aG sudo stackblog
```

#### 2. Application Setup

```bash
# Switch to application user
sudo su - stackblog

# Clone repository
git clone https://github.com/audit-brands/stack_blog.git
cd stack_blog

# Install production dependencies
npm ci --production

# Create directories
mkdir -p logs content/media
chmod 755 content content/media
```

#### 3. Environment Configuration

```bash
# Create production environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# Security Configuration (CHANGE THESE!)
SESSION_SECRET=your-cryptographically-secure-session-secret-64-chars-min
API_KEY=your-secure-api-key-32-chars-minimum
ADMIN_PASSWORD_HASH=$2b$12$your-bcrypt-password-hash-here

# Application Configuration
CONTENT_PATH=./content
MEDIA_PATH=./content/media
CACHE_TTL=900000

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
EOF

# Secure environment file
chmod 600 .env
```

#### 4. Generate Secrets

```bash
# Generate session secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate admin password hash
npm run setup
# Follow prompts and copy the hash to .env
```

#### 5. PM2 Configuration

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
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
    node_args: '--max-old-space-size=512'
  }]
};
EOF
```

#### 6. Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by PM2

# Monitor application
pm2 status
pm2 logs stack-blog
```

### Method 3: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S stackblog -u 1001

# Copy application code
COPY --chown=stackblog:nodejs . .

# Create necessary directories
RUN mkdir -p content/media logs && \
    chown -R stackblog:nodejs content logs

# Switch to non-root user
USER stackblog

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "app.js"]
EOF
```

#### 2. Docker Compose Setup

```yaml
# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  stack-blog:
    build: .
    container_name: stack-blog
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    volumes:
      - ./content:/usr/src/app/content
      - ./logs:/usr/src/app/logs
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.stack-blog.rule=Host(`yourdomain.com`)"
      - "traefik.http.routers.stack-blog.tls=true"
      - "traefik.http.routers.stack-blog.tls.certresolver=letsencrypt"

  nginx:
    image: nginx:alpine
    container_name: nginx-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - stack-blog
EOF
```

#### 3. Deploy with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f stack-blog

# Scale application
docker-compose up -d --scale stack-blog=3
```

## 🔧 Reverse Proxy Configuration

### Nginx Configuration

```nginx
# Create /etc/nginx/sites-available/stack-blog
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Static Files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }

    # API Rate Limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Admin Rate Limiting
    location /admin/login {
        limit_req zone=login burst=3 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main Application
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### Apache Configuration

```apache
# Create /etc/apache2/sites-available/stack-blog.conf
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    Redirect permanent / https://yourdomain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com

    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    SSLProtocol all -SSLv2 -SSLv3
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305

    # Security Headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Frame-Options DENY
    Header always set X-Content-Type-Options nosniff

    # Proxy Configuration
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Set headers for the backend
    ProxyPassReverse / http://localhost:3000/
    ProxyPassReverseRewrite Location ^http://localhost:3000/(.*) https://yourdomain.com/$1
</VirtualHost>
```

## 🔒 SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add line: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Setup

```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Follow your CA's process to obtain certificate
# Install certificate files in secure location
sudo mkdir -p /etc/ssl/stack-blog
sudo cp certificate.crt /etc/ssl/stack-blog/
sudo cp private.key /etc/ssl/stack-blog/
sudo chmod 600 /etc/ssl/stack-blog/*
```

## 📊 Monitoring and Logging

### PM2 Monitoring

```bash
# Real-time monitoring
pm2 monit

# Memory and CPU usage
pm2 status

# Application logs
pm2 logs stack-blog --lines 100

# Restart application
pm2 restart stack-blog

# Reload application (zero-downtime)
pm2 reload stack-blog
```

### Log Configuration

```bash
# Set up log rotation
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
```

### System Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs

# Monitor system resources
htop           # CPU and memory
iotop          # Disk I/O
nethogs        # Network usage
```

## 🔧 Performance Optimization

### Node.js Optimization

```bash
# Environment variables for production
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"
export UV_THREADPOOL_SIZE=128
```

### Caching Configuration

```javascript
// Add to .env
CACHE_TTL=900000          # 15 minutes
ENABLE_CONTENT_CACHE=true
ENABLE_SEARCH_CACHE=true
CACHE_MAX_SIZE=100        # Max cached items
```

### Database Optimization (if using plugins)

```bash
# For plugins using SQLite
sudo apt install sqlite3

# Optimize SQLite performance
echo "PRAGMA journal_mode=WAL;" | sqlite3 database.db
echo "PRAGMA synchronous=NORMAL;" | sqlite3 database.db
```

## 🚨 Backup and Recovery

### Automated Backup Script

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash

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

chmod +x backup.sh

# Add to crontab for daily backups
echo "0 2 * * * /home/stackblog/backup.sh" | crontab -
```

### Recovery Process

```bash
# Stop application
pm2 stop stack-blog

# Restore content
cd /home/stackblog/stack_blog
tar -xzf /backup/stack-blog/content_YYYYMMDD_HHMMSS.tar.gz

# Restore environment
cp /backup/stack-blog/env_YYYYMMDD_HHMMSS.backup .env

# Restart application
pm2 start stack-blog
```

## 🔍 Health Checks

### Application Health Check

```javascript
// Create healthcheck.js
const http = require('http');

const options = {
  host: 'localhost',
  port: 3000,
  path: '/api/status',
  timeout: 2000
};

const request = http.request(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', () => {
  process.exit(1);
});

request.end();
```

### External Monitoring

```bash
# Simple uptime monitoring with curl
*/5 * * * * curl -f https://yourdomain.com/api/status > /dev/null 2>&1 || echo "Site down" | mail -s "Stack Blog Down" admin@yourdomain.com
```

## 🛡️ Security Hardening

### Firewall Configuration

```bash
# UFW firewall setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Advanced iptables rules
sudo iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
```

### System Security

```bash
# Disable root SSH login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Enable fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Create fail2ban jail for Stack Blog
sudo cat > /etc/fail2ban/jail.d/stack-blog.conf << 'EOF'
[stack-blog]
enabled = true
port = http,https
filter = stack-blog
logpath = /home/stackblog/stack_blog/logs/combined.log
maxretry = 5
bantime = 3600
EOF
```

## 📈 Scaling Considerations

### Horizontal Scaling

```bash
# Load balancer configuration (HAProxy example)
backend stack-blog
    balance roundrobin
    server app1 10.0.1.10:3000 check
    server app2 10.0.1.11:3000 check
    server app3 10.0.1.12:3000 check
```

### Vertical Scaling

```javascript
// PM2 cluster mode
module.exports = {
  apps: [{
    name: 'stack-blog',
    script: './app.js',
    instances: 'max',        # Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G' # Increase memory limit
  }]
};
```

## 🐛 Troubleshooting

### Common Issues

1. **Application won't start**
   ```bash
   # Check logs
   pm2 logs stack-blog
   
   # Check environment
   node -e "console.log(process.env.NODE_ENV)"
   
   # Verify dependencies
   npm ls
   ```

2. **High memory usage**
   ```bash
   # Monitor memory
   pm2 monit
   
   # Restart application
   pm2 restart stack-blog
   
   # Check for memory leaks
   node --inspect app.js
   ```

3. **SSL certificate issues**
   ```bash
   # Test certificate
   openssl x509 -in certificate.crt -text -noout
   
   # Check expiration
   echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
   ```

### Performance Issues

```bash
# Check system resources
top
df -h
free -m

# Application performance
pm2 show stack-blog
curl -w "@curl-format.txt" -o /dev/null -s "https://yourdomain.com/"
```

## 📞 Support

For deployment issues:
1. Check this documentation first
2. Review application logs: `pm2 logs stack-blog`
3. Check system logs: `sudo journalctl -u nginx -f`
4. Monitor system resources: `htop`
5. Report issues on GitHub with relevant logs

Remember to sanitize any sensitive information before sharing logs or configurations.