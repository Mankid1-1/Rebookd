@echo off
REM 🚀 REBOOKED WINDOWS SETUP SCRIPT
REM One-click setup for Rebooked server from zip file

echo 🚀 REBOOKED QUICK SETUP
echo =====================================

REM Check if zip file provided
if "%~1"=="" (
    echo ❌ Error: Please provide a zip file path
    echo Usage: setup.bat rebooked-project.zip
    exit /b 1
)

set ZIP_FILE=%1

if not exist "%ZIP_FILE%" (
    echo ❌ Error: Zip file not found: %ZIP_FILE%
    exit /b 1
)

echo 📦 Found zip file: %ZIP_FILE%

REM Install Node.js dependencies
echo 📦 Installing setup dependencies...
call npm install archiver extract-zip

REM Check if pnpm is installed
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing pnpm...
    call npm install -g pnpm
)

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing PM2...
    call npm install -g pm2
)

REM Run the setup script
echo 🔧 Running server setup...
call node server-setup.js "%ZIP_FILE%"

echo 🎉 Setup complete!
echo =====================================
echo Your Rebooked application is now running!
echo.
echo Next steps:
echo 1. Update private_html\.env with your production values
echo 2. Configure your web server (IIS/Nginx)
echo 3. Set up SSL certificate
echo 4. Test your application
echo.
echo 🌐 Check your site at: http://your-domain.com

pause
