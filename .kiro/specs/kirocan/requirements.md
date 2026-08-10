# Requirements Document

## Introduction

KiroCan is a physical AI coding companion that connects the Logitech MX Creative Console hardware to Kiro IDE on Windows. It consists of a C# plugin for Logi Plugin Service (.NET 10) and a Node.js/TypeScript bridge service. Users press LCD buttons to send prompts, see animated feedback while Kiro processes requests, rotate a dial to navigate sessions, and capture screenshots or screen recordings directly into Kiro chat.

## Glossary

- **Plugin**: The C# Logi Actions SDK plugin running inside Logi Plugin Service that renders LCD buttons and handles hardware input
- **Bridge**: The Node.js/TypeScript HTTP server (port 9848) that mediates between the Plugin and Kiro IDE via Win32 keyboard simulation
- **LCD_Button**: One of 9 physical display buttons on the MX Creative Console arranged in a 3x3 grid
- **Dial**: The rotary encoder on the MX Creative Console that detects clockwise and counter-clockwise rotation
- **Ghost_Animation**: A 30-frame animated sprite of the Kiro ghost mascot rendered across all 9 LCD buttons as a single canvas
- **Context_Health**: A percentage representing how full the active Kiro session's context window is, derived from session files
- **Health_Level**: One of three states (normal 0-59%, worried 60-74%, critical 75%+) that determines animation style
- **Kiro_Hook**: A file-based hook mechanism in Kiro IDE that fires HTTP requests on agent events (promptSubmit, agentStop)
- **Session_File**: A JSON file in %APPDATA%/Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/ containing session metadata
- **Notch_Threshold**: The number of dial rotation increments (18) required before triggering a session switch
- **Page**: A group of 9 LCD button assignments that the user can cycle through on the MX Creative Console
- **Snippet**: Text appended to the Kiro chat input without pressing Enter, allowing the user to review before submitting
- **Prompt_Command**: A predefined instruction sent to Kiro and immediately submitted for processing
- **Suppression_Window**: A 2-second period after a cancel event during which stale hook responses are ignored
- **BitmapImage**: The Logi SDK image class instantiated via BitmapImage.FromArray(byte[])

## Requirements

### Requirement 1: Ghost Animation Rendering

**User Story:** As a developer, I want to see an animated Kiro ghost walking across all 9 LCD buttons while Kiro is working, so that I have immediate physical feedback that my request is being processed.

#### Acceptance Criteria

1. WHEN the Bridge reports state "working", THE Plugin SHALL start rendering the Ghost_Animation across all 9 LCD_Buttons as a unified 3x3 tile canvas
2. WHEN the Bridge reports state "idle", THE Plugin SHALL stop the Ghost_Animation and restore the static button icons
3. THE Plugin SHALL render the Ghost_Animation as a loop of 30 frames at 10 frames per second, split into 9 tiles (one per LCD_Button), repeating continuously until the animation is stopped
4. THE Plugin SHALL poll the Bridge /health endpoint every 500 milliseconds to retrieve the current state
5. IF the Bridge /health endpoint does not respond within 2000 milliseconds, THEN THE Plugin SHALL treat it as unreachable, display static button icons, and retry on the next poll interval
6. THE Plugin SHALL use BitmapImage.FromArray(byte[]) to create tile images of 72x72 pixels for each LCD_Button

### Requirement 2: Context Health Indicator

**User Story:** As a developer, I want to see the ghost animation change appearance based on how full my Kiro context window is, so that I know when to start a new session before running out of context.

#### Acceptance Criteria

1. THE Bridge SHALL read Session_Files from %APPDATA%/Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/ every 5 seconds and calculate Context_Health as the ratio of current token usage to maximum token capacity found in the most recent session file
2. IF Context_Health is between 0% and 59%, THEN THE Bridge SHALL report Health_Level as "normal"
3. IF Context_Health is between 60% and 74%, THEN THE Bridge SHALL report Health_Level as "worried"
4. IF Context_Health is 75% or above, THEN THE Bridge SHALL report Health_Level as "critical"
5. WHILE Health_Level is "normal", THE Plugin SHALL display the standard Ghost_Animation at 1x speed (base frame duration)
6. WHILE Health_Level is "worried", THE Plugin SHALL display the Ghost_Animation at 1.5x speed (base frame duration multiplied by 1.5)
7. WHILE Health_Level is "critical", THE Plugin SHALL display an alternate ghost sprite with flaming hair at 2x speed (base frame duration multiplied by 2)
8. THE Bridge SHALL include the current Health_Level and context usage percentage in the /health endpoint response
9. IF Session_Files are missing or unreadable, THEN THE Bridge SHALL report Health_Level as "normal" and context usage percentage as 0%
10. WHEN Health_Level changes, THE Plugin SHALL transition to the corresponding Ghost_Animation within 1 second

