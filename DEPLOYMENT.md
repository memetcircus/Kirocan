# KiroCan Windows Plugin Deployment Guide

Reference document for building and deploying the .lplug4 plugin package.

## Architecture

- **Plugin DLL** (`KiroCanPlugin.dll`): C# Logi Actions SDK plugin, .NET 10
- **Bridge**: Node.js process (node.exe + compiled JS + koffi native addon)
- **Auto-start**: Plugin `Load()` spawns `node.exe dist/index.js` from `bin/bridge/`
- **Communication**: HTTP on localhost:9848

## Build Steps

### 1. Build bridge (TypeScript → JS)

```bash
cd bridge
npm install
npx tsc
```

### 2. Build plugin (C#)

```bash
cd KiroCanPlugin/src
dotnet build -c Release
```

Output: `KiroCanPlugin/bin/Release/`

### 3. Prepare bridge bundle in Release

Copy the production bridge bundle into `KiroCanPlugin/bin/Release/bin/bridge/`:

```powershell
$bundleDir = "$env:TEMP\kirocan-bridge-bundle"
$targetDir = "KiroCanPlugin\bin\Release\bin\bridge"

# Create fresh production install
Remove-Item $bundleDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item "$bundleDir" -ItemType Directory -Force
Copy-Item "bridge\package.json" "$bundleDir\package.json"
Set-Location $bundleDir
npm install --omit=dev
Set-Location -

# Copy dist (compiled JS)
Copy-Item "bridge\dist" "$bundleDir\dist" -Recurse -Force

# Copy node.exe
Copy-Item "C:\Program Files\nodejs\node.exe" "$bundleDir\node.exe" -Force

# Copy bundle to Release
Copy-Item $bundleDir $targetDir -Recurse -Force
```

### 4. Clean the package (CRITICAL for Marketplace upload)

The Marketplace validator times out if file count exceeds ~500. Must clean:

```powershell
$releaseDir = "KiroCanPlugin\bin\Release"
$bridgeModules = "$releaseDir\bin\bridge\node_modules"

# Remove non-Windows koffi binaries (keep win32_x64 AND win32_arm64)
Get-ChildItem "$bridgeModules\koffi\build\koffi" -Directory |
    Where-Object { $_.Name -notin @("win32_x64", "win32_arm64") } |
    Remove-Item -Recurse -Force

# Remove koffi source/docs
Remove-Item "$bridgeModules\koffi\src" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$bridgeModules\koffi\doc" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$bridgeModules\koffi\test" -Recurse -Force -ErrorAction SilentlyContinue

# Remove dev artifacts from all node_modules
Get-ChildItem $bridgeModules -Recurse -File | Where-Object {
    $_.Extension -in @('.d.ts', '.map', '.md', '.txt', '.yml', '.yaml') -or
    $_.Name -match '^(LICENSE|CHANGELOG|HISTORY|AUTHORS|README|Makefile|\.npmignore|\.gitignore|\.editorconfig)'
} | Remove-Item -Force -ErrorAction SilentlyContinue

Get-ChildItem $bridgeModules -Recurse -Directory | Where-Object {
    $_.Name -in @('test', 'tests', 'docs', 'doc', 'example', 'examples', '.github', 'benchmark', 'coverage', 'typings')
} | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Remove duplicate folders if any
Remove-Item "$releaseDir\bin\bridge\kirocan-bridge-bundle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$releaseDir\bin\metadata" -Recurse -Force -ErrorAction SilentlyContinue

# Remove files that should NOT be in the package
Remove-Item "$releaseDir\bin\PluginApi.dll" -Force -ErrorAction SilentlyContinue
Remove-Item "$releaseDir\bin\kirocan-bridge.exe" -Force -ErrorAction SilentlyContinue
Remove-Item "$releaseDir\bin\koffi.node" -Force -ErrorAction SilentlyContinue
```

### 5. Pack with logiplugintool

```powershell
# Install tool if needed: dotnet tool install --global LogiPluginTool
logiplugintool pack "KiroCanPlugin\bin\Release" "C:\Temp\KiroCan_for_Windows_1_0.lplug4"
logiplugintool verify "C:\Temp\KiroCan_for_Windows_1_0.lplug4"
```

**Expected result:** ~440 files, ~32MB, verify OK.

### 6. Test locally

1. Logi Options+ → uninstall existing KiroCan
2. Double-click the .lplug4 file
3. Wait 15 seconds (bridge auto-starts)
4. Assign buttons, press "Be Honest" — should type into Kiro chat

### 7. Upload to Marketplace

https://marketplace.logitech.com/contribute

## Key Constraints Learned

| Issue | Cause | Solution |
|-------|-------|----------|
| Marketplace upload timeout | >500 files in .lplug4 | Clean dev artifacts, remove non-Windows koffi binaries |
| "LoupedeckPackage.yaml missing" | PowerShell Compress-Archive creates wrong ZIP structure | Use `logiplugintool pack` instead |
| Bridge won't start (.lplug4 install) | Assembly.Location returns empty | Plugin uses hardcoded fallback path: `Plugins\KiroCan\bin\bridge\` |
| koffi "cannot find native module" | Wrong platform binary included | Must include both `win32_x64` AND `win32_arm64` |
| Buttons don't work (Kiro window not found) | koffi EnumWindows needs correct encoding | window-manager.ts must be clean UTF-8 (no BOM, no UTF-16) |
| Bridge crashes in background | uncaughtException kills process | Global handler in index.ts: `process.on("uncaughtException", ...)` |
| Basket poller crashes bridge | isKiroForeground() PowerShell call fails | Disabled in embedded mode |
| SetForegroundWindow blocked | Windows focus-stealing prevention | activateWindow returns true anyway (user has Kiro foreground) |

## LoupedeckPackage.yaml

```yaml
type: plugin4
name: KiroCan
displayName: KiroCan for Windows
description: Control Kiro IDE from your MX Creative Console
pluginFileName: KiroCanPlugin.dll
version: 1.0
author: memetcircus
pluginFolderWin: bin
supportedDevices:
    - LoupedeckCtFamily
    - LogitechCreativeFamily
pluginCapabilities:
    - ActivatesApplication
minimumLoupedeckVersion: 6.0
```

## Version Bump Checklist

When releasing a new version:

1. Update `version` in `LoupedeckPackage.yaml`
2. Update `PluginVersion` constant in `KiroCanPlugin.cs` (triggers bridge re-extraction if using embedded mode)
3. Rebuild bridge: `cd bridge && npx tsc`
4. Rebuild plugin: `cd KiroCanPlugin/src && dotnet build -c Release`
5. Prepare bundle + clean (steps 3-4 above)
6. Pack + verify + test + upload

## File Locations

- Plugin source: `KiroCanPlugin/src/`
- Bridge source: `bridge/src/`
- Bridge compiled: `bridge/dist/`
- Build output: `KiroCanPlugin/bin/Release/`
- Package metadata: `KiroCanPlugin/src/package/metadata/`
- Icon: `assets/Icon256x256.png` → copy to `package/metadata/`
- GitHub Release: https://github.com/memetcircus/Kirocan/releases
- Marketplace: https://marketplace.logitech.com/contribute
