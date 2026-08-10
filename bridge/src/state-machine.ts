/**
 * KiroCan Bridge - State Machine
 *
 * Manages the bridge's working/idle state transitions with support for:
 * - Suppression window: 2-second period after cancel during which hook events are discarded
 * - Working timeout: 2-minute auto-transition to idle if no idle hook is received
 *
 * State transitions:
 * - idle -> working: triggered by setState("working") when not suppressed
 * - working -> idle: triggered by setState("idle") when not suppressed, or by 2-minute timeout
 * - Cancel: triggers suppression window (2s), forces state to idle
 * - During suppression: all setState calls are no-ops
 */

import type { BridgeInternalState } from "./types.js";

/** Duration of the suppression window in milliseconds. */
const SUPPRESSION_DURATION_MS = 2000;

/** Duration of the working state timeout in milliseconds (2 minutes). */
const WORKING_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Manages bridge state transitions between "working" and "idle",
 * including suppression window logic and automatic working timeout.
 */
export class StateMachine {
  private _state: BridgeInternalState;
  private _suppressionTimeoutHandle: NodeJS.Timeout | null = null;

  constructor() {
    this._state = {
      agentState: "idle",
      contextPercentage: 0,
      healthLevel: "normal",
      suppressionActive: false,
      suppressionExpiry: null,
      workingTimeoutHandle: null,
    };
  }

  /**
   * Returns the current agent state.
   */
  getState(): "working" | "idle" {
    return this._state.agentState;
  }

  /**
   * Attempts to update the agent state. If the suppression window is
   * currently active, the call is a no-op and the state remains unchanged.
   *
   * When transitioning to "working", a 2-minute timeout is started that
   * will auto-transition the state back to "idle" if no idle event arrives.
   *
   * When transitioning to "idle", any active working timeout is cleared.
   *
   * @param newState - The desired new state ("working" or "idle").
   */
  setState(newState: "working" | "idle"): void {
    if (this._state.suppressionActive) {
      return;
    }

    this._state.agentState = newState;

    if (newState === "working") {
      this._startWorkingTimeout();
    } else {
      this._clearWorkingTimeout();
    }
  }

  /**
   * Activates the 2-second suppression window and forces the state to "idle".
   * Used when a cancel action is performed to discard stale hook events.
   *
   * Any active working timeout is cleared since the state is forced to idle.
   * A 2-second timer is started to automatically deactivate suppression.
   */
  enterSuppressionWindow(): void {
    // Clear any existing suppression timer
    this._clearSuppressionTimeout();

    this._state.suppressionActive = true;
    this._state.suppressionExpiry = Date.now() + SUPPRESSION_DURATION_MS;
    this._state.agentState = "idle";
    this._clearWorkingTimeout();

    // Start timer to deactivate suppression after 2 seconds
    this._suppressionTimeoutHandle = setTimeout(() => {
      this._suppressionTimeoutHandle = null;
      this._state.suppressionActive = false;
      this._state.suppressionExpiry = null;
    }, SUPPRESSION_DURATION_MS);
  }

  /**
   * Checks whether the suppression window is currently active.
   *
   * @returns `true` if hook events should be discarded, `false` otherwise.
   */
  isInSuppressionWindow(): boolean {
    return this._state.suppressionActive;
  }

  /**
   * Cleans up all timers. Call this when shutting down the bridge.
   */
  dispose(): void {
    this._clearWorkingTimeout();
    this._clearSuppressionTimeout();
    this._state.suppressionActive = false;
    this._state.suppressionExpiry = null;
  }

  /**
   * Starts the 2-minute working timeout. If the state is still "working"
   * when the timeout fires, it auto-transitions to "idle".
   */
  private _startWorkingTimeout(): void {
    this._clearWorkingTimeout();
    this._state.workingTimeoutHandle = setTimeout(() => {
      this._state.workingTimeoutHandle = null;
      if (this._state.agentState === "working") {
        this._state.agentState = "idle";
      }
    }, WORKING_TIMEOUT_MS);
  }

  /**
   * Clears the working state timeout if one is active.
   */
  private _clearWorkingTimeout(): void {
    if (this._state.workingTimeoutHandle !== null) {
      clearTimeout(this._state.workingTimeoutHandle);
      this._state.workingTimeoutHandle = null;
    }
  }

  /**
   * Clears the suppression window timeout if one is active.
   */
  private _clearSuppressionTimeout(): void {
    if (this._suppressionTimeoutHandle !== null) {
      clearTimeout(this._suppressionTimeoutHandle);
      this._suppressionTimeoutHandle = null;
    }
  }
}
