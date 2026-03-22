#!/bin/bash

# 🚀 REBOOKED DATABASE AUDIT & FIX EXECUTOR
# Quick script to run the complete database audit and fix

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 REBOOKED DATABASE AUDIT & FIX${NC}"
echo -e "${BLUE}=====================================${NC}"

# Check if MySQL is available
if ! command -v mysql &> /dev/null; then
    echo -e "${RED}❌ Error: MySQL client not found${NC}"
    echo -e "${YELLOW}Please install MySQL client:${NC}"
    echo -e "${YELLOW}Ubuntu/Debian: sudo apt-get install mysql-client${NC}"
    echo -e "${YELLOW}CentOS/RHEL: sudo yum install mysql${NC}"
    echo -e "${YELLOW}macOS: brew install mysql-client${NC}"
    exit 1
fi

# Get database credentials
echo -e "${BLUE}📋 Database Connection Required${NC}"
echo -e "${YELLOW}Please provide your MySQL database credentials:${NC}"

read -p "Database Host (localhost): " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database Port (3306): " DB_PORT
DB_PORT=${DB_PORT:-3306}

read -p "Database Name (rebooked): " DB_NAME
DB_NAME=${DB_NAME:-rebooked}

read -p "Database Username (root): " DB_USER
DB_USER=${DB_USER:-root}

read -s -p "Database Password: " DB_PASS
echo ""

# Test database connection
echo -e "${BLUE}🔍 Testing database connection...${NC}"
if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "USE $DB_NAME;" 2>/dev/null; then
    echo -e "${GREEN}✅ Database connection successful${NC}"
else
    echo -e "${RED}❌ Database connection failed${NC}"
    echo -e "${YELLOW}Please check your credentials and try again${NC}"
    exit 1
fi

# Create database if it doesn't exist
echo -e "${BLUE}🗄️ Ensuring database exists...${NC}"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null

# Run the database audit and fix script
echo -e "${BLUE}🔧 Running database audit and fix...${NC}"
echo -e "${YELLOW}This may take a few minutes...${NC}"

if mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < scripts/database-audit-fix.sql; then
    echo -e "${GREEN}✅ Database audit and fix completed successfully!${NC}"
else
    echo -e "${RED}❌ Database audit and fix failed${NC}"
    echo -e "${YELLOW}Please check the error messages above${NC}"
    exit 1
fi

# Show database statistics
echo -e "${BLUE}📊 Database Statistics:${NC}"
mysql -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "
SELECT 
    'Tables' as Metric,
    COUNT(*) as Count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = '$DB_NAME'

UNION ALL

SELECT 
    'Foreign Keys' as Metric,
    COUNT(*) as Count
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = '$DB_NAME' 
AND CONSTRAINT_TYPE = 'FOREIGN KEY'

UNION ALL

SELECT 
    'Plans Seeded' as Metric,
    COUNT(*) as Count
FROM plans

UNION ALL

SELECT 
    'Total Size (MB)' as Metric,
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) as Count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = '$DB_NAME';
"

echo -e "${GREEN}🎉 Database audit and fix complete!${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "${GREEN}✅ Your Rebooked database is now optimized and ready for smooth sailing!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your application's database connection string"
echo "2. Run your application migrations if needed"
echo "3. Test your application functionality"
echo ""
echo -e "${GREEN}🌐 Your database is ready for production!${NC}"
