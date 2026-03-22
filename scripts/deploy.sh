#!/bin/bash

# 🚀 REBOOKED DEPLOYMENT WRAPPER
# Easy deployment script wrapper for the auto-deploy.js

set -e  # Exit on any error

echo "🚀 Rebooked Deployment Script"
echo "================================"
echo ""

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "⚠️  This script needs to be run with sudo privileges"
   echo "Please run: sudo ./scripts/deploy.sh"
   exit 1
fi

# Check if rebooked.zip exists
if [[ ! -f "rebooked.zip" ]]; then
    echo "❌ rebooked.zip not found in current directory"
    echo "Please place rebooked.zip in the current directory and try again"
    exit 1
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
fi

# Install npm if not present
if ! command -v npm &> /dev/null; then
    echo "📦 Installing npm..."
    apt-get install -y npm
fi

# Make deploy script executable
chmod +x scripts/auto-deploy.js

# Run the main deployment script
echo "🎯 Starting deployment..."
node scripts/auto-deploy.js

echo ""
echo "✅ Deployment process completed!"
echo "📋 Check deployment-report.txt for access information"
