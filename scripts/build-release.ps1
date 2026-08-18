# KiroCan Release Build Script
# Builds the bridge as a standalone exe, compiles the C# plugin, and packages as .lplug4
#
# Prerequisites:
#   - Bun (https://bun.sh) installed
#   - .NET 10 SDK installed
#   - LogiPluginTool installed (for pack/verify)
#
# Usage: .\scripts\build-release.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$BridgeDir = Join-Path $RepoRoot "bridge"
$PluginDir = Join-Path $RepoRoot "KiroCanPlugin"
$PluginSrcDir = Join-Path $PluginDir "src"
$BinDir = Join-Path $PluginDir "bin"
$ReleaseDir = Join-Path $BinDir "Release"
$ReleaseBinDir = Join-Path $ReleaseDir "bin"

Write-Host "=== KiroCan Release Build ===" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------------
# Step 1: Build bridge as standalone exe
# ---------------------------------------------------------------------------
Write-Host "[1/5] Building bridge (bun build --compile)..." -ForegroundColor Yellow

$bunExe = "$env:USERPROFILE\.bun\bin\bun.exe"
if (-not (Test-Path $bunExe)) {
    $bunExe = "bun"
}

$bridgeExePath = Join-Path $BinDir "kirocan-bridge.exe"
& $bunExe build --compile --target=bun-windows-x64 (Join-Path $BridgeDir "src\index.ts") --outfile $bridgeExePath
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: bun build --compile failed" -ForegroundColor Red
    exit 1
}
Write-Host "  -> kirocan-bridge.exe created ($([math]::Round((Get-Item $bridgeExePath).Length / 1MB, 1)) MB)" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 2: Build C# plugin (Release)
# ---------------------------------------------------------------------------
Write-Host "[2/5] Building C# plugin (dotnet build -c Release)..." -ForegroundColor Yellow

$dotnetExe = "C:\Program Files\dotnet\dotnet.exe"
if (-not (Test-Path $dotnetExe)) {
    $dotnetExe = "dotnet"
}

& $dotnetExe build -c Release $PluginSrcDir
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: dotnet build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  -> Plugin built successfully" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 3: Verify PluginApi.dll is NOT in output (must be Private=false)
# ---------------------------------------------------------------------------
Write-Host "[3/5] Verifying PluginApi.dll is excluded..." -ForegroundColor Yellow

$pluginApiPath = Join-Path $ReleaseBinDir "PluginApi.dll"
if (Test-Path $pluginApiPath) {
    Write-Host "FAILED: PluginApi.dll found in output! It must not be included in the package." -ForegroundColor Red
    Write-Host "  Check that <Private>false</Private> is set in the csproj reference." -ForegroundColor Red
    exit 1
}
Write-Host "  -> PluginApi.dll correctly excluded" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 4: Verify kirocan-bridge.exe IS in output
# ---------------------------------------------------------------------------
Write-Host "[4/5] Verifying kirocan-bridge.exe is in output..." -ForegroundColor Yellow

$bridgeInOutput = Join-Path $ReleaseBinDir "kirocan-bridge.exe"
if (-not (Test-Path $bridgeInOutput)) {
    Write-Host "FAILED: kirocan-bridge.exe not found in build output at $bridgeInOutput" -ForegroundColor Red
    exit 1
}
Write-Host "  -> kirocan-bridge.exe present in output" -ForegroundColor Green

# ---------------------------------------------------------------------------
# Step 5: Package with LogiPluginTool (if available)
# ---------------------------------------------------------------------------
Write-Host "[5/5] Packaging .lplug4..." -ForegroundColor Yellow

$logiTool = Get-Command logiplugintool -ErrorAction SilentlyContinue
if ($null -eq $logiTool) {
    # Try common install location
    $logiToolPath = "C:\Program Files\Logi\LogiPluginService\LogiPluginTool.exe"
    if (Test-Path $logiToolPath) {
        $logiTool = Get-Item $logiToolPath
    }
}

if ($null -ne $logiTool) {
    $packDir = $ReleaseDir
    Write-Host "  Running: logiplugintool pack $packDir" -ForegroundColor Gray
    & $logiTool pack $packDir
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: logiplugintool pack failed (non-fatal)" -ForegroundColor DarkYellow
    } else {
        Write-Host "  -> .lplug4 package created" -ForegroundColor Green

        Write-Host "  Running: logiplugintool verify..." -ForegroundColor Gray
        & $logiTool verify (Get-ChildItem $RepoRoot -Filter "*.lplug4" | Select-Object -First 1).FullName
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: logiplugintool verify reported issues" -ForegroundColor DarkYellow
        } else {
            Write-Host "  -> Package verified successfully" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  LogiPluginTool not found — skipping .lplug4 packaging" -ForegroundColor DarkYellow
    Write-Host "  Install Logi Options+ SDK or copy LogiPluginTool.exe to PATH" -ForegroundColor DarkYellow
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "=== Build complete ===" -ForegroundColor Cyan
Write-Host "Output: $ReleaseDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Contents:" -ForegroundColor Gray
Get-ChildItem $ReleaseBinDir -Filter "*.exe" | ForEach-Object { Write-Host "  $($_.Name) ($([math]::Round($_.Length / 1MB, 1)) MB)" }
Get-ChildItem $ReleaseBinDir -Filter "*.dll" | ForEach-Object { Write-Host "  $($_.Name) ($([math]::Round($_.Length / 1KB, 0)) KB)" }
