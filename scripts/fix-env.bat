@echo off
REM 🚀 REBOOKED ENVIRONMENT FIX (Windows)
REM Quick fix for missing environment variables

echo 🚀 REBOOKED ENVIRONMENT FIX
echo =====================================

REM Run the Node.js environment fix script
node scripts\fix-env.cjs

if errorlevel 1 (
    echo ❌ Environment fix failed
    echo Please check the error messages above
    pause
    exit /b 1
)

echo.
echo ✅ Environment fix completed!
echo.
echo Next steps:
echo 1. Restart your server with: npm run dev
echo 2. Or run: .\quick-start
echo 3. Server will be available at: http://localhost:3000
echo.
echo 🌐 Your Rebooked application should start successfully now!

pause
