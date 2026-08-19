/**
 * KiroCan Bridge - Shortcut Executor
 *
 * High-level orchestrator combining the Window Manager and Keyboard Simulator.
 * Each exported function activates the Kiro IDE window first, then sends the
 * appropriate keyboard shortcut sequence. Returns an ActionResult indicating
 * success or failure with a descriptive error.
 */

import { execSync } from "node:child_process";
import koffi from "koffi";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { findKiroWindow, activateWindow } from "./window-manager.js";
import { sendKeyCombo, sendKey, typeText } from "./keyboard-simulator.js";
import { addToBasket } from "./clipboard-basket.js";
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

  // Escape stops the current Kiro generation
  sendKeyCombo([VK.VK_ESCAPE]);
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
  // Try to activate Kiro but continue even if it fails
  // (Kiro may already be foreground when button is pressed from console)
  await activateKiro();

  typeText(text);
  return { success: true };
}

/**
 * Adds the current clipboard content to the basket queue.
 * Does NOT switch focus — user stays in their current app.
 * Items are auto-pasted into Kiro when it becomes the foreground window.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeAsk(): Promise<ActionResult> {
  const count = addToBasket();
  if (count === -1) {
    return { success: false, error: "Clipboard is empty — copy some text first" };
  }
  return { success: true };
}

/**
 * Opens Kiro chat with the currently selected code as context (Ctrl+L).
 * In Kiro 1.0, inline chat was replaced by "Ask Kiro" — selecting code
 * and pressing Ctrl+L sends it to the chat panel as context.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeInlineChat(): Promise<ActionResult> {
  const result = await activateKiro();
  if (!result.success) return result;

  sendKeyCombo([VK.VK_CONTROL, VK.VK_L]);
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
 * Saves all open files in Kiro (Ctrl+K S).
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeSaveAll(): Promise<ActionResult> {
  await activateKiro();

  // Ctrl+Shift+S = Save All in VS Code / Kiro
  sendKeyCombo([VK.VK_CONTROL, VK.VK_SHIFT, VK.VK_S]);
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
    // 1. Show confirmation dialog — recording starts when user clicks OK
    try {
      execSync(
        'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show(\'Screen recording will start when you click OK. 5 frames at 500ms intervals.\', \'KiroCan Screen Record\', \'OK\', \'Information\')"',
        { timeout: 30000 }
      );
    } catch {
      return { success: false, error: "Screen record cancelled" };
    }

    // 2. Capture frames at the specified interval
    for (let i = 0; i < frameCount; i++) {
      const filePath = join(tempDir, `frame_${i}.png`);
      const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $s=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $b=New-Object Drawing.Bitmap($s.Width,$s.Height); [Drawing.Graphics]::FromImage($b).CopyFromScreen(0,0,0,0,$b.Size); $b.Save('${filePath.replace(/'/g, "''")}','Png'); $b.Dispose()"`;

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

    // 3. Activate Kiro and focus chat input
    sendKeyCombo([VK.VK_MENU]); // Alt trick for foreground lock
    await sleep(50);

    const result = await activateKiro();
    if (!result.success) {
      return { success: false, error: "Kiro window not available after capture" };
    }

    sendKeyCombo([VK.VK_CONTROL, VK.VK_L]);
    await sleep(300);

    // 4. Paste each frame as an image into chat
    for (const framePath of capturedPaths) {
      // Copy image to clipboard
      const copyCmd = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms,System.Drawing; $img = [System.Drawing.Image]::FromFile('${framePath.replace(/'/g, "''")}'); [System.Windows.Forms.Clipboard]::SetImage($img); $img.Dispose()"`;
      try {
        execSync(copyCmd, { timeout: 5000, stdio: "ignore" });
      } catch {
        continue;
      }

      // Paste into chat (Ctrl+V)
      sendKeyCombo([VK.VK_CONTROL, VK.VK_V]);
      await sleep(500); // Wait for Kiro to process the image
    }

    return { success: true };
  } finally {
    // 5. Clean up temp directory
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup
    }
  }
}

/**
 * Reads the current text from the Kiro chat input, wraps it in a meta-prompt
 * asking Kiro to restructure it, clears the input, pastes the meta-prompt,
 * and submits.
 *
 * Flow:
 *  1. Activate Kiro window (chat input should be focused).
 *  2. Select all text in the chat input (Ctrl+A).
 *  3. Copy it to clipboard (Ctrl+C).
 *  4. Read clipboard text via PowerShell Get-Clipboard.
 *  5. If clipboard is empty, return error.
 *  6. Construct a meta-prompt wrapping the original text.
 *  7. Write the meta-prompt to clipboard via PowerShell Set-Clipboard.
 *  8. Select all again (to replace existing text) and paste (Ctrl+V).
 *  9. Submit with Enter.
 *
 * @returns ActionResult indicating success or failure.
 */
