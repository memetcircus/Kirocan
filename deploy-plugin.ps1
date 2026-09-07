# KiroCan Plugin Deploy Script
# Right-click -> Run with PowerShell (or run from admin terminal)

$ErrorActionPreference = "Stop"

$repoRoot = "C:\Users\mehme\OneDrive\Documents\Repos\Kirocan"
$pluginDir = "$repoRoot\plugin"
$buildOutput = "$pluginDir\bin\Release\net10.0"
$dest = "$env:LOCALAPPDATA\Logi\LogiPluginService\Plugins\KiroCan"

Write-Host "=== KiroCan Plugin Deploy ===" -ForegroundColor Cyan

# 1. Build
Write-Host "`n[1/4] Building plugin..." -ForegroundColor Yellow
Set-Location $pluginDir
dotnet build -c Release
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; pause; exit 1 }

# 2. Stop Logi processes and clear disabled state
Write-Host "`n[2/4] Stopping Logi processes..." -ForegroundColor Yellow
Stop-Process -Name "Logi*" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
# Remove KiroCan from disabled plugins list (if exists)
$disabledFile = "$env:LOCALAPPDATA\Logi\LogiPluginService\DisabledPlugins.json"
if (Test-Path $disabledFile) {
    $content = Get-Content $disabledFile -Raw | ConvertFrom-Json
    if ($content -is [System.Collections.IList]) {
        $filtered = $content | Where-Object { $_ -ne "KiroCan" -and $_ -ne "KiroCanPlugin" }
        $filtered | ConvertTo-Json | Set-Content $disabledFile
    } else {
        Remove-Item $disabledFile -Force
    }
}
# Also check for settings file with disabled plugins
Get-ChildItem "$env:LOCALAPPDATA\Logi\LogiPluginService" -Filter "*.json" -Recurse | ForEach-Object {
    $c = Get-Content $_.FullName -Raw -ErrorAction SilentlyContinue
    if ($c -match "KiroCan") {
        Write-Host "  Found KiroCan reference in: $($_.FullName)" -ForegroundColor DarkYellow
    }
}

# 3. Deploy to LocalAppData
Write-Host "`n[3/4] Deploying to $dest ..." -ForegroundColor Yellow
# Remove both old and new plugin directories
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
$oldDest = "$env:LOCALAPPDATA\Logi\LogiPluginService\Plugins\KiroCan"
if (Test-Path $oldDest) { Remove-Item $oldDest -Recurse -Force }
New-Item -ItemType Directory -Path "$dest\metadata" -Force | Out-Null

# Copy only the plugin's own files, exclude service-provided DLLs
$excludeFiles = @("PluginApi.dll", "PluginApi.xml")
Get-ChildItem "$buildOutput\*" | Where-Object { $_.Name -notin $excludeFiles } | Copy-Item -Destination $dest -Recurse -Force

Copy-Item "$pluginDir\metadata\LoupedeckPackage.yaml" "$dest\metadata\" -Force

Write-Host "`n[4/4] Deploy complete!" -ForegroundColor Green
Write-Host "Plugin installed to: $dest"
Write-Host "`nNow open Logi Options+ from Start menu." -ForegroundColor Cyan
