/**
 * KiroCan Bridge - Entry Point
 *
 * Local HTTP server on port 9848 that receives commands from the
 * Logitech MX Creative Console plugin and executes Win32 window
 * activation and keyboard simulation against Kiro IDE.
 */

const PORT = 9848;

async function main(): Promise<void> {
  // TODO: Wire up state machine, health monitor, window manager,
  // keyboard simulator, shortcut executor, and HTTP server.
  console.log(`KiroCan Bridge starting on port ${PORT}...`);
}

main().catch((err) => {
  console.error("Fatal error starting KiroCan Bridge:", err);
  process.exit(1);
});
