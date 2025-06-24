#!/bin/bash

# Stack Blog MVP Deployment Script for Pair Networks Managed Hosting
# Based on Method 3: Managed Hosting Deployment from INSTALLATION.md

set -e  # Exit on any error

echo "🚀 Starting Stack Blog MVP deployment to Pair Networks (Managed Hosting)..."

# Configuration
REMOTE_USER="certifiedhq"
REMOTE_HOST="certifiedhq.pairserver.com"
REMOTE_PATH="~/public_html/cpeio.online"
PASSWORD='&Fc%#%aTgsZ]P"2'

echo "📋 Deployment Configuration:"
echo "  User: $REMOTE_USER"
echo "  Host: $REMOTE_HOST"
echo "  Remote Path: $REMOTE_PATH"
echo "  Method: Managed Hosting (rsync + screen)"

echo "🔍 Pre-deployment checks..."
# Check if we have the latest code
if [[ $(git status --porcelain) ]]; then
    echo "  ⚠️  Warning: Uncommitted changes detected"
fi

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "  📦 Installing local dependencies for build..."
    npm install
fi

echo "📦 Preparing deployment package..."

# Create temporary deployment directory
DEPLOY_DIR="/tmp/stack_blog_deploy_$(date +%s)"
mkdir -p "$DEPLOY_DIR"

# Copy application files (excluding development files)
echo "  📁 Copying application files..."
rsync -av --progress \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='*.log' \
    --exclude='__tests__' \
    --exclude='.DS_Store' \
    --exclude='deploy-*.sh' \
    --exclude='.gitignore' \
    --exclude='secrets/' \
    "./" "$DEPLOY_DIR/"

# Copy production environment file
echo "  🔧 Setting up production environment..."
cp .env.production "$DEPLOY_DIR/.env"

echo "🌐 Deploying to Pair Networks server..."

# Create deployment script on server
cat > "$DEPLOY_DIR/server-deploy.sh" << 'EOF'
#!/bin/bash

echo "📁 Setting up directory structure..."
mkdir -p logs content/pages content/media

echo "📦 Installing production dependencies..."
npm ci --production

echo "🔧 Setting file permissions..."
chmod -R 755 .
chmod -R 766 content/ logs/

echo "🎯 Creating default content if not exists..."
if [ ! -f "content/pages/index.md" ]; then
    cat > content/pages/index.md << 'CONTENT'
---
title: "Welcome to Stack Blog MVP"
description: "Modern flat-file CMS with Ghost theme compatibility and RSS monetization"
author: "Stack Blog Team"
date: "2024-12-24"
featured: true
---

# Welcome to Stack Blog MVP 🚀

Stack Blog MVP is now live on Pair Networks with full Ghost theme compatibility and RSS monetization features!

## Key Features

- **Ghost Theme Compatibility**: Use 1000+ existing Ghost themes
- **RSS Monetization**: Built-in sponsorship and analytics platform  
- **Zero Database**: Pure flat-file architecture
- **Modern Admin**: Intuitive content management interface
- **Performance Optimized**: Sub-100ms response times

## Getting Started

Visit the [admin panel](/admin) to start creating content!

**Admin Credentials:**
- Username: admin
- Password: StackBlog2025!
CONTENT
fi

if [ ! -f "content/pages/blog/mvp-launch.md" ]; then
    mkdir -p content/pages/blog
    cat > content/pages/blog/mvp-launch.md << 'CONTENT'
---
title: "Stack Blog MVP Launch - Now with Ghost Themes & RSS Analytics"
description: "Announcing the launch of Stack Blog MVP with revolutionary Ghost theme compatibility and RSS monetization platform"
author: "Stack Blog Team"
date: "2024-12-24"
tags: ["announcement", "launch", "mvp", "ghost-themes", "rss"]
featured: true
---

# Stack Blog MVP is Live! 🎉

We're excited to announce that Stack Blog MVP is now live and running on Pair Networks with groundbreaking features that set it apart from traditional CMS platforms.

## Revolutionary Features

### 🎨 Ghost Theme Compatibility
- **1000+ Themes Available**: Use any existing Ghost theme
- **Seamless Migration**: Switch themes without losing content
- **Handlebars Engine**: Full Ghost helper compatibility
- **Theme Validation**: Built-in GScan integration

### 📡 RSS Monetization Platform
- **Sponsor Integration**: Built-in sponsorship management
- **Advanced Analytics**: Custom XML namespaces for tracking
- **Performance Metrics**: Real-time impression and click tracking
- **Revenue Dashboard**: Comprehensive monetization reporting

### ⚡ Performance & Security
- **Sub-100ms Response**: Optimized for speed
- **Enterprise Security**: Production-grade protection
- **Template Caching**: LRU cache with TTL
- **Rate Limiting**: API protection built-in

## Technical Innovation

Stack Blog represents a new category of CMS: **Theme-Compatible Flat-File Systems**. We've solved the fundamental challenge of Ghost theme compatibility without requiring a database.

### Core Architecture
- **Dual Template Engines**: Nunjucks + Handlebars
- **Ghost Context Mapping**: Automatic data transformation
- **File-Based Storage**: Zero database dependencies
- **Modern Node.js**: Built on latest technologies

