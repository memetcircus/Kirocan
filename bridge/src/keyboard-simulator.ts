/**
 * KiroCan Bridge - Keyboard Simulator
 *
 * Wraps the Win32 SendInput API via koffi to simulate keyboard events.
 * Provides functions for key combos, individual key presses/releases,
 * and text typing using VkKeyScanW for character-to-virtual-key mapping.
 */

import koffi from "koffi";
import { VK } from "./types.js";

// ---------------------------------------------------------------------------
// Win32 Constants
// ---------------------------------------------------------------------------

/** INPUT struct type value for keyboard events. */
const INPUT_KEYBOARD = 1;

/** dwFlags value for a key-up event. */
const KEYEVENTF_KEYUP = 0x0002;

/** dwFlags value for a key-down event (no flags). */
const KEYEVENTF_KEYDOWN = 0;

/**
 * Size of the INPUT structure on 64-bit Windows.
 * Layout: type (DWORD, 4 bytes) + 4 bytes padding + KEYBDINPUT (24 bytes) = 32 bytes.
 * On 32-bit it would be 28 bytes, but we target x64.
 */
const INPUT_STRUCT_SIZE = 40;

// ---------------------------------------------------------------------------
// Win32 FFI Bindings
// ---------------------------------------------------------------------------

const user32 = koffi.load("user32.dll");

/**
 * SendInput: Synthesizes keystrokes, mouse motions, and button clicks.
 *
 * UINT SendInput(UINT nInputs, LPINPUT pInputs, int cbSize)
 *
 * We pass a raw buffer for pInputs since we manually pack the INPUT struct.
 */
const SendInput = user32.func("SendInput", "uint32", [
  "uint32", // nInputs
  "void *", // pInputs (pointer to array of INPUT structs)
  "int", // cbSize (size of one INPUT struct)
]);

/**
 * VkKeyScanW: Translates a character to the corresponding virtual-key code
 * and shift state for the current keyboard layout.
 *
 * Returns a SHORT where:
 *   - Low byte: virtual-key code
 *   - High byte: shift state (bit 0 = Shift, bit 1 = Ctrl, bit 2 = Alt)
 */
const VkKeyScanW = user32.func("VkKeyScanW", "int16", ["uint16"]);

// ---------------------------------------------------------------------------
// INPUT Structure Packing
// ---------------------------------------------------------------------------

/**
 * Packs a KEYBDINPUT event into a raw Buffer representing a single INPUT struct.
 *
 * 64-bit INPUT struct layout (40 bytes total):
 *   Offset 0:  type      (DWORD, 4 bytes) = INPUT_KEYBOARD (1)
 *   Offset 4:  padding   (4 bytes, alignment for the union)
 *   Offset 8:  wVk       (WORD, 2 bytes)
 *   Offset 10: wScan     (WORD, 2 bytes)
 *   Offset 12: dwFlags   (DWORD, 4 bytes)
 *   Offset 16: time      (DWORD, 4 bytes)
 *   Offset 20: padding   (4 bytes, alignment for pointer)
 *   Offset 24: dwExtraInfo (ULONG_PTR, 8 bytes on x64)
 *   Offset 32: padding   (8 bytes to fill union size)
 *
 * @param vk - Virtual-key code.
 * @param flags - dwFlags (0 for key down, KEYEVENTF_KEYUP for key up).
 * @returns A Buffer representing one INPUT struct.
 */
function packKeyInput(vk: number, flags: number): Buffer {
  const buf = Buffer.alloc(INPUT_STRUCT_SIZE);

  // type = INPUT_KEYBOARD
  buf.writeUInt32LE(INPUT_KEYBOARD, 0);
  // (4 bytes padding at offset 4 is already zeroed)

  // KEYBDINPUT fields
  buf.writeUInt16LE(vk & 0xff, 8); // wVk
  buf.writeUInt16LE(0, 10); // wScan (not used for VK-based input)
  buf.writeUInt32LE(flags, 12); // dwFlags
  buf.writeUInt32LE(0, 16); // time (system will fill)
  // dwExtraInfo at offset 24, left as 0

  return buf;
}

/**
 * Packs multiple INPUT structs into a single contiguous buffer and calls SendInput.
 *
 * @param inputs - Array of packed INPUT buffers.
 */
function sendInputs(inputs: Buffer[]): void {
  if (inputs.length === 0) return;

  const combined = Buffer.concat(inputs);
  SendInput(inputs.length, combined, INPUT_STRUCT_SIZE);
}

// ---------------------------------------------------------------------------
// Sleep Utility
// ---------------------------------------------------------------------------

/**
 * Synchronous sleep using Atomics.wait for short, precise delays.
 * This avoids async overhead for the small inter-character delays needed
 * during text typing.
 *
 * @param ms - Milliseconds to sleep.
 */
