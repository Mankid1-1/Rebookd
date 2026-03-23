@echo off
REM 🚀 REBOOKED WINDOWS DEPLOYMENT SCRIPT
REM Easy deployment from Windows to remote Linux server

echo.
echo 🚀 Rebooked Windows Deployment Script
echo ====================================
echo.

REM Check if rebooked.zip exists
if not exist "rebooked.zip" (
    echo ❌ rebooked.zip not found in current directory
    echo Please place rebooked.zip in current directory and try again
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected
echo 📦 rebooked.zip found
echo.

REM Run the Windows deployment script
echo 🎯 Starting deployment...
node scripts/auto-deploy-windows.js

echo.
if errorlevel 1 (
    echo ❌ Deployment failed
    pause
    exit /b 1
) else (
    echo ✅ Deployment completed successfully!
    echo 📋 Check windows-deployment-report.txt for access information
)

pause
