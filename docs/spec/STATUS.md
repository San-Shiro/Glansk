# Status

The deterministic kiosk includes the hardened `glansk.media/image-carousel` alongside the four SDK widgets. The carousel has strict package-local media/config policy, two image layers, one decode candidate, tokenized one-shot lifecycle, reduced motion, bounded retries, and same-host-image-only CSP while preserving opaque-origin isolation and strict bridge checks.

## Validation Status (100% Lightweight Native Pipeline)

In accordance with the project's embedded baseline (Raspberry Pi Zero 2 W, 512MB RAM) and architectural design (`plan/00-VISION.md`, `plan/05-DEVELOPMENT-PLAN.md`), the heavy desktop Playwright / Chrome dependency was purged. Testing is cleanly separated into two tiers:

- **Layer A (Host CI / Local Dev):**
  - **Typecheck:** `tsc --noEmit` passing with zero diagnostics.
  - **Native Suite:** 47/47 passed across 9 test files (168 assertions) in ~700ms via `bun test`.
  - **HTTP Boundary:** `tests/admin-api.test.ts` exercises `createSecureApp` (auth, pairing/revocation 401s, 409 concurrency conflicts, guarded challenge/confirmation reset, memory GPIO).
  - **Static Markup & CSP Tripwires:** In-process validation asserting `sandbox="allow-scripts"` (strictly no `allow-same-origin`) and strict CSP headers.
  - **Production Build:** passing (`bun scripts/build.ts` builds admin SPA, kiosk, shared renderer, and packaged widgets).
  - **Gate Command:** `bun run validate` executes the entire pipeline in ~5s with < 50MB RAM footprint.

- **Layer B (Target-Device Release Gate):**
  - Concrete on-device verification script: `scripts/target-wpe-gate.sh`.
  - Drives production WPE WebKit / Cog inside Cage via WebKit Remote Inspector (`:9222`) or WPEWebDriver.
  - Directly tests real engine sandbox enforcement (`localStorage` throws `SecurityError`), DOM stability soak, and PSS memory budget on the physical Pi Zero 2 W.
