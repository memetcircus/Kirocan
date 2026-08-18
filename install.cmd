@echo off
:: KiroCan One-Click Installer
:: Prerequisites: .NET 10 SDK, Bun, Logi Options+
:: Double-click this file or run from terminal.

echo.
echo ========================================
echo   KiroCan Installer
echo ========================================
echo.

:: Check .NET SDK
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found. Install from https://dotnet.microsoft.com/download/dotnet/10.0
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('dotnet --version') do echo [OK] .NET SDK %%i

:: Check Bun
set BUN_EXE=bun
where bun >nul 2>&1
if errorlevel 1 (
    if exist "%USERPROFILE%\.bun\bin\bun.exe" (
        set BUN_EXE=%USERPROFILE%\.bun\bin\bun.exe
        echo [OK] Bun found at %USERPROFILE%\.bun\bin\bun.exe
    ) else (
        echo [ERROR] Bun not found. Install with: powershell -c "irm bun.sh/install.ps1 | iex"
        echo.
        pause
        exit /b 1
    )
) else (
    for /f "tokens=*" %%i in ('bun --version') do echo [OK] Bun %%i
)

echo.
echo [1/3] Compiling bridge to standalone exe...
cd /d "%~dp0bridge"
call npm install --silent 2>nul
%BUN_EXE% build --compile --target=bun-windows-x64 src\index.ts --outfile ..\KiroCanPlugin\bin\kirocan-bridge.exe
if errorlevel 1 (
    echo [ERROR] Bridge compilation failed
    pause
    exit /b 1
)
echo   Bridge compiled successfully

echo [2/3] Building plugin (C#)...
cd /d "%~dp0KiroCanPlugin\src"
dotnet build -c Release --nologo -v q
if errorlevel 1 (
    echo [ERROR] Plugin build failed
    pause
    exit /b 1
)
echo   Plugin built and registered with Logi Plugin Service

echo [3/3] Restarting Logi Plugin Service...
start loupedeck:plugin/KiroCan/reload 2>nul

echo.
echo ========================================
echo   Installation complete!
echo ========================================
echo.
echo   Plugin registered with Logi Options+
echo   Bridge will start automatically when plugin loads
echo.
echo   Next steps:
echo   1. Open Logi Options+
echo   2. Select your MX Creative Console
echo   3. Assign KiroCan actions to buttons
echo   4. See SETUP.md for detailed instructions
echo.
pause
