# Display Identity Contract

Glansk can propagate a screen identity to sandboxed widget iframes so that
widgets can namespace future per-screen state once a host-brokered storage
mechanism is available.

## Overview

Each physical kiosk display has a unique URL path: `/kiosk/<canvasId>`. That
path segment becomes the **display id** — an opaque, host-issued identifier
scoped to a specific screen.

The identity travels through the rendering chain entirely within the host
process; it never touches an iframe query string, URL fragment, or message
originating from the widget.

```
/kiosk/<displayId>
  └── src/kiosk/app.js          bindDisplay(id) → sets currentDisplayId
        └── renderCanvas(…, { renderContext: { display: { id } } })
              └── src/shared/canvas-render.js
                    └── createWidgetFrame(widget, renderContext)
                          └── src/shared/widget-host.js
                                → computes storageNamespace
                                → stores { id, storageNamespace } per entry
                                → includes display in 'connected' handshake
                                      ↓ postMessage
                                    widget sdk.js
                                      → api.display = { id, storageNamespace }
```

## The `connected` handshake

When a widget sends `{ type: 'connect' }`, the host replies with:

```json
{
  "protocol": "glansk.widget.v1",
  "type": "connected",
  "instanceId": "footer",
  "nonce": "<random-uuid>",
  "identity": { "instanceId": "footer", "packageId": "glansk.demo", "widgetId": "sdk-status" },
  "config": { … },
  "display": {
    "id": "main",
    "storageNamespace": "ld_bWFpbnxsaXRlZGFzaC5kZW1vfHNkay1zdGF0dXN8Zm9vdGVy"
  }
}
```

`display` is **omitted** when the widget is rendered in the admin editor preview.

## Widget SDK

```js
const widget = await Glansk.connect();

// null in admin editor; { id, storageNamespace } on a named kiosk display
console.log(widget.display);

// identity is always present
console.log(widget.identity); // { instanceId, packageId, widgetId }
```

## Admin editor isolation

`CanvasStage.tsx` calls `renderCanvas()` **without** a `renderContext`. Widget
iframes rendered by the editor therefore receive `null` for `widget.display`.
This is intentional — editor previews must not behave as a named production
display, and widget code should gracefully handle `display === null`.

## `storageNamespace`

`storageNamespace` is a deterministic, URL-safe, base64url-encoded string scoped
to all four of:

| Dimension    | Example value          |
|---|---|
| display      | `main`                 |
| packageId    | `glansk.demo`        |
| widgetId     | `sdk-status`           |
| instanceId   | `footer`               |

**Formula** (see `src/widget-sdk/contracts.ts → makeStorageNamespace` and the
inline copy in `src/shared/widget-host.js`):

```
raw   = encodeURIComponent(displayId)  + '|'
      + encodeURIComponent(packageId)  + '|'
      + encodeURIComponent(widgetId)   + '|'
      + encodeURIComponent(instanceId)

storageNamespace = 'gl_' + base64url(raw)
```

`|` is used as separator because `encodeURIComponent` encodes it to `%7C`,
making it impossible for any part to contain the literal separator. The result
is stable across process restarts for the same four inputs.

## Important constraints

### Iframe storage is unavailable

Sandboxed iframes load with an **opaque ("null") origin**
(`sandbox="allow-scripts"` without `allow-same-origin`). This means:

- `localStorage` and `sessionStorage` **throw or silently fail** (browser-dependent).
- Cookies are **not stored** (null origin has no cookie jar).
- `IndexedDB` is **inaccessible**.
- `Cache API` is **not available**.

`storageNamespace` reserves a namespace for host-brokered persistent storage.
Widgets **must not** attempt to use browser storage APIs directly.

### Host-brokered storage (implemented)

Host-brokered storage is fully implemented via the **3-Tier Storage Model**:
- **Client Storage (`widget.storage`)**: Uses `storage-get`, `storage-set`, and `storage-delete` messages brokered through the host to `/api/v1/interactive-state?mode=cookie` scoped by client cookie (`gl_client_id`).
- **Multi-Screen Shared State (`widget.shared`)**: Uses `shared-subscribe` and `shared-set` messages with local 0ms cross-widget fan-out, server disk persistence, and real-time Server-Sent Events (SSE) across all physical displays and kiosks.
- **Display Identity**: Available on `widget.display` (`{ id, storageNamespace }`) when running in a kiosk environment (`/kiosk/<displayId>`). Null in the Admin Studio preview to ensure preview isolation.

See [WIDGET-DEVELOPER-GUIDE.md](../WIDGET-DEVELOPER-GUIDE.md) for full API details and examples.

### Display identity must not authorize actions


`display.id` and `display.storageNamespace` are **informational identifiers**.

- Widget code must **not** use them to claim elevated permissions.
- The server must **not** grant additional command/state access based on a
  display id received in a widget message payload.
- All authorization is enforced server-side through the widget broker using
  server-managed state, not message-payload claims.

## Security properties preserved

| Property | Status |
|---|---|
| Sandbox remains `allow-scripts` only | ✅ unchanged |
| `allow-same-origin` NOT added | ✅ unchanged |
| Source + nonce validation unchanged | ✅ unchanged |
| Display id is host-issued (from kiosk URL path) | ✅ by design |
| Display id NOT placed in iframe `src` query strings | ✅ by design |
| Admin editor previews receive no display identity | ✅ by design |
| Widget cannot forge display identity | ✅ host computes it; widgets receive it read-only |

## Files changed

| File | Change |
|---|---|
| `src/widget-sdk/contracts.ts` | `DisplayIdentity`, `ConnectedMessage`, `makeStorageNamespace` |
| `src/shared/widget-host.js` | stores `display` per entry; includes it in 'connected' reply |
| `src/shared/canvas-render.js` | accepts `renderContext` option; forwards to `createWidgetFrame` |
| `src/kiosk/app.js` | sets `currentDisplayId` in `bindDisplay`; builds `renderContext` in `render` |
| `src/shared/widget-sdk.js` | canonical SDK — new `display` and `identity` getters on api |
| All `widgets/**/sdk.js` | updated to canonical SDK |
| `admin-ui/src/shared-canvas.d.ts` | `RenderContext` type; `renderContext` on `RenderOptions` |
