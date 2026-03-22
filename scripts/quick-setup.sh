#!/bin/bash

# 🚀 REBOOKED QUICK SETUP SCRIPT
# One-click setup for Rebooked server from zip file

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 REBOOKED QUICK SETUP${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if zip file provided
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ Error: Please provide a zip file path${NC}"
    echo -e "${YELLOW}Usage: ./quick-setup.sh <rebooked-project.zip>${NC}"
    exit 1
fi

ZIP_FILE="$1"

if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}❌ Error: Zip file not found: $ZIP_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}📦 Found zip file: $ZIP_FILE${NC}"

# Install Node.js dependencies
echo -e "${BLUE}📦 Installing setup dependencies...${NC}"
npm install archiver extract-zip

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦 Installing pnpm...${NC}"
    npm install -g pnpm
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
fi

# Run the setup script
echo -e "${BLUE}🔧 Running server setup...${NC}"
node server-setup.js "$ZIP_FILE"

echo -e "${GREEN}🎉 Setup complete!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}Your Rebooked application is now running!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update private_html/.env with your production values"
echo "2. Copy nginx-rebooked.conf to your nginx configuration"
echo "3. Set up SSL certificate"
echo "4. Test your application"
echo ""
echo -e "${GREEN}🌐 Check your site at: http://your-domain.com${NC}"
