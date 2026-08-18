/**
 * KiroCan Bridge - Keyboard Simulator
 *
 * Simulates keyboard input using PowerShell and WScript.Shell SendKeys.
 * No native addons required — all OS interaction via child_process exec.
 *
 * For text typing, uses clipboard-based paste (Set-Clipboard + Ctrl+V)
 * which is more reliable than SendKeys for arbitrary Unicode text.
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { VK } from "./types.js";

// ---------------------------------------------------------------------------
// PowerShell SendKeys Mapping
// ---------------------------------------------------------------------------

/**
 * Converts a VK array to WScript.Shell SendKeys format.
 * Returns null if conversion is not possible for the given combination.
 */
function vkArrayToSendKeys(keys: number[]): string | null {
  let prefix = "";
  let mainKey = "";

  for (const key of keys) {
    switch (key) {
      case VK.VK_CONTROL: prefix += "^"; break;
      case VK.VK_SHIFT: prefix += "+"; break;
      case VK.VK_MENU: prefix += "%"; break;
      case 0x5b: return null; // VK_LWIN - SendKeys can't do Win key
      case 0x5c: return null; // VK_RWIN - SendKeys can't do Win key
      case VK.VK_RETURN: mainKey = "{ENTER}"; break;
      case VK.VK_ESCAPE: mainKey = "{ESC}"; break;
      case VK.VK_TAB: mainKey = "{TAB}"; break;
      case VK.VK_BACK: mainKey = "{BACKSPACE}"; break;
      case VK.VK_DELETE: mainKey = "{DELETE}"; break;
      case VK.VK_LEFT: mainKey = "{LEFT}"; break;
      case VK.VK_RIGHT: mainKey = "{RIGHT}"; break;
      case VK.VK_UP: mainKey = "{UP}"; break;
      case VK.VK_DOWN: mainKey = "{DOWN}"; break;
      case VK.VK_HOME: mainKey = "{HOME}"; break;
      case VK.VK_END: mainKey = "{END}"; break;
      case VK.VK_SPACE: mainKey = " "; break;
      case VK.VK_F1: mainKey = "{F1}"; break;
      case VK.VK_F2: mainKey = "{F2}"; break;
      case VK.VK_F3: mainKey = "{F3}"; break;
      case VK.VK_F4: mainKey = "{F4}"; break;
      case VK.VK_F5: mainKey = "{F5}"; break;
      case VK.VK_F6: mainKey = "{F6}"; break;
      case VK.VK_F7: mainKey = "{F7}"; break;
      case VK.VK_F8: mainKey = "{F8}"; break;
      case VK.VK_F9: mainKey = "{F9}"; break;
      case VK.VK_F10: mainKey = "{F10}"; break;
      case VK.VK_F11: mainKey = "{F11}"; break;
      case VK.VK_F12: mainKey = "{F12}"; break;
      default:
        // A-Z keys: VK codes 0x41-0x5A map to lowercase letters
        if (key >= 0x41 && key <= 0x5A) {
          mainKey = String.fromCharCode(key + 32); // lowercase
        }
        // 0-9 keys
        else if (key >= 0x30 && key <= 0x39) {
          mainKey = String.fromCharCode(key);
        }
        else {
          return null; // Can't convert
        }
    }
  }

  if (!mainKey) return null;
  return prefix + mainKey;
}

/**
 * Executes a SendKeys command via PowerShell/WScript.Shell.
 * This is the core primitive for all keyboard simulation.
 */
function executeSendKeys(sendKeysStr: string): void {
  // Escape single quotes for PowerShell string
  const escaped = sendKeysStr.replace(/'/g, "''");
  execSync(
    `powershell -NoProfile -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${escaped}')"`,
    { timeout: 5000, stdio: "ignore" }
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a key combination by translating VK codes to SendKeys format.
 *
 * For example, `sendKeyCombo([VK.VK_CONTROL, VK.VK_C])` sends "^c" (Ctrl+C).
 *
 * @param keys - Array of virtual-key codes to press as a combination.
 */
export function sendKeyCombo(keys: number[]): void {
  if (keys.length === 0) return;

  const sendKeysStr = vkArrayToSendKeys(keys);
  if (sendKeysStr) {
    try {
      executeSendKeys(sendKeysStr);
      return;
    } catch (e) {
      console.error("[KeySim] SendKeys failed:", e);
    }
  }

  // For key combos that SendKeys can't handle (e.g., Win key),
  // use Add-Type with System.Windows.Forms.SendKeys as fallback
  const formsStr = vkArrayToFormsKeys(keys);
  if (formsStr) {
    try {
      execSync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${formsStr.replace(/'/g, "''")}')"`,
        { timeout: 5000, stdio: "ignore" }
      );
    } catch (e) {
      console.error("[KeySim] Forms.SendKeys also failed:", e);
    }
  }
}

/**
 * Converts VK array to System.Windows.Forms.SendKeys format.
 * Similar to WScript but with slightly different escaping.
 */
function vkArrayToFormsKeys(keys: number[]): string | null {
  // Same mapping as vkArrayToSendKeys — Forms.SendKeys uses same syntax
  return vkArrayToSendKeys(keys);
}

/**
 * Types a string of text using WScript.Shell SendKeys.
 * For simple ASCII text this works directly. For special characters,
 * falls back to clipboard paste.
 *
 * @param text - The text string to type.
 */
export function typeText(text: string): void {
  if (!text || text.length === 0) return;

  // Escape special SendKeys characters: +^%~(){}[]
  const escaped = text.replace(/([+^%~(){}[\]])/g, "{$1}");
  
  try {
    const psEscaped = escaped.replace(/'/g, "''");
    execSync(
      `powershell -NoProfile -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${psEscaped}')"`,
      { timeout: 5000, stdio: "ignore" }
    );
  } catch {
    // Fallback: clipboard paste
    const tempFile = join(tmpdir(), `kirocan-type-${Date.now()}.txt`);
    try {
      writeFileSync(tempFile, text, "utf-8");
      execSync(
        `powershell -NoProfile -Command "Get-Content -Raw '${tempFile.replace(/'/g, "''")}' | Set-Clipboard"`,
        { timeout: 3000, stdio: "ignore" }
      );
      executeSendKeys("^v");
    } finally {
      try { unlinkSync(tempFile); } catch { /* best effort */ }
    }
  }
}

/**
 * Sends a single key press.
 *
 * @param key - The virtual-key code to send.
 */
export function sendKey(key: number): void {
  sendKeyCombo([key]);
}

/**
 * Presses a key down without releasing it.
 * Note: SendKeys doesn't support held keys natively.
 * This is implemented as a regular key press for compatibility.
 *
 * @param key - The virtual-key code to press down.
 */
export function pressKey(key: number): void {
  sendKey(key);
}

/**
 * Releases a key. No-op in SendKeys mode since SendKeys always does
 * press+release atomically. Kept for API compatibility.
 *
 * @param key - The virtual-key code to release.
 */
export function releaseKey(key: number): void {
  // No-op: SendKeys handles press+release atomically
}
