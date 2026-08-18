/**
 * KiroCan Bridge - Window Manager
 *
 * Handles window enumeration, activation, and foreground management
 * using PowerShell commands. No native addons required — all OS
 * interaction via child_process exec.
 */

import { execSync } from "node:child_process";
import type { WindowHandle } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default timeout (ms) for waiting on foreground activation. */
const DEFAULT_FOREGROUND_TIMEOUT_MS = 2000;

/** Polling interval (ms) for foreground check loop. */
const FOREGROUND_POLL_INTERVAL_MS = 100;

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

/**
 * Sleeps for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs a PowerShell command and returns trimmed stdout.
 * Returns null on any failure.
 */
function psExec(command: string, timeoutMs: number = 5000): string | null {
  try {
    return execSync(
      `powershell -NoProfile -Command "${command.replace(/"/g, '\\"')}"`,
      { encoding: "utf8", timeout: timeoutMs, stdio: ["pipe", "pipe", "ignore"] }
    ).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Finds the Kiro IDE window by querying the Kiro process for its main window handle.
 *
 * @returns The window handle of the Kiro IDE window, or null if not found.
 */
export function findKiroWindow(): WindowHandle | null {
  const result = psExec(
    "(Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle"
  );

  if (result && result !== "0" && result !== "") {
    const hwnd = parseInt(result, 10);
    if (!isNaN(hwnd) && hwnd !== 0) {
      return hwnd as WindowHandle;
    }
  }

  return null;
}

/**
 * Activates a window by bringing it to the foreground using WScript.Shell.AppActivate.
 * If the window is minimized, restores it first via PowerShell.
 *
 * @param handle - The Win32 window handle to activate (used to find the process).
 * @returns true if the window was successfully activated.
 */
export async function activateWindow(handle: WindowHandle): Promise<boolean> {
  // Only restore if minimized (IsIconic), then activate via AppActivate
  const script = `
    $proc = Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1;
    if ($proc) {
      $sig = '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd);';
      $type = Add-Type -MemberDefinition $sig -Name ShowWindowAPI -Namespace Win32 -PassThru -ErrorAction SilentlyContinue;
      if ($type::IsIconic($proc.MainWindowHandle)) { $type::ShowWindow($proc.MainWindowHandle, 9) };
      $wsh = New-Object -ComObject WScript.Shell;
      $wsh.AppActivate($proc.Id);
      Write-Output 'ok';
    }
  `.replace(/\n/g, " ");

  const result = psExec(script, 5000);
  if (result && result.includes("ok")) {
    // Give window time to come to foreground
    await sleep(150);
    return true;
  }

  return false;
}

/**
 * Checks whether the Kiro process owns the current foreground window.
 * Uses WScript.Shell AppActivate in test mode — returns true if Kiro would be activatable.
 * This avoids Add-Type C# compilation which crashes on repeated invocations.
 *
 * @returns true if Kiro is in the foreground.
 */
export function isKiroForeground(): boolean {
  try {
    const result = execSync(
      'powershell -NoProfile -Command "$k=Get-Process Kiro -EA 0|?{$_.MainWindowHandle -ne 0}|Select -First 1;if($k){$w=New-Object -ComObject WScript.Shell;if($w.AppActivate($k.Id)){echo yes}}"',
      { encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "ignore"] }
    ).trim();
    return result === "yes";
  } catch {
    return false;
  }
}

/**
 * Checks whether the specified window is currently the foreground window.
 *
 * @param handle - The Win32 window handle to check.
 * @returns true if the window is in the foreground.
 */
export function isForeground(handle: WindowHandle): boolean {
  return isKiroForeground();
}

/**
 * Waits for Kiro to achieve foreground status by polling.
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
    if (isKiroForeground()) return true;
    await sleep(FOREGROUND_POLL_INTERVAL_MS);
  }

  return isKiroForeground();
}

/**
 * Checks whether the Kiro window is minimized.
 *
 * @param handle - The Win32 window handle to check.
 * @returns true if the window is minimized.
 */
export function isWindowMinimized(handle: WindowHandle): boolean {
  const result = psExec(
    "(Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle | ForEach-Object { Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class WC { [DllImport(\"user32.dll\")] public static extern bool IsIconic(IntPtr hWnd); }' -Language CSharp -ErrorAction SilentlyContinue; [WC]::IsIconic([IntPtr]$_) }"
  );
  return result === "True";
}

/**
 * Restores a minimized Kiro window.
 *
 * @param handle - The Win32 window handle to restore.
 */
export function restoreWindow(handle: WindowHandle): void {
  psExec(
    `$proc = Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1; if ($proc) { $sig = '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'; $type = Add-Type -MemberDefinition $sig -Name SW -Namespace Win32Restore -PassThru; $type::ShowWindow($proc.MainWindowHandle, 9) }`
  );
}

/**
 * Checks whether the specified window handle is still valid.
 *
 * @param handle - The Win32 window handle to validate.
 * @returns true if the window handle is valid (Kiro process exists with a window).
 */
export function isValidWindow(handle: WindowHandle): boolean {
  const result = psExec(
    "(Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Measure-Object).Count"
  );
  return result !== null && parseInt(result, 10) > 0;
}

/**
 * Retrieves the title bar text of the Kiro window.
 *
 * @param handle - The Win32 window handle.
 * @returns The window title string, or empty string if not available.
 */
export function getWindowTitle(handle: WindowHandle): string {
  const result = psExec(
    "(Get-Process Kiro -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowTitle"
  );
  return result ?? "";
}