### Requirement 3: Screenshot Capture to Chat

**User Story:** As a developer, I want to press a single button to capture a screen region and have it appear in my Kiro chat, so that I can quickly share visual context without manual copy-paste steps.

#### Acceptance Criteria

1. WHEN the user presses the Screenshot LCD_Button, THE Bridge SHALL invoke the Windows screen snipping mechanism (Win+Shift+S)
2. WHEN the snipping mechanism is invoked, THE Bridge SHALL poll the clipboard every 250 milliseconds for up to 30 seconds to detect a new image
3. WHEN a new image is detected on the clipboard, THE Bridge SHALL activate the Kiro IDE window and paste the clipboard content into the active chat input
4. IF no new image appears on the clipboard within 30 seconds of invoking the snipping mechanism, THEN THE Bridge SHALL treat the capture as cancelled and take no further action
5. IF the Kiro window cannot be activated after a screenshot is captured, THEN THE Bridge SHALL retain the image on the clipboard and return an error response

### Requirement 4: Screen Recording to Chat

**User Story:** As a developer, I want to capture a sequence of screen frames and send them to Kiro for visual analysis, so that I can show UI behavior or bugs over time.

#### Acceptance Criteria

1. WHEN the user presses the Screen Record LCD_Button in quick mode, THE Bridge SHALL capture 5 full-screen frames at 500 millisecond intervals
2. WHEN the user presses the Screen Record LCD_Button in long mode, THE Bridge SHALL capture 10 full-screen frames at 800 millisecond intervals
3. THE Bridge SHALL resize each captured frame to 1280 pixels width maintaining the original aspect ratio and encode as JPEG at 80% quality
4. WHEN all frames are captured, THE Bridge SHALL activate the Kiro window and paste all frames into the chat input
5. IF a frame capture fails, THEN THE Bridge SHALL skip that frame and continue with remaining captures
6. IF all frame captures fail during a recording session, THEN THE Bridge SHALL display an error notification indicating that screen recording failed
7. IF the Kiro window is not available after frame capture completes, THEN THE Bridge SHALL display an error notification indicating that the frames could not be delivered

### Requirement 5: Ask Kiro (Universal Selection)

**User Story:** As a developer, I want to select text in any Windows application and press a hardware button to send it to Kiro, so that I can ask questions about code or text from any context.

#### Acceptance Criteria

1. WHEN the user presses the Ask Kiro LCD_Button, THE Plugin SHALL send a request to the Bridge /ask endpoint
2. WHEN the Bridge receives an /ask request, THE Bridge SHALL simulate Ctrl+C in the currently active window to copy the selection to the clipboard
3. WHEN the clipboard contains the copied text, THE Bridge SHALL activate the Kiro window and paste the text into the chat input
4. WHEN the text is pasted into chat, THE Bridge SHALL simulate Enter to submit the prompt
5. IF the clipboard content is empty or unchanged after the Ctrl+C simulation, THEN THE Bridge SHALL take no further action and return a response indicating no selection was found
6. THE Bridge SHALL wait 100 milliseconds after simulating Ctrl+C before reading the clipboard to allow the copy operation to complete

### Requirement 6: Stop/Cancel Button

**User Story:** As a developer, I want a physical button to immediately cancel Kiro's current generation, so that I can stop unwanted responses without reaching for my keyboard.

#### Acceptance Criteria

1. WHEN the user presses the Stop LCD_Button, THE Plugin SHALL send a request to the Bridge /cancel endpoint
2. WHEN the Bridge receives a /cancel request, THE Bridge SHALL activate the Kiro window and simulate Ctrl+C (Kiro cancel keybinding)
3. WHEN a cancel action is performed, THE Bridge SHALL enter a Suppression_Window of 2 seconds during which stale hook responses are ignored
4. WHILE the Suppression_Window is active, THE Bridge SHALL discard any incoming state change hook events
5. WHEN a cancel is executed, THE Plugin SHALL stop the Ghost_Animation and restore static icons reflecting the "idle" state
6. IF the user presses the Stop LCD_Button multiple times within 1 second, THE Plugin SHALL send only one /cancel request and discard subsequent presses within that window

