@echo off
REM IPA Package Check - Frontend + API Server Start Script

echo ================================================================================
echo IPA Package Check - Frontend + API Server Start
echo ================================================================================

REM Set current directory to project root
cd /d "%~dp0.."

REM Install backend dependencies
echo.
echo [INFO] Installing backend dependencies...
call npm install
set npm_exit_code=%errorlevel%
echo [DEBUG] npm install exit code: %npm_exit_code%
if %npm_exit_code% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed

REM Compile backend TypeScript code
echo.
echo [INFO] Compiling backend TypeScript code...
call npm run build:backend
set build_exit_code=%errorlevel%
echo [DEBUG] npm run build:backend exit code: %build_exit_code%
if %build_exit_code% neq 0 (
    echo [ERROR] Failed to compile backend code
    pause
    exit /b 1
)
echo [SUCCESS] Backend code compiled successfully

REM Build frontend
echo.
echo [INFO] Building frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)

call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Failed to build frontend
    cd ..
    pause
    exit /b 1
)
echo [SUCCESS] Frontend built successfully

REM Return to project root directory
cd ..

REM Move frontend build to dist/public
echo.


echo [INFO] Copying public directory to dist/public...
if not exist "dist" (
    echo [ERROR] dist directory not found, backend compilation may have failed
    pause
    exit /b 1
)
if exist "dist\public" (
    echo [INFO] Removing existing dist\public directory...
    rmdir /s /q "dist\public"
)
xcopy "public" "dist\public" /e /i /y >nul
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy public to dist\public
    pause
    exit /b 1
)
echo [SUCCESS] Frontend build copied to dist\public

REM Check if PM2 is installed
call pm2 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PM2 is not installed.
    echo Installing PM2...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install PM2
        pause
        exit /b 1
    )
)

echo [INFO] Starting API server...

REM Stop existing API server
call pm2 delete ipa-api-server >nul 2>&1

REM Create necessary directories
if not exist "storage" mkdir storage
if not exist "storage\temp" mkdir storage\temp
if not exist "storage\ipa" mkdir storage\ipa
if not exist "logs" mkdir logs

REM Check configuration file
if not exist ".env" (
    if exist "config\default.env" (
        copy "config\default.env" ".env"
        echo [INFO] Created .env from config\default.env
    )
)

REM Start API server
call pm2 start dist/server.js --name "ipa-api-server" --env production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start API server
    pause
    exit /b 1
)

REM Save PM2 configuration
call pm2 save

echo.
echo ================================================================================
echo [SUCCESS] Frontend + API Server started successfully!
echo ================================================================================
echo.
echo Service Status:
call pm2 status ipa-api-server
echo.
echo API Server: http://localhost:8080
echo Frontend: http://localhost:8080/
echo.
echo Useful commands:
echo   pm2 status ipa-api-server    - Check API server status
echo   pm2 logs ipa-api-server      - View API server logs
echo   pm2 restart ipa-api-server   - Restart API server
echo   pm2 stop ipa-api-server      - Stop API server
echo.
pause 