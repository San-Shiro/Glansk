# LiteDash Widget SDK

> Status: Full authoring contract and production runtime implemented in `@litedash/widget-sdk` and `src/shared/widget-sdk.js`. Implemented SDK methods include `connect`, `onConfig`, `reportReady`, `onDestroy`, revision-aware `subscribe`/`unsubscribe`, correlated `command`, the **3-Tier Storage Model** (`widget.storage` client persistence, `widget.shared` real-time SSE multi-screen sync, and ephemeral session state), inter-widget pub/sub event bus (`broadcast`/`onNotification`), canvas variable binding/mutation, host-brokered fetch with vault secret injection (`widget.fetch`), and display identity (`widget.display`).


## Authoring model

A package can contain one or more widget UIs and optional providers. The web renderer is universal and the reference result. Portability is declared per widget UI; it never removes access to the web path.

## Package layout

```text
my-package/
├── manifest.json
├── ui/
│   └── weather-card/
│       ├── index.html
│       ├── styles.css
│       ├── main.js
│       └── assets/
├── providers/
│   ├── weather.wasm
│   └── provider.json
├── media/
├── schemas/
│   ├── weather-state.json
│   └── refresh-command.json
└── LICENSE
```

Archives use a versioned LiteDash package extension chosen during packaging work. Existing `.wig` files are migration inputs; format compatibility is not assumed.

## Manifest sketch

Human-authored JSON remains canonical for manifests:

```json
{
  "schemaVersion": 1,
  "id": "org.example.weather",
  "version": "1.0.0",
  "name": "Weather Card",
  "widgets": [{
    "id": "weather-card",
    "entry": "ui/weather-card/index.html",
    "renderer": {"web": true, "profile": "portable-1"},
    "javascript": "portable",
    "state": [{"channel": "weather", "schema": "schemas/weather-state.json"}],
    "actions": [{"name": "refresh", "schema": "schemas/refresh-command.json"}],
    "defaults": {"width": 420, "height": 240}
  }],
  "providers": [{
    "id": "weather-provider",
    "runtime": "wasm-wasi",
    "entry": "providers/weather.wasm",
    "publishes": ["weather"],
    "handles": ["refresh"],
    "capabilities": {"network": ["weather-api"]}
  }],
  "capabilities": {
    "network": [{"id": "weather-api", "https": ["api.example.invalid:443"]}],
    "secrets": ["weather-api-key"]
  }
}
```

The final schema defines strict IDs, versions, integrity entries, configuration schema, localization, media variants, preview fixtures, compatibility declarations, and migrations. Trust is not author-controlled.

## Web renderer

The web renderer supports standards-based HTML/CSS/JS subject to trust-tier CSP and iframe isolation. It is the universal/reference path for:

- all valid packages;
- advanced layout, typography, filters, animation, SVG, canvas, and capable media;
- modules not accepted by the native compatibility analyzer;
- visual reference snapshots and author preview.

The host injects no ambient authority. The SDK communicates through a narrow message bridge whose identity is bound to the iframe source.

## Portable profile

`portable-1` is a constrained, valid subset of HTML/CSS plus LiteDash binding/action attributes. It is still rendered as ordinary web content in WPE.

Initial candidate surface:

- semantic containers, text, image, button, lists, and a bounded SVG subset;
- block/flex/grid subset, fixed/relative sizing, spacing, color, borders, radius, opacity, transforms, and approved transitions;
- packaged fonts subject to license and memory policy;
- no DOM construction required for data updates;
- deterministic bindings and actions.

Example:

```html
<article class="card" ld-show="state.available">
  <img ld-attr-src="state.icon" alt="">
  <strong ld-text="state.temperature" ld-format="number:1"></strong>
  <button ld-action="refresh">Refresh</button>
</article>
```

Bindings resolve typed state/config paths without expression evaluation. Action attributes invoke manifest-declared commands for the host-derived widget instance. Dynamic style/property bindings use an allowlisted typed vocabulary, not arbitrary JavaScript strings.

## JavaScript modes

- **`web`:** package JavaScript may use the documented browser SDK under its CSP; native compatibility is not promised.
- **`portable`:** JavaScript is limited to a specified deterministic SDK/module subset that the analyzer can model or reject. No ambient fetch, storage, eval, or host identity.
- **`none`:** widget UI is declarative HTML/CSS and bindings/actions only; best candidate for native compilation.

