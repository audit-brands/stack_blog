#!/bin/bash

# SSH Connectivity Test Script for Pair Networks
# Tests various connection methods to identify the correct approach

echo "🔍 Testing SSH connectivity to Pair Networks..."

# Test different hostnames and IPs
HOSTS=(
    "certifiedhq.com"
    "certifiedhq.pairserver.com" 
    "216.146.206.69"
    "216.146.192.24"
)

SSH_KEY="~/.ssh/stackblog_pair_rsa"
USER="certifiedhq"

echo "📋 Testing SSH connections:"
echo "  User: $USER"
echo "  Key: $SSH_KEY"
echo ""

for host in "${HOSTS[@]}"; do
    echo "Testing $host..."
    if timeout 10 ssh -o ConnectTimeout=8 -o BatchMode=yes -i $SSH_KEY $USER@$host "echo 'SUCCESS: Connected to' && hostname && pwd" 2>/dev/null; then
        echo "✅ SUCCESS: $host"
        echo "🎯 Use this host for deployment: $host"
        break
    else
        echo "❌ FAILED: $host (timeout/refused)"
    fi
    echo ""
done

echo ""
echo "🔍 Network diagnostics:"
echo ""

for host in "${HOSTS[@]}"; do
    echo "Ping test for $host:"
    if ping -c 2 -W 3 $host > /dev/null 2>&1; then
        echo "✅ Ping successful: $host"
    else
        echo "❌ Ping failed: $host"
    fi
done

echo ""
echo "📋 SSH Key Information:"
ssh-keygen -lf ~/.ssh/stackblog_pair_rsa.pub 2>/dev/null || echo "❌ SSH key not found"

echo ""
echo "📋 Current SSH Agent Keys:"
ssh-add -l 2>/dev/null || echo "❌ No keys in SSH agent"

echo ""
echo "🎯 Next Steps:"
echo "1. If no connections work, try from different network/computer"
echo "2. Verify SSH key is active in Pair Networks control panel"
echo "3. Use working host in deploy-pair-networks.sh"
echo "4. Run deployment: ./deploy-pair-networks.sh"