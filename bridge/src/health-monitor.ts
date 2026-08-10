/**
 * KiroCan Bridge - Health Monitor
 *
 * Reads Kiro session files from the workspace-sessions directory,
 * calculates context health percentage, and determines the health level.
 * Polls every 5 seconds via setInterval.
 *
 * @module health-monitor
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HealthResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Partial schema of a Kiro session file — only the fields we need.
 */
interface KiroSessionFile {
  sessionId: string;
  tokenUsage?: {
    current: number;
    maximum: number;
  };
  lastModified: string; // ISO timestamp
}

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

// ---------------------------------------------------------------------------
// HealthMonitor Class
// ---------------------------------------------------------------------------

/**
 * Monitors Kiro session files to track context window usage.
 *
 * Reads session JSON files from the standard %APPDATA% location every 5 seconds,
 * picks the most recently modified session, and computes the context percentage
 * and health level. Gracefully defaults to 0% / "normal" when files are missing
 * or unreadable.
 */
export class HealthMonitor {
  /** Directory containing Kiro workspace session files. */
  private readonly sessionDir: string;

  /** Polling interval handle, or null when stopped. */
  private intervalHandle: NodeJS.Timeout | null = null;

  /** Current calculated context usage percentage (0–100). */
  private contextPercentage: number = 0;

  /** Current health level derived from contextPercentage. */
  private healthLevel: HealthResponse["healthLevel"] = "normal";

  /** Polling interval in milliseconds (default 5000). */
  private readonly pollIntervalMs: number;

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
   * Resets context tracking to 0% / "normal".
   * Called when a new session is created.
   */
  resetContext(): void {
    this.contextPercentage = 0;
    this.healthLevel = "normal";
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  /**
   * Reads session files from the directory, finds the most recent one,
   * and updates internal state. Defaults to 0%/normal on any error.
   */
  private async poll(): Promise<void> {
    try {
      const files = await readdir(this.sessionDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        this.setDefaults();
        return;
      }

      let mostRecentSession: KiroSessionFile | null = null;
      let mostRecentTime = -Infinity;

      for (const file of jsonFiles) {
        try {
          const filePath = join(this.sessionDir, file);
          const content = await readFile(filePath, "utf-8");
          const session = JSON.parse(content) as KiroSessionFile;

          // Validate required fields
          if (!session.lastModified) continue;

          const modifiedTime = new Date(session.lastModified).getTime();
          if (isNaN(modifiedTime)) continue;

          if (modifiedTime > mostRecentTime) {
            mostRecentTime = modifiedTime;
            mostRecentSession = session;
          }
        } catch {
          // Skip unreadable/invalid files
          continue;
        }
      }

      if (
        mostRecentSession === null ||
        !mostRecentSession.tokenUsage ||
        mostRecentSession.tokenUsage.maximum <= 0
      ) {
        this.setDefaults();
        return;
      }

      const { current, maximum } = mostRecentSession.tokenUsage;
      const rawPercentage = (current / maximum) * 100;
      this.contextPercentage = Math.min(100, Math.max(0, Math.round(rawPercentage)));
      this.healthLevel = determineHealthLevel(this.contextPercentage);
    } catch {
      // Directory doesn't exist or other filesystem error
      this.setDefaults();
    }
  }

  /**
   * Resets internal state to safe defaults.
   */
  private setDefaults(): void {
    this.contextPercentage = 0;
    this.healthLevel = "normal";
  }
}
