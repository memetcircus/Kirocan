# KiroCan Full Rebuild & Deploy
# Builds bridge (TypeScript) + plugin (C#), deploys plugin, restarts services.
# Usage: Right-click -> Run with PowerShell, or from terminal: .\rebuild.ps1

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$bridgeDir = "$repoRoot\bridge"
$pluginDir = "$repoRoot\plugin"
$buildOutput = "$pluginDir\bin\Release\net10.0"
$dest = "$env:LOCALAPPDATA\Logi\LogiPluginService\Plugins\KiroCan"

Write-Host "=== KiroCan Full Rebuild ===" -ForegroundColor Cyan
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. Bridge: TypeScript build
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[1/5] Building Bridge (TypeScript)..." -ForegroundColor Yellow
Set-Location $bridgeDir
node node_modules\typescript\bin\tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "BRIDGE BUILD FAILED" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  Bridge build OK" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 2. Plugin: C# build
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[2/5] Building Plugin (C#)..." -ForegroundColor Yellow
Set-Location $pluginDir
dotnet build -c Release --nologo -v q
if ($LASTEXITCODE -ne 0) {
    Write-Host "PLUGIN BUILD FAILED" -ForegroundColor Red
    pause
    exit 1
}
Write-Host "  Plugin build OK" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 3. Stop Logi processes
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[3/5] Stopping Logi processes..." -ForegroundColor Yellow
Stop-Process -Name "Logi*" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Write-Host "  Logi stopped" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 4. Deploy plugin
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[4/5] Deploying plugin..." -ForegroundColor Yellow
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path "$dest\metadata" -Force | Out-Null

$excludeFiles = @("PluginApi.dll", "PluginApi.xml")
Get-ChildItem "$buildOutput\*" | Where-Object { $_.Name -notin $excludeFiles } | Copy-Item -Destination $dest -Recurse -Force
Copy-Item "$pluginDir\metadata\LoupedeckPackage.yaml" "$dest\metadata\" -Force
Write-Host "  Plugin deployed to $dest" -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# 5. Restart bridge + open Logi Options+
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "[5/5] Restarting bridge..." -ForegroundColor Yellow

# Kill old bridge if running
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*kirocan-bridge*" -or $_.CommandLine -like "*bridge\dist*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Start bridge in background
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "$bridgeDir\dist\index.js" -WorkingDirectory $bridgeDir
Write-Host "  Bridge started" -ForegroundColor Green

# Launch Logi Options+
$logiExe = "$env:ProgramFiles\Logi\LogiPluginService\LogiPluginService.exe"
if (Test-Path $logiExe) {
    Start-Process $logiExe
    Write-Host "  Logi Plugin Service started" -ForegroundColor Green
} else {
    Write-Host "  Logi Plugin Service not found — open Logi Options+ manually" -ForegroundColor DarkYellow
}

Write-Host ""
Write-Host "=== Done! ===" -ForegroundColor Cyan
Write-Host "Bridge running on http://localhost:9848"
Write-Host "Open Logi Options+ to activate the plugin."

Set-Location $repoRoot
