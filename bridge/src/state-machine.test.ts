/**
 * KiroCan Bridge - State Machine Unit Tests
 *
 * Tests for state transitions, suppression window, and working timeout.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StateMachine } from "./state-machine.js";

describe("StateMachine", () => {
  let sm: StateMachine;

  beforeEach(() => {
    vi.useFakeTimers();
    sm = new StateMachine();
  });

  afterEach(() => {
    sm.dispose();
    vi.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe("initial state", () => {
    it("starts in idle state", () => {
      expect(sm.getState()).toBe("idle");
    });

    it("suppression window is not active initially", () => {
      expect(sm.isInSuppressionWindow()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setState (outside suppression)
  // -------------------------------------------------------------------------

  describe("setState", () => {
    it("transitions from idle to working", () => {
      sm.setState("working");
      expect(sm.getState()).toBe("working");
    });

    it("transitions from working to idle", () => {
      sm.setState("working");
      sm.setState("idle");
      expect(sm.getState()).toBe("idle");
    });

    it("is idempotent when setting same state", () => {
      sm.setState("working");
      sm.setState("working");
      expect(sm.getState()).toBe("working");
    });

    it("setting idle when already idle is a no-op", () => {
      sm.setState("idle");
      expect(sm.getState()).toBe("idle");
    });
  });

  // -------------------------------------------------------------------------
  // Working timeout (2 minutes)
  // -------------------------------------------------------------------------

  describe("working timeout", () => {
    it("auto-transitions to idle after 2 minutes in working state", () => {
      sm.setState("working");
      expect(sm.getState()).toBe("working");

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(sm.getState()).toBe("idle");
    });

    it("does not auto-transition if state was set to idle before timeout", () => {
      sm.setState("working");
      sm.setState("idle");

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(sm.getState()).toBe("idle");
    });

    it("resets timeout when setState working is called again", () => {
      sm.setState("working");

      // Advance 90 seconds (less than 2 min)
      vi.advanceTimersByTime(90_000);
      expect(sm.getState()).toBe("working");

      // Set working again — should reset the timeout
      sm.setState("working");

      // Advance another 90 seconds — 90s from the reset, still less than 2 min
      vi.advanceTimersByTime(90_000);
      expect(sm.getState()).toBe("working");

      // Now advance another 30s to pass the full 2 min from the reset
      vi.advanceTimersByTime(30_000);
      expect(sm.getState()).toBe("idle");
    });

    it("does not fire timeout when state is idle", () => {
      sm.setState("idle");
      vi.advanceTimersByTime(3 * 60 * 1000);
      expect(sm.getState()).toBe("idle");
    });
  });

  // -------------------------------------------------------------------------
  // Suppression window
  // -------------------------------------------------------------------------

  describe("suppression window", () => {
    it("forces state to idle when entered", () => {
      sm.setState("working");
      sm.enterSuppressionWindow();
      expect(sm.getState()).toBe("idle");
    });

    it("activates suppression flag", () => {
      sm.enterSuppressionWindow();
      expect(sm.isInSuppressionWindow()).toBe(true);
    });

    it("makes setState a no-op during suppression", () => {
      sm.enterSuppressionWindow();
      sm.setState("working");
      expect(sm.getState()).toBe("idle");
    });

    it("deactivates after 2 seconds", () => {
      sm.enterSuppressionWindow();
      expect(sm.isInSuppressionWindow()).toBe(true);

      vi.advanceTimersByTime(2000);
      expect(sm.isInSuppressionWindow()).toBe(false);
    });

    it("allows setState after suppression expires", () => {
      sm.enterSuppressionWindow();
      vi.advanceTimersByTime(2000);

      sm.setState("working");
      expect(sm.getState()).toBe("working");
    });

    it("discards all setState calls during the full 2-second window", () => {
      sm.enterSuppressionWindow();

      // Try at 500ms, 1000ms, 1500ms
      vi.advanceTimersByTime(500);
      sm.setState("working");
      expect(sm.getState()).toBe("idle");

      vi.advanceTimersByTime(500);
      sm.setState("working");
      expect(sm.getState()).toBe("idle");

      vi.advanceTimersByTime(500);
      sm.setState("working");
      expect(sm.getState()).toBe("idle");

      // After 2s total, suppression ends
      vi.advanceTimersByTime(500);
      sm.setState("working");
      expect(sm.getState()).toBe("working");
    });

    it("clears the working timeout when entering suppression", () => {
      sm.setState("working");
      sm.enterSuppressionWindow();

      // Working timeout should not fire since it was cleared
      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(sm.getState()).toBe("idle");
    });

    it("can be re-entered to reset the suppression timer", () => {
      sm.enterSuppressionWindow();
      vi.advanceTimersByTime(1500); // 1.5s into first suppression

      sm.enterSuppressionWindow(); // Re-enter — should reset to 2s
      vi.advanceTimersByTime(1500); // 1.5s from reset — still suppressed
      expect(sm.isInSuppressionWindow()).toBe(true);

      vi.advanceTimersByTime(500); // 2s from reset — should expire
      expect(sm.isInSuppressionWindow()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // dispose
  // -------------------------------------------------------------------------

  describe("dispose", () => {
    it("clears working timeout", () => {
      sm.setState("working");
      sm.dispose();

      vi.advanceTimersByTime(2 * 60 * 1000);
      // State stays "working" since the timeout was cleared by dispose
      // Actually, dispose doesn't change the state to idle — it only clears timers
      // But since suppression is also cleared, let's verify timers don't fire
      expect(sm.getState()).toBe("working");
    });

    it("clears suppression state", () => {
      sm.enterSuppressionWindow();
      sm.dispose();
      expect(sm.isInSuppressionWindow()).toBe(false);
    });

    it("allows setState after dispose clears suppression", () => {
      sm.enterSuppressionWindow();
      sm.dispose();

      sm.setState("working");
      expect(sm.getState()).toBe("working");
    });
  });
});
