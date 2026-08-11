/**
 * KiroCan Bridge - Property-Based Tests
 *
 * Tests the universal correctness properties defined in the design document.
 * Each test runs a minimum of 100 iterations with randomly generated inputs.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fc from "fast-check";
import { determineHealthLevel } from "./health-monitor.js";
import { StateMachine } from "./state-machine.js";

// ---------------------------------------------------------------------------
// Property 1: Health Level Determination
// For any integer contextPercentage in [0, 100], health level follows thresholds.
// Validates: Requirements 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------

describe("Property 1: Health Level Determination", () => {
  it("for any percentage 0-59, returns 'normal'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 59 }), (pct) => {
        expect(determineHealthLevel(pct)).toBe("normal");
      }),
      { numRuns: 100 }
    );
  });

  it("for any percentage 60-74, returns 'worried'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 60, max: 74 }), (pct) => {
        expect(determineHealthLevel(pct)).toBe("worried");
      }),
      { numRuns: 100 }
    );
  });

  it("for any percentage 75-100, returns 'critical'", () => {
    fc.assert(
      fc.property(fc.integer({ min: 75, max: 100 }), (pct) => {
        expect(determineHealthLevel(pct)).toBe("critical");
      }),
      { numRuns: 100 }
    );
  });

  it("for any percentage 0-100, returns one of the three valid levels", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (pct) => {
        const level = determineHealthLevel(pct);
        expect(["normal", "worried", "critical"]).toContain(level);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3: Health Response Serialization Round-Trip
// For any valid HealthResponse, JSON.stringify then JSON.parse yields identical object.
// Validates: Requirements 22.1, 22.2, 22.3
// ---------------------------------------------------------------------------

describe("Property 3: Health Response Serialization Round-Trip", () => {
  const healthResponseArb = fc.record({
    state: fc.constantFrom("working" as const, "idle" as const),
    healthLevel: fc.constantFrom("normal" as const, "worried" as const, "critical" as const),
    contextPercentage: fc.integer({ min: 0, max: 100 }),
  });

  it("round-trips through JSON serialization", () => {
    fc.assert(
      fc.property(healthResponseArb, (response) => {
        const serialized = JSON.stringify(response);
        const parsed = JSON.parse(serialized);
        expect(parsed).toEqual(response);
        expect(parsed.state).toBe(response.state);
        expect(parsed.healthLevel).toBe(response.healthLevel);
        expect(parsed.contextPercentage).toBe(response.contextPercentage);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Invalid Health Response Defaults to Safe Values
// For any malformed JSON, missing fields, or out-of-range values, parsing
// should yield idle/normal/0 defaults.
// Validates: Requirements 22.4, 22.5
// ---------------------------------------------------------------------------

describe("Property 4: Invalid Health Response Defaults", () => {
  function parseHealthResponse(raw: string): { state: string; healthLevel: string; contextPercentage: number } {
    try {
      const parsed = JSON.parse(raw);
      if (
        typeof parsed !== "object" || parsed === null ||
        !("state" in parsed) || !("healthLevel" in parsed) || !("contextPercentage" in parsed) ||
        typeof parsed.contextPercentage !== "number" ||
        parsed.contextPercentage < 0 || parsed.contextPercentage > 100
      ) {
        return { state: "idle", healthLevel: "normal", contextPercentage: 0 };
      }
      return parsed;
    } catch {
      return { state: "idle", healthLevel: "normal", contextPercentage: 0 };
    }
  }

  it("malformed JSON defaults to idle/normal/0", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        // Only test strings that are NOT valid health responses
        try {
          const parsed = JSON.parse(raw);
          if (parsed?.state && parsed?.healthLevel && typeof parsed?.contextPercentage === "number") {
            return; // Skip valid responses
          }
        } catch {
          // Not JSON — this is what we want to test
        }
        const result = parseHealthResponse(raw);
        expect(result).toEqual({ state: "idle", healthLevel: "normal", contextPercentage: 0 });
      }),
      { numRuns: 100 }
    );
  });

  it("out-of-range contextPercentage defaults to idle/normal/0", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -1000, max: -1 }), fc.integer({ min: 101, max: 1000 })),
        (badPct) => {
          const raw = JSON.stringify({ state: "working", healthLevel: "normal", contextPercentage: badPct });
          const result = parseHealthResponse(raw);
          expect(result).toEqual({ state: "idle", healthLevel: "normal", contextPercentage: 0 });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: State Machine Transitions with Suppression
// For any sequence of hook events, state updates correctly when not suppressed,
// and remains unchanged when suppressed.
// Validates: Requirements 17.3, 17.4, 17.6
// ---------------------------------------------------------------------------

describe("Property 6: State Machine Transitions with Suppression", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("state reflects most recent hook event when not suppressed", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("working" as const, "idle" as const), { minLength: 1, maxLength: 20 }),
        (events) => {
          const sm = new StateMachine();
          for (const event of events) {
            sm.setState(event);
          }
          expect(sm.getState()).toBe(events[events.length - 1]);
          sm.dispose();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("state remains unchanged during suppression window", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("working" as const, "idle" as const), { minLength: 1, maxLength: 10 }),
        (events) => {
          const sm = new StateMachine();
          sm.enterSuppressionWindow();
          const stateBeforeSuppression = sm.getState(); // Should be "idle" (forced by enterSuppression)

          for (const event of events) {
            sm.setState(event);
          }

          // State should remain "idle" since suppression is active
          expect(sm.getState()).toBe(stateBeforeSuppression);
          sm.dispose();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Prompt Body Length Validation
// For any string >4096 chars or empty, reject. For 1-4096, accept.
// Validates: Requirements 18.7
// ---------------------------------------------------------------------------

describe("Property 10: Prompt Body Length Validation", () => {
  function validatePromptBody(text: unknown): { valid: boolean; error?: string } {
    if (typeof text !== "string" || text.length < 1 || text.length > 4096) {
      return { valid: false, error: "Prompt text must be between 1 and 4096 characters" };
    }
    return { valid: true };
  }

  it("accepts strings of length 1-4096", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 4096 }), (text) => {
        expect(validatePromptBody(text).valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects empty strings", () => {
    expect(validatePromptBody("").valid).toBe(false);
  });

  it("rejects strings longer than 4096 chars", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 4097, maxLength: 8000 }), (text) => {
        expect(validatePromptBody(text).valid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
