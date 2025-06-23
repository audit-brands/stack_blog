# Installation Guide

This guide provides step-by-step installation instructions for Stack Blog CMS using different deployment methods.

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: 16.x or higher (18.x recommended)
- **npm**: 8.x or higher
- **Memory**: 512MB RAM (2GB+ recommended for production)
- **Storage**: 1GB free space (SSD recommended)
- **OS**: Linux, macOS, or Windows

### Recommended Production Environment
- **Node.js**: 18.x LTS
- **Memory**: 2GB+ RAM
- **Storage**: SSD with 5GB+ free space
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- **Reverse Proxy**: Nginx or Apache
- **SSL Certificate**: Let's Encrypt or commercial certificate

## 🚀 Installation Methods

### Method 1: Simple Automated Deployment (Recommended)

**Best for:** Production servers, VPS deployments, users who want a complete setup

This method provides a fully automated installation with all production features configured.

#### Prerequisites
- Fresh Ubuntu/Debian/CentOS server
- Sudo privileges
- Internet connection

#### Installation Steps

1. **Run the automated deployment script:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/audit-brands/stack_blog/main/scripts/deploy-simple.sh | bash
   ```

2. **Follow the interactive prompts:**
   - Confirm deployment
   - Configure Nginx reverse proxy (optional)
   - Set up UFW firewall (optional)

3. **Complete the setup:**
   ```bash
   # Run interactive configuration
   sudo -u stackblog node /home/stackblog/stack_blog/scripts/setup.js
   ```

4. **Access your site:**
   - Frontend: `http://your-server-ip:3000` (or your domain)
   - Admin Panel: `http://your-server-ip:3000/admin`

#### What Gets Installed
- ✅ Application user (`stackblog`) with proper permissions
- ✅ Stack Blog CMS with all dependencies
- ✅ Systemd service for automatic startup
- ✅ Environment configuration with secure secrets
- ✅ Nginx reverse proxy (optional)
- ✅ UFW firewall rules (optional)
- ✅ Log rotation and daily backups
- ✅ Health monitoring

#### Service Management
```bash
# Check service status
sudo systemctl status stack-blog

# Start/stop/restart service
sudo systemctl start stack-blog
sudo systemctl stop stack-blog
sudo systemctl restart stack-blog

# View logs
sudo journalctl -u stack-blog -f

# View application logs
sudo tail -f /home/stackblog/stack_blog/logs/app.log
```

### Method 2: Docker Deployment

**Best for:** Containerized environments, development, easy scaling

#### Prerequisites
- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- 2GB+ available memory

#### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/audit-brands/stack_blog.git
   cd stack_blog
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   nano .env
   ```

3. **Build and start with Docker Compose:**
   ```bash
   # Development
   docker-compose up -d

   # Production
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. **Set up admin password:**
   ```bash
   # Generate password hash
   docker-compose exec app node scripts/setup.js
   ```

5. **Access your site:**
   - Frontend: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin`

#### Docker Management Commands
```bash
# View logs
docker-compose logs -f app

# Restart application
docker-compose restart app

# Update application
git pull
docker-compose build app
docker-compose up -d app

# Backup data
docker-compose exec app tar -czf /tmp/backup.tar.gz content/

# Stop services
docker-compose down
```

### Method 3: Manual Installation

**Best for:** Development, custom setups, learning purposes

#### Prerequisites
- Node.js 16+ and npm installed
- Git installed
- Terminal/command line access

#### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/audit-brands/stack_blog.git
   cd stack_blog
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env  # Edit configuration
   ```

4. **Generate admin password:**
   ```bash
   npm run setup
   ```

5. **Start the application:**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

6. **Access your site:**
   - Frontend: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin`

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with the following configuration:

```bash
# Application Settings
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Security Configuration (REQUIRED)
SESSION_SECRET=your-64-character-session-secret-here
API_KEY=your-32-character-api-key-here
ADMIN_PASSWORD_HASH=your-bcrypt-password-hash-here

# Content Configuration
CONTENT_PATH=./content
MEDIA_PATH=./content/media
UPLOAD_MAX_SIZE=10485760

# Cache Configuration
CACHE_TTL=300000
CACHE_ENABLED=true

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Logging
LOG_LEVEL=info
LOG_FORMAT=combined
```

### Security Configuration

**Required for production:**

1. **Generate secure secrets:**
   ```bash
   # Session secret (64 characters)
   openssl rand -hex 32

   # API key (32 characters)  
   openssl rand -hex 16
   ```

2. **Create admin password hash:**
   ```bash
   node scripts/setup.js
   # Follow prompts to generate password hash
   ```

3. **Configure CORS origins:**
   ```bash
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