### Requirement 7: Session Navigate via Dial

**User Story:** As a developer, I want to rotate the physical dial to switch between Kiro sessions, so that I can quickly navigate my open conversations without keyboard shortcuts.

#### Acceptance Criteria

1. WHEN the user rotates the Dial clockwise and the accumulated rotation reaches the Notch_Threshold of 18 increments, THE Plugin SHALL send a "next session" command to the Bridge and reset the rotation accumulator to zero
2. WHEN the user rotates the Dial counter-clockwise and the accumulated rotation reaches the Notch_Threshold of 18 increments, THE Plugin SHALL send a "previous session" command to the Bridge and reset the rotation accumulator to zero
3. WHEN the Bridge receives a "next session" command, THE Bridge SHALL activate the Kiro window and simulate Ctrl+Alt+Right within 100 milliseconds of receiving the command
4. WHEN the Bridge receives a "previous session" command, THE Bridge SHALL activate the Kiro window and simulate Ctrl+Alt+Left within 100 milliseconds of receiving the command
5. WHEN the user reverses dial rotation direction, THE Plugin SHALL reset the rotation accumulator to zero
6. THE Plugin SHALL not trigger a session switch until the full Notch_Threshold is reached in one direction
7. WHEN the Plugin initializes, THE Plugin SHALL set the rotation accumulator to zero and the current direction to undefined

### Requirement 8: New Session Button

**User Story:** As a developer, I want a button to open a fresh Kiro chat session, so that I can start a clean context without navigating IDE menus.

#### Acceptance Criteria

1. WHEN the user presses the New Session LCD_Button, THE Plugin SHALL send a request to the Bridge /new-session endpoint
2. WHEN the Bridge receives a /new-session request, THE Bridge SHALL activate the Kiro window and simulate Ctrl+L followed by Ctrl+T with no more than 200 milliseconds delay between keystrokes
3. WHEN the Bridge completes the new session keyboard simulation, THE Bridge SHALL reset the internal context usage counter to zero and report contextPercentage as 0 and healthLevel as "normal" in subsequent /health responses
4. WHEN the Plugin receives a successful response from the /new-session endpoint, THE Plugin SHALL update the health display to show contextPercentage as 0% and Health_Level as "normal"
5. IF the Kiro window cannot be found when processing a /new-session request, THEN THE Bridge SHALL return an error response with status code 503

### Requirement 9: Inline Chat Button

**User Story:** As a developer, I want a button to open Kiro's inline editing mode at my cursor position, so that I can quickly make targeted code changes.

#### Acceptance Criteria

1. WHEN the user presses the Inline Chat LCD_Button, THE Plugin SHALL send a request to the Bridge /inline endpoint
2. WHEN the Bridge receives an /inline request, THE Bridge SHALL activate the Kiro window and simulate Ctrl+I
3. THE Bridge SHALL execute the keyboard simulation within 100 milliseconds of receiving the button press event
4. IF the Kiro window cannot be found or fails to activate within 2 seconds, THEN THE Bridge SHALL return an error response and take no further keyboard action

### Requirement 10: Terminal to Chat Button

**User Story:** As a developer, I want a button to send terminal output to Kiro for analysis, so that I can quickly get help with build errors or command output.

#### Acceptance Criteria

1. WHEN the user presses the Terminal to Chat LCD_Button, THE Plugin SHALL send a request to the Bridge /terminal endpoint
2. WHEN the Bridge receives a /terminal request, THE Bridge SHALL activate the Kiro window and simulate Ctrl+Shift+R
3. THE Bridge SHALL execute the keyboard simulation within 100 milliseconds of receiving the HTTP request, excluding time spent waiting for window activation
4. IF the Kiro window cannot be found when processing a /terminal request, THEN THE Bridge SHALL return an error response with status code 503 and take no further action

### Requirement 11: Prompt Command Buttons

**User Story:** As a developer, I want predefined prompt buttons for common coding tasks (Explain, Criticize, Document, Fix Bug, Optimize, Refactor, Review, Simplify, Write Tests), so that I can trigger frequent actions with a single press.

#### Acceptance Criteria

