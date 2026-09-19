# Operations

## Configuration
Use process-scoped secrets. Configure GLANSK_HOST, GLANSK_PORT, GLANSK_DATA_DIR, and GLANSK_ADMIN_SECRET.

## Build and run
Run bun run typecheck, bun run build, then start bun build/main.js with an ephemeral administrator secret. Check GET /health for HTTP 200 and GET /admin/ for the UI.

## Validation
Run the six non-E2E test files explicitly, then run bun run test:e2e with an ephemeral GLANSK_E2E_SECRET. Use isolated data, bounded startup/read timeouts, and finally cleanup that stops the process and removes disposable data.

## Reset safety
Reset requires authentication, a fresh one-use challenge, exact confirmation, and a supported kind. Wrong, expired, or reused confirmation is rejected. Backup/journal state precedes mutation and interrupted work rolls back.

## Hardware boundaries
The memory provider is software evidence only. Perform GPIO electrical checks on Raspberry Pi hardware and WPE/Cog/Cage rendering and performance checks on those targets.
