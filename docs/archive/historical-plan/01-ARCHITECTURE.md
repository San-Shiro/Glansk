# LiteDash Architecture

> Status: target architecture; it does not claim these components already exist.

## System model

- **Package:** versioned, signed/checksummed unit containing a manifest, widget UI assets, optional provider modules, media, and migrations.
- **Widget UI:** visual module instantiated on a canvas.
- **Provider:** non-visual module that publishes state channels and handles declared commands.
- **Node:** authenticated LiteDash participant that advertises capabilities and hosts roles.
- **Display:** role that presents a canvas through a renderer.
- **Renderer:** adapter that turns the canvas and widget UI into pixels.
- **State channel:** revisioned stream of provider or system state.

A single Linux device may host all roles, but topology is not encoded into domain identity. Displays subscribe to channels; providers publish channels; commands route by capability and instance ownership; hardware is exposed through brokers.

## Greenfield core boundaries

### Package manager

Validates archive structure, manifest/schema versions, checksums/signatures, compatibility, migrations, permissions, and quotas. It stages to a non-active location, performs validation, atomically activates, and retains rollback metadata. It never executes installer-provided shell strings.

### Registry

Indexes installed package versions, widget UIs, providers, media, trust tier, compatibility results, and grants. Registry records are derived from validated packages plus administrator policy; manifest claims cannot elevate trust.

### Canvas service

Owns logical canvas documents, widget instances, geometry, themes, schedules, versioning, draft/publish workflow, display assignments, and validation. It publishes immutable canvas revisions and can restore last-known-good revisions.

### State broker

Owns state channels, schemas, current snapshots, monotonic revisions, patch application, subscriptions, retention, freshness, replay limits, and resynchronization. It is independent of persistence format and transport.

### Command router

Resolves a widget instance and declared action to an authorized provider or broker capability. It validates parameters, applies idempotency and rate limits, tracks deadlines, and returns acknowledgements. Clients do not choose arbitrary process IDs, providers, or devices.

### Permission and capability manager

Combines package declarations, trust tier, node capability, and administrator grants. It issues narrow runtime grants for network, filesystem, secrets, GPIO, media, and commands. Deny is the default.

### Node manager

Pairs nodes, rotates credentials, tracks sessions and health, negotiates protocol/codec versions, records capabilities, assigns roles, and handles loss/rejoin. Node identity is bound to authenticated transport credentials.

### Process supervisor

Starts provider workloads from executable plus argv, never shell command strings. It applies dedicated identities and Linux controls, health policy, restart budgets, resource quotas, logging, and lifecycle events. Local process details do not leak into provider identity.

### Persistence

Provides atomic documents and append/revision storage for registry, canvases, grants, node records, audit events, broker checkpoints, and package transactions. Interfaces permit an embedded starting store and later replacement without changing domain services.

### Media pipeline

Imports and identifies media, validates types, records checksums and metadata, creates thumbnails/transcodes/fallbacks, enforces quotas, and serves renderer-appropriate variants. Expensive transforms are scheduled, cached, and observable.

### Renderer adapters

Consume published canvas revisions and state channels through stable contracts. Initial adapter: WPE WebKit/Cog. Later adapter: native/LVGL via scene IR for supported portable content. Adapters report capability and diagnostics; they do not redefine package semantics.

## Logical data flow

```text
package -> package manager -> registry
                              |
admin/editor -> canvas service -> published canvas revision -> display/renderer
provider ----> state broker ----> subscribed displays/widget UIs
widget UI ---> command router ---> provider or GPIO/secret/media broker
node manager <================ authenticated node sessions
```

Local processes use framed Unix sockets. Remote nodes use authenticated WebSockets. Both carry the same protocol envelope and CBOR payload model described in [Protocol](./02-PROTOCOL.md).

## Bootstrap deployment

The initial core is a Bun application because the current repository demonstrates useful HTTP/static-serving and Linux deployment experience. Bun is an implementation choice behind interfaces, not a domain boundary. Each service exposes an in-process interface plus protocol-facing adapter; contract tests run against implementations.

