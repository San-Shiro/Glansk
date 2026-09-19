# Glansk — Development Handoff

_Last updated: 2026-09-05_

## 1. What Glansk is
Greenfield, Linux-first dashboard core (Bun + strict TypeScript) built against the
contracts in [`plan/`](../plan/README.md). Standards-based widget UIs, fixed
logical-pixel canvases, revisioned state, explicit capabilities, and a
WPE/Cog reference renderer on Raspberry Pi Zero 2 W (512MB RAM).

Entry point: `src/main.ts` -> composes `createSecureApp` (`src/secure-app.ts`),
which wraps the core router `src/app.ts`. Serves on `127.0.0.1:3000` by default
(`GET /health`, `/admin/`, `/kiosk/`, `/api/v1/*`, secured `/api/*`).

## 2. Current state (by phase)
All six planned phases are implemented (see `plan/06-PHASED-ROADMAP.md`):

1. Application foundation, canvas CRUD, immutable publication.
2. Durable editor, geometry/content edits, optimistic concurrency, `/admin` studio.
3. Runtime preview, activation, status, restart, rollback, state transport.
4. Auth, grants, pairing/revocation, package trust, audit log.
5. Backup, guarded reset/recovery, device broker, memory GPIO.
6. Responsive admin UI, lightweight native validation, production build + smoke.

## 3. Validation status (100% Lightweight Two-Tier Pipeline)
Command: `bun run validate` = `typecheck -> bun test -> build`.

Desktop Playwright/Chrome has been completely removed to align with Glansk's lightweight, low-memory embedded baseline (Raspberry Pi Zero 2 W, 512MB RAM):
- **Layer A (Host CI / Local Dev):**
  - **Typecheck:** clean (`tsc --noEmit`, 0 diagnostics).
  - **Unit/Integration & HTTP boundary:** 47/47 passing (9 files, 168 assertions in ~700ms).
  - **In-process HTTP Boundary:** `tests/admin-api.test.ts` directly verifies `createSecureApp` (auth, pairing, revocation 401s, 409 concurrency conflicts, guarded reset, memory GPIO).
  - **Static Markup & CSP Tripwires:** In-process assertions verifying `sandbox="allow-scripts"` (strictly no `allow-same-origin`) and strict CSP headers.
  - **Build:** passing; `bun scripts/build.ts` builds admin SPA, kiosk, and packaged widgets.
- **Layer B (Target-Device Gate):**
  - Concrete script: `scripts/target-wpe-gate.sh`.
  - Directly drives WPE WebKit/Cog on the physical Raspberry Pi Zero 2 W via WebKit Remote Inspector (`:9222`) or `WPEWebDriver` to verify genuine sandbox enforcement (`SecurityError` on `localStorage`) and DOM soak stability.

## 4. How to run
```sh
bun install
bun run dev          # watch mode on 127.0.0.1:3000
bun run test         # run all 47 tests in < 1s
bun run validate     # full gate: typecheck -> test -> build (~5s, <50MB RAM)
```
Notable env vars:
- `GLANSK_ADMIN_SECRET` -- required in production; dev default `glansk-dev`.
- `GLANSK_DATA_DIR` -- durable canvas/runtime storage location.
- `GLANSK_SEED_SHOWCASE=1` -- seed showcase canvases at boot.

## 5. Implemented SDK validation suite
The deterministic showcase uses four packaged iframe widgets under `src/widgets/glansk.demo/`: `sdk-status` (basic snapshot), `telemetry-chart` (two-series revisioned snapshot/deltas and resync), `command-control` (narrow correlated acknowledge command plus denial UI), and `status-grid` (nested table configuration, two subscriptions, loading/empty/error paths, lifecycle unsubscribe). `ShowcaseWidgetState` seeds deterministic broker state and command behavior server-side rather than fabricating it in widget code.

The widget SDK exposes `connect`, `onConfig`, `reportReady`, revision-aware `subscribe` with cleanup, and `command`. The host preserves opaque-origin `allow-scripts` isolation and checks source, origin, runtime identity, nonce, protocol, shape, size, channel grants, and command grants. Full dynamic package loading, manifest-derived grants, production streaming/rate limits, and production sync composition remain future work.

## 6. Immediate next step (pick up here)
Run the lightweight gate:

```sh
bun run validate
```
Current result: typecheck clean, 47 unit/integration tests pass, build OK.

## 7. Target-device release validation
Per `plan/06-PHASED-ROADMAP.md` and `docs/STATUS.md`:
- Physical GPIO electrical verification on real hardware.
- WPE WebKit / Cog / Cage rendering + performance on Raspberry Pi Zero 2 W via `scripts/target-wpe-gate.sh`.
- The composed renderer is still the deterministic local adapter (`src/adapters/runtime/deterministic-renderer.ts`); the WPE/Cog reference renderer adapter is pending.
- Open design decisions (CBOR profile, package archive format, transport/TLS, persistence engine, portable scene IR) tracked in `plan/README.md`.
