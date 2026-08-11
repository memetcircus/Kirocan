/**
 * KiroCan Bridge - Shortcut Executor
 *
 * High-level orchestrator combining the Window Manager and Keyboard Simulator.
 * Each exported function activates the Kiro IDE window first, then sends the
 * appropriate keyboard shortcut sequence. Returns an ActionResult indicating
 * success or failure with a descriptive error.
 */

import koffi from "koffi";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findKiroWindow, activateWindow } from "./window-manager.js";
import { sendKeyCombo, sendKey, typeText } from "./keyboard-simulator.js";
import type { ActionResult } from "./types.js";
import { VK } from "./types.js";

// ---------------------------------------------------------------------------
// Win32 Clipboard Bindings
// ---------------------------------------------------------------------------

const user32Clip = koffi.load("user32.dll");

/** Returns the clipboard sequence number; changes whenever clipboard content changes. */
const GetClipboardSequenceNumber = user32Clip.func(
  "GetClipboardSequenceNumber",
  "uint32",
  []
);

/** Checks whether the clipboard contains data in the specified format. */
const IsClipboardFormatAvailable = user32Clip.func(
  "IsClipboardFormatAvailable",
  "int",
  ["uint32"]
);

// Clipboard format constants
const CF_BITMAP = 2;
const CF_DIB = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sleeps for the specified number of milliseconds using an async timer.
 *
 * @param ms - Milliseconds to wait.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Locates the Kiro IDE window and brings it to the foreground.
 * Encapsulates the repeated find-then-activate pattern used by every executor.
 *
 * @returns An ActionResult with success: true if Kiro is now the foreground window,
 *          or success: false with a descriptive error message.
 */
async function activateKiro(): Promise<ActionResult> {
  const handle = findKiroWindow();
  if (handle === null) {
    return { success: false, error: "Kiro window not found" };
  }

  const activated = await activateWindow(handle);
  if (!activated) {
    return { success: false, error: "Failed to activate Kiro window" };
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a cancel signal (Ctrl+C) to Kiro IDE.
 * Used by the Stop button to interrupt the current agent generation.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeCancel(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_C]);
  return { success: true };
}

/**
 * Types a prompt into the Kiro chat input and submits it by pressing Enter.
 *
 * @param text - The prompt text to type and submit.
 * @returns ActionResult indicating success or failure.
 */
export async function executePrompt(text: string): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  typeText(text);
  sendKey(VK.VK_RETURN);
  return { success: true };
}

/**
 * Types snippet text into the Kiro chat input without pressing Enter.
 * Allows the user to review and compose before manually submitting.
 *
 * @param text - The snippet text to append to the chat input.
 * @returns ActionResult indicating success or failure.
 */
export async function executeSnippet(text: string): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  typeText(text);
  return { success: true };
}

/**
 * Copies the current selection from the active window, then activates Kiro
 * and pastes the copied text into chat, submitting with Enter.
 *
 * The Ctrl+C is sent BEFORE activating Kiro so that the copy happens in
 * the user's currently focused application. A 100ms delay allows the
 * clipboard to populate before switching to Kiro for the paste.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeAsk(): Promise<ActionResult> {
  // Copy selection from the CURRENT foreground window (not Kiro)
  sendKeyCombo([VK.VK_CONTROL, VK.VK_C]);

  // Wait for clipboard to populate
  await sleep(100);

  // Now activate Kiro and paste + submit
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_V]);
  sendKey(VK.VK_RETURN);
  return { success: true };
}

/**
 * Opens Kiro's inline editing mode at the current cursor position (Ctrl+I).
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeInlineChat(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_I]);
  return { success: true };
}

/**
 * Sends terminal output to Kiro chat for analysis (Ctrl+Shift+R).
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeTerminalToChat(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_SHIFT, VK.VK_R]);
  return { success: true };
}

/**
 * Opens a new Kiro session by pressing Ctrl+L followed by Ctrl+T.
 * A 200ms delay between keystrokes ensures the first command completes
 * before the second is dispatched.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeNewSession(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_L]);
  await sleep(200);
  sendKeyCombo([VK.VK_CONTROL, VK.VK_T]);
  return { success: true };
}

/**
 * Navigates to the next Kiro session (Ctrl+Alt+Right).
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeSessionNext(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_MENU, VK.VK_RIGHT]);
  return { success: true };
}

/**
 * Navigates to the previous Kiro session (Ctrl+Alt+Left).
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeSessionPrevious(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_MENU, VK.VK_LEFT]);
  return { success: true };
}

/**
 * Submits the current chat input by pressing Enter without typing text.
 * Used by the "Go!" button after composing snippets.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeGo(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKey(VK.VK_RETURN);
  return { success: true };
}

/**
 * Captures a sequence of full-screen frames using PowerShell and delivers the
 * file paths into the Kiro chat input.
 *
 * Quick mode: 5 frames at 500ms intervals.
 * Long mode: 10 frames at 800ms intervals.
 *
 * @param mode - "quick" (5 frames, 500ms) or "long" (10 frames, 800ms).
 * @returns ActionResult indicating success or failure.
 */
