/**
 * KiroCan Bridge - Window Manager
 *
 * Handles Win32 window enumeration, activation, and foreground management
 * using koffi for native FFI bindings. Locates the Kiro IDE window by
 * process name and provides reliable window activation with minimized
 * window restoration.
 */

import koffi from "koffi";
import type { WindowHandle } from "./types.js";

// ---------------------------------------------------------------------------
// Win32 Constants
// ---------------------------------------------------------------------------

/** ShowWindow command to restore a minimized window. */
const SW_RESTORE = 9;

/** Default timeout (ms) for waiting on foreground activation. */
const DEFAULT_FOREGROUND_TIMEOUT_MS = 2000;

/** Polling interval (ms) for foreground check loop. */
const FOREGROUND_POLL_INTERVAL_MS = 50;

/** The process name to search for when locating Kiro IDE windows. */
const KIRO_PROCESS_NAME = "Kiro.exe";

// ---------------------------------------------------------------------------
// Win32 FFI Bindings
// ---------------------------------------------------------------------------

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");
const psapi = koffi.load("psapi.dll");

/**
 * Callback type for EnumWindows.
 * Receives an HWND and an lParam; returns non-zero to continue enumeration.
 */
const EnumWindowsProc = koffi.proto(
  "EnumWindowsProc",
  "int",
  ["void *", "intptr"]
);

/** Enumerates all top-level windows, calling the callback for each. */
const EnumWindows = user32.func("EnumWindows", "int", [
  koffi.pointer(EnumWindowsProc),
  "intptr",
]);

/**
 * Retrieves the thread and process ID that created the specified window.
 * The process ID is written to the output pointer.
 * Uses C prototype string with _Out_ qualifier for the PID parameter.
 */
const GetWindowThreadProcessId = user32.func(
  "uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)"
);

/** Brings the specified window to the foreground. */
const SetForegroundWindow = user32.func("SetForegroundWindow", "int", [
  "void *",
]);

/** Sets the specified window's show state (minimize, restore, etc.). */
const ShowWindow = user32.func("ShowWindow", "int", ["void *", "int"]);

/** Retrieves a handle to the current foreground window. */
const GetForegroundWindow = user32.func("GetForegroundWindow", "void *", []);

/** Determines whether the specified window is minimized (iconic). */
const IsIconic = user32.func("IsIconic", "int", ["void *"]);

/** Determines whether the specified window handle is still valid. */
const IsWindow = user32.func("IsWindow", "int", ["void *"]);

/** Checks if a window is visible. */
const IsWindowVisible = user32.func("IsWindowVisible", "int", ["void *"]);

/**
 * Opens an existing local process object for querying.
 * PROCESS_QUERY_INFORMATION | PROCESS_VM_READ = 0x0410
 */
const OpenProcess = kernel32.func("OpenProcess", "void *", [
  "uint32",
  "int",
  "uint32",
]);

/** Closes an open object handle. */
const CloseHandle = kernel32.func("CloseHandle", "int", ["void *"]);

/**
 * Retrieves the full path of the executable for the specified process.
 * Returns the length of the string copied to the buffer.
 */
const GetModuleFileNameExW = psapi.func(
  "uint32_t __stdcall GetModuleFileNameExW(void *hProcess, void *hModule, _Out_ uint16_t *lpFilename, uint32_t nSize)"
);

/** Retrieves the last active popup window owned by the specified window. */
const GetLastActivePopup = user32.func("GetLastActivePopup", "void *", [
  "void *",
]);

/**
 * Retrieves the text of the specified window's title bar (if it has one).
 * Returns the length of the string copied to the buffer.
 */
const GetWindowTextW = user32.func(
  "int __stdcall GetWindowTextW(void *hWnd, _Out_ uint16_t *lpString, int nMaxCount)"
);

// ---------------------------------------------------------------------------
// Win32 Access Flags
// ---------------------------------------------------------------------------

