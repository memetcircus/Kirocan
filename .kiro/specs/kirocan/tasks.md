# Implementation Plan: KiroCan

## Overview

KiroCan connects a Logitech MX Creative Console to Kiro IDE on Windows through two cooperating services: a C# Plugin (.NET 10) running inside Logi Plugin Service, and a Node.js/TypeScript Bridge HTTP server on port 9848. Implementation proceeds bottom-up — foundational modules first (state machine, keyboard simulator, window manager), then composition layers (shortcut executor, HTTP server, animation engine), and finally integration wiring and hook configuration.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - [x] 1.1 Initialize the Bridge Node.js/TypeScript project
    - Create `bridge/package.json` with dependencies: express, koffi (Win32 FFI), node-clipboard (or equivalent)
    - Create `bridge/tsconfig.json` targeting ES2022 with strict mode
    - Add dev dependencies: vitest, fast-check, supertest, @types/express
    - Create `bridge/src/index.ts` entry point (placeholder)
    - _Requirements: 18.1_

  - [x] 1.2 Initialize the C# Plugin project
    - Create `plugin/KiroCan.csproj` targeting .NET 10 with reference to `PluginApi.dll` from `C:\Program Files\Logi\LogiPluginService\`
    - Create `plugin/src/KiroCanPlugin.cs` with the Plugin base class and Load/Unload methods
    - Add test project `plugin/tests/KiroCan.Tests.csproj` with xUnit and FsCheck.Xunit packages
    - _Requirements: 19.4, 19.5_

  - [x] 1.3 Define shared TypeScript interfaces and types
    - Create `bridge/src/types.ts` with `HealthResponse`, `BridgeInternalState`, `PromptRequest`, `ScreenRecordRequest`, `SuccessResponse`, `ErrorResponse`, `ActionResult` interfaces
    - Define `VirtualKey` type and key constants
    - _Requirements: 18.2, 18.3, 22.1_

  - [x] 1.4 Define shared C# enums and models
    - Create `plugin/src/Models/BridgeState.cs` with `BridgeState` enum (Idle, Working)
    - Create `plugin/src/Models/HealthLevel.cs` with `HealthLevel` enum (Normal, Worried, Critical)
    - Create `plugin/src/Models/RotationDirection.cs` with `RotationDirection` enum (Undefined, Clockwise, CounterClockwise)
    - Create `plugin/src/Models/HealthResponse.cs` DTO class
    - Create `plugin/src/Models/PluginState.cs` with all plugin state fields
    - _Requirements: 22.1, 22.2_

- [ ] 2. Implement Bridge state machine
  - [~] 2.1 Implement the state machine module
    - Create `bridge/src/state-machine.ts` implementing `StateMachine` interface
    - Implement `getState()`, `setState()`, `enterSuppressionWindow()`, `isInSuppressionWindow()`
    - Implement 2-second suppression window with timestamp-based expiry
    - Implement 2-minute working state timeout that auto-transitions to idle
    - _Requirements: 17.3, 17.4, 17.5, 17.6, 6.3, 6.4_

  - [ ]* 2.2 Write property test for state machine transitions (Property 6)
    - **Property 6: State Machine Transitions with Suppression**
    - Generate sequences of {event, timestamp} pairs, verify state updates correctly when not suppressed and remains unchanged when suppressed
    - **Validates: Requirements 17.3, 17.4, 17.6**

- [ ] 3. Implement Bridge window manager
  - [~] 3.1 Implement Win32 window enumeration and activation
    - Create `bridge/src/window-manager.ts` using koffi for Win32 FFI bindings
    - Implement `FindWindowExW`, `EnumWindows`, `GetWindowThreadProcessId`, `SetForegroundWindow`, `ShowWindow`, `GetForegroundWindow`, `IsIconic`
    - Implement `findKiroWindow()` to locate Kiro.exe process window
    - Implement `activateWindow()` with restore-from-minimized and foreground confirmation
    - Implement `waitForForeground()` with 2-second timeout
    - Handle multiple Kiro windows by targeting most recently active
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

- [ ] 4. Implement Bridge keyboard simulator
  - [~] 4.1 Implement Win32 SendInput keyboard simulation
    - Create `bridge/src/keyboard-simulator.ts` using koffi for Win32 SendInput
    - Implement `sendKeyCombo()` for modifier+key combinations (Ctrl+C, Ctrl+Shift+S, etc.)
    - Implement `typeText()` for typing arbitrary strings character-by-character
    - Implement `sendKey()` for single key events (Enter, Delete)
    - Support VK constants for all required keys
    - Only dispatch key events after Kiro window is confirmed foreground
    - _Requirements: 21.5_

- [ ] 5. Implement Bridge shortcut executor
  - [~] 5.1 Implement the shortcut executor orchestrator
    - Create `bridge/src/shortcut-executor.ts` combining window manager + keyboard simulator
    - Implement `executeCancel()`: activate window → Ctrl+C
    - Implement `executePrompt(text)`: activate window → type text → Enter
    - Implement `executeAsk(text)`: activate window → Ctrl+C (copy selection) → wait 100ms → read clipboard → activate Kiro → paste → Enter
    - Implement `executeInlineChat()`: activate window → Ctrl+I
    - Implement `executeTerminalToChat()`: activate window → Ctrl+Shift+R
    - Implement `executeNewSession()`: activate window → Ctrl+L → wait → Ctrl+T
    - Implement `executeSessionNext()`: activate window → Ctrl+Alt+Right
    - Implement `executeSessionPrevious()`: activate window → Ctrl+Alt+Left
    - Each method returns `ActionResult` with success/error
    - _Requirements: 6.2, 5.2, 5.3, 5.4, 9.2, 10.2, 8.2, 7.3, 7.4_

  - [~] 5.2 Implement screenshot executor
    - Implement `executeScreenshot()`: invoke Win+Shift+S → poll clipboard every 250ms for 30s → if image found, activate Kiro and paste
    - Handle 30-second timeout as cancellation
    - Handle Kiro window unavailable after capture
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [~] 5.3 Implement screen recording executor
    - Implement `executeScreenRecord(mode)`: quick mode = 5 frames at 500ms intervals, long mode = 10 frames at 800ms intervals
    - Resize frames to 1280px width maintaining aspect ratio, encode JPEG at 80% quality
    - Skip failed frame captures, continue with remaining
    - Activate Kiro and paste all frames after capture completes
    - Handle all-frames-failed and Kiro-unavailable error cases
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

- [ ] 6. Implement Bridge health monitor
  - [~] 6.1 Implement session file reader and health calculation
    - Create `bridge/src/health-monitor.ts`
    - Read session files from `%APPDATA%/Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/`
    - Calculate contextPercentage as ratio of current token usage to maximum capacity from most recent session file
    - Determine healthLevel: 0-59% = normal, 60-74% = worried, 75%+ = critical
    - Poll every 5 seconds via interval timer
    - Default to normal/0% if files missing or unreadable
    - Implement `resetContext()` for new session events
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9_

  - [ ]* 6.2 Write property test for health level determination (Property 1)
    - **Property 1: Health Level Determination**
    - Generate integers 0-100, verify threshold classification matches requirements
    - **Validates: Requirements 2.2, 2.3, 2.4**

- [~] 7. Checkpoint - Ensure all Bridge core modules pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Bridge HTTP server
  - [~] 8.1 Implement the Express HTTP server with all endpoints
    - Create `bridge/src/http-server.ts` with Express app
    - Implement `GET /health` returning `HealthResponse` JSON
    - Implement `POST /cancel` calling shortcut executor cancel + entering suppression window
    - Implement `POST /ask` with body validation (1-4096 chars), executing ask flow
    - Implement `POST /prompt` with body validation (1-4096 chars), executing prompt flow
    - Implement `POST /inline` executing inline chat
    - Implement `POST /terminal` executing terminal-to-chat
    - Implement `POST /new-session` executing new session + resetting context
    - Implement `POST /session/next` and `POST /session/previous` executing session navigation
    - Implement `POST /screenshot` executing screenshot flow
    - Implement `POST /screen-record` with mode body, executing screen record flow
    - Implement `POST /hook/working` and `POST /hook/idle` updating state machine (respecting suppression)
    - Return 503 when Kiro window unavailable, 400 for invalid body, 200 with success boolean otherwise
    - Listen on localhost:9848
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

  - [ ]* 8.2 Write property test for prompt body length validation (Property 10)
    - **Property 10: Prompt Body Length Validation**
    - Generate strings of varying lengths (0, 1-4096, >4096), verify accept/reject behavior
    - **Validates: Requirements 18.7**

  - [ ]* 8.3 Write property test for health response serialization round-trip (Property 3)
    - **Property 3: Health Response Serialization Round-Trip**
    - Generate valid HealthResponse objects with constrained fields, verify JSON round-trip preserves all values
    - **Validates: Requirements 22.1, 22.2, 22.3**

  - [ ]* 8.4 Write property test for invalid health response defaults (Property 4)
    - **Property 4: Invalid Health Response Defaults to Safe Values**
    - Generate malformed JSON strings, objects with missing fields, out-of-range contextPercentage values
    - Verify parser returns idle/normal/0 defaults
    - **Validates: Requirements 22.4, 22.5**

- [ ] 9. Wire Bridge entry point
  - [~] 9.1 Compose all Bridge modules in index.ts
    - Wire state machine, health monitor, window manager, keyboard simulator, shortcut executor, and HTTP server together in `bridge/src/index.ts`
    - Start health monitor polling on startup
    - Start HTTP server on port 9848
    - Handle graceful shutdown (SIGTERM/SIGINT)
    - _Requirements: 18.1_

- [ ] 10. Implement Plugin application and health polling
  - [~] 10.1 Implement KiroCanApplication with Bridge polling
    - Create `plugin/src/KiroCanApplication.cs` inheriting `ClientApplication`
    - Implement 500ms poll timer calling GET /health with 2000ms HTTP timeout
    - Parse HealthResponse JSON, update shared state (CurrentState, CurrentHealthLevel, ContextPercentage)
    - Track consecutive failures: 2 failures → disconnected state
    - Emit OnStateChanged and OnDisconnected events
    - Reset failure counter on successful poll
    - _Requirements: 1.4, 1.5, 19.1, 19.2, 19.3, 22.2, 22.4, 22.5_

  - [ ]* 10.2 Write property test for bridge connectivity state (Property 11)
    - **Property 11: Bridge Connectivity State**
    - Generate boolean sequences (success/failure poll results), verify disconnected state triggers after exactly 2 consecutive failures and resets on any success
    - **Validates: Requirements 19.2, 19.3**

- [ ] 11. Implement Plugin animation engine
  - [~] 11.1 Implement the AnimationEngine class
    - Create `plugin/src/Animation/AnimationEngine.cs`
    - Load 30-frame normal ghost sprites and 30-frame critical (flaming hair) sprites from embedded resources
    - Implement frame timer: 100ms normal, 67ms worried, 50ms critical
    - Implement `Start(healthLevel)`, `Stop()`, `UpdateHealthLevel(newLevel)`
    - Implement `GetTile(position)` extracting 72x72 tile from 216x216 canvas using row/col calculation
    - Use `BitmapImage.FromArray(byte[])` for tile creation
    - Emit OnFrameChanged event for UI updates
    - _Requirements: 1.1, 1.2, 1.3, 1.6, 2.5, 2.6, 2.7, 2.10_

  - [ ]* 11.2 Write property test for animation speed mapping (Property 2)
    - **Property 2: Animation Speed Mapping**
    - Generate HealthLevel enum values, verify duration is 100ms for normal, 67ms for worried, 50ms for critical
    - **Validates: Requirements 2.5, 2.6, 2.7**

  - [ ]* 11.3 Write property test for frame cycling invariant (Property 7)
    - **Property 7: Frame Cycling Invariant**
    - Generate frame indices 0-29, verify advance produces (index + 1) % 30
    - **Validates: Requirements 1.3**

  - [ ]* 11.4 Write property test for tile extraction dimensions (Property 8)
    - **Property 8: Tile Extraction Dimensions**
    - Generate random 216x216 byte arrays and positions 0-8, verify extracted tile is exactly 72x72 pixels at correct row/col
    - **Validates: Requirements 1.6**

- [ ] 12. Implement Plugin page layout and button commands
  - [~] 12.1 Implement Page Manager and button layout
    - Create `plugin/src/PageLayout.cs` with static arrays defining Page 1, Page 2, Page 3 button assignments
    - Page 1: Screenshot, BeHonest, DontCodeYet, ShowOptions, ExplainWhy, Stop, KeepShort, NoTests, Go
    - Page 2: NewSession, StructPrompt, InlineChat, TerminalToChat, ScreenRecord, AskKiro, UnderstandWorkspace, StartSpec, GitCommit
    - Page 3: Criticize, Refactor, WriteTests, Explain, FixBug, Optimize, Review, Document, Simplify
    - _Requirements: 20.1, 20.2, 20.3_

  - [~] 12.2 Implement Prompt Command actions (Page 3)
    - Create `plugin/src/Actions/Prompts/` with command classes for each of the 9 prompts
    - Each command sends POST /prompt with the command name text
    - Start Ghost_Animation on button press, stop when state returns to idle
    - Ignore button press if bridge state is already "working"
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

  - [~] 12.3 Implement Snippet actions (Page 1)
    - Create `plugin/src/Actions/Snippets/` with command classes for each snippet
    - Snippets: "Be Honest", "Don't Code Yet", "Show Options", "Explain Why", "Keep Short", "No Tests"
    - Implement "Go!" button sending Enter without typing
    - Each snippet appends text to chat input without submitting
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [~] 12.4 Implement Utility Control actions (Page 2)
    - Implement Screenshot button → POST /screenshot
    - Implement Stop button → POST /cancel with 1-second debounce
    - Implement New Session button → POST /new-session
    - Implement Struct Prompt button → POST /prompt with struct-prompt flow
    - Implement Inline Chat button → POST /inline
    - Implement Terminal to Chat button → POST /terminal
    - Implement Screen Record button → POST /screen-record
    - Implement Ask Kiro button → POST /ask
    - Implement Understand Workspace button → POST /prompt with workspace analysis text
    - Implement Start Spec button → POST /prompt with spec workflow text
    - Implement Git Commit button → POST /prompt with git commit text
    - _Requirements: 3.1, 6.1, 6.6, 8.1, 13.1, 9.1, 10.1, 4.1, 5.1, 16.1, 14.1, 15.1_

- [ ] 13. Implement Plugin dial navigation
  - [~] 13.1 Implement SessionNavigateAdjustment for dial rotation
    - Create `plugin/src/Actions/SessionNavigateAdjustment.cs` inheriting `PluginDynamicAdjustment`
    - Implement rotation accumulator with NotchThreshold of 18
    - Reset accumulator on direction reversal
    - Send POST /session/next on clockwise threshold, POST /session/previous on counter-clockwise threshold
    - Initialize accumulator to 0 and direction to Undefined
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7_

  - [ ]* 13.2 Write property test for dial rotation threshold (Property 5)
    - **Property 5: Dial Rotation Threshold Trigger**
    - Generate tick sequences (direction + magnitude), verify switch fires at exactly threshold and accumulator resets, verify direction reversal resets accumulator
    - **Validates: Requirements 7.1, 7.2, 7.5, 7.6**

- [ ] 14. Implement Plugin button debounce and animation integration
  - [~] 14.1 Implement button debounce for Stop button
    - Create `plugin/src/ButtonDebounce.cs` with 1-second window filtering
    - Integrate with Stop button command to discard rapid repeat presses
    - _Requirements: 6.6_

  - [ ]* 14.2 Write property test for button debounce (Property 9)
    - **Property 9: Button Debounce**
    - Generate monotonically increasing timestamp sequences, verify exactly one press passes per 1-second window
    - **Validates: Requirements 6.6**

  - [~] 14.3 Implement animation rendering integration
    - Wire AnimationEngine to page display: start animation on "working" state for Page 1 and Page 3 buttons
    - Do NOT animate Page 2 buttons regardless of state
    - Stop animation and restore static icons on "idle" transition
    - Handle health level changes updating animation speed/sprite within 1 second
    - Handle disconnected state showing disconnect indicator on all 9 buttons
    - _Requirements: 1.1, 1.2, 20.4, 20.5, 20.6, 2.10, 19.2_

- [~] 15. Checkpoint - Ensure all Plugin tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Create Kiro hook configuration files
  - [~] 16.1 Create hook files for state detection
    - Create `.kiro/hooks/kirocan-working.json` with UserPromptSubmit trigger → POST http://localhost:9848/hook/working
    - Create `.kiro/hooks/kirocan-idle.json` with Stop trigger → POST http://localhost:9848/hook/idle
    - Use curl command with -s flag and 2-second timeout
    - _Requirements: 17.1, 17.2, 17.7_

- [ ] 17. Integration testing and final wiring
  - [ ]* 17.1 Write integration tests for Bridge HTTP endpoints
    - Test all routes with Supertest: GET /health, POST /cancel, /ask, /prompt, /inline, /terminal, /new-session, /session/next, /session/previous, /screenshot, /screen-record, /hook/working, /hook/idle
    - Verify correct HTTP status codes (200, 400, 503)
    - Verify JSON response structure
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

  - [ ]* 17.2 Write integration tests for state machine hook flow
    - Test /hook/working → state becomes "working" in /health response
    - Test /hook/idle → state becomes "idle" in /health response
    - Test suppression window blocks state changes
    - Test 2-minute working timeout
    - _Requirements: 17.3, 17.4, 17.5, 17.6_

  - [~] 17.3 Create Bridge startup script and build configuration
    - Add `bridge/package.json` scripts: "build", "start", "test" (vitest --run)
    - Ensure `npm run build` compiles TypeScript successfully
    - Ensure `npm test` runs all unit and property tests
    - _Requirements: 18.1_

  - [~] 17.4 Create Plugin build configuration
    - Ensure `dotnet build` compiles the plugin project successfully
    - Ensure `dotnet test` runs all xUnit and FsCheck property tests
    - Verify PluginApi.dll reference resolves correctly
    - _Requirements: 19.4_

- [~] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- The Bridge must be running before the Plugin can function (Bridge is a dependency)
- Win32 FFI operations (window manager, keyboard simulator) require Windows OS for integration testing
- Animation assets (ghost sprites, fire ghost sprites, button icons) must be created/sourced separately and placed in `assets/`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "3.1", "6.1"] },
    { "id": 3, "tasks": ["2.2", "4.1", "6.2"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4", "9.1"] },
    { "id": 8, "tasks": ["10.1", "11.1", "12.1"] },
    { "id": 9, "tasks": ["10.2", "11.2", "11.3", "11.4", "12.2", "12.3", "12.4"] },
    { "id": 10, "tasks": ["13.1", "14.1"] },
    { "id": 11, "tasks": ["13.2", "14.2", "14.3"] },
    { "id": 12, "tasks": ["16.1"] },
    { "id": 13, "tasks": ["17.1", "17.2", "17.3", "17.4"] }
  ]
}
```
