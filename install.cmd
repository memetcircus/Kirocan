@echo off
:: KiroCan Installer
:: Prerequisites: Node.js 22+, .NET 10 SDK, Logi Options+
:: Run this from the repo root folder.

echo.
echo ========================================
echo   KiroCan Installer
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Node.js %%i

:: Check .NET SDK
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download/dotnet/10.0
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('dotnet --version') do echo [OK] .NET SDK %%i

echo.
echo [1/3] Installing bridge dependencies...
cd /d "%~dp0bridge"
call npm install --silent
if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)

echo [2/3] Building bridge (TypeScript)...
call npx tsc
if errorlevel 1 (
    echo [ERROR] TypeScript build failed
    pause
    exit /b 1
)

echo [3/3] Building plugin (C#)...
cd /d "%~dp0KiroCanPlugin\src"
dotnet build -c Release --nologo -v q
if errorlevel 1 (
    echo [ERROR] Plugin build failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Installation complete!
echo ========================================
echo.
echo   Plugin registered with Logi Options+
echo.
echo   To start using KiroCan:
echo   1. Open a NEW terminal (not this one)
echo   2. Run: cd bridge ^&^& node dist\index.js
echo   3. Keep that terminal open
echo   4. Open Logi Options+ and assign buttons
echo   5. See SETUP.md for detailed instructions
echo.
pause
