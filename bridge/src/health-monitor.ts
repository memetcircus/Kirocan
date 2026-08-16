/**
 * KiroCan Bridge - Health Monitor
 *
 * Reads Kiro session files from the workspace-sessions directory,
 * reads the contextUsagePercentage field, and determines the health level.
 * Falls back to message count (working hook counter) when session files
 * are unavailable.
 *
 * Polls every 5 seconds via setInterval.
 *
 * @module health-monitor
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { statSync } from "node:fs";
import type { HealthResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Pure Functions (exported for independent testing)
// ---------------------------------------------------------------------------

/**
 * Determines the health level tier for a given context usage percentage.
 *
 * - 0–59%  → "normal"
 * - 60–74% → "worried"
 * - 75%+   → "critical"
 *
 * @param percentage - Integer in [0, 100] representing context usage.
 * @returns The corresponding health level string.
 */
export function determineHealthLevel(
  percentage: number
): HealthResponse["healthLevel"] {
  if (percentage >= 75) return "critical";
  if (percentage >= 60) return "worried";
  return "normal";
}

/**
 * Determines the health level based on message count (fallback).
 *
 * - 0–15  → "normal"
 * - 16–25 → "worried"
 * - 26+   → "critical"
 *
 * @param count - Number of working state changes (proxy for messages).
 * @returns The corresponding health level string.
 */
export function determineHealthLevelByMessageCount(
  count: number
): HealthResponse["healthLevel"] {
  if (count >= 26) return "critical";
  if (count >= 16) return "worried";
  return "normal";
}

// ---------------------------------------------------------------------------
// HealthMonitor Class
// ---------------------------------------------------------------------------

/**
 * Monitors Kiro session files to track context window usage.
 *
 * Reads session JSON files from the standard %APPDATA% location every 5 seconds,
 * picks the most recently modified file, and reads the contextUsagePercentage field.
 * Falls back to message count when session files are unavailable.
 */
export class HealthMonitor {
  /** Directory containing Kiro workspace session files. */
  private readonly sessionDir: string;

  /** Polling interval handle, or null when stopped. */
  private intervalHandle: NodeJS.Timeout | null = null;

  /** Current calculated context usage percentage (0–100). */
  private contextPercentage: number = 0;

  /** Current health level derived from contextPercentage or message count. */
  private healthLevel: HealthResponse["healthLevel"] = "normal";

  /** Polling interval in milliseconds (default 5000). */
  private readonly pollIntervalMs: number;

  /** Whether the last poll successfully read a session file. */
  private sessionFileAvailable: boolean = false;

  /** Counter for working state changes (proxy for message count). */
  private messageCount: number = 0;

  /**
   * Creates a new HealthMonitor instance.
   *
   * @param sessionDir - Override for the session directory path (useful for testing).
   *   Defaults to `%APPDATA%/Kiro/User/globalStorage/kiro.kiroagent/workspace-sessions/`.
   * @param pollIntervalMs - Override for the polling interval (useful for testing).
   *   Defaults to 5000ms.
   */
  constructor(sessionDir?: string, pollIntervalMs?: number) {
    this.sessionDir =
      sessionDir ??
      join(
        process.env.APPDATA ?? "",
        "Kiro",
        "User",
        "globalStorage",
        "kiro.kiroagent",
        "workspace-sessions"
      );
    this.pollIntervalMs = pollIntervalMs ?? 5000;
  }

  /**
   * Starts the 5-second polling interval.
   * Performs an immediate read on start.
   */
  start(): void {
    if (this.intervalHandle !== null) return; // Already running
    // Perform an initial read immediately
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  /**
   * Stops the polling interval and cleans up the timer.
   */
  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * Returns the current health level.
   */
  getHealthLevel(): HealthResponse["healthLevel"] {
    return this.healthLevel;
  }

  /**
   * Returns the current context usage percentage (0–100).
   */
  getContextPercentage(): number {
    return this.contextPercentage;
  }

  /**
   * Resets context tracking to 0% / "normal" and message counter to 0.
   * Called when a new session is created.
   */
  resetContext(): void {
    this.contextPercentage = 0;
    this.healthLevel = "normal";
    this.messageCount = 0;
    this.sessionFileAvailable = false;
  }

  /**
   * Increments the message counter. Called each time the working hook fires.
   * If session files are unavailable, this drives the health level.
   */
  incrementMessageCount(): void {
    this.messageCount++;
    if (!this.sessionFileAvailable) {
      this.updateFromMessageCount();
    }
  }

  /**
   * Returns the current message count.
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Reads session files from the directory, finds the most recent one,
   * and updates internal state. Falls back to message count on error.
   */
  private async poll(): Promise<void> {
    try {
      const files = await readdir(this.sessionDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        this.sessionFileAvailable = false;
        this.updateFromMessageCount();
        return;
      }

      // Find the most recently modified file
      let mostRecentFile: string | null = null;
      let mostRecentMtime = -Infinity;

      for (const file of jsonFiles) {
        try {
          const filePath = join(this.sessionDir, file);
          const stat = statSync(filePath);
          const mtime = stat.mtimeMs;
          if (mtime > mostRecentMtime) {
            mostRecentMtime = mtime;
            mostRecentFile = filePath;
          }
        } catch {
          continue;
        }
      }

      if (mostRecentFile === null) {
        this.sessionFileAvailable = false;
        this.updateFromMessageCount();
        return;
      }

      // Read and parse the session file
      const content = await readFile(mostRecentFile, "utf-8");
      const data = JSON.parse(content);

      // Read contextUsagePercentage field
      if (
        typeof data.contextUsagePercentage === "number" &&
        data.contextUsagePercentage >= 0
      ) {
        this.contextPercentage = Math.min(100, Math.round(data.contextUsagePercentage));
        this.healthLevel = determineHealthLevel(this.contextPercentage);
        this.sessionFileAvailable = true;
      } else {
        // Field missing or invalid — fall back to message count
        this.sessionFileAvailable = false;
        this.updateFromMessageCount();
      }
    } catch {
      // Directory doesn't exist or other filesystem error
      this.sessionFileAvailable = false;
      this.updateFromMessageCount();
    }
  }

  /**
   * Updates health level from message count (fallback when session files unavailable).
   */
  private updateFromMessageCount(): void {
    // Convert message count to a pseudo-percentage for the /health response
    // 0-15 → 0-59%, 16-25 → 60-74%, 26+ → 75-100%
    if (this.messageCount >= 26) {
      this.contextPercentage = 75 + Math.min(25, this.messageCount - 26);
    } else if (this.messageCount >= 16) {
      this.contextPercentage = 60 + Math.round(((this.messageCount - 16) / 10) * 14);
    } else {
      this.contextPercentage = Math.round((this.messageCount / 15) * 59);
    }
    this.healthLevel = determineHealthLevelByMessageCount(this.messageCount);
  }
}
