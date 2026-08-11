/**
 * KiroCan Bridge - Entry Point
 *
 * Wires up all bridge modules and starts the HTTP server on port 9848.
 * Handles graceful shutdown on SIGTERM/SIGINT.
 */

import { StateMachine } from "./state-machine.js";
import { HealthMonitor } from "./health-monitor.js";
import { createHttpServer } from "./http-server.js";

const PORT = 9848;

async function main(): Promise<void> {
  // Initialize core modules
  const stateMachine = new StateMachine();
  const healthMonitor = new HealthMonitor();

  // Start health monitoring (polls session files every 5s)
  healthMonitor.start();

  // Create and start the HTTP server
  const app = createHttpServer(stateMachine, healthMonitor);
  
  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`KiroCan Bridge listening on http://127.0.0.1:${PORT}`);
  });

  // Graceful shutdown handler
  const shutdown = () => {
    console.log("Shutting down KiroCan Bridge...");
    healthMonitor.stop();
    stateMachine.dispose();
    server.close(() => {
      console.log("Bridge stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal error starting KiroCan Bridge:", err);
  process.exit(1);
});
