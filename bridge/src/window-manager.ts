/**
 * KiroCan Bridge - Window Manager
 *
 * Handles Win32 window enumeration, activation, and foreground management
 * using koffi for native FFI bindings.
 */

import koffi from "koffi";
import { execSync } from "node:child_process";
import type { WindowHandle } from "./types.js";

// ---------------------------------------------------------------------------
// Win32 Constants
// ---------------------------------------------------------------------------

const SW_RESTORE = 9;
const DEFAULT_FOREGROUND_TIMEOUT_MS = 2000;
const FOREGROUND_POLL_INTERVAL_MS = 50;
const KIRO_PROCESS_NAME = "Kiro.exe";
const PROCESS_QUERY_AND_READ = 0x0410;

// ---------------------------------------------------------------------------
// Win32 FFI Bindings
// ---------------------------------------------------------------------------

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");
const psapi = koffi.load("psapi.dll");

const EnumWindowsProc = koffi.proto("EnumWindowsProc", "int", ["void *", "intptr"]);
const EnumWindows = user32.func("EnumWindows", "int", [koffi.pointer(EnumWindowsProc), "intptr"]);
const GetWindowThreadProcessId = user32.func("uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)");
const SetForegroundWindow = user32.func("SetForegroundWindow", "int", ["void *"]);
const ShowWindow = user32.func("ShowWindow", "int", ["void *", "int"]);
const GetForegroundWindow = user32.func("GetForegroundWindow", "void *", []);
const IsIconic = user32.func("IsIconic", "int", ["void *"]);
const IsWindow = user32.func("IsWindow", "int", ["void *"]);
const IsWindowVisible = user32.func("IsWindowVisible", "int", ["void *"]);
const OpenProcess = kernel32.func("OpenProcess", "void *", ["uint32", "int", "uint32"]);
const CloseHandle = kernel32.func("CloseHandle", "int", ["void *"]);
const GetModuleFileNameExW = psapi.func("uint32_t __stdcall GetModuleFileNameExW(void *hProcess, void *hModule, _Out_ uint16_t *lpFilename, uint32_t nSize)");
const GetLastActivePopup = user32.func("GetLastActivePopup", "void *", ["void *"]);
const GetWindowTextW = user32.func("int __stdcall GetWindowTextW(void *hWnd, _Out_ uint16_t *lpString, int nMaxCount)");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ptrToHandle(ptr: unknown): WindowHandle {
  if (ptr === null || ptr === undefined) return 0;
  if (typeof ptr === "number") return ptr;
  if (typeof ptr === "bigint") return Number(ptr);
  return 0;
}

function handleToPtr(handle: WindowHandle): number {
  return handle;
}

