# KiroCan Setup Guide (Windows)

Step-by-step guide for getting KiroCan running on your Windows machine with a Logitech MX Creative Console.

## Prerequisites

- **Windows 10 or 11** (x64 or ARM64)
- **Logitech MX Creative Console** connected via USB or Bluetooth
- **Logi Options+** installed and running ([download](https://www.logitech.com/software/logi-options-plus.html))
- **Kiro IDE** installed ([download](https://kiro.dev))

For building from source, you also need:
- **.NET 10 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/10.0))
- **Bun** ([install](https://bun.sh)) — compiles bridge to standalone exe

## Installation

### Option A: Install .lplug4 package (recommended)

1. Download `KiroCan.lplug4` from [Releases](https://github.com/memetcircus/Kirocan/releases)
2. Double-click the file — Logi Options+ installs it automatically
3. Done. The bridge extracts and starts automatically when the plugin loads.

No terminal, no Node.js, no manual bridge startup required.

### Option B: Build from source

```powershell
git clone https://github.com/memetcircus/Kirocan.git
cd Kirocan
.\scripts\build-release.ps1
```

This compiles the bridge into a standalone exe, builds the plugin, and registers it with Logi Plugin Service via a `.link` file.

## Configure Buttons in Logi Options+

### Step 1: Create a Kiro Profile

1. Open **Logi Options+**
2. Select your **MX Creative Console**
3. Click **+ Add Application** and browse to `Kiro.exe`
4. This profile activates automatically when Kiro is the foreground window

### Step 2: Assign KiroCan Actions

With the Kiro profile selected:

1. Click on an LCD button to assign an action
2. In the action picker, look for **KiroCan** section
3. Drag actions onto your preferred button positions

**Available actions:**

| Category | Actions |
|----------|---------|
| Snippets | Be Honest, Don't Code Yet, Show Options, Explain Why, Keep Short, No Tests |
| Controls | Screenshot, Stop, Go! |
| Utilities | New Session, Struct Prompt, Inline Chat, Terminal→Chat, Screen Record, Paste To Kiro, Workspace, Start Spec, Git Commit |
| Prompts | Criticize, Refactor, Write Tests, Explain, Fix Bug, Optimize, Review, Document, Simplify |

## Configure Kiro Hooks

KiroCan needs hooks in your Kiro workspace to detect when the AI agent starts/stops working. These hooks tell the bridge to update its state, which triggers the ghost animation.

The hooks are included in this repo's `.kiro/hooks/` directory. If you're working in this repo, they work automatically.

**For other projects**, copy these hook files to the project's `.kiro/hooks/` folder:

- `.kiro/hooks/kirocan-working.json` — Signals bridge when agent starts working
- `.kiro/hooks/kirocan-idle.json` — Signals bridge when agent stops

## Paste To Kiro Setup (Optional)

This feature lets you select text in any app, press a button, and it queues up. When you switch to Kiro, everything auto-pastes into chat.

### Setup in Logi Options+ Default Profile:

1. Go to the **Default Profile** (top bar, first icon — works from any app)
2. Click an empty button → **System Actions** → **ADVANCED** → **Multi-action**
3. Add two actions in order:
   - **Action 1**: Keyboard Shortcut → `Ctrl+C`
   - **Action 2**: Run → browse to `bridge\paste-to-kiro.bat`
4. Save

**Usage:** Select text in any app → press button → switch to Kiro → text auto-pastes into chat.

## Verify Everything Works

1. Open Kiro IDE with a project that has the KiroCan hooks
2. Press a button on the MX Console (try "Go!" or a snippet like "Be Honest")
3. The ghost animation should play while Kiro is working
4. When Kiro finishes, animation stops and button labels return

## Troubleshooting

### Plugin not showing in Logi Options+
- Close Logi Options+ completely (system tray → right-click → Quit)
- Reopen Logi Options+
- If built from source, check that `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\` contains a `KiroCanPlugin.link` file

### Buttons do nothing
- Check Kiro is open and the correct application profile is active in Logi Options+
- Check bridge is running: open `http://localhost:9848/health` in a browser — should return JSON
- If bridge isn't running, restart Logi Options+ (plugin extracts and starts it on load)
- Check `%LOCALAPPDATA%\KiroCan\kirocan-bridge.exe` exists (plugin extracts it there)

### Ghost animation stuck / purple tiles remain
- Press the **Stop** button to force-clear animation
- If persists, switch pages (arrow buttons on console) and switch back

### Bridge port 9848 in use
If another process is using port 9848:
```powershell
# Find what's using the port
netstat -ano | findstr :9848
# Kill the process
Stop-Process -Id <PID> -Force
```
Then restart Logi Options+ to let the plugin respawn the bridge.

### Build errors (from source)
```powershell
# Clean rebuild
cd KiroCanPlugin\src
dotnet clean
dotnet build -c Release
```

## Updating

### If using .lplug4
Download the new version and double-click to install. It replaces the old version.

### If built from source
```powershell
git pull
.\scripts\build-release.ps1
```
Then restart Logi Options+.