### Content Structure

Stack Blog expects the following directory structure:

```
content/
├── pages/           # Markdown content files
│   ├── index.md     # Homepage content
│   ├── about.md     # About page
│   └── blog/        # Blog posts
│       └── post1.md
└── media/           # Uploaded media files
    ├── images/
    └── documents/
```

### Sample Content File

Create `content/pages/index.md`:

```markdown
---
title: Welcome to Stack Blog
description: A modern flat-file CMS built with Node.js
template: default
date: 2024-01-01
---

# Welcome to Stack Blog

This is your homepage content. You can edit this file or create new pages through the admin panel.

## Features

- Markdown-based content management
- Modern admin interface
- REST API support
- Full-text search
- Media management
```

## 🔧 Post-Installation Setup

### 1. Admin Panel Setup

1. **Access admin panel:** `http://your-domain/admin`
2. **Login** with your configured admin credentials
3. **Create your first page** using the page editor
4. **Upload media files** through the media manager
5. **Configure site settings** in the admin dashboard

### 2. Content Creation

**Via Admin Panel:**
- Navigate to `/admin/pages/new`
- Enter title, content, and metadata
- Save and publish

**Via File System:**
- Create `.md` files in `content/pages/`
- Include frontmatter metadata
- Use subdirectories for organization

### 3. Template Customization

Templates are located in `views/`:
- `layouts/base.njk` - Main layout template
- `pages/` - Page templates
- `admin/` - Admin interface templates

### 4. Plugin Development

Create custom plugins in `plugins/`:
```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  hooks: {
    'content:render': (content) => {
      // Modify content before rendering
      return content;
    }
  }
};
```

## 🔍 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port 3000
sudo lsof -i :3000
# Kill the process
sudo kill -9 <PID>
```

**Permission denied errors:**
```bash
# Fix file permissions
sudo chown -R stackblog:stackblog /home/stackblog/stack_blog
sudo chmod -R 755 /home/stackblog/stack_blog
```

**Service won't start:**
```bash
# Check service status
sudo systemctl status stack-blog
# View detailed logs
sudo journalctl -u stack-blog -n 50
```

**Memory issues:**
```bash
# Check memory usage
free -h
# Increase swap if needed
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Log Files

**Application logs:**
- `/home/stackblog/stack_blog/logs/app.log` - Application logs
- `/home/stackblog/stack_blog/logs/error.log` - Error logs
- `sudo journalctl -u stack-blog` - System service logs

**Nginx logs (if configured):**
- `/var/log/nginx/access.log` - Access logs
- `/var/log/nginx/error.log` - Error logs

### Health Checks

**Manual health check:**
```bash
# Check application health
curl http://localhost:3000/health

# Check API status
curl http://localhost:3000/api/status
```

**Automated monitoring:**
```bash
# Add to crontab for health monitoring
*/5 * * * * curl -f http://localhost:3000/health || systemctl restart stack-blog
```

## 🔄 Updates and Maintenance

### Updating Stack Blog

**Automated deployment:**
```bash
# Re-run deployment script
curl -fsSL https://raw.githubusercontent.com/audit-brands/stack_blog/main/scripts/deploy-simple.sh | bash
```

**Manual update:**
```bash
cd /home/stackblog/stack_blog
sudo -u stackblog git pull origin main
sudo -u stackblog npm ci --production
sudo systemctl restart stack-blog
```

**Docker update:**
```bash
cd stack_blog
git pull
docker-compose build
docker-compose up -d
```

### Backup and Restore

**Create backup:**
```bash
# Automated backup (runs daily)
/home/stackblog/stack_blog/scripts/backup.sh

# Manual backup
sudo -u stackblog tar -czf backup.tar.gz content/ .env
```

**Restore backup:**
```bash
# Stop service
sudo systemctl stop stack-blog

# Restore content
tar -xzf backup.tar.gz

# Start service
sudo systemctl start stack-blog
```

## 📞 Support

### Getting Help

- **Documentation:** Check the `docs/` directory
- **Issues:** Report bugs on [GitHub Issues](https://github.com/audit-brands/stack_blog/issues)
- **Security:** Follow responsible disclosure in `SECURITY.md`

### Performance Optimization

**Enable caching:**
```bash
# In .env file
CACHE_ENABLED=true
CACHE_TTL=300000
```

**Optimize images:**
- Use WebP format when possible
- Enable automatic image processing
- Configure CDN for static assets

**Database-free optimization:**
- Implement content indexing
- Use file system caching
- Configure reverse proxy caching

This installation guide should get you up and running with Stack Blog CMS. Choose the method that best fits your needs and environment.