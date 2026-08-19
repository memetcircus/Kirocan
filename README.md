# KiroCan

<p align="center">
  <img src="assets/kiro_animation.gif" alt="KiroCan Ghost Animation" width="600" />
</p>

## Overview
KiroCan is a physical AI coding companion that connects the Logitech MX Creative Console hardware to Kiro IDE on Windows. Press LCD buttons to send prompts, see animated ghost feedback while Kiro processes requests, and capture screenshots directly into chat.

## Architecture
```
MX Creative Console -> C# Plugin (Logi Actions SDK, .NET 10)
                          | HTTP on localhost:9848
                       Bridge (Node.js + koffi Win32 FFI)
                          | Win32 SendInput / Window management
                       Kiro IDE
```

The bridge runs as a local Node.js process that translates button presses into Win32 keyboard simulation targeting Kiro IDE. The plugin communicates with the bridge over HTTP on localhost.

## Features
- **Ghost Animation** - 30-frame animated Kiro ghost across 9 LCD buttons while Kiro is working
- **Context Health** - Visual indicator showing context window usage (normal/worried/critical)
- **Screenshot to Chat** - One button to capture screen region and paste into Kiro
- **Screen Record to Chat** - Capture frame sequences for visual analysis
- **Paste To Kiro** - Select text in any app, press button to queue it; auto-pastes when you return to Kiro
- **Stop/Cancel** - Physical button to immediately cancel Kiro generation
- **9 Prompt Commands** - Explain, Criticize, Document, Fix Bug, Optimize, Refactor, Review, Simplify, Write Tests
- **6 Snippet Buttons** - Append qualifiers to chat without sending
- **Utility Controls** - New Session, Ask Kiro (code to chat), Terminal to Chat, Git Commit, Start Spec, Understand Workspace

## Quick Start

