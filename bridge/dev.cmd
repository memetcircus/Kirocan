@echo off
:: KiroCan Bridge - Build and Start with auto-restart on file changes
:: Uses Node.js --watch flag to auto-restart when dist/ files change
:: tsc --watch recompiles on .ts file changes

echo === KiroCan Bridge Dev Mode ===
echo Building TypeScript...

cd /d "%~dp0"
node node_modules\typescript\bin\tsc
if errorlevel 1 (
    echo BUILD FAILED
    pause
    exit /b 1
)

echo Starting bridge with --watch...
echo (saves to .ts files will need manual tsc, use dev-watch.cmd for full auto)
echo.
node --watch-path=dist dist\index.js
