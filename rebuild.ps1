# KiroCan Quick Rebuild & Deploy
# Rebuilds bridge + plugin and restarts Logi Plugin Service.
# For full release builds with .lplug4 packaging, use: .\scripts\build-release.ps1
#
# Usage: .\rebuild.ps1

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$bridgeDir = "$repoRoot\bridge"
$pluginSrcDir = "$repoRoot\KiroCanPlugin\src"
$pluginBinDir = "$repoRoot\KiroCanPlugin\bin"

Write-Host "=== KiroCan Quick Rebuild ===" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Compile bridge to standalone exe
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[1/4] Compiling bridge (bun build --compile)..." -ForegroundColor Yellow

$bunExe = "$env:USERPROFILE\.bun\bin\bun.exe"
if (-not (Test-Path $bunExe)) {
    $bunExe = "bun"
}

$bridgeExePath = "$pluginBinDir\kirocan-bridge.exe"
& $bunExe build --compile --target=bun-windows-x64 "$bridgeDir\src\index.ts" --outfile $bridgeExePath
if ($LASTEXITCODE -ne 0) {
    Write-Host "BRIDGE COMPILE FAILED" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  Bridge compiled ($([math]::Round((Get-Item $bridgeExePath).Length / 1MB, 1)) MB)" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 2. Build C# plugin
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[2/4] Building plugin (C#)..." -ForegroundColor Yellow

$dotnetExe = "C:\Program Files\dotnet\dotnet.exe"
if (-not (Test-Path $dotnetExe)) { $dotnetExe = "dotnet" }

& $dotnetExe build -c Release --nologo -v q $pluginSrcDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "PLUGIN BUILD FAILED" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  Plugin built" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 3. Kill old bridge process (if running standalone)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[3/4] Stopping old bridge processes..." -ForegroundColor Yellow

Get-Process -Name "kirocan-bridge" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try { $_.CommandLine -like "*bridge*dist*" } catch { $false }
} | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "  Old processes stopped" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 4. Reload plugin (triggers bridge auto-start)
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[4/4] Reloading plugin..." -ForegroundColor Yellow

Start-Process "loupedeck:plugin/KiroCan/reload" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Plugin reload signal sent" -ForegroundColor Green

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Plugin reloaded - bridge starts automatically on plugin load."
Write-Host "Open Logi Options+ to verify."