export async function executeStructPrompt(): Promise<ActionResult> {
  // 1. Activate Kiro window
  const result = await activateKiro();
  if (!result.success) return result;

  // 2. Focus chat input
  sendKeyCombo([VK.VK_CONTROL, VK.VK_L]);
  await sleep(150);

  // 3. Clear clipboard first so we can detect if chat input had text
  try {
    execSync(
      'powershell -NoProfile -Command "Set-Clipboard -Value $null"',
      { timeout: 2000, stdio: "ignore" }
    );
  } catch { /* non-fatal */ }

  // 4. Select all text in chat input
  sendKeyCombo([VK.VK_CONTROL, VK.VK_A]);
  await sleep(50);

  // 5. Copy to clipboard
  sendKeyCombo([VK.VK_CONTROL, VK.VK_C]);
  await sleep(200);

  // 6. Read clipboard text
  let originalText: string;
  try {
    originalText = execSync(
      'powershell -NoProfile -Command "Get-Clipboard"',
      { timeout: 3000, encoding: "utf-8" }
    ).trim();
  } catch {
    return { success: false, error: "Failed to read clipboard" };
  }

  // 7. If empty, nothing to restructure
  if (!originalText || originalText.length === 0) {
    return { success: false, error: "Chat input is empty — nothing to restructure" };
  }

  // 6. Construct the meta-prompt
  const metaPrompt =
    `Restructure the following messy prompt into a well-structured, clear prompt. ` +
    `Organize it with proper sections (Goal, Context, Constraints) where applicable. ` +
    `Output ONLY the restructured prompt text, nothing else — no explanation, no markdown fences:\n\n` +
    originalText;

  // 7. Write meta-prompt to clipboard
  try {
    // Write to a temp file to avoid quoting issues, then pipe to Set-Clipboard
    const tempFile = join(tmpdir(), `kirocan-struct-${Date.now()}.txt`);
    require("node:fs").writeFileSync(tempFile, metaPrompt, "utf-8");
    execSync(
      `powershell -NoProfile -Command "Get-Content -Raw '${tempFile.replace(/'/g, "''")}' | Set-Clipboard"`,
      { timeout: 3000 }
    );
    require("node:fs").unlinkSync(tempFile);
  } catch {
    return { success: false, error: "Failed to write meta-prompt to clipboard" };
  }

  // 8. Select all (to replace) and paste the meta-prompt
  sendKeyCombo([VK.VK_CONTROL, VK.VK_A]);
  await sleep(50);
  sendKeyCombo([VK.VK_CONTROL, VK.VK_V]);
  await sleep(100);

  // 9. Submit
  sendKey(VK.VK_RETURN);
  return { success: true };
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

  // 2. Launch Snipping Tool
  try {
    execSync(
      'powershell -NoProfile -Command "Start-Process ms-screenclip:"',
      { timeout: 3000, stdio: "ignore" }
    );
  } catch {
    sendKeyCombo([VK.VK_LWIN, VK.VK_SHIFT, VK.VK_S]);
  }

  // 3. Poll clipboard for a new image (up to 30 seconds, every 250ms)
  const POLL_INTERVAL_MS = 250;
  const TIMEOUT_MS = 30_000;
  const maxAttempts = TIMEOUT_MS / POLL_INTERVAL_MS;

  let imageDetected = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const currentSeqNum = GetClipboardSequenceNumber();
    if (currentSeqNum !== initialSeqNum) {
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
