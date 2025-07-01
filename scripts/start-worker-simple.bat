@echo off
echo IPA Package Check - Worker Start (Simple Version)
echo ================================================

echo [STEP 1] Setting up project directory...
cd /d "%~dp0.."
echo Current directory: %CD%

echo [STEP 2] Installing backend dependencies...
call npm install
echo Backend dependencies installation completed.

echo [STEP 3] Compiling TypeScript code...
call npm run build:backend
echo TypeScript compilation completed.

echo [STEP 4] Installing PM2 if needed...
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo Installing PM2...
    call npm install -g pm2
)

echo [STEP 5] Creating directories...
if not exist "worker_storage" mkdir worker_storage
if not exist "logs" mkdir logs

echo [STEP 6] Setting up configuration...
if not exist ".env" (
    if exist "config\default.env" (
        copy "config\default.env" ".env"
    )
)

echo [STEP 7] Stopping existing worker...
pm2 delete ipa-worker >nul 2>&1

echo [STEP 8] Starting worker...
pm2 start dist/worker.js --name "ipa-worker" --env production

echo [STEP 9] Saving PM2 configuration...
pm2 save

echo ================================================
echo [SUCCESS] All steps completed!
echo ================================================
echo Worker is running and ready to process tasks.
echo.
pm2 status ipa-worker
echo.
pause 