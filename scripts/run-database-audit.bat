@echo off
REM 🚀 REBOOKED DATABASE AUDIT & FIX EXECUTOR (Windows)
REM Quick script to run the complete database audit and fix

echo 🚀 REBOOKED DATABASE AUDIT & FIX
echo =====================================

REM Check if MySQL is available
mysql --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: MySQL client not found
    echo Please install MySQL client and add to PATH
    echo Download from: https://dev.mysql.com/downloads/mysql/
    pause
    exit /b 1
)

REM Get database credentials
echo 📋 Database Connection Required
echo Please provide your MySQL database credentials:

set /p DB_HOST="Database Host (localhost): "
if "%DB_HOST%"=="" set DB_HOST=localhost

set /p DB_PORT="Database Port (3306): "
if "%DB_PORT%"=="" set DB_PORT=3306

set /p DB_NAME="Database Name (rebooked): "
if "%DB_NAME%"=="" set DB_NAME=rebooked

set /p DB_USER="Database Username (root): "
if "%DB_USER%"=="" set DB_USER=root

set /p DB_PASS="Database Password: "

REM Test database connection
echo 🔍 Testing database connection...
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% -e "USE %DB_NAME%;" >nul 2>&1
if errorlevel 1 (
    echo ❌ Database connection failed
    echo Please check your credentials and try again
    pause
    exit /b 1
)

echo ✅ Database connection successful

REM Create database if it doesn't exist
echo 🗄️ Ensuring database exists...
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% -e "CREATE DATABASE IF NOT EXISTS %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >nul 2>&1

REM Run the database audit and fix script
echo 🔧 Running database audit and fix...
echo This may take a few minutes...

mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% %DB_NAME% < scripts\database-audit-fix.sql

if errorlevel 1 (
    echo ❌ Database audit and fix failed
    echo Please check the error messages above
    pause
    exit /b 1
)

echo ✅ Database audit and fix completed successfully!

REM Show database statistics
echo 📊 Database Statistics:
mysql -h%DB_HOST% -P%DB_PORT% -u%DB_USER% -p%DB_PASS% %DB_NAME% -e "
SELECT 
    'Tables' as Metric,
    COUNT(*) as Count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = '%DB_NAME%'

UNION ALL

SELECT 
    'Foreign Keys' as Metric,
    COUNT(*) as Count
FROM information_schema.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA = '%DB_NAME%' 
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
WHERE TABLE_SCHEMA = '%DB_NAME%';
"

echo.
echo 🎉 Database audit and fix complete!
echo =====================================
echo ✅ Your Rebooked database is now optimized and ready for smooth sailing!
echo.
echo Next steps:
echo 1. Update your application's database connection string
echo 2. Run your application migrations if needed
echo 3. Test your application functionality
echo.
echo 🌐 Your database is ready for production!

pause
