@echo off
echo 🚀 Rebooked Quick Start
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js found

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
    echo ✅ Dependencies installed
) else (
    echo ✅ Dependencies already installed
)

REM Check if .env file exists
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy .env.example .env >nul
    echo ⚠️  Please edit .env file and update DATABASE_URL with your database credentials
    echo    Current DATABASE_URL: mysql://root:password@localhost:3306/rebooked
    echo.
    echo Press any key to continue after updating .env...
    pause
) else (
    echo ✅ .env file found
)

REM Start the server
echo.
echo 🚀 Starting the server...
echo Server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

npm run dev
