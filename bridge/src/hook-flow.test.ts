/**
 * KiroCan Bridge - Hook Flow Integration Tests
 *
 * Tests the full flow: hook events → state machine → /health response.
 * Verifies suppression window and working timeout behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { StateMachine } from "./state-machine.js";
import { HealthMonitor } from "./health-monitor.js";
import { createHttpServer } from "./http-server.js";
import type express from "express";

// Mock shortcut executor
vi.mock("./shortcut-executor.js", () => ({
  executeCancel: vi.fn().mockResolvedValue({ success: true }),
  executeAsk: vi.fn().mockResolvedValue({ success: true }),
  executePrompt: vi.fn().mockResolvedValue({ success: true }),
  executeSnippet: vi.fn().mockResolvedValue({ success: true }),
  executeInlineChat: vi.fn().mockResolvedValue({ success: true }),
  executeTerminalToChat: vi.fn().mockResolvedValue({ success: true }),
  executeNewSession: vi.fn().mockResolvedValue({ success: true }),
  executeSessionNext: vi.fn().mockResolvedValue({ success: true }),
  executeSessionPrevious: vi.fn().mockResolvedValue({ success: true }),
  executeScreenshot: vi.fn().mockResolvedValue({ success: true }),
  executeScreenRecord: vi.fn().mockResolvedValue({ success: true }),
  executeGo: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Hook Flow Integration", () => {
  let app: express.Application;
  let stateMachine: StateMachine;
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    vi.useFakeTimers();
    stateMachine = new StateMachine();
    healthMonitor = new HealthMonitor("/nonexistent", 999999);
    healthMonitor.start();
    app = createHttpServer(stateMachine, healthMonitor);
  });

  afterEach(() => {
    healthMonitor.stop();
    stateMachine.dispose();
    vi.useRealTimers();
  });

  it("hook/working changes /health state to working", async () => {
    await request(app).post("/hook/working");
    const res = await request(app).get("/health");
    expect(res.body.state).toBe("working");
  });

  it("hook/idle changes /health state to idle", async () => {
    await request(app).post("/hook/working");
    await request(app).post("/hook/idle");
    const res = await request(app).get("/health");
    expect(res.body.state).toBe("idle");
  });

  it("cancel enters suppression window and blocks subsequent hooks", async () => {
    // Set working state
    await request(app).post("/hook/working");
    let res = await request(app).get("/health");
    expect(res.body.state).toBe("working");

    // Cancel — forces idle and enters suppression
    await request(app).post("/cancel");
    res = await request(app).get("/health");
    expect(res.body.state).toBe("idle");

    // Try to set working during suppression — should be blocked
    await request(app).post("/hook/working");
    res = await request(app).get("/health");
    expect(res.body.state).toBe("idle");

    // After 2 seconds, suppression expires
    vi.advanceTimersByTime(2000);
    await request(app).post("/hook/working");
    res = await request(app).get("/health");
    expect(res.body.state).toBe("working");
  });

  it("2-minute working timeout auto-transitions to idle", async () => {
    await request(app).post("/hook/working");
    let res = await request(app).get("/health");
    expect(res.body.state).toBe("working");

    // Advance 2 minutes
    vi.advanceTimersByTime(2 * 60 * 1000);

    res = await request(app).get("/health");
    expect(res.body.state).toBe("idle");
  });

  it("multiple rapid hook events resolve to last state", async () => {
    await request(app).post("/hook/working");
    await request(app).post("/hook/idle");
    await request(app).post("/hook/working");
    await request(app).post("/hook/working");
    await request(app).post("/hook/idle");

    const res = await request(app).get("/health");
    expect(res.body.state).toBe("idle");
  });
});