1. WHEN the user presses a Prompt Command LCD_Button, THE Bridge SHALL activate the Kiro window, type the prompt command name (e.g., "Explain", "Fix Bug") prefixed with the active file context into the chat input, and simulate Enter to submit
2. THE Plugin SHALL provide the following 9 Prompt_Commands on Page 3: Criticize, Refactor, Write Tests, Explain, Fix Bug, Optimize, Review, Document, Simplify
3. WHEN a Prompt_Command is submitted, THE Plugin SHALL start the Ghost_Animation on all 9 LCD_Buttons of the active page
4. WHEN the Bridge reports state "idle" after a Prompt_Command submission, THE Plugin SHALL stop the Ghost_Animation and restore static icons
5. THE Bridge SHALL prepend each prompt with a reference to the currently active editor file path so that Kiro applies the command to that file
6. IF a Prompt_Command LCD_Button is pressed while the Bridge state is "working", THEN THE Plugin SHALL ignore the button press and not send a new prompt to the Bridge
7. THE Bridge SHALL execute the full prompt submission sequence (window activation, text typing, and Enter simulation) within 500 milliseconds of receiving the prompt request

### Requirement 12: Snippet Buttons

**User Story:** As a developer, I want buttons that append modifier text to my chat input without sending, so that I can compose prompts with common qualifiers before reviewing and submitting manually.

#### Acceptance Criteria

1. WHEN the user presses a Snippet LCD_Button, THE Bridge SHALL activate the Kiro window and append the corresponding snippet text to the current chat input content, preceded by a single space if the input is non-empty, without simulating Enter
2. THE Plugin SHALL provide the following Snippets on Page 1: "Be Honest" ("Be honest, criticize. Suggest better alternatives."), "Don't Code Yet" ("Don't write code yet. Let's discuss first."), "Show Options" ("Give me 2-3 options to choose from."), "Explain Why" ("Explain your reasoning."), "Keep Short" ("Be concise, short answer."), "No Tests" ("Don't add tests unless I ask.")
3. WHEN the user presses the "Go!" LCD_Button, THE Bridge SHALL activate the Kiro window and simulate Enter without typing additional text
4. THE Plugin SHALL display all Snippet buttons on Page 1 alongside the Screenshot and Stop buttons in the layout defined in Requirement 20
5. WHEN the user presses multiple Snippet LCD_Buttons in sequence, THE Bridge SHALL append each snippet text to the accumulated chat input content in press order, each separated by a single space

### Requirement 13: Struct Prompt Button

**User Story:** As a developer, I want a button that rewrites my current messy chat input into a clear structured prompt using Kiro itself, so that I get better responses from well-formed requests.

#### Acceptance Criteria

1. WHEN the user presses the Struct Prompt LCD_Button, THE Bridge SHALL activate the Kiro window, select all text in the chat input (Ctrl+A), and copy it (Ctrl+C)
2. THE Bridge SHALL wait 100 milliseconds after Ctrl+C before reading the clipboard to ensure the copy operation completes
3. WHEN the clipboard contains the captured chat text, THE Bridge SHALL construct a meta-prompt instructing Kiro to rewrite the captured text as a clear structured English prompt
4. THE Bridge SHALL clear the chat input (Ctrl+A followed by Delete), paste the meta-prompt, and simulate Enter to submit
5. IF the clipboard is empty after Ctrl+A and Ctrl+C, THEN THE Bridge SHALL take no action and return a response indicating no text was found

### Requirement 14: Start Spec Button

**User Story:** As a developer, I want a button to initiate a Kiro spec workflow for my current feature, so that I can begin structured development without typing the command.

#### Acceptance Criteria

1. WHEN the user presses the Start Spec LCD_Button, THE Bridge SHALL activate the Kiro window, clear the chat input (Ctrl+A followed by Delete), type "Start a spec workflow for this feature" into the chat input, and simulate Enter to submit
2. THE Bridge SHALL complete the keyboard simulation within 100 milliseconds of receiving the button press event, excluding time spent waiting for window activation
3. WHEN the Start Spec prompt is submitted, THE Plugin SHALL start the Ghost_Animation on all 9 LCD_Buttons of the active page until the Bridge reports state "idle"
4. IF the chat input cannot be cleared or the prompt cannot be typed, THEN THE Bridge SHALL abort the operation and return an error response indicating the failure reason

### Requirement 15: Git Commit Button

**User Story:** As a developer, I want a button that asks Kiro to generate a commit message from the current diff and commit, so that I can maintain clean git history without context switching.

#### Acceptance Criteria

1. WHEN the user presses the Git Commit LCD_Button, THE Plugin SHALL send a request to the Bridge /prompt endpoint with the text "Generate a commit message from current git diff and commit"
2. WHEN the Bridge receives the Git Commit prompt request, THE Bridge SHALL activate the Kiro window, type the prompt text into the chat input, and simulate Enter within 100 milliseconds of window activation
3. IF the Kiro window cannot be found when processing the Git Commit request, THEN THE Bridge SHALL return an error response with status code 503

