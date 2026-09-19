# Glansk

<div align="center">

```
   ______   __         ___       __    __    ______   __    __ 
  /      \ /  |       /   \     /  \  /  |  /      \ /  |  /  |
 /$$$$$$  |$$ |      /$$$  \    $$  \ $$ | /$$$$$$  |$$ | /$$/ 
 $$ | _$$/ $$ |     /  $$$  \   $$$  \$$ | $$ \__$$/ $$ |/$$/  
 $$ |/    |$$ |     /  _$$$  \  $$$$  $$ | $$      \ $$  $$<   
 $$ |$$$$ |$$ |     /  / \$$  \ $$ $$ $$ |  $$$$$$  |$$$$$  \  
 $$ \__$$ |$$ |____/  /___\$$  \$$ |$$$$ | /  \__$$ |$$ |$$  \ 
 $$    $$/ $$      /  /   \$$  \$$ | $$$ | $$    $$/ $$ | $$  \
  $$$$$$/  $$$$$$$/__/     \$$__$$/   $$/   $$$$$$/  $$/   $$/ 
```

### Ultra-Lean, Reactive Command Center & Kiosk Display Platform

[![Version](https://img.shields.io/badge/version-v0.1.1--alpha-orange.svg)](https://github.com/San-Shiro/Glansk)
[![Active Branch](https://img.shields.io/badge/branch-dev-2ea44f.svg)](https://github.com/San-Shiro/Glansk/tree/dev)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-Bun_1.2+-black.svg)](https://bun.sh)
[![Architecture](https://img.shields.io/badge/architecture-Monorepo-purple.svg)](#monorepo-structure)

</div>

---

> [!WARNING]
> **Experimental Proof of Concept (`v0.1.1-alpha`)**  
> Glansk is currently in an early **alpha proof-of-concept** stage. While the core canvas engine, state broker, and widget sandbox are fully functional and pass 260+ automated test suites, expect rough edges, bugs, and rapid API iterations. Feedback, issue reports, and contributions are warmly welcome!

---

## What is Glansk?

**Glansk** is a modern, lightweight, freeform canvas engine and display runtime designed from scratch for **Raspberry Pi, low-power edge kiosks, smart home command centers, and wall-mounted dashboards**.

Most traditional dashboard solutions (Grafana, Home Assistant Lovelace, specialized digital signage) are either too resource-intensive for low-spec microcomputers, impose rigid grid constraints, or lack safe third-party widget sandboxing.

Glansk changes this by providing:
- ⚡ **Sub-50ms Cold Starts**: Powered by native [Bun](https://bun.sh), booting instantly with <40MB idle memory.
- 📐 **Freeform 60fps Vector Studio**: Drag-and-drop blueprint ghosts, marquee lasso selection, 8px grid snapping, minimal enclosing bounding-box grouping (`Ctrl+G`), alignment tools, and context menus.
- 🛡️ **Hardened Widget Sandboxing**: Third-party widgets run in isolated, zero-trust iframes protected by Content Security Policy (CSP), communicating exclusively through a structured message bus.
- 🔄 **Monotonic State Broker**: Central event bus that guarantees causal order, monotonic revisions, and instant reconnect replay for display kiosks.
- 🔐 **Secret Vault & SSRF-Hardened Proxy**: Widgets never receive raw API keys or database tokens; backend proxying injects secrets at the host boundary with domain allowlists.
- 📡 **Realtime SSE Event Bus & Reactive Variables**: Cascade state changes across disparate widgets in real time with zero polling overhead.

---

## Monorepo Structure

Glansk is organized as a clean, industry-standard Bun workspace monorepo:

```
Glansk/
├── apps/
│   ├── server/           # Core Bun runtime engine, state broker, SQLite/ndjson storage & API
│   │   ├── src/          # Engine source (services, broker, proxy, vault, kiosk)
│   │   └── tests/        # 266 backend integration & unit tests
│   └── studio/           # Admin Studio Vite/React 18 SPA (formerly admin-ui)
│       └── src/          # Studio workspace (Canvas, Inspector, 5-Tool Drawer, Dock)
├── packages/
│   ├── widget-sdk/       # Official @glansk/widget-sdk (published to npm)
│   │   ├── src/          # TypeScript SDK APIs (context.http, context.storage, etc.)
│   │   └── cli/          # glansk-widget CLI (validate and bundle .glpkg archives)
│   └── shared/           # Single source of truth for version tokens and shared schemas
├── docs/                 # Documentation hub
│   ├── ai/               # AI Agent context, instructions, prompt maps
│   ├── adr/              # Architecture Decision Records (ADRs)
│   ├── dev-logs/         # Chronological engineering dev logs
│   └── spec/             # Wire protocol, state delta specs, widget manifest spec
├── scripts/
│   ├── bump-version.ts   # Automated version bump CLI
│   └── build.ts          # Monorepo build orchestrator
├── LICENSE               # Apache 2.0 License
└── README.md             # Project documentation
```

---

## Quickstart

### Prerequisites
- [Bun](https://bun.sh) v1.2.0 or higher
- Git

### 1. Clone & Install
```bash
git clone https://github.com/San-Shiro/Glansk.git
cd Glansk

# Switch to the active development branch
git checkout dev

bun install
```

### 2. Start Development Server
```bash
bun run dev
```

The Glansk engine will launch at **`http://localhost:3000/`**.
- **Admin Studio**: [http://localhost:3000/admin/](http://localhost:3000/admin/) (Default password: `glansk-dev`)
- **Kiosk Display**: [http://localhost:3000/kiosk/](http://localhost:3000/kiosk/)
- **Live Event Stream**: `GET /api/v1/interactive-state/events`

To run the Vite studio dev server with Hot Module Reloading (HMR):
```bash
bun run dev:studio
# Runs Vite on http://localhost:5173 with automatic backend proxying to :3000
```

---

## Branching Strategy & Development Workflow

Glansk maintains a clear two-branch model:

| Branch | Purpose | Stability | PR & Push Rules |
| :--- | :--- | :--- | :--- |
| **`main`** | Official stable releases and milestone tags (`v*.*.*`) | Production | Tagged releases only |
| **`dev`** | **Active development**, continuous integration, rapid feature prototyping | Bleeding Edge | **Target for daily work, commits & all PRs** |

### Everyday Workflow on `dev`
```bash
# 1. Keep dev up to date
git checkout dev
git pull origin dev

# 2. Create your feature or fix branch
git checkout -b feat/awesome-widget

# 3. Validate before committing (all must pass!)
bun test       # Runs 266+ unit and integration tests
bun run build  # Validates full monorepo build (Studio, Server, SDK)

# 4. Commit and push
git commit -m "feat: add awesome widget"
git push -u origin feat/awesome-widget

# 5. Open a Pull Request targeting the `dev` branch!
```

---

## Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `GLANSK_PORT` | HTTP port to bind the server to | `3000` |
| `GLANSK_HOST` | Host address to bind to | `0.0.0.0` |
| `GLANSK_DATA_DIR` | Directory for SQLite DB, audit logs, and canvas storage | `.glansk` |
| `GLANSK_ADMIN_SECRET` | Master password for Studio access | `glansk-dev` (in dev mode) |
| `GLANSK_SEED_SHOWCASE`| Pre-populate default showcase canvas on initial boot | `1` |
| `GLANSK_ALLOWED_ORIGINS`| Comma-separated list of additional CORS origins | `""` |

---

## Developing Widgets with `@glansk/widget-sdk`

Third-party widgets are bundled as `.glpkg` archives or hosted in isolated iframes.

```bash
cd packages/widget-sdk
bun run build
```

```typescript
import { defineWidget } from "@glansk/widget-sdk";

export default defineWidget({
  init(context) {
    console.log("Widget initialized on display:", context.display.id);

    // Subscribe to reactive canvas variables
    context.variables.subscribe("temperature", (val) => {
      document.getElementById("temp")!.innerText = `${val} °C`;
    });

    // Fetch outbound data via host proxy (secrets automatically injected)
    context.http.fetch("https://api.weather.com/v1/forecast")
      .then(res => res.json())
      .then(data => renderForecast(data));
  }
});
```

To validate and pack a widget directory into a `.glpkg` distribution archive:
```bash
bun run ./packages/widget-sdk/cli/glansk-widget.ts pack ./my-widget ./dist/my-widget.glpkg
```

For full documentation on the **3-Tier Storage Model**, iframe sandboxing, pub/sub event bus, and secret injection, see:
- [**Widget Developer & Architecture Guide**](docs/spec/WIDGET-DEVELOPER-GUIDE.md)
- [**`@glansk/widget-sdk` Package Guide**](packages/widget-sdk/README.md)

---


## Release & Version Bumping

Glansk uses a single-source-of-truth versioning architecture:

```bash
# Bump to next version (automatically updates all manifests and packages/shared/src/version.ts)
bun run bump 0.1.2-alpha
```

---

## Roadmap to v1.0

- [x] High-performance Bun core engine with monotonic revision state broker.
- [x] Multi-widget drag-and-drop canvas with 8px snapping, grouping, and context menus.
- [x] Sandboxed iframe widget runtime and `@glansk/widget-sdk`.
- [x] Realtime SSE event bus and Secret Vault.
- [ ] Hardware-accelerated transitions on Raspberry Pi Chromium kiosk mode.
- [ ] Built-in package registry and community widget hub.
- [ ] Native BLE / Zigbee / MQTT inbound sensor adapter subsystem.
- [ ] Fleet management multi-display orchestration.

---

## Contributing & Community Forks

We want Glansk to be a thriving, community-driven platform where anyone can freely experiment, create widgets, and build custom setups:

- **Forks & Freedom to Build**: You are completely free to fork Glansk, customize it for your own Raspberry Pi or homelab hardware, or deploy it internally without restrictions under the [Apache 2.0 License](LICENSE).
- **Third-Party Widgets**: You can create, distribute, open-source, or commercially publish widgets built with `@glansk/widget-sdk` without needing prior approval or copyleft encumbrance.
- **Contributing Code**:
  1. Fork the repo and create your branch off **`dev`**.
  2. Keep changes focused and test-driven.
  3. Ensure `bun test` (all 266+ tests) passes and `bun run build` succeeds cleanly.
  4. Open a Pull Request targeting **`dev`**.

---

## License

Glansk is open-source software licensed under the **[Apache License 2.0](LICENSE)**.
Commercial homelabs, industrial signage operators, and third-party widget developers are free to use, modify, and build upon Glansk without viral copyleft constraints.

