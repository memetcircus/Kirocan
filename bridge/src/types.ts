/**
 * KiroCan Bridge - Shared TypeScript Interfaces and Types
 *
 * Central type definitions used across all Bridge components.
 */

// ---------------------------------------------------------------------------
// Health & State
// ---------------------------------------------------------------------------

/**
 * Response body for the GET /health endpoint.
 * Serialized as JSON and polled by the C# Plugin every 500ms.
 */
export interface HealthResponse {
  /** Current agent working state. */
  state: "working" | "idle";
  /** Context health tier (worst of context vs media severity). */
  healthLevel: "normal" | "worried" | "critical";
  /** Context window usage as an integer percentage (0-100). */
  contextPercentage: number;
  /** Number of images in the current session. */
  mediaCount: number;
  /** Hard limit for inline media segments. */
  mediaLimit: number;
  /** Remaining images before hitting the limit. */
  mediaRemaining: number;
  /** True when mediaCount >= 90 (screenshot/screen-record blocked). */
  mediaBlocked: boolean;
}

/**
 * Internal state tracked by the Bridge service at runtime.
 */
export interface BridgeInternalState {
  /** Current agent working state. */
  agentState: "working" | "idle";
  /** Context window usage percentage (0-100). */
  contextPercentage: number;
  /** Context health tier. */
  healthLevel: "normal" | "worried" | "critical";
  /** Whether the suppression window is currently active. */
  suppressionActive: boolean;
  /** Unix timestamp (ms) when the suppression window expires, or null. */
  suppressionExpiry: number | null;
  /** Handle for the 2-minute working-state timeout, or null. */
  workingTimeoutHandle: NodeJS.Timeout | null;
}

// ---------------------------------------------------------------------------
// Request Bodies
// ---------------------------------------------------------------------------

/**
 * Request body for POST /prompt and POST /ask endpoints.
 * Text must be between 1 and 4096 characters inclusive.
 */
export interface PromptRequest {
  /** The prompt text to send to Kiro. */
  text: string;
}

/**
 * Request body for POST /screen-record endpoint.
 */
export interface ScreenRecordRequest {
  /** Recording mode: quick (5 frames) or long (10 frames). */
  mode: "quick" | "long";
}

// ---------------------------------------------------------------------------
// Response Bodies
// ---------------------------------------------------------------------------

/** Successful action response. */
export interface SuccessResponse {
  success: true;
}

/** Failed action response with an error message. */
export interface ErrorResponse {
  success: false;
  error: string;
}

// ---------------------------------------------------------------------------
// Internal Result Types
// ---------------------------------------------------------------------------

/** Result returned by shortcut executor operations. */
export interface ActionResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Win32 Types
// ---------------------------------------------------------------------------

/**
 * Type alias for a Win32 window handle (HWND).
 * Represented as a numeric pointer value.
 */
export type WindowHandle = number;

// ---------------------------------------------------------------------------
// Virtual Key Codes
// ---------------------------------------------------------------------------

/**
 * Win32 Virtual-Key code constants used by the keyboard simulator.
 * Values sourced from the Windows SDK header `WinUser.h`.
 */
export const VK = {
  // Modifier keys
  VK_CONTROL: 0x11,
  VK_SHIFT: 0x10,
  VK_MENU: 0x12, // Alt
  VK_LWIN: 0x5b,

  // Navigation / editing
  VK_RETURN: 0x0d,
  VK_TAB: 0x09,
  VK_ESCAPE: 0x1b,
  VK_LEFT: 0x25,
  VK_RIGHT: 0x27,
  VK_UP: 0x26,
  VK_DOWN: 0x28,
  VK_DELETE: 0x2e,
  VK_BACK: 0x08,
  VK_HOME: 0x24,
  VK_END: 0x23,

  // Letter keys A-Z (0x41-0x5A)
  VK_A: 0x41,
  VK_B: 0x42,
  VK_C: 0x43,
  VK_D: 0x44,
  VK_E: 0x45,
  VK_F: 0x46,
  VK_G: 0x47,
  VK_H: 0x48,
  VK_I: 0x49,
  VK_J: 0x4a,
  VK_K: 0x4b,
  VK_L: 0x4c,
  VK_M: 0x4d,
  VK_N: 0x4e,
  VK_O: 0x4f,
  VK_P: 0x50,
  VK_Q: 0x51,
  VK_R: 0x52,
  VK_S: 0x53,
  VK_T: 0x54,
  VK_U: 0x55,
  VK_V: 0x56,
  VK_W: 0x57,
  VK_X: 0x58,
  VK_Y: 0x59,
  VK_Z: 0x5a,

  // Number keys 0-9
  VK_0: 0x30,
  VK_1: 0x31,
  VK_2: 0x32,
  VK_3: 0x33,
  VK_4: 0x34,
  VK_5: 0x35,
  VK_6: 0x36,
  VK_7: 0x37,
  VK_8: 0x38,
  VK_9: 0x39,

  // Function keys
  VK_F1: 0x70,
  VK_F2: 0x71,
  VK_F3: 0x72,
  VK_F4: 0x73,
  VK_F5: 0x74,
  VK_F6: 0x75,
  VK_F7: 0x76,
  VK_F8: 0x77,
  VK_F9: 0x78,
  VK_F10: 0x79,
  VK_F11: 0x7a,
  VK_F12: 0x7b,

  // Misc
  VK_SPACE: 0x20,
} as const;

/** A virtual-key code value (numeric). */
export type VirtualKey = (typeof VK)[keyof typeof VK];
