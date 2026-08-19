/**
 * KiroCan Bridge - Clipboard Basket
 *
 * Collects clipboard text snippets in a queue (the "basket") without
 * switching window focus. A background poller watches for Kiro to become
 * the foreground window; when it does, all queued snippets are pasted
 * into the chat input and the basket is cleared.
 */

import { execSync } from "node:child_process";
import koffi from "koffi";
import { sendKeyCombo } from "./keyboard-simulator.js";
import { VK } from "./types.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

// ---------------------------------------------------------------------------
// Win32 Bindings for foreground check
// ---------------------------------------------------------------------------

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");
const psapi = koffi.load("psapi.dll");

const GetForegroundWindow = user32.func("GetForegroundWindow", "void *", []);
const GetWindowThreadProcessId = user32.func(
  "uint32_t __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32_t *lpdwProcessId)"
);
const OpenProcess = kernel32.func("OpenProcess", "void *", ["uint32", "int", "uint32"]);
const CloseHandle = kernel32.func("CloseHandle", "int", ["void *"]);
const GetModuleFileNameExW = psapi.func(
  "uint32_t __stdcall GetModuleFileNameExW(void *hProcess, void *hModule, _Out_ uint16_t *lpFilename, uint32_t nSize)"
);

const PROCESS_QUERY_AND_READ = 0x0410;

// ---------------------------------------------------------------------------
// Basket State
// ---------------------------------------------------------------------------

/** Queued clipboard snippets waiting to be pasted into Kiro. */
const basket: string[] = [];

/** Interval handle for the foreground poller. */
let pollInterval: NodeJS.Timeout | null = null;

/** Polling frequency in ms (check every 500ms if Kiro is foreground). */
const POLL_INTERVAL_MS = 500;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Adds the current clipboard content to the basket.
 * Does NOT switch focus or activate any window.
 *
 * @returns The number of items now in the basket, or -1 if clipboard was empty.
 */
export function addToBasket(): number {
  let clipboardText: string;
  try {
    clipboardText = execSync(
      'powershell -NoProfile -Command "Get-Clipboard"',
      { timeout: 3000, encoding: "utf-8" }
    ).trim();
  } catch {
    return -1;
  }

  if (!clipboardText || clipboardText.length === 0) {
    return -1;
  }

  basket.push(clipboardText);
  console.log(`[Basket] Added item #${basket.length} (${clipboardText.length} chars)`);
  return basket.length;
}

/**
 * Returns the current number of items in the basket.
 */
export function getBasketSize(): number {
  return basket.length;
}

/**
 * Checks if the Kiro process owns the current foreground window.
 * Uses koffi Win32 bindings directly ΓÇö no PowerShell overhead.
 */
function isKiroForeground(): boolean {
  try {
    // Get foreground window handle
    const fgHwnd = GetForegroundWindow();
    if (fgHwnd === null) return false;

    // Get the process ID of the foreground window
    const pidOut: [number | null] = [null];
    GetWindowThreadProcessId(fgHwnd, pidOut);
    const pid = pidOut[0];
    if (!pid || pid === 0) return false;

    // Open the process and get its executable name
    const hProcess = OpenProcess(PROCESS_QUERY_AND_READ, 0, pid);
    if (hProcess === null) return false;

    try {
      const MAX_PATH = 260;
      const buf = Buffer.alloc(MAX_PATH * 2);
      const len = GetModuleFileNameExW(hProcess, null, buf, MAX_PATH);
      if (len === 0) return false;

      const fullPath = buf.toString("utf16le", 0, len * 2);
      return fullPath.toLowerCase().includes("kiro.exe");
    } finally {
      CloseHandle(hProcess);
    }
  } catch {
    return false;
  }
}

/**
 * Starts the background poller that watches for Kiro to become
 * the foreground window. When Kiro is detected in the foreground
 * AND the basket is not empty, all items are pasted into the chat input.
 */
export function startBasketPoller(): void {
  if (pollInterval !== null) return; // already running

  pollInterval = setInterval(() => {
    if (basket.length === 0) return;

    if (isKiroForeground()) {
      console.log("[Basket] Kiro is foreground, flushing...");
      flushBasket();
    }
  }, POLL_INTERVAL_MS);

  console.log("[Basket] Poller started");
}

/**
 * Stops the background poller.
 */
export function stopBasketPoller(): void {
  if (pollInterval !== null) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log("[Basket] Poller stopped");
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/**
 * Pastes all basket items into Kiro's chat input and clears the basket.
 * Assumes Kiro is already the foreground window.
 */
export function flushBasket(): void {
  if (basket.length === 0) return;

  const combined = basket.join("\n\n");
  console.log(`[Basket] Flushing ${basket.length} items (${combined.length} chars) into Kiro`);

  // Write combined text to clipboard
  try {
    const tempFile = join(tmpdir(), `kirocan-basket-${Date.now()}.txt`);
    writeFileSync(tempFile, combined, "utf-8");
    execSync(
      `powershell -NoProfile -Command "Get-Content -Raw '${tempFile.replace(/'/g, "''")}' | Set-Clipboard"`,
      { timeout: 3000 }
    );
    unlinkSync(tempFile);
  } catch (err) {
    console.error("[Basket] Failed to write to clipboard:", err);
    return;
  }

  // Focus chat input (Ctrl+L) then paste (Ctrl+V)
  sendKeyCombo([VK.VK_CONTROL, VK.VK_L]);
  setTimeout(() => {
    sendKeyCombo([VK.VK_CONTROL, VK.VK_V]);
    console.log("[Basket] Paste complete");
  }, 300);

  // Clear the basket
  basket.length = 0;
}
