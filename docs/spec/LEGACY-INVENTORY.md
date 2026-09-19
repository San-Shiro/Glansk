# PiDashboard reference inventory

PiDashboard was inspected read-only. Glansk does not preserve its architecture.

| Area inspected | Classification | Conceptual takeaway |
|---|---|---|
| Bun server/router/static serving | Reuse pattern | Keep a small composition root and explicit boundaries; avoid the legacy all-in-one server module. |
| Canvas schemas, validator, tests | Reuse pattern + migration fixture | Preserve fixed logical pixels, bounds, duplicate checks, and fixture tests; use strict non-mutating versioned contracts. |
| Compositor/widget frame | Reference only | Preserve deterministic placement, iframe isolation, and preview/live parity; rewrite renderer host and identity bridge. |
| State store/deep merge | Reference only | Preserve size limits, prototype-pollution defense, and atomic writes; replace merge/file IPC semantics with revisioned snapshots/patches. |
| WebSocket display routing | Reference only | Preserve server-derived role/instance ownership, rate limits, bounded maps, and coalescing lessons; replace JSON protocol entirely. |
| Widget SDK/bindings and manifests | Migration fixtures | Inform declarative bindings/actions and visual corpus; do not claim direct compatibility. |
| React admin components/themes | Selective future candidate | Reuse visual language or low-coupled primitives only after reconnecting to new services. |
| `.wig` archives and staging ideas | Migration/reference | Inform validation, staging, integrity, activation, and rollback; create a new package contract. |
| Cage/Cog installer and service knowledge | Operational reference | Retain Linux seat/session/readiness lessons; harden users, services, isolation, and update behavior. |
| Daemon scripts/file IPC | Discard as architecture | Replace shell/file authority with supervised argv/WASM providers and capability brokers. |
| Existing canvases/widgets/media | Migration/visual fixtures | Import read-only later with compatibility reports and checksums. |

No legacy files were changed and no legacy code was copied into Glansk.
