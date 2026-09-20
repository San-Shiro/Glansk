# @glansk/widget-sdk

Official Developer SDK for building sandboxed, high-performance widgets and emitters for [Glansk](https://github.com/San-Shiro/Glansk).

Glansk runs widgets in strictly isolated `<iframe sandbox="allow-scripts">` environments with `null` origin and CSP `connect-src 'none'`. This SDK provides the secure bridge for persistence, real-time multi-screen synchronization, inter-widget messaging, canvas variable binding, and secret-injected egress networking.

---

## Quick Start

### 1. Vanilla JavaScript (Zero Dependencies)

Include the canonical Glansk SDK script in your widget's `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Status Widget</title>
  <script src="../../shared/widget-sdk.js"></script>
</head>
<body>
  <div id="counter">Pings: 0</div>
  <button id="pingBtn">Ping</button>

  <script>
    Glansk.connect().then(widget => {
      let pings = 0; // Tier 1: Ephemeral session state

      document.getElementById('pingBtn').addEventListener('click', () => {
        pings++;
        document.getElementById('counter').textContent = `Pings: ${pings}`;
      });

      widget.reportReady();
    });
  </script>
</body>
</html>
```

### 2. TypeScript / ES Modules (`defineWidget`)

```bash
npm install @glansk/widget-sdk
# or
bun add @glansk/widget-sdk
```

```typescript
import { defineWidget } from "@glansk/widget-sdk";

export default defineWidget<{ title?: string }>({
  mount(context, container) {
    const heading = document.createElement("h2");
    heading.textContent = context.config.title || "Default Title";
    container.appendChild(heading);

    // Subscribe to multi-screen shared state
    const unsubscribe = context.shared.on<number>("system_rpm", (rpm) => {
      heading.textContent = `Live RPM: ${rpm}`;
    });

    return () => {
      unsubscribe();
    };
  },
  configChanged(newConfig, context) {
    console.log("Config updated:", newConfig);
  }
});
```

---

## The 3-Tier Storage Model

Widgets run inside sandboxed iframes without `allow-same-origin`. Consequently, native browser storage APIs (`localStorage`, `sessionStorage`, `document.cookie`, `IndexedDB`) throw `SecurityError: Access is denied for this document`.

The SDK provides a **3-Tier Storage Model** that allows widget creators to choose the exact persistence scope **per element / feature** directly in code, with **zero configuration** required in `manifest.json` or canvas files.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        3-Tier Storage Model                            │
├─────────┬───────────────────────────┬──────────────────────────────────┤
│ Tier    │ Scope & Lifecycle         │ API                              │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Tier 1  │ Ephemeral / Session       │ Plain JavaScript: let count = 0; │
│         │ Resets on reload          │ Zero SDK calls                   │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Tier 2  │ Client-Scoped Storage     │ widget.storage.get(key)          │
│         │ Persists across reloads   │ widget.storage.set(key, val)     │
│         │ Resets in incognito/tabs  │ widget.storage.delete(key)       │
├─────────┼───────────────────────────┼──────────────────────────────────┤
│ Tier 3  │ Multi-Screen Shared State │ widget.shared.on(key, callback)  │
│         │ Real-time SSE sync (<1s)  │ widget.shared.set(key, val)      │
│         │ Durable disk persistence  │ widget.shared.get(key)           │
└─────────┴───────────────────────────┴──────────────────────────────────┘
```

### Tier 1: Ephemeral / Session State
Use standard JavaScript variables. They live in memory and reset cleanly on reload:
```javascript
let currentStep = 1;
let scratchNotes = "";
```

### Tier 2: Client-Scoped Storage
Persists data for the specific browser client (backed by the host's `gl_client_id` cookie). Survives page reloads on the same device, but isolates across incognito windows or separate browsers:
```javascript
// Load saved theme on startup
const savedTheme = await widget.storage.get("user_theme");
if (savedTheme) applyTheme(savedTheme);

// Save updated theme
await widget.storage.set("user_theme", "neon-amber");

// Remove key
await widget.storage.delete("user_theme");
```
*Limits: Key length $\le 128$ characters, value payload $\le 16\text{ KB}$.*

### Tier 3: Multi-Screen Shared State
Synchronizes real-time state across **all open kiosks, browser windows, and displays** via Server-Sent Events (SSE) with **0ms local cross-widget fan-out** and durable disk storage:
```javascript
// Listen for real-time changes across all screens
const unsubscribe = widget.shared.on("reactor_speed", (speed, meta) => {
  speedSlider.value = speed;
  rpmDisplay.textContent = `${speed * 1.6} RPM`;
  if (meta?.remote) {
    console.log("Updated from remote kiosk by:", meta.from);
  }
});

// Update state across all kiosks & persist to disk
speedSlider.addEventListener("input", (e) => {
  const val = Number(e.target.value);
  widget.shared.set("reactor_speed", val);
});
```

### Unified State Handle (`widget.state`)
A single reactive handle wrapping all three tiers:
```javascript
// Scope: 'session' | 'client' | 'shared'
const themeState = widget.state("theme", { scope: "client", default: "solar-gold" });

// Read current value
const current = themeState.get();

// Update value
themeState.set("plasma-cyan");

// Subscribe to changes
themeState.subscribe((newVal) => console.log("Theme is now:", newVal));
```

---

## Inter-Widget Event Bus

Widgets on the same canvas can communicate via pub/sub events. Messages also propagate across connected displays:

```javascript
// Publish an event
widget.broadcast("turbine.scram", { active: true, reason: "Manual E-Stop" });

// Subscribe to events
const unsubscribe = widget.onNotification("turbine.scram", (payload) => {
  if (payload.active) {
    showEmergencyOverlay(payload.reason);
  }
});
```

---

## Canvas Variables

Canvases maintain shared reactive variables that can be inspected, updated, and watched:

```javascript
// Inspect all variables
const allVars = widget.getVariables();

// Mutate a canvas variable
widget.setVariable("system.operating_mode", "STANDBY");

// Listen for canvas variable changes
widget.onVariableChange((name, value, all) => {
  if (name === "system.operating_mode") {
    updateModeBadge(value);
  }
});
```

---

## Secure Egress Fetch & Secret Injection

Under Glansk CSP, widgets have `connect-src 'none'` and cannot execute direct `window.fetch()` or `XMLHttpRequest`. All network egress is host-brokered through `widget.fetch()`:

```javascript
// Host-brokered fetch
const res = await widget.fetch("https://api.weather.example/v1/forecast", {
  method: "GET",
  headers: { "Accept": "application/json" },
  timeoutMs: 5000,
});

if (res.ok) {
  const data = await res.json();
  console.log("Forecast:", data);
}
```

### Secret Vault Injection
To access private APIs without exposing API keys inside the client widget code, use the `{{secret:KEY}}` placeholder syntax. The Glansk backend proxy substitutes the secret from its encrypted vault:

```javascript
const res = await widget.fetch("https://api.internal.org/telemetry?token={{secret:TELEMETRY_KEY}}", {
  headers: {
    "Authorization": "Bearer {{secret:AUTH_TOKEN}}"
  }
});
```
*Note: Target domains must be configured in the host's proxy allowlist.*

---

## Lifecycle & Display Identity

### Lifecycle Hooks
```javascript
// React to live configuration changes in the Admin Studio
widget.onConfig((cfg) => {
  if (cfg.title) titleElem.textContent = cfg.title;
});

// Clean up timers/intervals when widget is unmounted
widget.onDestroy(() => {
  clearInterval(telemetryTimer);
});

// Signal to host that rendering has completed
widget.reportReady();
```

### Identity & Display Properties
```javascript
// Immutable widget identity
console.log(widget.identity);
// => { instanceId: "reactor-1", packageId: "glansk.core", widgetId: "quantum-reactor" }

// Physical kiosk display identity (null in Admin Editor preview)
if (widget.display) {
  console.log(widget.display.id); // e.g. "mobile-stress-global"
  console.log(widget.display.storageNamespace); // e.g. "gl_bW9iaWxl..."
}
```

---

## CLI Tooling (`glansk-widget` / `gl-widget`)

The package includes CLI tools for key generation, cryptographic signing, packaging, and archive integrity verification:

```bash
# 1. Generate an Ed25519 Developer Keypair
bunx glansk-widget keygen --out ./keys --name developer
# Outputs: ./keys/developer.private.key, ./keys/developer.public.key
# Displays Developer Origin Identity (e.g. SHA256:7f3a...)

# 2. Package and Cryptographically Sign a .glpkg Archive
bunx glansk-widget pack ./my-widget-package \
  --sign ./keys/developer.private.key \
  --version-code 120 \
  --out ./dist/my-package-1.2.0.glpkg

# 3. Verify Package Integrity & Developer Origin
bunx glansk-widget verify ./dist/my-package-1.2.0.glpkg
```

### Security Guarantees
- **Origin Continuity (Signer Pinning)**: Once installed, package upgrades MUST be signed by the identical developer key. Unauthorized origin updates are rejected by the Glansk platform.
- **Anti-Rollback (`versionCode`)**: Monotonic positive 32-bit integer ($1 \le \text{versionCode} \le 2,147,483,647$). Downgrades are blocked by default to prevent rollback attacks unless administrative override `allowDowngrade: true` is supplied.
- **Bidirectional File Verification**: Unlisted file injections or archive digest mismatches are rejected before extraction.

---

## Security & Sandbox Constraints

Glansk enforces military-grade embedded security invariants:

1. **No Ambient Storage**: `localStorage` and `IndexedDB` are structurally disabled by the sandbox. Always use `widget.storage` or `widget.shared`.
2. **Strict CSP**: `connect-src 'none'` blocks raw networking. Always use `widget.fetch()`.
3. **Bounded Payloads**: State updates and messages are enforced to $\le 16\text{ KB}$ to protect embedded devices (e.g. Raspberry Pi Zero 2 W).
4. **Isolated Origins**: Iframe windows possess an opaque `null` origin, preventing CSRF or DOM access to the host window.

---

## Architectural Specification

For the full architectural and message broker specification, see [docs/spec/WIDGET-DEVELOPER-GUIDE.md](../../docs/spec/WIDGET-DEVELOPER-GUIDE.md).

---

## License

Apache-2.0 / MIT © Glansk Authors

