/**
 * KiroCan Bridge - Health Monitor
 *
 * Two-axis health tracking:
 * 1. Context usage percentage (from session file contextUsagePercentage field)
 * 2. Media/image count (from session file history[].message.content[] imageUrl items)
 *
 * Overall health level = worst of the two axes.
 * Media is blocked (screenshot/screen-record refused) at 90+ images.
 *
 * Falls back to message count (working hook counter) when session files unavailable.
 * Polls every 5 seconds via setInterval.
 *
 * @module health-monitor
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { statSync } from "node:fs";
import type { HealthResponse } from "./types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MEDIA_LIMIT = 100;
const MEDIA_BLOCK_THRESHOLD = 90;

// ---------------------------------------------------------------------------
// Pure Functions (exported for independent testing)
// ---------------------------------------------------------------------------

/**
 * Determines the health level tier for context usage percentage.
 * 0–59% → "normal", 60–74% → "worried", 75%+ → "critical"
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
 * 0–15 → "normal", 16–25 → "worried", 26+ → "critical"
 */
export function determineHealthLevelByMessageCount(
  count: number
): HealthResponse["healthLevel"] {
  if (count >= 26) return "critical";
  if (count >= 16) return "worried";
  return "normal";
}

/**
 * Determines the health level based on media/image count.
 * 0–49 → "normal", 50–69 → "worried", 70+ → "critical"
 */
export function determineMediaHealthLevel(
  mediaCount: number
): HealthResponse["healthLevel"] {
  if (mediaCount >= 70) return "critical";
  if (mediaCount >= 50) return "worried";
  return "normal";
}

/**
 * Returns the worse severity of two health levels.
 */
export function worstHealthLevel(
  a: HealthResponse["healthLevel"],
  b: HealthResponse["healthLevel"]
): HealthResponse["healthLevel"] {
  const severity = { normal: 0, worried: 1, critical: 2 };
  return severity[a] >= severity[b] ? a : b;
}

/**
 * Counts imageUrl items in a session history array.
 */
export function countMediaInHistory(history: unknown[]): number {
  let count = 0;
  for (const entry of history) {
    if (entry && typeof entry === "object" && "message" in entry) {
      const msg = (entry as { message?: { content?: unknown[] } }).message;
      if (msg && Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item && typeof item === "object" && "type" in item) {
            if ((item as { type: string }).type === "imageUrl") {
              count++;
            }
          }
        }
      }
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// HealthMonitor Class
// ---------------------------------------------------------------------------

export class HealthMonitor {
  private readonly sessionDir: string;
  private intervalHandle: NodeJS.Timeout | null = null;
  private contextPercentage: number = 0;
  private healthLevel: HealthResponse["healthLevel"] = "normal";
  private readonly pollIntervalMs: number;
  private sessionFileAvailable: boolean = false;
  private messageCount: number = 0;
  private mediaCount: number = 0;

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

  start(): void {
    if (this.intervalHandle !== null) return;
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  getHealthLevel(): HealthResponse["healthLevel"] {
    return this.healthLevel;
  }

  getContextPercentage(): number {
    return this.contextPercentage;
  }

  getMediaCount(): number {
    return this.mediaCount;
  }

  getMediaLimit(): number {
    return MEDIA_LIMIT;
  }

  getMediaRemaining(): number {
    return Math.max(0, MEDIA_LIMIT - this.mediaCount);
  }

  isMediaBlocked(): boolean {
    return this.mediaCount >= MEDIA_BLOCK_THRESHOLD;
  }

  /**
   * Resets all tracking to defaults. Called on new session.
   */
  resetContext(): void {
    this.contextPercentage = 0;
    this.healthLevel = "normal";
    this.messageCount = 0;
    this.mediaCount = 0;
    this.sessionFileAvailable = false;
  }

  /**
   * Increments the message counter. Called each time the working hook fires.
   */
  incrementMessageCount(): void {
    this.messageCount++;
    if (!this.sessionFileAvailable) {
      this.updateFromFallback();
    }
  }

  getMessageCount(): number {
    return this.messageCount;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private async poll(): Promise<void> {
    try {
      const files = await readdir(this.sessionDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      if (jsonFiles.length === 0) {
        this.sessionFileAvailable = false;
        this.updateFromFallback();
        return;
      }

      // Find most recently modified file
      let mostRecentFile: string | null = null;
      let mostRecentMtime = -Infinity;

      for (const file of jsonFiles) {
        try {
          const filePath = join(this.sessionDir, file);
          const stat = statSync(filePath);
          if (stat.mtimeMs > mostRecentMtime) {
            mostRecentMtime = stat.mtimeMs;
            mostRecentFile = filePath;
          }
        } catch {
          continue;
        }
      }

      if (mostRecentFile === null) {
        this.sessionFileAvailable = false;
        this.updateFromFallback();
        return;
      }

      const content = await readFile(mostRecentFile, "utf-8");
      const data = JSON.parse(content);

      // Read contextUsagePercentage
      let contextLevel: HealthResponse["healthLevel"] = "normal";
      if (
        typeof data.contextUsagePercentage === "number" &&
        data.contextUsagePercentage >= 0
      ) {
        this.contextPercentage = Math.min(100, Math.round(data.contextUsagePercentage));
        contextLevel = determineHealthLevel(this.contextPercentage);
        this.sessionFileAvailable = true;
      } else {
        this.sessionFileAvailable = false;
      }

      // Count media in history
      if (Array.isArray(data.history)) {
        this.mediaCount = countMediaInHistory(data.history);
      } else {
        this.mediaCount = 0;
      }

      // Two-axis health: worst of context vs media
      const mediaLevel = determineMediaHealthLevel(this.mediaCount);

      if (this.sessionFileAvailable) {
        this.healthLevel = worstHealthLevel(contextLevel, mediaLevel);
      } else {
        // No context data — use message count fallback combined with media
        const msgLevel = determineHealthLevelByMessageCount(this.messageCount);
        this.healthLevel = worstHealthLevel(msgLevel, mediaLevel);
        // Set pseudo-percentage from message count
        this.updateContextFromMessageCount();
      }
    } catch {
      this.sessionFileAvailable = false;
      this.updateFromFallback();
    }
  }

  private updateFromFallback(): void {
    this.updateContextFromMessageCount();
    const msgLevel = determineHealthLevelByMessageCount(this.messageCount);
    const mediaLevel = determineMediaHealthLevel(this.mediaCount);
    this.healthLevel = worstHealthLevel(msgLevel, mediaLevel);
  }

  private updateContextFromMessageCount(): void {
    if (this.messageCount >= 26) {
      this.contextPercentage = 75 + Math.min(25, this.messageCount - 26);
    } else if (this.messageCount >= 16) {
      this.contextPercentage = 60 + Math.round(((this.messageCount - 16) / 10) * 14);
    } else {
      this.contextPercentage = Math.round((this.messageCount / 15) * 59);
    }
  }
}
