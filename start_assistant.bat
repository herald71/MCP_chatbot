@echo off
title AI Assistant Quick Start

:: Set portable node path
set "NODE_PATH=%~dp0node-v24.14.1-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

:: Check node_modules
if not exist "node_modules\" (
    echo [ERROR] node_modules not found.
    echo Please run "npm install" first.
    pause
    exit /b
)

:: Open browser in background after 5 seconds
echo Open http://localhost:3000 in 5 seconds...
start /b cmd /c "timeout /t 5 >nul && start http://localhost:3000"

:: Start Server
echo Running "npm run dev"...
call npm run dev

pause