A later Rust replacement is considered component-by-component only when:

1. Pi Zero 2 W profiles show a material bottleneck;
2. the target interface and conformance suite are stable;
3. replacement improves a recorded metric or security property;
4. operational complexity and migration cost are acceptable.

No phase should pause for a speculative whole-core rewrite.

## PiDashboard inventory: selectively reusable now

Reuse means clone, extract, or adapt after review—not assume production readiness.

| Asset | LiteDash use |
|---|---|
| React/Vite admin visual design and selected components | Reuse visual language and isolated components where domain coupling is low; reconnect them to new services. |
| Bun HTTP and static-serving concepts | Bootstrap API, package assets, admin assets, and renderer host behind explicit boundaries. |
| Cage + Cog setup knowledge | Basis for the Linux reference display installer and WPE/Cog lifecycle; harden service/user/session setup. |
| `.wig` staging, validation, backup/rollback concepts | Inform the new transactional package manager; define a new package contract and stronger validation. |
| Existing widget manifests and HTML/CSS assets | Migration fixtures and visual parity corpus; convert through tooling rather than declaring direct compatibility. |
| Fixed logical canvas and editor ideas | Preserve deterministic logical pixels, placement, layering, preview, and scaling concepts. |
| Existing SDK binding ideas | Input to the portable binding/action vocabulary, after contract and security redesign. |

Observed current assets include a Bun server, React/Vite admin, JSON canvas/state files, WebSocket display updates, HTML widget fragments, daemons, `.wig` archives, and a Cage+Cog kiosk script. These are the PiDashboard baseline, not claims about LiteDash.

## Must be rewritten

- **Canvas domain:** canonical schema, drafts/publications, revisions, assignments, schedules, and migrations.
- **Protocol:** canonical CBOR envelopes, framing, negotiation, authenticated remote sessions, revisions, replay, and limits.
- **State broker:** in-memory channel semantics with snapshot/patch/revision contracts; persistence is a checkpoint, not the architecture.
- **Security boundary:** provenance, grants, browser isolation, provider isolation, secrets, auditing, and node identity.
- **Provider runtime:** declared entries, argv execution, WASM/WASI path, quotas, lifecycle, and brokered host imports.
- **Node protocol:** pairing, capability advertisement, assignments, token rotation, reconnect, and revocation.

PiDashboard's file IPC and JSON WebSocket behavior may be useful migration inputs but do not define LiteDash contracts.

## Renderer strategy

### Reference web renderer

WPE WebKit/Cog renders every valid widget UI. Each community widget UI runs in an isolated iframe with a generated CSP and opaque host-issued instance identity. Built-in/reviewed tiers have explicitly documented privileges. The display adapter scales the fixed logical canvas to output dimensions.

### Progressive native renderer

The compatibility analyzer parses portable HTML/CSS and LiteDash attributes into a renderer-neutral scene IR. A native/LVGL adapter consumes supported IR nodes. Packages or modules outside the supported set stay on WPE. Mixed-renderer composition is experimental until correctness, layering, input, media, and lifecycle semantics are proven.

## Failure and consistency model

- Published canvas revisions are immutable; a display activates a revision atomically.
- State channels are ordered per channel, not globally.
- A stale patch is rejected and triggers snapshot resync.
- Commands are at-least-once across reconnect unless an idempotency key enables deduplication; acknowledgement is not proof of physical-world effect unless the provider says so.
- Node loss marks hosted capabilities unavailable and does not silently reroute hardware commands.
- Package activation and rollback are journaled.
- Unknown versions, codecs, capabilities, or grants fail closed.

## Architecture tests

- Contract suites for every core boundary.
- Protocol golden vectors and malformed-frame fuzzing.
- Renderer parity corpus using captured reference images plus semantic checks.
- Transaction crash tests at every package activation step.
- Node disconnect/reconnect and revision-gap tests.
- Permission matrix tests proving denied flows stay denied.
- Pi Zero 2 W performance runs recorded as described in [Development Plan](./05-DEVELOPMENT-PLAN.md).
