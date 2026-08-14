---
inclusion: auto
---

# KiroCan Build & Deploy Guide

## Environment Setup (every session)
```powershell
$env:PATH = "C:\Program Files\Git\bin;C:\Program Files\nodejs;C:\Program Files\dotnet;$env:PATH"
```

## Plugin Build
```powershell
cd C:\Users\mehme\OneDrive\Documents\Repos\Kirocan\KiroCanPlugin\src
dotnet build
```
Build output goes to `bin\Debug\` — Logi Plugin Service reads the `.link` file pointing here.
After build, restart Logi Options+ (or use Settings → Restart Logi Plugin Service).

## Bridge Build & Run
```powershell
cd C:\Users\mehme\OneDrive\Documents\Repos\Kirocan\bridge
cmd /c "npm run build"
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
cmd /c "npm start"
```
Bridge listens at `http://127.0.0.1:9848`.

## Testing Bridge
```powershell
Invoke-RestMethod -Uri http://localhost:9848/health
Invoke-RestMethod -Method POST -Uri http://localhost:9848/hook/working
Invoke-RestMethod -Method POST -Uri http://localhost:9848/hook/idle
Invoke-RestMethod -Method POST -Uri http://localhost:9848/cancel
Invoke-RestMethod -Method POST -Uri http://localhost:9848/screenshot
```

## Commit & Push
```powershell
$env:PATH = "C:\Program Files\Git\bin;$env:PATH"
cd C:\Users\mehme\OneDrive\Documents\Repos\Kirocan
git add -A
git commit -m "feat: description"
git push origin main
```

## Key Paths
- Plugin source: `KiroCanPlugin/src/`
- Bridge source: `bridge/src/`
- Sprite tiles: `assets/sprites/tiles/`
- Plugin .link file: `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\KiroCanPlugin.link`
- Plugin logs: `%LOCALAPPDATA%\Logi\LogiPluginService\Logs\plugin_logs\`

## ARM64 Notes
- koffi `SendInput` does NOT work on Windows ARM64
- Use PowerShell `WScript.Shell.SendKeys()` for keyboard simulation
- Use PowerShell `Get-Process Kiro` + `AppActivate` for window management
- koffi `EnumWindows` does NOT work — use PowerShell to find HWND

## Plugin Reload
After `dotnet build`, either:
1. Restart Logi Options+ from system tray
2. Or use Logi Options+ Settings → Restart Logi Plugin Service

## Sprite Regeneration
```powershell
cd C:\Users\mehme\OneDrive\Documents\Repos\Kirocan
cmd /c "npm run build:sprites"
```
Then rebuild plugin to pick up new embedded resources.