/** PROCESS_QUERY_INFORMATION | PROCESS_VM_READ */
const PROCESS_QUERY_AND_READ = 0x0410;

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

/**
 * Converts a koffi pointer (void *) to a numeric WindowHandle.
 * Returns 0 if the pointer is null.
 */
function ptrToHandle(ptr: unknown): WindowHandle {
  // koffi represents void* as a number or BigInt depending on platform
  if (ptr === null || ptr === undefined) return 0;
  if (typeof ptr === "number") return ptr;
  if (typeof ptr === "bigint") return Number(ptr);
  return 0;
}

/**
 * Converts a numeric WindowHandle to a value suitable for koffi void * parameter.
 */
function handleToPtr(handle: WindowHandle): number {
  return handle;
}

/**
 * Retrieves the executable file name (e.g., "Kiro.exe") for a given process ID.
 * Returns null if the process cannot be opened or queried.
 */
function getProcessName(pid: number): string | null {
  const hProcess = OpenProcess(PROCESS_QUERY_AND_READ, 0, pid);
  const hProcessHandle = ptrToHandle(hProcess);
  if (hProcessHandle === 0) return null;

  try {
    const MAX_PATH = 260;
    const buf = Buffer.alloc(MAX_PATH * 2); // UTF-16 = 2 bytes per character
    const len = GetModuleFileNameExW(hProcess, null, buf, MAX_PATH);
    if (len === 0) return null;

    // Decode the UTF-16LE buffer to a JS string
    const fullPath = buf.toString("utf16le", 0, len * 2);

    // Extract just the filename from the full path
    const lastBackslash = fullPath.lastIndexOf("\\");
    const lastSlash = fullPath.lastIndexOf("/");
    const sep = Math.max(lastBackslash, lastSlash);
    return sep >= 0 ? fullPath.substring(sep + 1) : fullPath;
  } finally {
    CloseHandle(hProcess);
  }
}

/**
 * Sleeps for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Finds the Kiro IDE window by enumerating all top-level windows and matching
 * against the Kiro.exe process name.
 *
 * If multiple Kiro windows are found, returns the most recently active one
 * (determined by GetLastActivePopup heuristic and visibility).
 *
 * @returns The window handle of the Kiro IDE window, or null if not found.
 */
export function findKiroWindow(): WindowHandle | null {
  const candidates: WindowHandle[] = [];

  // EnumWindows calls the callback synchronously for each top-level window.
  // We use a transient callback (passed directly) since it's only invoked
  // during the EnumWindows call itself.
  EnumWindows((hwnd: unknown, _lParam: unknown): number => {
    const handle = ptrToHandle(hwnd);
    if (handle === 0) return 1; // continue

    // Skip invisible windows
    if (!IsWindowVisible(handleToPtr(handle))) return 1;

    // Get the process ID for this window
    const pidOut: [number | null] = [null];
    const tid = GetWindowThreadProcessId(hwnd, pidOut);
    if (!tid) return 1; // window may have been destroyed
    const pid = pidOut[0];
    if (pid === null || pid === 0) return 1;

    // Check if the process is Kiro.exe
    const processName = getProcessName(pid);
    if (
      processName !== null &&
      processName.toLowerCase() === KIRO_PROCESS_NAME.toLowerCase()
    ) {
      candidates.push(handle);
    }

    return 1; // continue enumeration
  }, 0);

  if (candidates.length === 0) return null;

  // If multiple windows found, prefer the most recently active one.
  // GetLastActivePopup returns the most recently active popup owned by a window,
  // or the window itself if it has no popups. We use this as a proxy for "most recent."
  // Also prefer non-minimized windows.
  let best: WindowHandle = candidates[0];

  for (const candidate of candidates) {
    const popup = ptrToHandle(GetLastActivePopup(handleToPtr(candidate)));
    // If the popup is the window itself and it's visible, prefer it
    if (popup === candidate && !IsIconic(handleToPtr(candidate))) {
      best = candidate;
      break;
    }
  }

  // Fallback: prefer any non-minimized window
  if (IsIconic(handleToPtr(best))) {
    for (const candidate of candidates) {
      if (!IsIconic(handleToPtr(candidate))) {
        best = candidate;
        break;
      }
    }
  }

  return best;
}

