@echo off
REM IPA Package Check - Worker Start Script

echo ================================================================================
echo IPA Package Check - Worker Start
echo ================================================================================

REM Set current directory to project root
cd /d "%~dp0.."

REM Install backend dependencies
echo.
echo [INFO] Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
echo [SUCCESS] Backend dependencies installed

REM Compile backend TypeScript code
echo.
echo [INFO] Compiling backend TypeScript code...
call npm run build:backend
if %errorlevel% neq 0 (
    echo [ERROR] Failed to compile backend code
    pause
    exit /b 1
)
echo [SUCCESS] Backend code compiled successfully

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

echo [INFO] Starting Worker...

REM Stop existing Worker
call pm2 delete ipa-worker >nul 2>&1

REM Create necessary directories
if not exist "worker_storage" mkdir worker_storage
if not exist "logs" mkdir logs

REM Check configuration file
if not exist ".env" (
    if exist "config\default.env" (
        copy "config\default.env" ".env"
        echo [INFO] Created .env from config\default.env
    )
)

REM Start Worker
call pm2 start dist/worker.js --name "ipa-worker" --env production
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start worker
    pause
    exit /b 1
)

REM Save PM2 configuration
call pm2 save

echo.
echo ================================================================================
echo [SUCCESS] Worker started successfully!
echo ================================================================================
echo.
echo Service Status:
call pm2 status ipa-worker
echo.
echo Worker is running and ready to process tasks.
echo.
echo Useful commands:
echo   pm2 status ipa-worker        - Check worker status
echo   pm2 logs ipa-worker          - View worker logs
echo   pm2 restart ipa-worker       - Restart worker
echo   pm2 stop ipa-worker          - Stop worker
echo.
echo Worker Configuration:
echo   MAX_CONCURRENT_TASKS: %MAX_CONCURRENT_TASKS%
echo   POLLING_INTERVAL_MS: %POLLING_INTERVAL_MS%
echo.
pause 