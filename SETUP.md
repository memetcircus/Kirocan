# KiroCan Setup Guide (Windows)

Step-by-step installation guide for getting KiroCan running on your Windows machine with a Logitech MX Creative Console.

## Prerequisites

Before you start, make sure you have:

- **Windows 10 or 11** (x64 or ARM64)
- **Logitech MX Creative Console** connected via USB or Bluetooth
- **Logi Options+** installed and running ([download](https://www.logitech.com/software/logi-options-plus.html))
- **Kiro IDE** installed ([download](https://kiro.dev))
- **Node.js 22+** ([download](https://nodejs.org/))
- **.NET 10 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/10.0))
- **Git** ([download](https://git-scm.com/downloads))

## Step 1: Clone the Repository

```bash
git clone https://github.com/memetcircus/Kirocan.git
cd Kirocan
```

## Step 2: Install and Start the Bridge

The bridge is a local HTTP server that translates MX Console button presses into Kiro IDE actions.

```bash
cd bridge
npm install
npm run build
npm start
```

You should see:
```
KiroCan Bridge listening on http://127.0.0.1:9848
```

Keep this terminal open. The bridge must be running for buttons to work.

For development with auto-reload:
```bash
bridge\dev-watch.cmd
```

## Step 3: Build and Install the C# Plugin

```bash
cd KiroCanPlugin\src
dotnet build
```

The build automatically:
1. Compiles the plugin DLL
2. Creates a `.link` file in `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\`
3. Sends a reload signal to Logi Plugin Service

After build completes, open **Logi Options+**. You should see "KiroCan" in the actions list when your MX Creative Console is selected.

If the plugin doesn't appear, restart Logi Options+ (close from system tray, then reopen).

## Step 4: Configure Kiro Hooks

KiroCan needs two hooks in your Kiro workspace to detect when the AI agent starts/stops working. These are already included in the `.kiro/hooks/` directory of this repo.

If you're opening a **different project** in Kiro and want KiroCan to work there, copy these files to that project's `.kiro/hooks/` folder:

- `.kiro/hooks/kirocan-working.json` - Signals bridge when agent starts
- `.kiro/hooks/kirocan-idle.json` - Signals bridge when agent stops

## Step 5: Assign Buttons in Logi Options+

### KiroCan Profile (when Kiro is active)

1. Open **Logi Options+**
2. Select your **MX Creative Console**
3. Click the **Kiro** application profile (or create one for Kiro.exe)
4. Drag KiroCan actions from the right panel onto your LCD buttons

Available actions:
- **Snippets**: Be Honest, Don't Code Yet, Show Options, Explain Why, Keep Short, No Tests
- **Controls**: Screenshot, Stop, Go!
- **Utilities**: New Session, Struct Prompt, Inline Chat, Terminal to Chat, Screen Record, Paste To Kiro, Workspace, Start Spec, Git Commit
- **Prompts**: Criticize, Refactor, Write Tests, Explain, Fix Bug, Optimize, Review, Document, Simplify

### Paste To Kiro (Default Profile - works from any app)

This is the "clipboard basket" feature. Select text in any app, press the button, and it queues up. When you switch to Kiro, everything gets pasted into chat automatically.

1. In Logi Options+, go to the **Default Profile** (top bar, first icon)
2. Click an empty button → **System Actions** → **ADVANCED** → **Multi-action**
3. Add two actions in order:
   - **Action 1**: Keyboard Shortcut → `Ctrl+C`
   - **Action 2**: Run → browse to `bridge\paste-to-kiro.bat`
4. Save

Now from any app: select text → press button → text is queued. Switch to Kiro → auto-pasted into chat.

## Step 6: Verify Everything Works

1. Make sure the bridge is running (`KiroCan Bridge listening on http://127.0.0.1:9848`)
2. Open Kiro IDE with a project
3. Press a button on the MX Console (try "Go!" or a snippet like "Be Honest")
4. The ghost animation should play while Kiro is working
5. When Kiro finishes, animation stops and button labels return

## Troubleshooting

### Bridge won't start / port in use
```bash
Stop-Process -Name "node" -Force
npm start
```

### Plugin not showing in Logi Options+
- Close Logi Options+ completely (system tray → right-click → Quit)
- Reopen Logi Options+
- Check that `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\` contains a `KiroCanPlugin.link` file

### Buttons do nothing
- Check bridge is running (terminal shows `listening on http://127.0.0.1:9848`)
- Check Kiro is open and the correct application profile is active in Logi Options+
- Try: `curl -s -X POST http://localhost:9848/health` — should return JSON

### Ghost animation stuck / purple tiles remain
- Press the **Stop** button to force-clear animation
- If persists, switch pages (arrow buttons) and switch back

### Build errors (assembly version conflicts)
This is normal when Logi Plugin Service updates. Run:
```bash
cd KiroCanPlugin\src
dotnet build -c Release
```
The warnings about version conflicts can be ignored as long as the build succeeds.

## Auto-Start Bridge on Kiro Launch

The repository includes a Kiro hook (`.kiro/hooks/bridge-autostart.json`) that automatically starts the bridge when a Kiro session begins. This means you don't need to manually start the bridge if you're working in this repo.

For other projects, you can copy this hook file or always keep a terminal running `bridge\dev-watch.cmd`.

## Updating

```bash
git pull
cd bridge && npm install && npm run build
cd ..\KiroCanPlugin\src && dotnet build
```

Then restart the bridge and Logi Options+.