function sleepSync(ms: number): void {
  if (ms <= 0) return;
  const sab = new SharedArrayBuffer(4);
  const view = new Int32Array(sab);
  Atomics.wait(view, 0, 0, ms);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a key combination by pressing all keys in order, then releasing in
 * reverse order.
 *
 * For example, `sendKeyCombo([VK.VK_CONTROL, VK.VK_C])` produces:
 *   Ctrl down → C down → C up → Ctrl up
 *
 * @param keys - Array of virtual-key codes to press as a combination.
 */
export function sendKeyCombo(keys: number[]): void {
  if (keys.length === 0) return;

  // Try PowerShell SendKeys first (reliable on ARM64)
  const sendKeysStr = vkArrayToSendKeys(keys);
  if (sendKeysStr) {
    try {
      const { execSync } = require("node:child_process");
      execSync(
        `powershell -NoProfile -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${sendKeysStr}')"`,
        { timeout: 3000 }
      );
      return;
    } catch {
      // Fall through to koffi
    }
  }

  // Fallback: koffi SendInput
  const inputs: Buffer[] = [];

  // Press all keys in order (key down)
  for (const key of keys) {
    inputs.push(packKeyInput(key, KEYEVENTF_KEYDOWN));
  }

  // Release all keys in reverse order (key up)
  for (let i = keys.length - 1; i >= 0; i--) {
    inputs.push(packKeyInput(keys[i], KEYEVENTF_KEYUP));
  }

  sendInputs(inputs);
}

/**
 * Converts VK array to WScript.Shell SendKeys format.
 * Returns null if conversion is not possible.
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
      case VK.VK_F1: mainKey = "{F1}"; break;
      case VK.VK_F2: mainKey = "{F2}"; break;
      case VK.VK_F3: mainKey = "{F3}"; break;
      case VK.VK_F4: mainKey = "{F4}"; break;
      case VK.VK_F5: mainKey = "{F5}"; break;
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
 * Types a string of text by simulating key presses for each character.
 *
 * Uses VkKeyScanW to convert each character to its virtual-key code.
 * Automatically handles Shift for uppercase or shifted characters.
 * Inserts a 1ms delay between characters for reliable input.
 *
 * @param text - The text string to type.
 */
export function typeText(text: string): void {
  for (const char of text) {
    const charCode = char.charCodeAt(0);
    const scanResult = VkKeyScanW(charCode);

    // VkKeyScanW returns -1 if the character cannot be mapped
    if (scanResult === -1) continue;

    const vk = scanResult & 0xff;
    const shiftState = (scanResult >> 8) & 0xff;

    const needShift = (shiftState & 0x01) !== 0;
    const needCtrl = (shiftState & 0x02) !== 0;
    const needAlt = (shiftState & 0x04) !== 0;

    const inputs: Buffer[] = [];

    // Press modifier keys
    if (needShift) inputs.push(packKeyInput(VK.VK_SHIFT, KEYEVENTF_KEYDOWN));
    if (needCtrl) inputs.push(packKeyInput(VK.VK_CONTROL, KEYEVENTF_KEYDOWN));
    if (needAlt) inputs.push(packKeyInput(VK.VK_MENU, KEYEVENTF_KEYDOWN));

    // Press and release the character key
    inputs.push(packKeyInput(vk, KEYEVENTF_KEYDOWN));
    inputs.push(packKeyInput(vk, KEYEVENTF_KEYUP));

    // Release modifier keys in reverse
    if (needAlt) inputs.push(packKeyInput(VK.VK_MENU, KEYEVENTF_KEYUP));
    if (needCtrl) inputs.push(packKeyInput(VK.VK_CONTROL, KEYEVENTF_KEYUP));
    if (needShift) inputs.push(packKeyInput(VK.VK_SHIFT, KEYEVENTF_KEYUP));

    sendInputs(inputs);

    // Small delay between characters for reliable input delivery
    sleepSync(1);
  }
}

/**
 * Sends a single key press (key down followed immediately by key up).
 *
 * @param key - The virtual-key code to send.
 */
export function sendKey(key: number): void {
  const inputs: Buffer[] = [
    packKeyInput(key, KEYEVENTF_KEYDOWN),
    packKeyInput(key, KEYEVENTF_KEYUP),
  ];
  sendInputs(inputs);
}

/**
 * Presses a key down without releasing it.
 * Use {@link releaseKey} to release the key afterwards.
 *
 * @param key - The virtual-key code to press down.
 */
export function pressKey(key: number): void {
  sendInputs([packKeyInput(key, KEYEVENTF_KEYDOWN)]);
}

/**
 * Releases a key that was previously pressed down with {@link pressKey}.
 *
 * @param key - The virtual-key code to release.
 */
export function releaseKey(key: number): void {
  sendInputs([packKeyInput(key, KEYEVENTF_KEYUP)]);
}
