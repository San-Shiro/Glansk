# Glansk AI Agent Guide & Architecture Handbook

This document serves as the foundational operating manual and context anchor for any AI agent (Claude, Gemini, GPT) working on the Glansk codebase.

---

## 1. Project Philosophy & Core Invariants

1. **Ultra-Lean Bun Engine**:
   - Glansk runs directly on [Bun](https://bun.sh) with zero heavy framework overhead (no NestJS, Express, or bloated ORMs).
   - Invariant: Server cold boots in < 50ms and maintains < 40MB idle resident memory on Raspberry Pi hardware.
2. **Hardened Widget Sandboxing**:
   - Invariant: Widgets run inside opaque-origin sandboxed iframes. Widgets **never** access the DOM of the host or other widgets directly. All communication flows through the `@glansk/widget-sdk` bridge protocol.
3. **Monotonic Revision State Broker**:
   - Invariant: Every mutation on a canvas produces a monotonically increasing integer revision number (`revision++`). Displays and inspectors use monotonic revisions to prevent race conditions and detect revision gaps.
4. **SSRF-Proof Secret Vault & Outbound Proxy**:
   - Invariant: Secrets stored in the Vault are encrypted at rest using AES-256-GCM. Outbound requests from widgets are proxied through `/api/v1/widget-proxy` where secrets are injected into HTTP headers at the host boundary, preventing secret leakage into browser iframes.
5. **Freeform 60fps Vector Studio**:
   - Invariant: Canvas manipulations (drag, resize, multi-select, grouping) update DOM transforms directly during pointer movement to guarantee 60fps performance, only committing to React state upon pointer release (`pointerup`).

---

## 2. Directory Layout Reference

- `apps/server/src/main.ts`: Application bootstrap, CLI argument parsing, HTTP router attachment.
- `apps/server/src/secure-app.ts`: Hardened HTTP routing pipeline, CORS origin checking, CSP headers, authentication middleware.
- `apps/server/src/broker/`: Real-time state broker with monotonic revision ordering.
- `apps/server/src/services/`: Durable canvas repository, SQLite storage, Secret Vault, Backup, Package Loader.
- `apps/server/src/shared/`: Canvas schemas, theme tokens, canvas renderer (shared between Studio and Kiosk).
- `apps/studio/src/studio/Studio.tsx`: Main Studio workstation orchestrator.
- `apps/studio/src/studio/CanvasViewport.tsx`: 60fps interactive vector canvas stage with marquee lasso, grouping, and context menus.
- `apps/studio/src/studio/LeftSidebar.tsx`: Extensible 5-tool left console (Layers, Widgets, Canvas, Variables, Events).
- `apps/studio/src/studio/inspector/InspectorRoot.tsx`: 100% contextual right inspector panel (Config, Style, Data, Logic).
- `apps/studio/src/studio/StatusBar.tsx`: 28px bottom status bar showing draft save state, resolution, published revision, and diagnostics.
- `packages/widget-sdk/src/`: The official `@glansk/widget-sdk` library providing `context.http`, `context.storage`, `context.variables`, and `context.events`.
- `packages/shared/src/version.ts`: Single source of truth for version constants (`GLANSK_VERSION`).

---

## 3. Key Naming & Protocol Constants

- **MIME Types**:
  - `text/glansk-widget`: Package and widget ID payload for drag-and-drop.
  - `text/glansk-dim`: JSON `{ width, height }` dimensions for blueprint ghost preview.
  - `text/glansk-title`: Human-readable widget title.
- **Environment Variables**:
  - `GLANSK_PORT`, `GLANSK_HOST`, `GLANSK_DATA_DIR`, `GLANSK_ADMIN_SECRET`, `GLANSK_SEED_SHOWCASE`, `GLANSK_ALLOWED_ORIGINS`.
- **Default Auth Secret**:
  - `glansk-dev` (in development mode).
- **Default Canvas Showcase ID**:
  - `glansk-demo-showcase`.
- **Storage Namespaces**:
  - Prefix `gl_${scope}` generated deterministically by `makeStorageNamespace`.

---

## 4. How to Version Bump & Release

Always use the automated bumper script:
```bash
bun run bump <new-version>
# Example: bun run bump 0.1.2-alpha
```
Never manually edit version numbers in individual `package.json` files.

---

## 5. Git & Branching Invariants

- **`main`**: Production releases and tags only. Never commit experimental code directly to `main`.
- **`dev`**: Active development branch. All engineering tasks, feature branches, and PRs branch from and target `dev`.

