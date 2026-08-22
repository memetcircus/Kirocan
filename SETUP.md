# KiroCan Setup Guide (Windows)

## Option A: Install from .lplug4 (recommended)

**Prerequisites:** Windows 10/11, Logitech MX Creative Console, Logi Options+, Kiro IDE

1. Download `KiroCan.lplug4` from [Releases](https://github.com/memetcircus/Kirocan/releases)
2. Double-click to install
3. Open Logi Options+ → select MX Creative Console → assign KiroCan buttons
4. Done — bridge starts automatically when plugin loads

No Node.js, no .NET SDK, no terminal needed.

---

## Option B: Build from source

### Prerequisites

- **Windows 10 or 11** (x64)
- **Logitech MX Creative Console** connected via USB or Bluetooth
- **Logi Options+** installed ([download](https://www.logitech.com/software/logi-options-plus.html))
- **Kiro IDE** installed ([download](https://kiro.dev))
- **Node.js 22+** ([download](https://nodejs.org/))
- **.NET 10 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/10.0))

## Installation

### Step 1: Clone and build

```bash
git clone https://github.com/memetcircus/Kirocan.git
cd Kirocan

# Build plugin
cd KiroCanPlugin/src
dotnet build -c Release

# Install bridge dependencies
cd ../../bridge
npm install
```

### Step 2: Start the bridge

Open a **separate terminal** (not Kiro's integrated terminal) and run:

```bash
cd bridge
node dist/index.js
```

You should see: `KiroCan Bridge listening on http://127.0.0.1:9848`

Keep this terminal open while using KiroCan.

### Step 3: Assign buttons in Logi Options+

1. Open **Logi Options+**
2. Select your **MX Creative Console**
3. Create a **Kiro** application profile (or select existing)
4. Drag KiroCan actions from the right panel onto LCD buttons

Available action groups:
- **Kiro Commands**: Screenshot, Stop, Go!
- **Snippets**: Be Honest, Don't Code Yet, Show Options, Explain Why, Keep Short, No Tests
- **Prompts**: Criticize, Refactor, Write Tests, Explain, Fix Bug, Optimize, Review, Document, Simplify
- **Utilities**: New Session, Struct Prompt, Ask Kiro, Terminal to Chat, Screen Record, Paste To Kiro, Workspace, Start Spec, Git Commit

## Kiro Hooks Configuration

KiroCan needs hooks in your Kiro workspace to detect when the AI agent starts/stops working. These hooks trigger the ghost animation.

The hooks are included in this repo's `.kiro/hooks/` directory. If you're working in this repo, they work automatically.

**For other projects**, copy these hook files to that project's `.kiro/hooks/` folder:
- `.kiro/hooks/kirocan-working.json`
- `.kiro/hooks/kirocan-idle.json`

## Paste To Kiro Setup (Optional)

This lets you select text in any app, press a button, and it queues up. When you press "Paste To Kiro" in Kiro profile, everything pastes into chat.

### Default Profile multi-action:

1. Go to **Default Profile** in Logi Options+ (works from any app)
2. Click an empty button -> System Actions -> ADVANCED -> Multi-action
3. Add two actions:
   - **Action 1**: Keyboard Shortcut: `Ctrl+C`
   - **Action 2**: Run: browse to `bridge\paste-to-kiro.bat` (in the repo folder)
4. Save

**Usage:** Select text in any app -> press button -> switch to Kiro -> press "Paste To Kiro" button -> all queued text pastes into chat.

## Verify Everything Works

1. Bridge running in separate terminal ("listening on 127.0.0.1:9848")
2. Kiro IDE open with a project
3. Kiro is the foreground window
4. Press a snippet button (e.g., "Be Honest") -> text appears in chat input
5. Ghost animation plays while Kiro is working

## Troubleshooting

### Buttons do nothing
- Is bridge running? Check terminal shows "listening on 127.0.0.1:9848"
- Is Kiro the foreground window? Buttons type into the active window.
- Try: `curl http://localhost:9848/health` in another terminal - should return JSON.

### Bridge won't start / port in use
```bash
# Kill existing bridge process
taskkill /F /IM node.exe
# Restart
node dist/index.js
```

### Plugin not showing in Logi Options+
- Restart Logi Options+ (system tray -> right-click -> Quit, then reopen)
- Rebuild: `cd KiroCanPlugin/src && dotnet build -c Release`
- Check `.link` file exists: `%LOCALAPPDATA%\Logi\LogiPluginService\Plugins\KiroCanPlugin.link`

### Ghost animation not working
- Check Kiro hooks are in `.kiro/hooks/` of your current project
- Bridge must be running for animation to trigger

### Bridge started from Kiro terminal dies when switching windows
- Use a **separate** PowerShell/Terminal window, not Kiro's integrated terminal
- Kiro's terminal may kill background processes on focus change

## Updating

```bash
git pull
cd bridge && npm install && npx tsc
cd ../KiroCanPlugin/src && dotnet build -c Release
```

Restart bridge and Logi Options+.