function getProcessName(pid: number): string | null {
  const hProcess = OpenProcess(PROCESS_QUERY_AND_READ, 0, pid);
  const hProcessHandle = ptrToHandle(hProcess);
  if (hProcessHandle === 0) return null;

  try {
    const MAX_PATH = 260;
    const buf = Buffer.alloc(MAX_PATH * 2);
    const len = GetModuleFileNameExW(hProcess, null, buf, MAX_PATH);
    if (len === 0) return null;

    const fullPath = buf.toString("utf16le", 0, len * 2);
    const lastBackslash = fullPath.lastIndexOf("\\");
    const lastSlash = fullPath.lastIndexOf("/");
    const sep = Math.max(lastBackslash, lastSlash);
    return sep >= 0 ? fullPath.substring(sep + 1) : fullPath;
  } finally {
    CloseHandle(hProcess);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Finds the Kiro IDE window. Uses PowerShell Get-Process first (fast, reliable),
 * falls back to koffi EnumWindows if needed.
 */
export function findKiroWindow(): WindowHandle | null {
  // Primary: PowerShell (always works)
  try {
    const result = execSync(
      'powershell -NoProfile -Command "(Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle"',
      { encoding: "utf8", timeout: 3000, stdio: ["pipe", "pipe", "ignore"] }
    ).trim();

    if (result && result !== "0" && result !== "") {
      const hwnd = parseInt(result, 10);
      if (!isNaN(hwnd) && hwnd !== 0) {
        return hwnd as WindowHandle;
      }
    }
  } catch {
    // Fall through to EnumWindows
  }

  // Fallback: koffi EnumWindows
  const candidates: WindowHandle[] = [];

  EnumWindows((hwnd: unknown, _lParam: unknown): number => {
    const handle = ptrToHandle(hwnd);
    if (handle === 0) return 1;
    if (!IsWindowVisible(handleToPtr(handle))) return 1;

    const pidOut: [number | null] = [null];
    const tid = GetWindowThreadProcessId(hwnd, pidOut);
    if (!tid) return 1;
    const pid = pidOut[0];
    if (pid === null || pid === 0) return 1;

    const processName = getProcessName(pid);
    if (processName !== null && processName.toLowerCase() === KIRO_PROCESS_NAME.toLowerCase()) {
      candidates.push(handle);
    } else {
      // Title fallback
      const MAX_TITLE = 256;
      const titleBuf = Buffer.alloc(MAX_TITLE * 2);
      const titleLen = GetWindowTextW(handleToPtr(handle), titleBuf, MAX_TITLE);
      if (titleLen > 0) {
        const title = titleBuf.toString("utf16le", 0, titleLen * 2);
        if (title.includes("Kiro")) {
          candidates.push(handle);
        }
      }
    }

    return 1;
  }, 0);

  if (candidates.length === 0) return null;

  // Prefer non-minimized window
  let best: WindowHandle = candidates[0];
  for (const candidate of candidates) {
    if (!IsIconic(handleToPtr(candidate))) {
      best = candidate;
      break;
    }
  }

  return best;
}

/**
 * Activates the Kiro window - restores if minimized, brings to foreground.
 * Returns true even if SetForegroundWindow is blocked by Windows focus-stealing
 * prevention — the caller should proceed anyway since Kiro may already be foreground.
 */
export async function activateWindow(handle: WindowHandle): Promise<boolean> {
  if (!IsWindow(handleToPtr(handle))) return false;

  if (IsIconic(handleToPtr(handle))) {
    ShowWindow(handleToPtr(handle), SW_RESTORE);
  }

  SetForegroundWindow(handleToPtr(handle));

  // Quick check - if already foreground, return immediately
  if (isForeground(handle)) return true;

  // Brief wait then return true anyway - Windows may block SetForegroundWindow
  // from background processes, but Kiro is likely already foreground when
  // the user presses a physical button
  await sleep(100);
  return true;
}

/**
 * Checks whether the specified window is the foreground window.
 */
export function isForeground(handle: WindowHandle): boolean {
  const fg = ptrToHandle(GetForegroundWindow());
  return fg === handle;
}

/**
 * Waits for the window to achieve foreground status.
 */
export async function waitForForeground(
  handle: WindowHandle,
  timeoutMs: number = DEFAULT_FOREGROUND_TIMEOUT_MS
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (isForeground(handle)) return true;
    SetForegroundWindow(handleToPtr(handle));
    await sleep(FOREGROUND_POLL_INTERVAL_MS);
  }

  return isForeground(handle);
}

export function isWindowMinimized(handle: WindowHandle): boolean {
  return IsIconic(handleToPtr(handle)) !== 0;
}

export function restoreWindow(handle: WindowHandle): void {
  if (IsIconic(handleToPtr(handle))) {
    ShowWindow(handleToPtr(handle), SW_RESTORE);
  }
}

export function isValidWindow(handle: WindowHandle): boolean {
  return IsWindow(handleToPtr(handle)) !== 0;
}

export function getWindowTitle(handle: WindowHandle): string {
  const MAX_TITLE = 256;
  const buf = Buffer.alloc(MAX_TITLE * 2);
  const len = GetWindowTextW(handleToPtr(handle), buf, MAX_TITLE);
  if (len === 0) return "";
  return buf.toString("utf16le", 0, len * 2);
}
