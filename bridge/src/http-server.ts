/**
 * KiroCan Bridge - HTTP Server
 *
 * Express-based HTTP server exposing all Bridge endpoints. The server is
 * created via `createHttpServer()` which returns the Express app without
 * calling `.listen()` — the caller (index.ts) is responsible for binding
 * to port 9848.
 *
 * Endpoints follow three response patterns:
 * - Success: 200 `{success: true}`
 * - Kiro unavailable: 503 `{success: false, error: "..."}`
 * - Invalid input: 400 `{success: false, error: "..."}`
 *
 * @module http-server
 */

import express from "express";

import type { StateMachine } from "./state-machine.js";
import type { HealthMonitor } from "./health-monitor.js";
import type { HealthResponse, SuccessResponse, ErrorResponse } from "./types.js";

import {
  executeCancel,
  executeAsk,
  executePrompt,
  executeSnippet,
  executeInlineChat,
  executeTerminalToChat,
  executeNewSession,
  executeSessionNext,
  executeSessionPrevious,
  executeScreenshot,
  executeScreenRecord,
  executeGo,
  executeStructPrompt,
} from "./shortcut-executor.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed prompt text length (characters). */
const MAX_PROMPT_LENGTH = 4096;

/** Minimum allowed prompt text length (characters). */
const MIN_PROMPT_LENGTH = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates and configures the Express HTTP application with all Bridge endpoints.
 * The returned app is not yet listening — call `app.listen(port)` to start serving.
 *
 * @param stateMachine - The StateMachine instance managing working/idle state.
 * @param healthMonitor - The HealthMonitor instance tracking context health.
 * @returns A fully configured Express application.
 */
export function createHttpServer(
  stateMachine: StateMachine,
  healthMonitor: HealthMonitor
): express.Application {
  const app = express();

  // -------------------------------------------------------------------------
  // Middleware
  // -------------------------------------------------------------------------

  // Parse JSON request bodies
  app.use(express.json());

  // CORS headers — allow all origins for localhost development
  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
  });

  // Handle CORS preflight requests
  app.options("*", (_req, res) => {
    res.sendStatus(204);
  });

  // -------------------------------------------------------------------------
  // GET /health
  // -------------------------------------------------------------------------

  /**
   * Returns the current bridge state, health level, and context percentage.
   * Polled by the C# Plugin every 500ms.
   */
  app.get("/health", (_req, res) => {
    const response: HealthResponse = {
      state: stateMachine.getState(),
      healthLevel: healthMonitor.getHealthLevel(),
      contextPercentage: healthMonitor.getContextPercentage(),
    };
    res.json(response);
  });

  // -------------------------------------------------------------------------
  // POST /cancel
  // -------------------------------------------------------------------------

  /**
   * Cancels the current Kiro generation and enters the suppression window.
   */
  app.post("/cancel", async (_req, res) => {
    const result = await executeCancel();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    stateMachine.enterSuppressionWindow();
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /ask
  // -------------------------------------------------------------------------

  /**
   * Copies from the current window and sends to Kiro chat.
   * No request body needed.
   */
  app.post("/ask", async (_req, res) => {
    const result = await executeAsk();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /prompt
  // -------------------------------------------------------------------------

  /**
   * Types prompt text into Kiro and submits.
   * Body: `{text: string}` — validated to 1–4096 characters.
   */
  app.post("/prompt", async (req, res) => {
    const { text } = req.body ?? {};

    if (typeof text !== "string" || text.length < MIN_PROMPT_LENGTH || text.length > MAX_PROMPT_LENGTH) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: `Prompt text must be between ${MIN_PROMPT_LENGTH} and ${MAX_PROMPT_LENGTH} characters`,
      };
      res.status(400).json(errorResponse);
      return;
    }

    const result = await executePrompt(text);
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /snippet
  // -------------------------------------------------------------------------

  /**
   * Appends snippet text to Kiro chat input without submitting.
   * Body: `{text: string}`.
   */
  app.post("/snippet", async (req, res) => {
    const { text } = req.body ?? {};

    if (typeof text !== "string" || text.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: "Snippet text must be a non-empty string",
      };
      res.status(400).json(errorResponse);
      return;
    }

    const result = await executeSnippet(text);
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /inline
  // -------------------------------------------------------------------------

  /**
   * Opens Kiro's inline chat mode (Ctrl+I).
   */
  app.post("/inline", async (_req, res) => {
    const result = await executeInlineChat();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /terminal
  // -------------------------------------------------------------------------

  /**
   * Sends terminal output to Kiro chat (Ctrl+Shift+R).
   */
  app.post("/terminal", async (_req, res) => {
    const result = await executeTerminalToChat();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /new-session
  // -------------------------------------------------------------------------

  /**
   * Opens a new Kiro session and resets the context health monitor.
   */
  app.post("/new-session", async (_req, res) => {
    const result = await executeNewSession();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    healthMonitor.resetContext();
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /session/next
  // -------------------------------------------------------------------------

  /**
   * Navigates to the next Kiro session (Ctrl+Alt+Right).
   */
  app.post("/session/next", async (_req, res) => {
    const result = await executeSessionNext();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /session/previous
  // -------------------------------------------------------------------------

  /**
   * Navigates to the previous Kiro session (Ctrl+Alt+Left).
   */
  app.post("/session/previous", async (_req, res) => {
    const result = await executeSessionPrevious();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /screenshot
  // -------------------------------------------------------------------------

  /**
   * Captures a screen region via Win+Shift+S and pastes into Kiro chat.
   */
  app.post("/screenshot", async (_req, res) => {
    const result = await executeScreenshot();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /screen-record
  // -------------------------------------------------------------------------

  /**
   * Captures screen frames and delivers them to Kiro chat.
   * Body: `{mode: "quick" | "long"}`.
   */
  app.post("/screen-record", async (req, res) => {
    const { mode } = req.body ?? {};

    if (mode !== "quick" && mode !== "long") {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Mode must be "quick" or "long"',
      };
      res.status(400).json(errorResponse);
      return;
    }

    const result = await executeScreenRecord(mode);
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /hook/working
  // -------------------------------------------------------------------------

  /**
   * Called by the Kiro hook when the agent starts working.
   * Updates internal state without activating the Kiro window.
   */
  app.post("/hook/working", (_req, res) => {
    stateMachine.setState("working");
    healthMonitor.incrementMessageCount();
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /hook/idle
  // -------------------------------------------------------------------------

  /**
   * Called by the Kiro hook when the agent stops.
   * Updates internal state without activating the Kiro window.
   */
  app.post("/hook/idle", (_req, res) => {
    stateMachine.setState("idle");
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /go
  // -------------------------------------------------------------------------

  /**
   * Submits the current chat input by pressing Enter without typing text.
   * Used by the "Go!" button after composing snippets.
   */
  app.post("/go", async (_req, res) => {
    const result = await executeGo();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  // -------------------------------------------------------------------------
  // POST /struct-prompt
  // -------------------------------------------------------------------------

  /**
   * Reads the current chat input text, wraps it in a meta-prompt asking
   * Kiro to restructure it into a well-organized prompt, and submits.
   * No request body needed — text is read from Kiro's chat input via clipboard.
   */
  app.post("/struct-prompt", async (_req, res) => {
    const result = await executeStructPrompt();
    if (!result.success) {
      const errorResponse: ErrorResponse = { success: false, error: result.error! };
      res.status(503).json(errorResponse);
      return;
    }
    const successResponse: SuccessResponse = { success: true };
    res.json(successResponse);
  });

  return app;
}
