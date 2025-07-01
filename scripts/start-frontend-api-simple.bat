@echo off
echo IPA Package Check - Frontend + API Server Start (Simple Version)
echo ================================================================

echo [STEP 1] Setting up project directory...
cd /d "%~dp0.."
echo Current directory: %CD%

echo [STEP 2] Installing backend dependencies...
call npm install
echo Backend dependencies installation completed.

echo [STEP 3] Compiling TypeScript code...
call npm run build:backend
echo TypeScript compilation completed.

echo [STEP 4] Installing frontend dependencies...
cd frontend
call npm install
echo Frontend dependencies installation completed.

echo [STEP 5] Building frontend...
call npm run build
echo Frontend build completed.

echo [STEP 6] Returning to project root...
cd ..
echo Current directory: %CD%

echo [STEP 7] Installing PM2 if needed...
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo Installing PM2...
    call npm install -g pm2
)

echo [STEP 8] Creating directories...
if not exist "storage" mkdir storage
if not exist "storage\temp" mkdir storage\temp
if not exist "storage\ipa" mkdir storage\ipa
if not exist "logs" mkdir logs

echo [STEP 9] Setting up configuration...
if not exist ".env" (
    if exist "config\default.env" (
        copy "config\default.env" ".env"
    )
)

echo [STEP 10] Stopping existing services...
pm2 delete ipa-api-server >nul 2>&1

echo [STEP 11] Starting API server...
pm2 start dist/server.js --name "ipa-api-server" --env production

echo [STEP 12] Saving PM2 configuration...
pm2 save

echo ================================================================
echo [SUCCESS] All steps completed!
echo ================================================================
echo API Server: http://localhost:8080
echo Frontend: http://localhost:8080/
echo.
pm2 status ipa-api-server
echo.
pause 