/**
 * Activates a window by bringing it to the foreground.
 * If the window is minimized, it is first restored. Then SetForegroundWindow
 * is called, followed by polling until the window achieves foreground status
 * (up to 2 seconds).
 *
 * @param handle - The Win32 window handle to activate.
 * @returns true if the window successfully achieved foreground status.
 */
export async function activateWindow(handle: WindowHandle): Promise<boolean> {
  if (!IsWindow(handleToPtr(handle))) return false;

  // Restore the window if it is minimized
  if (IsIconic(handleToPtr(handle))) {
    ShowWindow(handleToPtr(handle), SW_RESTORE);
  }

  // Bring window to foreground
  SetForegroundWindow(handleToPtr(handle));

  // Wait for the window to achieve foreground status
  return waitForForeground(handle, DEFAULT_FOREGROUND_TIMEOUT_MS);
}

/**
 * Checks whether the specified window is currently the foreground window.
 *
 * @param handle - The Win32 window handle to check.
 * @returns true if the window is in the foreground.
 */
export function isForeground(handle: WindowHandle): boolean {
  const fg = ptrToHandle(GetForegroundWindow());
  return fg === handle;
}

/**
 * Waits for the specified window to achieve foreground status by polling.
 * Returns as soon as the window becomes the foreground window, or returns
 * false after the timeout expires.
 *
 * On each poll iteration, SetForegroundWindow is retried in case the initial
 * attempt was blocked by Windows focus-stealing prevention.
 *
 * @param handle - The Win32 window handle to wait on.
 * @param timeoutMs - Maximum time to wait in milliseconds (default: 2000ms).
 * @returns true if the window achieved foreground status within the timeout.
 */
export async function waitForForeground(
  handle: WindowHandle,
  timeoutMs: number = DEFAULT_FOREGROUND_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isForeground(handle)) return true;

    // Retry SetForegroundWindow on each poll in case the first attempt was
    // blocked by focus-stealing prevention
    SetForegroundWindow(handleToPtr(handle));

    await sleep(FOREGROUND_POLL_INTERVAL_MS);
  }

  // Final check after timeout
  return isForeground(handle);
}

/**
 * Checks whether the specified window is minimized (iconic).
 *
 * @param handle - The Win32 window handle to check.
 * @returns true if the window is minimized.
 */
export function isWindowMinimized(handle: WindowHandle): boolean {
  return IsIconic(handleToPtr(handle)) !== 0;
}

/**
 * Restores a minimized window to its previous size and position.
 *
 * @param handle - The Win32 window handle to restore.
 */
export function restoreWindow(handle: WindowHandle): void {
  if (IsIconic(handleToPtr(handle))) {
    ShowWindow(handleToPtr(handle), SW_RESTORE);
  }
}

/**
 * Checks whether the specified window handle is still valid.
 *
 * @param handle - The Win32 window handle to validate.
 * @returns true if the window handle is valid.
 */
export function isValidWindow(handle: WindowHandle): boolean {
  return IsWindow(handleToPtr(handle)) !== 0;
}

/**
 * Retrieves the title bar text of the specified window.
 *
 * @param handle - The Win32 window handle.
 * @returns The window title string, or empty string if no title.
 */
export function getWindowTitle(handle: WindowHandle): string {
  const MAX_TITLE = 256;
  const buf = Buffer.alloc(MAX_TITLE * 2); // UTF-16LE
  const len = GetWindowTextW(handleToPtr(handle), buf, MAX_TITLE);
  if (len === 0) return "";
  return buf.toString("utf16le", 0, len * 2);
}