### Requirement 16: Understand Workspace Button

**User Story:** As a developer, I want a button that asks Kiro to analyze and summarize my project structure, so that I can quickly orient myself or onboard to a codebase.

#### Acceptance Criteria

1. WHEN the user presses the Understand Workspace LCD_Button, THE Plugin SHALL send a request to the Bridge /prompt endpoint with the text "Analyze and summarize this project structure"
2. WHEN the Bridge receives the Understand Workspace prompt request, THE Bridge SHALL activate the Kiro window, type the prompt text into the chat input, and simulate Enter within 100 milliseconds of window activation
3. IF the Kiro window cannot be found when processing the Understand Workspace request, THEN THE Bridge SHALL return an error response with status code 503

### Requirement 17: State Detection via Kiro Hooks

**User Story:** As a developer, I want the system to automatically detect when Kiro starts and stops working, so that animations and feedback reflect the real IDE state without manual intervention.

#### Acceptance Criteria

1. WHEN the Kiro_Hook "promptSubmit" fires, THE Kiro_Hook SHALL send an HTTP POST with an empty body to the Bridge at http://localhost:9848/hook/working within 2 seconds of the event firing
2. WHEN the Kiro_Hook "agentStop" fires, THE Kiro_Hook SHALL send an HTTP POST with an empty body to the Bridge at http://localhost:9848/hook/idle within 2 seconds of the event firing
3. WHEN the Bridge receives a /hook/working request, THE Bridge SHALL update the internal state to "working" and include the current state value in subsequent /health responses
4. WHEN the Bridge receives a /hook/idle request, THE Bridge SHALL update the internal state to "idle" and include the current state value in subsequent /health responses
5. IF no hook event is received for 2 minutes after a "working" state begins, THEN THE Bridge SHALL automatically transition to "idle" state
6. WHILE the Suppression_Window is active, THE Bridge SHALL ignore incoming /hook/idle and /hook/working requests and retain the current state unchanged
7. IF the Kiro_Hook fails to reach the Bridge (connection refused or no response within 2 seconds), THEN THE Kiro_Hook SHALL discard the event without retrying and without displaying an error to the user

### Requirement 18: Bridge HTTP Server

**User Story:** As a developer, I want a reliable local HTTP bridge that coordinates communication between the hardware plugin and Kiro IDE, so that button presses translate into IDE actions.

#### Acceptance Criteria

1. THE Bridge SHALL listen for HTTP requests on port 9848 on localhost
2. THE Bridge SHALL expose a GET /health endpoint returning JSON with fields: state ("working" or "idle"), healthLevel ("normal", "worried", or "critical"), and contextPercentage (integer 0-100)
3. THE Bridge SHALL expose POST endpoints for /cancel, /ask, /hook/working, /hook/idle, and /prompt, where the /prompt and /ask endpoints accept a body containing the prompt text with a maximum length of 4096 characters, and /cancel, /hook/working, and /hook/idle require no request body
4. WHEN the Bridge receives a POST request to /cancel, /ask, or /prompt, THE Bridge SHALL activate the Kiro window using Win32 FindWindow + SetForegroundWindow before simulating keyboard input, and return a JSON response with a success boolean field and HTTP status 200
5. WHEN the Bridge receives a POST request to /hook/working or /hook/idle, THE Bridge SHALL update the internal bridge state without activating the Kiro window, and return a JSON response with a success boolean field and HTTP status 200
6. IF the Kiro window cannot be found when processing /cancel, /ask, or /prompt, THEN THE Bridge SHALL return an error response with status code 503 and a message indicating the Kiro window is unavailable
7. IF a POST request to /prompt or /ask contains a body exceeding 4096 characters or an empty body, THEN THE Bridge SHALL return an error response with status code 400 and a message indicating the invalid prompt length
8. THE Bridge SHALL respond to all HTTP requests within 500 milliseconds, excluding time spent waiting for window activation

### Requirement 19: Plugin-to-Bridge Communication

**User Story:** As a developer, I want the C# plugin to reliably communicate with the Bridge service, so that hardware inputs are consistently translated to IDE actions.

#### Acceptance Criteria

