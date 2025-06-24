# Stack Blog - Pair Networks Deployment Procedure

## Quick Reference Guide

This document provides the exact step-by-step procedure for deploying Stack Blog to Pair Networks, based on successful deployment on June 24, 2025.

---

## 🚀 Deployment Overview

**Deployment Method**: SSH Key Authentication + rsync  
**Target Server**: certifiedhq.com (Pair Networks)  
**Application Path**: `/usr/www/users/certifiedhq/cpeio.online`  
**Domain**: https://cpeio.online  
**Process Management**: screen session  

---

## 📋 Prerequisites Checklist

### ✅ **Before Starting**
- [ ] Pair Networks hosting account active
- [ ] SSH access enabled in Pair Networks control panel
- [ ] Domain configured (cpeio.online → certifiedhq.com)
- [ ] Local development environment ready
- [ ] Git repository clean (or acceptable uncommitted changes)

### ✅ **Network Requirements**
- [ ] IP address whitelisted in Pair Networks security
- [ ] SSH client available locally
- [ ] rsync command available

---

## 🔑 SSH Key Setup Process

### Step 1: Generate SSH Key (if needed)
```bash
# Generate dedicated SSH key for Stack Blog deployment
ssh-keygen -t rsa -b 4096 -C "stackblog-deployment@pair.com" -f ~/.ssh/stackblog_pair_rsa -N ""

# Add key to SSH agent
ssh-add ~/.ssh/stackblog_pair_rsa

# Verify key fingerprint
ssh-keygen -lf ~/.ssh/stackblog_pair_rsa.pub
```

### Step 2: Add Key to Pair Networks
1. Login to Pair Networks control panel
2. Navigate to "Manage SSH Access"
3. Paste public key content in "SSH Key" field:
   ```bash
   cat ~/.ssh/stackblog_pair_rsa.pub
   ```
4. Set title: "Stack Blog CMS Deployment Key"
5. **Wait 20 minutes** for key activation

### Step 3: Verify SSH Connectivity
```bash
# Add server to known_hosts
ssh-keyscan -H certifiedhq.com >> ~/.ssh/known_hosts

# Test SSH connection
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com "echo 'SSH Success!' && hostname && pwd"
```

**Expected Output:**
```
SSH Success!
qs4505.pair.com
/usr/home/certifiedhq
```

---

## 🚀 Deployment Execution

### Step 1: Pre-Deployment Verification
```bash
# Navigate to Stack Blog project
cd /path/to/stack_blog

# Verify deployment script is ready
ls -la deploy-pair-networks.sh

# Check SSH key configuration in script
grep -n "SSH_KEY" deploy-pair-networks.sh
```

### Step 2: Execute Deployment
```bash
# Run deployment script
echo "y" | ./deploy-pair-networks.sh
```

**Expected Deployment Flow:**
1. ✅ Pre-deployment checks
2. ✅ Package preparation (rsync to temp directory)
3. ✅ File upload to server (rsync with SSH key)
4. ✅ Dependencies installation (`npm install --production`)
5. ✅ Directory setup and permissions
6. ✅ Application startup in screen session

### Step 3: Verify Deployment Success
```bash
# Check application status
curl -s https://cpeio.online/api/status | jq .

# Expected response:
{
  "success": true,
  "data": {
    "status": "operational",
    "version": "1.1.0-MVP",
    "timestamp": "2025-06-24T03:XX:XX.XXXZ"
  }
}
```

---

## 📊 Post-Deployment Verification

### Application Health Check
```bash
# Test main endpoints
curl -I https://cpeio.online/                    # Should return 200 or 404
curl -s https://cpeio.online/api/status          # Should return JSON status
curl -I https://cpeio.online/admin/login         # Should return 200 (not 500)
```

### Server Process Check
```bash
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && ps aux | grep node"
```

### File Verification
```bash
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && ls -la && cat package.json | grep version"
```

---

## 🔧 Process Management Commands

### Screen Session Management
```bash
# Connect to server
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com

# List screen sessions
screen -list

# Attach to Stack Blog session
screen -r stackblog

# Start new screen session (if needed)
screen -dmS stackblog node app.js

# Kill and restart application
screen -S stackblog -X quit
sleep 2
screen -dmS stackblog node app.js
```

### Application Restart Procedure
```bash
# Complete restart sequence
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && \
   screen -S stackblog -X quit; \
   sleep 2; \
   screen -dmS stackblog node app.js"

# Verify restart
sleep 5
curl -s https://cpeio.online/api/status
```

---

## 🛠️ Troubleshooting Guide

### SSH Connection Issues

**Problem**: SSH connection timeout
```bash
ssh: connect to host certifiedhq.com port 22: Connection timed out
```

