@echo off
SETLOCAL
SET "NODE_PATH=%~dp0node-v24.14.1-win-x64"
SET "PATH=%NODE_PATH%;%PATH%"

echo [INFO] Starting KIS Premium AI Assistant...

:: Check if node_modules exists
if not exist "%~dp0node_modules" (
    echo [WARN] node_modules not found. Running npm install...
    call npm install
)

:: Clear Next.js dev lock if it exists (prevents "Unable to acquire lock" errors)
if exist "%~dp0.next\dev\lock" (
    echo [INFO] Cleaning up Next.js lock file...
    del /f /q "%~dp0.next\dev\lock"
)

:: Open browser automatically after a short delay (assume port 3000)
echo [INFO] Chrome browser will open automatically at http://localhost:3000 in 5 seconds...
start /b cmd /c "timeout /t 5 >nul && start chrome http://localhost:3000"

:: Run the development server
echo [INFO] Running 'npm run dev'...
call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] npm run dev failed with error code %ERRORLEVEL%.
)

pause