1. THE Plugin SHALL send HTTP requests to the Bridge at http://localhost:9848 with a request timeout of 2000 milliseconds
2. IF the Bridge fails to respond to 2 consecutive poll requests (connection refused or timeout), THEN THE Plugin SHALL display a "disconnected" indicator on all 9 LCD_Buttons by replacing their current icons with a visual disconnected state
3. WHEN the Bridge becomes reachable again, THE Plugin SHALL restore normal LCD_Button display within one poll interval (500 milliseconds)
4. THE Plugin SHALL target .NET 10 and reference PluginApi.dll from "C:\Program Files\Logi\LogiPluginService\"
5. THE Plugin SHALL register under the LogitechCreativeFamily device family
6. IF an action request (non-poll) to the Bridge fails due to timeout or connection error, THEN THE Plugin SHALL discard the request and leave the LCD_Button display unchanged

### Requirement 20: LCD Button Page Layout

**User Story:** As a developer, I want organized pages of button functions, so that related actions are grouped and I can find the right button quickly.

#### Acceptance Criteria

1. THE Plugin SHALL configure Page 1 with Snippets and Controls in the following order: Screenshot, Be Honest, Don't Code Yet, Show Options, Explain Why, Stop, Keep Short, No Tests, Go!
2. THE Plugin SHALL configure Page 2 with Utility Controls in the following order: New Session, Struct Prompt, Inline Chat, Terminal to Chat, Screen Record, Ask Kiro, Understand Workspace, Start Spec, Git Commit
3. THE Plugin SHALL configure Page 3 with Prompt Commands in the following order: Criticize, Refactor, Write Tests, Explain, Fix Bug, Optimize, Review, Document, Simplify
4. WHILE the plugin state is "working", THE Plugin SHALL render Ghost_Animation on all Page 1 and Page 3 buttons
5. THE Plugin SHALL NOT render Ghost_Animation on Page 2 buttons regardless of plugin state
6. WHEN the plugin state transitions from "working" to any other state, THE Plugin SHALL stop rendering Ghost_Animation on Page 1 and Page 3 buttons

### Requirement 21: Window Activation and Keyboard Simulation

**User Story:** As a developer, I want reliable window activation and keyboard simulation, so that button presses correctly reach the Kiro IDE regardless of which window is currently focused.

#### Acceptance Criteria

1. WHEN the Bridge initiates a keyboard simulation command, THE Bridge SHALL locate the Kiro window by searching for a window belonging to the Kiro.exe process using Win32 window enumeration APIs
2. IF multiple Kiro windows are found, THEN THE Bridge SHALL target the most recently active Kiro window
3. IF the Kiro window is not found or Kiro is not running, THEN THE Bridge SHALL abort the operation and return an error indicating that no Kiro window is available
4. WHEN the Kiro window is located, THE Bridge SHALL bring it to the foreground using Win32 SetForegroundWindow and confirm the window has received foreground status before proceeding
5. WHEN simulating keyboard input, THE Bridge SHALL use Win32 SendInput or equivalent native API and SHALL only dispatch key events after the Kiro window is confirmed as the foreground window
6. IF the Kiro window fails to achieve foreground status within 2 seconds of the activation attempt, THEN THE Bridge SHALL abort the keyboard simulation and return an error indicating activation timeout
7. IF the Kiro window is minimized, THEN THE Bridge SHALL restore the window before attempting to bring it to the foreground

### Requirement 22: Parse and Serialize Health Response

**User Story:** As a developer, I want the /health endpoint to return well-structured JSON, so that the Plugin can reliably determine system state and context health.

#### Acceptance Criteria

1. THE Bridge SHALL serialize the /health response as JSON with the schema: {"state": string, "healthLevel": string, "contextPercentage": number}, where state is one of ["working", "idle"], healthLevel is one of ["normal", "worried", "critical"], and contextPercentage is an integer from 0 to 100 inclusive
2. WHEN the Plugin receives the /health JSON response, THE Plugin SHALL parse the response body and extract the state, healthLevel, and contextPercentage fields
3. THE Bridge SHALL produce JSON such that serializing and parsing back yields an object with identical field names, field types, and field values for state, healthLevel, and contextPercentage
4. IF the /health response body is not valid JSON or is valid JSON but missing any of the required fields (state, healthLevel, contextPercentage), THEN THE Plugin SHALL treat the state as "idle", healthLevel as "normal", and contextPercentage as 0
5. IF the /health response contains a contextPercentage value outside the range 0 to 100, THEN THE Plugin SHALL treat the state as "idle", healthLevel as "normal", and contextPercentage as 0
