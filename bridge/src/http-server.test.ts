/**
 * KiroCan Bridge - HTTP Server Integration Tests
 *
 * Tests all HTTP endpoints using Supertest with mocked shortcut executor.
 * These tests verify route registration, status codes, response structure,
 * and state machine integration without requiring Win32 APIs.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { StateMachine } from "./state-machine.js";
import { HealthMonitor } from "./health-monitor.js";
import { createHttpServer } from "./http-server.js";

// Mock the shortcut executor module
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

describe("Bridge HTTP Server", () => {
  let app: express.Application;
  let stateMachine: StateMachine;
  let healthMonitor: HealthMonitor;

  beforeAll(() => {
    stateMachine = new StateMachine();
    // Use a non-existent dir so it defaults to 0%/normal
    healthMonitor = new HealthMonitor("/nonexistent-path", 999999);
    healthMonitor.start();
    app = createHttpServer(stateMachine, healthMonitor);
  });

  afterAll(() => {
    healthMonitor.stop();
    stateMachine.dispose();
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  // GET /health
  describe("GET /health", () => {
    it("returns 200 with correct JSON structure", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("state");
      expect(res.body).toHaveProperty("healthLevel");
      expect(res.body).toHaveProperty("contextPercentage");
    });

    it("returns idle state by default", async () => {
      const res = await request(app).get("/health");
      expect(res.body.state).toBe("idle");
      expect(res.body.healthLevel).toBe("normal");
      expect(res.body.contextPercentage).toBe(0);
    });
  });

  // POST /hook/working and /hook/idle
  describe("POST /hook/working and /hook/idle", () => {
    it("/hook/working sets state to working", async () => {
      const res = await request(app).post("/hook/working");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const health = await request(app).get("/health");
      expect(health.body.state).toBe("working");
    });

    it("/hook/idle sets state back to idle", async () => {
      await request(app).post("/hook/working");
      const res = await request(app).post("/hook/idle");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const health = await request(app).get("/health");
      expect(health.body.state).toBe("idle");
    });
  });

  // POST /cancel
  describe("POST /cancel", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/cancel");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /prompt
  describe("POST /prompt", () => {
    it("returns 200 for valid prompt", async () => {
      const res = await request(app).post("/prompt").send({ text: "Hello Kiro" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 for empty text", async () => {
      const res = await request(app).post("/prompt").send({ text: "" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 for missing text field", async () => {
      const res = await request(app).post("/prompt").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 for text > 4096 chars", async () => {
      const longText = "a".repeat(4097);
      const res = await request(app).post("/prompt").send({ text: longText });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("accepts text of exactly 4096 chars", async () => {
      const maxText = "a".repeat(4096);
      const res = await request(app).post("/prompt").send({ text: maxText });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /snippet
  describe("POST /snippet", () => {
    it("returns 200 for valid snippet", async () => {
      const res = await request(app).post("/snippet").send({ text: "Be concise." });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 for empty snippet", async () => {
      const res = await request(app).post("/snippet").send({ text: "" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // POST /ask
  describe("POST /ask", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/ask");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /inline
  describe("POST /inline", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/inline");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /terminal
  describe("POST /terminal", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/terminal");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /new-session
  describe("POST /new-session", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/new-session");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /session/next and /session/previous
  describe("POST /session/next and /session/previous", () => {
    it("/session/next returns 200", async () => {
      const res = await request(app).post("/session/next");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("/session/previous returns 200", async () => {
      const res = await request(app).post("/session/previous");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /screenshot
  describe("POST /screenshot", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/screenshot");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // POST /screen-record
  describe("POST /screen-record", () => {
    it("returns 200 for quick mode", async () => {
      const res = await request(app).post("/screen-record").send({ mode: "quick" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 200 for long mode", async () => {
      const res = await request(app).post("/screen-record").send({ mode: "long" });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 400 for invalid mode", async () => {
      const res = await request(app).post("/screen-record").send({ mode: "invalid" });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 400 for missing mode", async () => {
      const res = await request(app).post("/screen-record").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // POST /go
  describe("POST /go", () => {
    it("returns 200 with success true", async () => {
      const res = await request(app).post("/go");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
