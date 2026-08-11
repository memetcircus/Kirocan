/**
 * KiroCan Bridge - Shortcut Executor
 *
 * High-level orchestrator combining the Window Manager and Keyboard Simulator.
 * Each exported function activates the Kiro IDE window first, then sends the
 * appropriate keyboard shortcut sequence. Returns an ActionResult indicating
 * success or failure with a descriptive error.
 */

import { findKiroWindow, activateWindow } from "./window-manager.js";
import { sendKeyCombo, sendKey, typeText } from "./keyboard-simulator.js";
import type { ActionResult } from "./types.js";
import { VK } from "./types.js";

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
