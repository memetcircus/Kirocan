# KiroCan

## Overview
KiroCan is a physical AI coding companion that connects the Logitech MX Creative Console hardware to Kiro IDE on Windows. Press LCD buttons to send prompts, see animated ghost feedback while Kiro processes requests, rotate a dial to navigate sessions, and capture screenshots directly into chat.

## Architecture
```
MX Creative Console → C# Plugin (Logi Actions SDK, .NET 10) → HTTP → Bridge Service (Node.js/TypeScript) → Kiro IDE (Win32 keyboard simulation)
```

## Features
- 🎬 **Ghost Animation** — 30-frame animated Kiro ghost across 9 LCD buttons while Kiro is working
- 📊 **Context Health** — Visual indicator showing context window usage (normal/worried/critical)
- 📸 **Screenshot → Chat** — One button to capture screen region and paste into Kiro
- 🎥 **Screen Record → Chat** — Capture frame sequences for visual analysis
- 🔍 **Ask Kiro** — Select text in any app, press button to ask Kiro about it
- ⏹️ **Stop/Cancel** — Physical button to immediately cancel Kiro generation
- 🔄 **Session Navigate** — Dial rotation to switch between Kiro sessions
- 💬 **9 Prompt Commands** — Explain, Criticize, Document, Fix Bug, Optimize, Refactor, Review, Simplify, Write Tests
- ✏️ **6 Snippet Buttons** — Append qualifiers to chat without sending
- 🚀 **Utility Controls** — New Session, Inline Chat, Terminal→Chat, Git Commit, Start Spec, Understand Workspace

## LCD Button Layout
### Page 1 — Snippets & Controls (animated)
| Screenshot | Be Honest | Don't Code Yet |
|---|---|---|
| Show Options | Explain Why | Stop |
| Keep Short | No Tests | Go! |

### Page 2 — Utility Controls (no animation)
| New Session | Struct Prompt | Inline Chat |
|---|---|---|
| Terminal→Chat | Screen Record | Ask Kiro |
| Workspace | Start Spec | Git Commit |

### Page 3 — Prompt Commands (animated)
| Criticize | Refactor | Write Tests |
|---|---|---|
| Explain | Fix Bug | Optimize |
| Review | Document | Simplify |

## Ghost Animation — How It Works

The 9 LCD buttons on the MX Creative Console form a unified **360×360px virtual canvas**. Each button displays a **120×120px tile** — when combined, they show a single animated ghost walking across the grid.

### Canvas-to-Button Mapping

```
┌──────────────┬──────────────┬──────────────┐
│   Tile 0     │   Tile 1     │   Tile 2     │  ← Row 0
│  (120×120)   │  (120×120)   │  (120×120)   │
├──────────────┼──────────────┼──────────────┤
│   Tile 3     │   Tile 4     │   Tile 5     │  ← Row 1
│  (120×120)   │  (120×120)   │  (120×120)   │
├──────────────┼──────────────┼──────────────┤
│   Tile 6     │   Tile 7     │   Tile 8     │  ← Row 2
│  (120×120)   │  (120×120)   │  (120×120)   │
└──────────────┴──────────────┴──────────────┘
         = 360×360px unified canvas
```

### Tile-to-Button Assignment (Page 1)

| Tile | Position | Button Function |
|------|----------|-----------------|
| 0 | Top-Left | Screenshot |
| 1 | Top-Center | Be Honest |
| 2 | Top-Right | Don't Code Yet |
| 3 | Middle-Left | Show Options |
| 4 | Middle-Center | Explain Why |
| 5 | Middle-Right | Stop |
| 6 | Bottom-Left | Keep Short |
| 7 | Bottom-Center | No Tests |
| 8 | Bottom-Right | Go! |

### Animation Cycle

1. Kiro starts working → Bridge sets state to "working" via hook
2. Plugin polls `/health` every 500ms, detects "working" state
3. AnimationEngine starts: loops through 30 frames at 10fps (100ms/frame)
4. Each frame: ghost sprite (270×270px) is composited onto the 360×360 purple canvas at a calculated (x, y) position
5. The canvas is split into 9 tiles of 120×120px
6. Each tile is sent to the corresponding LCD button via `BitmapImage.FromArray(byte[])`
7. All 9 buttons update simultaneously → appears as one large animation
8. Kiro finishes → state becomes "idle" → animation stops, static icons restored

### Walk Pattern (30 frames)

- **Frames 0–14**: Ghost walks left → right (normal orientation)
- **Frames 15–29**: Ghost walks right → left (horizontally mirrored)
- **Vertical bob**: `sin(progress × 2π) × 6px` — gentle floating motion
- **Background**: Solid `#9145fd` purple (matches icon backgrounds for seamless edges)

### Context Health Variants

| Health Level | Context Usage | Sprite Set | Animation Speed |
|---|---|---|---|
| Normal | 0–59% | `ghost-walk/` | 10fps (100ms/frame) |
| Worried | 60–74% | `ghost-walk-worried/` | 15fps (67ms/frame) |
| Critical | 75%+ | `ghost-walk-fire/` (flaming hair) | 20fps (50ms/frame) |