**Solutions**:
1. **Check IP Whitelisting**: Contact Pair Networks support to whitelist IP
2. **Verify SSH Key**: Ensure key is active in Pair Networks control panel
3. **Test Network**: Try from different network/computer
4. **Check Known Hosts**: Add server to known_hosts if needed

### Deployment Failures

**Problem**: rsync fails with permission errors
```bash
# Check file permissions on server
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "ls -la /usr/www/users/certifiedhq/cpeio.online"

# Fix permissions if needed
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "chmod -R 755 /usr/www/users/certifiedhq/cpeio.online"
```

**Problem**: npm install fails
```bash
# Check Node.js version compatibility
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "node --version && npm --version"

# Clear npm cache if needed
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && npm cache clean --force"
```

### Application Issues

**Problem**: Admin panel returns 500 error
```bash
# Check if critical fix is deployed
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && \
   grep -A 2 -B 2 'await.*markdownService.render' routes/frontend.js"

# Should show:
# const htmlContent = await markdownService.render(page.content);
```

**Problem**: Application not responding
```bash
# Check if process is running
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "ps aux | grep node"

# Check application logs (if available)
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && tail -20 app.log"

# Restart if needed
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "cd /usr/www/users/certifiedhq/cpeio.online && \
   screen -S stackblog -X quit; sleep 2; screen -dmS stackblog node app.js"
```

---

## 📝 Deployment Checklist

### Pre-Deployment ✅
- [ ] SSH key generated and added to Pair Networks
- [ ] SSH connectivity tested and working
- [ ] Local code ready with latest changes
- [ ] Version number updated in package.json
- [ ] Critical fixes verified locally

### During Deployment ✅
- [ ] Deployment script executes without errors
- [ ] File upload completes successfully
- [ ] Dependencies install without issues
- [ ] Application starts in screen session
- [ ] Basic connectivity test passes

### Post-Deployment ✅
- [ ] API status endpoint responds correctly
- [ ] Application version matches deployment
- [ ] Admin panel accessible (no 500 errors)
- [ ] Ghost theme features available
- [ ] RSS feeds generating correctly
- [ ] Process running in screen session

---

## 🔄 Quick Redeploy Procedure

For subsequent deployments after initial setup:

```bash
# 1. Update local code and version
echo '"version": "1.1.1-MVP",' # Update package.json

# 2. Execute deployment
echo "y" | ./deploy-pair-networks.sh

# 3. Verify deployment
curl -s https://cpeio.online/api/status | jq .version

# 4. Test critical functionality
curl -I https://cpeio.online/admin/login  # Should be 200, not 500
```

---

## 📈 Performance Monitoring

### Health Check Commands
```bash
# API status
curl -s https://cpeio.online/api/status

# Response time measurement
curl -w "@curl-format.txt" -o /dev/null -s https://cpeio.online/

# Where curl-format.txt contains:
#     time_namelookup:  %{time_namelookup}\n
#        time_connect:  %{time_connect}\n
#     time_appconnect:  %{time_appconnect}\n
#    time_pretransfer:  %{time_pretransfer}\n
#       time_redirect:  %{time_redirect}\n
#  time_starttransfer:  %{time_starttransfer}\n
#                     ----------\n
#          time_total:  %{time_total}\n
```

### Process Monitoring
```bash
# Memory and CPU usage
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "top -p \$(pgrep node) -n 1"

# Long-running process check
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com \
  "ps -eo pid,ppid,cmd,%mem,%cpu,time --sort=-%cpu | grep node"
```

---

## 🚨 Emergency Procedures

### Complete Application Restart
```bash
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com << 'EOF'
cd /usr/www/users/certifiedhq/cpeio.online
echo "Stopping application..."
screen -S stackblog -X quit
pkill -f "node.*app.js" || true
sleep 3
echo "Starting application..."
screen -dmS stackblog node app.js
sleep 5
echo "Verifying startup..."
ps aux | grep node
curl -s http://localhost:3000/api/status || echo "Application not responding"
EOF
```

### Rollback Procedure
```bash
# If deployment fails, manual rollback:
ssh -i ~/.ssh/stackblog_pair_rsa certifiedhq@certifiedhq.com << 'EOF'
cd /usr/www/users/certifiedhq/cpeio.online
echo "Rolling back to previous version..."
git checkout HEAD~1  # If using git
# Or restore from backup
EOF
```

---

## 📞 Support Contacts

**Pair Networks Support**: For SSH access, IP whitelisting, server issues  
**Stack Blog Repository**: For code issues, deployment script problems  
**This Documentation**: Updated June 24, 2025 - Based on successful MVP deployment

---

**🎯 Deployment Success Criteria:**
- ✅ Application responds to API status calls
- ✅ Version number reflects deployed code  
- ✅ Admin panel accessible (no 500 errors)
- ✅ Process running in screen session
- ✅ All MVP features operational

This procedure document ensures consistent, repeatable deployments of Stack Blog to Pair Networks hosting.