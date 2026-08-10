/**
 * KiroCan Bridge - Health Monitor Unit Tests
 *
 * Tests for session file reading, health level determination,
 * and the HealthMonitor class lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { determineHealthLevel, HealthMonitor } from "./health-monitor.js";

// ---------------------------------------------------------------------------
// determineHealthLevel (pure function)
// ---------------------------------------------------------------------------

describe("determineHealthLevel", () => {
  it("returns 'normal' for 0%", () => {
    expect(determineHealthLevel(0)).toBe("normal");
  });

  it("returns 'normal' for 59%", () => {
    expect(determineHealthLevel(59)).toBe("normal");
  });

  it("returns 'worried' for 60%", () => {
    expect(determineHealthLevel(60)).toBe("worried");
  });

  it("returns 'worried' for 74%", () => {
    expect(determineHealthLevel(74)).toBe("worried");
  });

  it("returns 'critical' for 75%", () => {
    expect(determineHealthLevel(75)).toBe("critical");
  });

  it("returns 'critical' for 100%", () => {
    expect(determineHealthLevel(100)).toBe("critical");
  });
});

// ---------------------------------------------------------------------------
// HealthMonitor class
// ---------------------------------------------------------------------------

describe("HealthMonitor", () => {
  let tempDir: string;
  let monitor: HealthMonitor;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "kirocan-health-test-"));
  });

  afterEach(async () => {
    monitor?.stop();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("defaults to 0% and 'normal' when directory is empty", async () => {
    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    // Wait a tick for the initial poll to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(0);
    expect(monitor.getHealthLevel()).toBe("normal");
  });

  it("defaults to 0% and 'normal' when directory does not exist", async () => {
    monitor = new HealthMonitor(join(tempDir, "nonexistent"), 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(0);
    expect(monitor.getHealthLevel()).toBe("normal");
  });

  it("reads most recent session file and calculates percentage", async () => {
    // Write two session files — the more recent one has higher usage
    const oldSession = {
      sessionId: "session-old",
      tokenUsage: { current: 1000, maximum: 10000 },
      lastModified: "2024-01-01T00:00:00Z",
    };
    const newSession = {
      sessionId: "session-new",
      tokenUsage: { current: 7000, maximum: 10000 },
      lastModified: "2024-06-15T12:00:00Z",
    };

    await writeFile(join(tempDir, "old.json"), JSON.stringify(oldSession));
    await writeFile(join(tempDir, "new.json"), JSON.stringify(newSession));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(70);
    expect(monitor.getHealthLevel()).toBe("worried");
  });

  it("correctly classifies critical health level (75%+)", async () => {
    const session = {
      sessionId: "session-crit",
      tokenUsage: { current: 8000, maximum: 10000 },
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "session.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(80);
    expect(monitor.getHealthLevel()).toBe("critical");
  });

  it("handles session files without tokenUsage gracefully", async () => {
    const session = {
      sessionId: "session-no-tokens",
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "session.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(0);
    expect(monitor.getHealthLevel()).toBe("normal");
  });

  it("skips non-JSON files in the directory", async () => {
    await writeFile(join(tempDir, "readme.txt"), "not a session file");

    const session = {
      sessionId: "valid",
      tokenUsage: { current: 6500, maximum: 10000 },
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "valid.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(65);
    expect(monitor.getHealthLevel()).toBe("worried");
  });

  it("skips malformed JSON files gracefully", async () => {
    await writeFile(join(tempDir, "bad.json"), "not valid json{{{");

    const session = {
      sessionId: "good",
      tokenUsage: { current: 3000, maximum: 10000 },
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "good.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(30);
    expect(monitor.getHealthLevel()).toBe("normal");
  });

  it("resetContext sets percentage to 0 and health to normal", async () => {
    const session = {
      sessionId: "session-high",
      tokenUsage: { current: 9000, maximum: 10000 },
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "session.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    expect(monitor.getContextPercentage()).toBe(90);
    expect(monitor.getHealthLevel()).toBe("critical");

    monitor.resetContext();

    expect(monitor.getContextPercentage()).toBe(0);
    expect(monitor.getHealthLevel()).toBe("normal");
  });

  it("stop() clears the polling interval", () => {
    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();
    monitor.stop();

    // Starting again should work without issues (not a double-interval)
    monitor.start();
    monitor.stop();
  });

  it("start() is idempotent when already running", () => {
    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();
    monitor.start(); // Should not create a second interval
    monitor.stop();
  });

  it("handles session with zero maximum tokens gracefully", async () => {
    const session = {
      sessionId: "zero-max",
      tokenUsage: { current: 500, maximum: 0 },
      lastModified: "2024-06-15T12:00:00Z",
    };
    await writeFile(join(tempDir, "session.json"), JSON.stringify(session));

    monitor = new HealthMonitor(tempDir, 60000);
    monitor.start();

    await new Promise((r) => setTimeout(r, 50));

    // maximum <= 0 should result in defaults
    expect(monitor.getContextPercentage()).toBe(0);
    expect(monitor.getHealthLevel()).toBe("normal");
  });
});