### Prerequisites
- Windows 10/11
- [Logitech MX Creative Console](https://www.logitech.com/products/keyboards/mx-creative-console.html)
- [Logi Options+](https://www.logitech.com/software/logi-options-plus.html) installed
- [Kiro IDE](https://kiro.dev)
- [Node.js 22+](https://nodejs.org/) (LTS)
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)

### Install from source (recommended)

```bash
git clone https://github.com/memetcircus/Kirocan.git
cd Kirocan

# Build plugin (registers with Logi Options+)
cd KiroCanPlugin/src
dotnet build -c Release

# Install bridge dependencies
cd ../../bridge
npm install

# Start bridge (keep this terminal open)
node dist/index.js
```

Then open Logi Options+ and assign KiroCan buttons to your MX Creative Console.

### Install from .lplug4 (if available)

1. Download `KiroCan.lplug4` from [Releases](https://github.com/memetcircus/Kirocan/releases)
2. Double-click to install
3. Start the bridge: `cd bridge && node dist/index.js`
4. Assign buttons in Logi Options+

## Setup Instructions

See [SETUP.md](./SETUP.md) for detailed instructions including:
- Logi Options+ button assignment
- Kiro hooks configuration
- Paste To Kiro multi-action button setup
- Troubleshooting common issues

## LCD Button Layout
### Page 1 - Snippets & Controls (animated)
```
+----------+----------+----------+
|Screenshot| Be Honest|Don't Code|
+----------+----------+----------+
|Show Opts |Explain Y |   Stop   |
+----------+----------+----------+
|Keep Short| No Tests |   Go!    |
+----------+----------+----------+
```

### Page 2 - Utility Controls
```
+----------+----------+----------+
|New Session|Struct Pr| Ask Kiro |
+----------+----------+----------+
|Terminal  |Screen Rec|Paste Kiro|
+----------+----------+----------+
|Workspace |Start Spec|Git Commit|
+----------+----------+----------+
```

### Page 3 - Prompt Commands (animated)
```
+----------+----------+----------+
|Criticize | Refactor |Wrt Tests |
+----------+----------+----------+
| Explain  | Fix Bug  | Optimize |
+----------+----------+----------+
|  Review  | Document | Simplify |
+----------+----------+----------+
```

## Ghost Animation

The 9 LCD buttons form a unified 360x360px virtual canvas. Each button displays a 120x120px tile - when combined, they show a single animated ghost walking across the grid.

### Context Health Variants

| Health Level | Context Usage | Sprite Set | Visual |
|---|---|---|---|
| Normal | 0-59% | ghost-walk/ | Standard ghost |
| Worried | 60-74% | ghost-walk-worried/ | Worried expression |
| Critical | 75%+ | ghost-walk-fire/ | Flaming hair |

### Sprite Generation

```bash
npm install
npm run build:sprites
```

Source: `assets/normal.png`, `assets/worried.png`, `assets/onfire.png` (2048x2048 RGBA)
Output: `assets/sprites/tiles/{ghost-walk,ghost-walk-worried,ghost-walk-fire}/frame-XX-tile-Y.png`

## Development

### Bridge (hot reload)

```bash
cd bridge
npm install
npm run dev
```

Or with auto-reload: `bridge\dev-watch.cmd`

### Plugin

```bash
cd KiroCanPlugin/src
dotnet build
```

Build creates a `.link` file so Logi Plugin Service loads from build output.

## Testing

### Bridge Tests
```bash
cd bridge
npm test
```

### Plugin Tests
```bash
cd plugin/tests
dotnet test
```

## How Kiro Was Used

This project was built entirely within Kiro IDE using its spec-driven development workflow:

1. **Spec Creation** - Requirements, design, and tasks generated through Kiro's spec workflow
2. **Requirements** - 22 formal requirements in EARS pattern with detailed acceptance criteria
3. **Technical Design** - Full architecture with Mermaid diagrams, component interfaces, and 11 correctness properties
4. **Implementation Tasks** - 18 top-level tasks with 40+ sub-tasks executed sequentially via Kiro
5. **Property-Based Testing** - Correctness properties formalized in design doc, implemented as fast-check/FsCheck tests
6. **Kiro Hooks** - The project uses Kiro hooks for its own state detection (the product IS a Kiro companion)
7. **Incremental Development** - Every task committed individually showing the full Kiro-driven development process

## Project Structure
```
KiroCan/
+-- .kiro/                      # Kiro specs, hooks, steering
|   +-- specs/kirocan/          # Requirements, design, tasks
|   +-- hooks/                  # Working/idle state detection hooks
+-- KiroCanPlugin/              # C# Logi plugin (.NET 10)
|   +-- src/
|   |   +-- KiroCanPlugin.cs    # Plugin entry point + bridge lifecycle
|   |   +-- Actions/            # Button action handlers
|   |   +-- Helpers/            # Bridge client, health monitor
|   +-- bin/                    # Build output
+-- bridge/                     # Node.js/TypeScript bridge
|   +-- src/
|   |   +-- index.ts            # Entry point (port 9848)
|   |   +-- http-server.ts      # Express HTTP endpoints
|   |   +-- state-machine.ts    # Working/idle state + suppression
|   |   +-- health-monitor.ts   # Context health from session files
|   |   +-- clipboard-basket.ts # Paste To Kiro queue
|   |   +-- window-manager.ts   # Win32 window activation (koffi)
|   |   +-- keyboard-simulator.ts  # Win32 SendInput (koffi)
|   |   +-- shortcut-executor.ts   # High-level action orchestrator
|   +-- paste-to-kiro.bat       # Helper for multi-action setup
|   +-- dev-watch.cmd           # Auto rebuild + restart
|   +-- package.json
+-- assets/                     # Ghost sprite source + generated tiles
+-- scripts/                    # Build scripts
+-- README.md
+-- SETUP.md
+-- LICENSE
```

## Third-Party Libraries

### Bridge (Node.js)
| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| express | 4.21.2 | HTTP server | MIT |
| koffi | 2.16.3 | Win32 FFI bindings (SendInput, window management) | MIT |
| vitest | 3.1.3 | Test runner (dev only) | MIT |
| fast-check | 3.23.2 | Property-based testing (dev only) | MIT |
| supertest | 7.1.0 | HTTP testing (dev only) | MIT |
| typescript | 5.8.3 | TypeScript compiler (dev only) | Apache-2.0 |

### Plugin (C#)
| Library | Purpose | License |
|---------|---------|---------|
| PluginApi.dll | Logi Actions SDK | Logitech proprietary |
| xUnit | Test framework | Apache-2.0 |
| FsCheck.Xunit | Property-based testing | BSD-3-Clause |

## API Costs & Rate Limits
- **No API costs** - all communication is local (HTTP on localhost:9848)
- **No rate limits** - the bridge processes requests sequentially
- **No external services** - fully offline, no internet required

## License
MIT License. See [LICENSE](./LICENSE) for details.
