---
inclusion: auto
---

# KiroCan — Project Context

## What Is This Project

KiroCan is a physical AI coding companion connecting the Logitech MX Creative Console hardware to Kiro IDE on Windows. Built for the "Ready, Spec, Ship" hackathon (Aug 8-23, 2026).

## Architecture

```
MX Creative Console → C# Plugin (Logi Actions SDK, .NET 10) → HTTP (localhost:9848) → Bridge Service (Node.js/TypeScript) → Kiro IDE (Win32 keyboard simulation)
```

Two services:
1. **C# Plugin** (`plugin/`) — runs inside Logi Plugin Service, handles hardware events, renders LCD animations
2. **Node.js Bridge** (`bridge/`) — HTTP server on port 9848, executes Win32 window activation + keyboard simulation

## Current State (Completed)

All 18 tasks + 40 sub-tasks are DONE. The full implementation includes:

### Bridge (TypeScript, `bridge/src/`)
- `types.ts` — shared interfaces (HealthResponse, ActionResult, VK codes)
- `state-machine.ts` — working/idle state with 2s suppression window + 2min timeout
- `window-manager.ts` — Win32 FFI via koffi (EnumWindows, SetForegroundWindow, etc.)
- `keyboard-simulator.ts` — Win32 SendInput for key combos and text typing
- `shortcut-executor.ts` — orchestrator (executeCancel, executePrompt, executeScreenshot, etc.)
- `health-monitor.ts` — reads Kiro session files, calculates context health %
- `http-server.ts` — Express with 15 endpoints (GET /health, POST /cancel, /prompt, /hook/working, etc.)
- `index.ts` — wires everything, listens on 127.0.0.1:9848

### Plugin (C#, `plugin/src/`)
- `KiroCanPlugin.cs` — entry point, static Instance, starts Application
- `KiroCanApplication.cs` — polls Bridge /health every 500ms, tracks connectivity
- `PageLayout.cs` — 3-page button layout (Page1=snippets, Page2=utility, Page3=prompts)
- `Animation/AnimationEngine.cs` — 30-frame ghost at 10/15/20fps based on health
- `Animation/AnimationRenderer.cs` — wires engine to LCD buttons based on state
- `Actions/Prompts/PromptCommandAction.cs` — 9 prompt buttons
- `Actions/Snippets/SnippetAction.cs` — 6 snippet + Go button
- `Actions/UtilityAction.cs` — utility buttons (screenshot, stop, new session, etc.)
- `Actions/SessionNavigateAdjustment.cs` — dial rotation with 18-notch threshold
- `Actions/ButtonDebounce.cs` — 1-second debounce for Stop button

### Hooks (`.kiro/hooks/`)
- `kirocan-working.json` — UserPromptSubmit → POST /hook/working
- `kirocan-idle.json` — Stop → POST /hook/idle

### Assets (`assets/`)
- Source PNGs: normal.png, worried.png, onfire.png (2048x2048)
- Generated: 810 tile PNGs in `assets/sprites/tiles/` (3 variants × 30 frames × 9 tiles)
- Generator: `scripts/build-animation-tiles.js` (Jimp-based)

### Tests
- Bridge: Vitest + fast-check (property tests for all 11 correctness properties + integration tests)
- Plugin: xUnit + FsCheck (property tests for animation, dial, debounce, connectivity)

## Key Technical Details

- **Port**: 9848 (localhost only)
- **.NET**: 10, references PluginApi.dll from `C:\Program Files\Logi\LogiPluginService\`
- **Device family**: LogitechCreativeFamily
- **Win32 APIs**: koffi FFI bindings (user32.dll, kernel32.dll, psapi.dll)
- **Animation**: 360x360 canvas split into 9 tiles of 120x120px each
- **Health levels**: normal (0-59%), worried (60-74%), critical (75%+)
- **Suppression window**: 2 seconds after cancel, blocks hook events
- **Working timeout**: 2 minutes auto-idle if no hook fires
- **Dial threshold**: 18 notches before triggering session switch

## Git History (17 commits on main, all pushed)

1. docs: add kiro specs and hackathon rules
2. feat: initialize project structure (bridge + plugin)
3. feat: define shared interfaces and data models
4. feat: implement bridge core modules (state machine, window manager, health monitor)
5. feat: implement Win32 keyboard simulator (SendInput)
6. feat: implement shortcut executor orchestrator
7. feat: add screenshot and screen recording executors
8. feat: implement bridge HTTP server and wire entry point
9. feat: implement plugin core (Application, AnimationEngine, PageLayout)
10. feat: implement plugin button actions, dial navigation, and debounce
11. feat: add Kiro IDE hooks for working/idle state detection
12. docs: add README and project structure placeholders
13. test: add property-based tests for all 11 correctness properties
14. feat: add animation rendering integration coordinator
15. test: add HTTP endpoint and hook flow integration tests
16. docs: mark all tasks complete in spec
17. feat: generate 810 ghost animation tiles with Jimp sprite generator

## What's Next / Remaining Work

- Run bridge tests: `cd bridge && npm install && npm test` — fix any failures
- Run plugin build: `cd plugin && dotnet build` — needs PluginApi.dll present
- Demo video for hackathon submission
- Final polish (error messages, edge cases)

## Development Rules

- Commit after every task (conventional commits: feat:, test:, docs:)
- Push to remote after each commit (judges need full history)
- Never squash commits
- .kiro/ directory MUST be in repo (judges inspect it)
- All materials in English