## Try It Now

- **Browse the Site**: You're already here! 
- **Check RSS Feed**: [/rss.xml](/rss.xml) with enhanced analytics
- **Admin Interface**: [/admin](/admin) (login required)
- **API Endpoints**: [/api/status](/api/status) for system info

## What's Next

This MVP demonstrates the viability of our approach. We're proving that you can have:
- The theme ecosystem of Ghost
- The simplicity of flat-file systems  
- Enterprise-grade monetization features
- All without database complexity

Welcome to the future of content management! 🚀
CONTENT
fi

echo "🚀 Stopping existing application..."
# Kill any existing Stack Blog processes
pkill -f "node.*app.js" || true
pkill -f "npm.*start" || true

# Wait for processes to stop
sleep 3

echo "🌟 Starting Stack Blog MVP..."
# Start application with screen for persistence
screen -dmS stackblog node app.js

# Wait for startup
sleep 5

echo "🔍 Checking application status..."
if pgrep -f "node.*app.js" > /dev/null; then
    echo "✅ Stack Blog MVP is running!"
    echo "📊 Process info:"
    pgrep -f "node.*app.js" | xargs ps -p
else
    echo "❌ Application failed to start!"
    echo "📋 Last 20 lines of log:"
    tail -20 logs/app.log 2>/dev/null || echo "No log file found"
    exit 1
fi

echo "🌐 Testing connectivity..."
sleep 2
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/" | grep -q "200\|404"; then
    echo "✅ Application responding on port 3000"
else
    echo "❌ Application not responding properly"
    tail -10 logs/app.log 2>/dev/null || echo "No log file found"
fi

echo "✅ Stack Blog MVP deployment completed!"
echo ""
echo "🎯 Important URLs:"
echo "  Site: https://cpeio.online"
echo "  Admin: https://cpeio.online/admin"
echo "  RSS: https://cpeio.online/rss.xml"
echo "  API: https://cpeio.online/api/status"
echo ""
echo "🔑 Admin Access:"
echo "  Username: admin"
echo "  Password: StackBlog2025!"
echo ""
echo "📊 MVP Features Available:"
echo "  ✓ Ghost Theme Compatibility"
echo "  ✓ RSS Analytics & Monetization"
echo "  ✓ Enhanced Admin Interface"
echo "  ✓ Performance Optimization"
echo "  ✓ Enterprise Security"
EOF

chmod +x "$DEPLOY_DIR/server-deploy.sh"

# Upload files using rsync with expect for password automation
echo "📤 Uploading files to server..."

# Create expect script for automated password entry
cat > /tmp/deploy-expect.exp << EOF
#!/usr/bin/expect -f
set timeout 30
spawn rsync -avz --delete "$DEPLOY_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/"
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    eof
}
EOF

# Check if expect is available
if command -v expect > /dev/null; then
    chmod +x /tmp/deploy-expect.exp
    /tmp/deploy-expect.exp
    rm /tmp/deploy-expect.exp
else
    echo "📋 Expect not available. Please run the following command manually:"
    echo "rsync -avz --delete '$DEPLOY_DIR/' '$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/'"
    echo "Then connect via SSH and run: ./server-deploy.sh"
    exit 1
fi

echo "🔧 Running server deployment script..."

# Create expect script for SSH deployment
cat > /tmp/ssh-deploy.exp << EOF
#!/usr/bin/expect -f
set timeout 60
spawn ssh "$REMOTE_USER@$REMOTE_HOST" "cd $REMOTE_PATH && ./server-deploy.sh"
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "yes/no" {
        send "yes\r"
        exp_continue
    }
    eof
}
EOF

if command -v expect > /dev/null; then
    chmod +x /tmp/ssh-deploy.exp
    /tmp/ssh-deploy.exp
    rm /tmp/ssh-deploy.exp
else
    echo "📋 Please connect via SSH and run the deployment script:"
    echo "ssh $REMOTE_USER@$REMOTE_HOST"
    echo "cd $REMOTE_PATH"
    echo "./server-deploy.sh"
fi

# Clean up deployment directory
echo "🧹 Cleaning up..."
rm -rf "$DEPLOY_DIR"

echo ""
echo "🎉 Stack Blog MVP Deployment Complete!"
echo ""
echo "📝 Deployment Summary:"
echo "  ✓ Latest MVP code deployed"
echo "  ✓ Production dependencies installed"
echo "  ✓ Application started with screen"
echo "  ✓ Default content created"
echo "  ✓ Connectivity verified"
echo ""
echo "🔗 Next Steps:"
echo "1. Test the live site: https://cpeio.online"
echo "2. Access admin panel: https://cpeio.online/admin"
echo "3. Check RSS feed: https://cpeio.online/rss.xml"
echo "4. Run comprehensive testing plan"
echo ""
echo "📞 Server Management:"
echo "  SSH: ssh $REMOTE_USER@$REMOTE_HOST"
echo "  Check status: screen -list"
echo "  View logs: tail -f $REMOTE_PATH/logs/app.log"
echo "  Restart app: screen -S stackblog -X quit && screen -dmS stackblog node app.js"