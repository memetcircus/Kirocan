@echo off
:: KiroCan One-Click Installer
:: Prerequisites: Node.js 22+, .NET 10 SDK, Logi Options+
:: Double-click this file or run from terminal.

echo.
echo ========================================
echo   KiroCan Installer
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i

:: Check .NET SDK
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download/dotnet/10.0
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('dotnet --version') do echo [OK] .NET SDK %%i

echo.
echo [1/4] Installing bridge dependencies...
cd /d "%~dp0bridge"
call npm install --silent
if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

echo [2/4] Building bridge (TypeScript)...
call node node_modules\typescript\bin\tsc
if errorlevel 1 (
    echo [ERROR] TypeScript build failed
    pause
    exit /b 1
)

echo [3/4] Building plugin (C#)...
cd /d "%~dp0KiroCanPlugin\src"
dotnet build --nologo -v q
if errorlevel 1 (
    echo [ERROR] Plugin build failed
    pause
    exit /b 1
)

echo [4/4] Starting bridge...
cd /d "%~dp0bridge"
start "KiroCan Bridge" cmd /c "node dist\index.js"

echo.
echo ========================================
echo   Installation complete!
echo ========================================
echo.
echo   Bridge running on http://127.0.0.1:9848
echo   Plugin registered with Logi Options+
echo.
echo   Next steps:
echo   1. Open Logi Options+
echo   2. Select your MX Creative Console
echo   3. Assign KiroCan actions to buttons
echo   4. See SETUP.md for detailed instructions
echo.
pause