export async function executeScreenRecord(
  mode: "quick" | "long"
): Promise<ActionResult> {
  const frameCount = mode === "quick" ? 5 : 10;
  const intervalMs = mode === "quick" ? 500 : 800;

  // Create a temp directory for captured frames
  const tempDir = mkdtempSync(join(tmpdir(), "kirocan-record-"));
  const capturedPaths: string[] = [];

  try {
    // Capture frames at the specified interval
    for (let i = 0; i < frameCount; i++) {
      const filePath = join(tempDir, `frame_${i}.jpg`);
      const psCommand = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b=New-Object Drawing.Bitmap($s.Width,$s.Height); [Drawing.Graphics]::FromImage($b).CopyFromScreen(0,0,0,0,$b.Size); $b.Save('${filePath.replace(/'/g, "''")}',[Drawing.Imaging.ImageFormat]::Jpeg); $b.Dispose()"`;

      try {
        execSync(psCommand, { timeout: 10000, stdio: "ignore" });
        capturedPaths.push(filePath);
      } catch {
        // Skip failed frame capture and continue
      }

      // Wait between frames (skip wait after last frame)
      if (i < frameCount - 1) {
        await sleep(intervalMs);
      }
    }

    // If ALL frames failed, return an error
    if (capturedPaths.length === 0) {
      return {
        success: false,
        error: "Screen recording failed - all frame captures failed",
      };
    }

    // Activate Kiro window and paste file paths into chat
    const result = await activateKiro();
    if (!result.success) {
      return {
        success: false,
        error: "Kiro window not available after capture",
      };
    }

    // Type each file path into the chat input (one per line)
    const pathsText = capturedPaths.join("\n");
    typeText(pathsText);

    return { success: true };
  } finally {
    // Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Captures a screen region via the Windows Snipping Tool (Win+Shift+S),
 * waits for the user to complete the snip, and pastes the resulting image
 * into the Kiro chat input.
 *
 * Flow:
 *  1. Record current clipboard sequence number.
 *  2. Simulate Win+Shift+S to open Snipping Tool.
 *  3. Poll every 250ms for up to 30 seconds checking for a new image
 *     on the clipboard (CF_BITMAP or CF_DIB).
 *  4. If an image is found: activate Kiro window and paste with Ctrl+V.
 *  5. If timeout: return failure indicating capture was cancelled.
 *  6. If Kiro can't activate after capture: return failure.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeScreenshot(): Promise<ActionResult> {
  // 1. Record the current clipboard sequence number
  const initialSeqNum = GetClipboardSequenceNumber();

  // 2. Simulate Win+Shift+S to invoke the Windows Snipping Tool
  sendKeyCombo([VK.VK_LWIN, VK.VK_SHIFT, VK.VK_S]);

  // 3. Poll clipboard for a new image (up to 30 seconds, every 250ms)
  const POLL_INTERVAL_MS = 250;
  const TIMEOUT_MS = 30_000;
  const maxAttempts = TIMEOUT_MS / POLL_INTERVAL_MS;

  let imageDetected = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const currentSeqNum = GetClipboardSequenceNumber();
    if (currentSeqNum !== initialSeqNum) {
      // Clipboard content changed — check if it contains an image
      const hasBitmap = IsClipboardFormatAvailable(CF_BITMAP) !== 0;
      const hasDib = IsClipboardFormatAvailable(CF_DIB) !== 0;

      if (hasBitmap || hasDib) {
        imageDetected = true;
        break;
      }
    }
  }

  if (!imageDetected) {
    return {
      success: false,
      error: "Screenshot capture cancelled or timed out",
    };
  }

  // 4. Activate Kiro window and paste
  const result = await activateKiro();
  if (!result.success) {
    return { success: false, error: "Kiro window not available" };
  }

  sendKeyCombo([VK.VK_CONTROL, VK.VK_V]);
  return { success: true };
}