### Sprite Generation

Run `npm run build:sprites` to regenerate all animation tiles from the source PNGs:

```bash
npm install   # installs Jimp
npm run build:sprites   # generates 810 tile PNGs (3 variants × 30 frames × 9 tiles)
```

Source files: `assets/normal.png`, `assets/worried.png`, `assets/onfire.png` (2048×2048 RGBA)
Output: `assets/sprites/tiles/{ghost-walk,ghost-walk-worried,ghost-walk-fire}/frame-XX-tile-Y.png`

## Prerequisites
- Windows 10/11
- [Logitech MX Creative Console](https://www.logitech.com/products/keyboards/mx-creative-console.html)
- [Logi Plugin Service](https://www.logitech.com/software/logi-options-plus.html) installed
- [Node.js 22+](https://nodejs.org/) (LTS)
- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)
- [Kiro IDE](https://kiro.dev)

## Setup Instructions

### Bridge Service
```bash
cd bridge
npm install
npm run build
npm start
```
The bridge listens on `http://127.0.0.1:9848`.

### C# Plugin
```bash
cd plugin
dotnet build
```
Copy the built DLL to your Logi Plugin Service plugins directory.

### Kiro Hooks
The `.kiro/hooks/` directory contains hook files that automatically signal the bridge when Kiro starts/stops working. These are included in the repository and active when the project is open in Kiro.

## Testing
### Bridge Tests
```bash
cd bridge
npm test
```
Runs unit tests and property-based tests using Vitest + fast-check.

### Plugin Tests
```bash
cd plugin/tests
dotnet test
```
Runs xUnit tests with FsCheck property-based testing.

## How Kiro Was Used
This project was built entirely within Kiro IDE using its spec-driven development workflow:

1. **Spec Creation** — Requirements, design, and tasks were generated through Kiro's spec workflow (see `.kiro/specs/kirocan/`)
2. **Requirements** — 22 formal requirements in EARS pattern with detailed acceptance criteria
3. **Technical Design** — Full architecture with Mermaid diagrams, component interfaces, and 11 correctness properties
4. **Implementation Tasks** — 18 top-level tasks with 40+ sub-tasks executed sequentially via Kiro
5. **Property-Based Testing** — Correctness properties formalized in the design doc, implemented as fast-check/FsCheck tests
6. **Kiro Hooks** — The project uses Kiro hooks for its own state detection (the product IS a Kiro companion)
7. **Incremental Development** — Every task was committed individually showing the full Kiro-driven development process

## Project Structure
```
KiroCan/
├── .kiro/                      # Kiro specs, hooks, steering
│   ├── specs/kirocan/          # Requirements, design, tasks
│   └── hooks/                  # Working/idle state detection hooks
├── plugin/                     # C# Logi plugin (.NET 10)
│   ├── src/
│   │   ├── KiroCanPlugin.cs    # Plugin entry point
│   │   ├── KiroCanApplication.cs  # Bridge polling & state
│   │   ├── PageLayout.cs       # 3-page button layout
│   │   ├── Animation/          # Ghost animation engine
│   │   └── Actions/            # Button action handlers
│   └── tests/                  # xUnit + FsCheck tests
├── bridge/                     # Node.js/TypeScript bridge
│   ├── src/
│   │   ├── index.ts            # Entry point (port 9848)
│   │   ├── http-server.ts      # Express HTTP endpoints
│   │   ├── state-machine.ts    # Working/idle state + suppression
│   │   ├── health-monitor.ts   # Context health from session files
│   │   ├── window-manager.ts   # Win32 window activation
│   │   ├── keyboard-simulator.ts  # Win32 SendInput
│   │   └── shortcut-executor.ts   # High-level action orchestrator
│   └── package.json
├── assets/                     # Ghost sprites (placeholder)
└── README.md
```

## Third-Party Libraries

### Bridge (Node.js)
| Library | Version | Purpose | License |
|---------|---------|---------|---------|
| express | 4.21.2 | HTTP server | MIT |
| koffi | 2.9.3 | Win32 FFI bindings | MIT |
| clipboardy | 4.0.0 | Clipboard access | MIT |
| vitest | 3.1.3 | Test runner | MIT |
| fast-check | 3.23.2 | Property-based testing | MIT |
| supertest | 7.1.0 | HTTP testing | MIT |
| typescript | 5.8.3 | TypeScript compiler | Apache-2.0 |

### Plugin (C#)
| Library | Purpose | License |
|---------|---------|---------|
| PluginApi.dll | Logi Actions SDK | Logitech proprietary |
| xUnit | Test framework | Apache-2.0 |
| FsCheck.Xunit | Property-based testing | BSD-3-Clause |

## API Costs & Rate Limits
- **No API costs** — all communication is local (HTTP on localhost:9848)
- **No rate limits** — the bridge processes requests sequentially
- **No external services** — fully offline, no internet required

## License
All Rights Reserved. See [LICENSE](./LICENSE) for details.