A package may provide separate modules/modes, but the manifest selects them explicitly. Analyzer rejection is diagnostic, not a reason to degrade the WPE result.

## SDK surface

The canonical SDK surface available to widgets:

```js
const widget = await LiteDash.connect();

// 1. 3-Tier Storage Model
let sessionNotes = "";                           // Tier 1: Ephemeral session state
await widget.storage.set("theme", "solar-gold");  // Tier 2: Client-scoped storage (persists on reload)
widget.shared.on("rpm", (rpm) => render(rpm));   // Tier 3: Multi-screen shared state (real-time SSE)
widget.shared.set("rpm", 85);

// 2. Inter-Widget Pub/Sub
widget.broadcast("reactor.scram", { active: true });
widget.onNotification("reactor.scram", (payload) => handleScram(payload));

// 3. Canvas Variables & Dynamic Bindings
widget.setVariable("system.mode", "ACTIVE");
widget.onVariableChange((name, val) => console.log(name, val));

// 4. Secure Host-Brokered Egress & Vault Secrets
const res = await widget.fetch("https://api.example/data?key={{secret:API_KEY}}");

// 5. Channel Subscriptions & Correlated Commands
widget.subscribe("weather", (snapshot) => render(snapshot.value));
const result = await widget.command("refresh", {}, { idempotencyKey });

// 6. Lifecycle & Identity
widget.onConfig((config) => applyConfig(config));
widget.onDestroy(() => cleanup());
widget.reportReady();

console.log(widget.identity); // { instanceId, packageId, widgetId }
console.log(widget.display);  // { id, storageNamespace } or null in admin
```

The host supplies package/widget/instance identity. The UI never chooses a provider process or node. APIs are asynchronous, schema-checked, abortable, rate-limited, and lifecycle-aware. Preview fixtures use the same state and command schemas.


## Native compatibility analyzer and scene IR

The analyzer parses package assets; it does not execute package JavaScript. It reports supported nodes/properties/media, unsupported features with source locations, estimated costs, and the fallback renderer.

Supported portable content is compiled into a versioned scene IR containing layout nodes, text/font references, paint, images, animations, bindings, actions, accessibility/input metadata, and resource IDs. The scene IR is a compiler boundary, not a hand-authored package format.

The native/LVGL adapter grows support over time. Unsupported widget UIs continue in WPE rather than losing visual quality. Production native status requires semantic, visual, input, lifecycle, and performance conformance—not merely successful parsing.

## Providers and WASM

Community data logic should use WASM/WASI when possible. A provider receives explicit, capability-checked host imports to publish a state channel, receive declared commands, make approved HTTP requests, use bounded storage, access secrets by handle, and call logical hardware capabilities. It has memory, CPU/fuel, concurrency, output, and deadline quotas.

WASM is a provider runtime, not a renderer and not a way to embed arbitrary native UI.

## Media

- **Images:** packaged or brokered; metadata, dimensions, decoding cost, and variants are validated. Prefer renderer-appropriate WebP/PNG/JPEG variants.
- **SVG:** supported in WPE; portable/native support is a declared subset with raster fallback generation when permitted.
- **Lottie/GIF:** WPE support depends on packaged runtime/platform decoding; pipeline may generate optimized or static fallbacks. Native support is capability-reported.
- **Video:** available on capable Linux displays when codec/decode budgets pass; manifests declare fallback poster/image or alternate UI. No promise on native-lite/ESP32 nodes.
- **Fonts:** packaged with explicit licenses and subsets where possible; fallback stacks are required.

The media pipeline selects variants by renderer/node capability without rewriting widget semantics.

## GPIO and hardware

Widget UIs declare logical actions/state such as `porch-light.set` or `doorbell.pressed`. They never address BCM numbers, chips, `/dev`, buses, or node IDs. Administrators map logical capability to a hardware node and safe physical configuration. Providers and UIs see typed broker contracts only.

## Author tooling and validation

Planned tools provide manifest/schema validation, local WPE preview, state/command fixtures, CSP diagnostics, portable-profile analysis, scene-IR inspection, package integrity generation, permission review, media budget reports, and Pi Zero 2 W benchmark scenarios. CI produces actionable compatibility reports while keeping the universal web path available.
