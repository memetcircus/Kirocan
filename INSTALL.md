# KiroCan Installation Guide

## Prerequisites

- Windows 10/11 (x64 or ARM64)
- [Logi Options+](https://www.logitech.com/software/logi-options-plus.html) installed (includes Logi Plugin Service)
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0) installed
- [Node.js](https://nodejs.org/) (v20+) installed
- Logitech MX Creative Console connected via USB

## Plugin Installation (Development Mode)

### 1. Install Logi Plugin Tool

```powershell
dotnet tool install --global LogiPluginTool
```

### 2. Build the Plugin

```powershell
cd plugin\src
dotnet build
```

On successful build, a `.link` file is created at:
```
%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\KiroCanPlugin.link
```

This tells Logi Plugin Service where to find the plugin DLL.

### 3. Restart Logi Plugin Service

Open Logi Options+ Settings and click "Restart Logi Plugin Service", or restart from services.msc.

### 4. Verify Plugin

Open Logi Options+ and navigate to your MX Creative Console device. Under "ALL ACTIONS" you should see "KiroCan Actions" with the available commands.

## Bridge Installation

### 1. Install Dependencies

```powershell
cd bridge
npm install
```

### 2. Build

```powershell
npm run build
```

### 3. Start

```powershell
npm start
```

The bridge starts an HTTP server at `http://localhost:9848`.

## How It Works

```
MX Creative Console
    |
    v
Logi Options+ (Plugin: KiroCan)
    |
    | HTTP POST to localhost:9848
    v
Bridge (Node.js HTTP server)
    |
    | Win32 API calls (keyboard shortcuts, window management)
    v
Kiro IDE
```

1. User presses a button on MX Creative Console
2. Logi Options+ triggers the mapped KiroCan action
3. The plugin sends an HTTP request to the Bridge
4. The Bridge executes the corresponding Kiro IDE shortcut via Win32 APIs

## Troubleshooting

### Plugin not showing in Logi Options+
- Ensure there is no stale `KiroCan` folder in `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\` (delete it if present)
- Only the `.link` file should exist for development mode
- Restart Logi Plugin Service after build

### "Malfunctioned" error
- Make sure the TargetFramework in `.csproj` matches your Logi Plugin Service version
- Check `%LOCALAPPDATA%\Logi\LogiPluginService\Logs\plugin_logs\` for error details
- Ensure `PluginApi.dll` is NOT copied to the output (set `<Private>false</Private>` in csproj reference)

### Build fails with CS1705 (System.Runtime version mismatch)
- Your Logi Plugin Service uses .NET 10. Set `<TargetFramework>net10.0</TargetFramework>` in the plugin csproj.
- The official SDK docs say net8.0, but newer Logi Options+ versions bundle .NET 10.

### Bridge not starting
- Ensure Node.js is in PATH
- Run `npm install` in the bridge directory first
