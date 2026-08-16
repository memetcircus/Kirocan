@echo off
:: KiroCan Bridge - Full auto rebuild + restart
:: Watches src/ for .ts changes, recompiles and restarts automatically
:: Run this ONCE and forget about it.

echo === KiroCan Bridge Auto Dev ===
echo Watching for changes... (Ctrl+C to stop)
echo.

cd /d "%~dp0"

:: Initial build
node node_modules\typescript\bin\tsc
if errorlevel 1 (
    echo INITIAL BUILD FAILED
    pause
    exit /b 1
)

echo Initial build OK. Starting watch mode...
echo.

:: tsc --watch recompiles on save, node --watch restarts when dist/ changes
start /B node node_modules\typescript\bin\tsc --watch --preserveWatchOutput
node --watch-path=dist dist\index.js
