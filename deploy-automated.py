#!/usr/bin/env python3

import pexpect
import sys
import os
import time
from pathlib import Path

# Configuration
REMOTE_USER = "certifiedhq"
REMOTE_HOST = "certifiedhq.pairserver.com"
REMOTE_PATH = "~/public_html/cpeio.online"
PASSWORD = "&Fc%#%aTgsZ]P\"2"
TIMEOUT = 60

def run_command_with_password(command, password, timeout=30):
    """Run a command with password authentication"""
    print(f"🔧 Running: {command}")
    
    try:
        child = pexpect.spawn(command, timeout=timeout)
        child.logfile = sys.stdout.buffer
        
        i = child.expect(['password:', 'Password:', pexpect.EOF, pexpect.TIMEOUT])
        
        if i == 0 or i == 1:
            child.sendline(password)
            child.expect(pexpect.EOF)
        elif i == 2:
            print("✅ Command completed without password prompt")
        else:
            print("❌ Command timed out")
            return False
            
        child.close()
        return child.exitstatus == 0
        
    except Exception as e:
        print(f"❌ Error running command: {e}")
        return False

def deploy_to_server():
    """Deploy Stack Blog MVP to Pair Networks"""
    
    print("🚀 Starting Stack Blog MVP deployment to Pair Networks...")
    print("📋 Using Python pexpect for automated deployment")
    
    # Check if deployment directory exists
    deploy_dir = "/tmp/stack_blog_deploy"
    if os.path.exists(deploy_dir):
        os.system(f"rm -rf {deploy_dir}")
    
    # Create deployment package
    print("📦 Creating deployment package...")
    os.makedirs(deploy_dir)
    
    # Copy files using rsync locally first
    rsync_cmd = [
        "rsync", "-av",
        "--exclude=.git",
        "--exclude=node_modules", 
        "--exclude=.env",
        "--exclude=.env.local",
        "--exclude=*.log",
        "--exclude=__tests__",
        "--exclude=.DS_Store",
        "--exclude=deploy-*.sh",
        "--exclude=deploy-*.py",
        "--exclude=.gitignore",
        "--exclude=secrets/",
        "./", f"{deploy_dir}/"
    ]
    
    if os.system(" ".join(rsync_cmd)) != 0:
        print("❌ Failed to create deployment package")
        return False
    
    # Copy production environment
    os.system(f"cp .env.production {deploy_dir}/.env")
    
    # Create server deployment script
    server_script = f"""#!/bin/bash
set -e

echo "📁 Setting up directory structure..."
mkdir -p logs content/pages content/media

echo "📦 Installing production dependencies..."
npm ci --production

echo "🔧 Setting file permissions..."
chmod -R 755 .
chmod -R 766 content/ logs/

echo "🚀 Stopping existing application..."
pkill -f "node.*app.js" || true
sleep 3

echo "🌟 Starting Stack Blog MVP..."
screen -dmS stackblog node app.js
sleep 5

echo "🔍 Checking application status..."
if pgrep -f "node.*app.js" > /dev/null; then
    echo "✅ Stack Blog MVP is running!"
    pgrep -f "node.*app.js" | xargs ps -p
else
    echo "❌ Application failed to start!"
    tail -20 logs/app.log 2>/dev/null || echo "No log file found"
    exit 1
fi

echo "🌐 Testing connectivity..."
if curl -s -o /dev/null -w "%{{http_code}}" "http://localhost:3000/" | grep -q "200\\|404"; then
    echo "✅ Application responding on port 3000"
else
    echo "❌ Application not responding properly"
fi

echo "✅ Stack Blog MVP deployment completed!"
"""
    
    with open(f"{deploy_dir}/server-deploy.sh", "w") as f:
        f.write(server_script)
    
    os.chmod(f"{deploy_dir}/server-deploy.sh", 0o755)
    
    # Upload files to server
    print("📤 Uploading files to server...")
    rsync_upload_cmd = f"rsync -avz --delete {deploy_dir}/ {REMOTE_USER}@{REMOTE_HOST}:{REMOTE_PATH}/"
    
    if not run_command_with_password(rsync_upload_cmd, PASSWORD, TIMEOUT):
        print("❌ Failed to upload files to server")
        return False
    
    # Run deployment script on server
    print("🔧 Running deployment script on server...")
    ssh_cmd = f"ssh {REMOTE_USER}@{REMOTE_HOST} 'cd {REMOTE_PATH} && ./server-deploy.sh'"
    
    if not run_command_with_password(ssh_cmd, PASSWORD, TIMEOUT):
        print("❌ Failed to run deployment script on server")
        return False
    
    # Clean up
    print("🧹 Cleaning up...")
    os.system(f"rm -rf {deploy_dir}")
    
    print("")
    print("🎉 Stack Blog MVP Deployment Complete!")
    print("")
    print("🔗 Test URLs:")
    print("  Site: https://cpeio.online")
    print("  Admin: https://cpeio.online/admin")
    print("  RSS: https://cpeio.online/rss.xml")
    print("  API: https://cpeio.online/api/status")
    
    return True

if __name__ == "__main__":
    success = deploy_to_server()
    sys.exit(0 if success else 1)