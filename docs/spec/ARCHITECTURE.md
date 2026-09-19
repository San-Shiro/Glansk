# Architecture

## Confirmed facts

Glansk remains distributed: providers publish state channels and displays/widgets subscribe. State is ordered per channel and uses snapshots/deltas, revisions, validation, bounded delivery, and resynchronization. The base synchronization service has changed and JSON is not used for synchronization.

The replacement service API, codec, framing, transport, and non-JSON representation are not documented. Earlier CBOR envelope, Unix length framing, and JSON path-patch details are therefore not treated as current integration contracts.

## Boundaries

```text
base sync service <-> SyncAdapter <-> opaque EncodedFrame <-> Codec<TMessage>
                                                        |
                                           typed integration mapping
                                                        |
                           StateBroker<TState,TDelta> <-> StateTransition
```

- `StateBroker` owns channel consistency: schema, revision, causality, conflict policy, snapshots/deltas, subscriptions, and resync.
- `StateTransition` alone understands a state/delta representation and supplies cloning, validation, application, and size measurement.
- `Codec` converts typed integration messages to opaque bytes.
- `SyncAdapter` owns external delivery, lifecycle, backpressure, and retryable/non-retryable errors.
- The broker never parses frames, chooses a codec, opens a transport, or traverses paths.

## Consistency and failure policy

Updates carry an expected revision and operation ID. Stale revisions, schema mismatch, invalid results, oversized payloads, or reused operation IDs fail closed. Broker state is defensively cloned. Subscriber queues are bounded; overrun drops the invalid delivery chain and emits `resync_required`. A requested revision that cannot be replayed also requires a snapshot.

## Composition

Bootstrap HTTP exposes health and human-authored canvas operations only. Sync is intentionally not composed until the real base-service contract is known. JSON remains permitted for canvas/configuration and document persistence; it is absent from the synchronization core API.


## Durable canvas repository

The composition root uses `DurableCanvasService` over `FileCanvasRepository`. A schema-versioned v2 repository stores drafts and immutable publications in separate records, guarded by both draft revisions and a store revision. Commits acquire a filesystem lock, flush a uniquely staged file, preserve the prior committed file as recovery backup, and atomically rename the stage. Startup migrates v1 records, recovers a missing/corrupt primary from backup, and fails closed when neither copy is readable. JSON is an implementation detail behind this human-facing persistence boundary, not a synchronization format.

## Admin/editor application boundary

`domain/canvas.ts` defines draft, summary, workspace and command contracts. `CanvasService` owns use cases; HTTP is only an adapter. `editor/session.ts` is a pure working-state model. Persisted draft documents, transient editor state, immutable publication state, and runtime state are deliberately separate.

## Runtime and activation

`projectDocument` is the application boundary shared by editor preview and live publication projection. It validates the canvas and creates a deterministic immutable render artifact with fixed logical dimensions, ordered widget frames, opaque instance identities, sandbox requirements, and a content digest. Renderer implementations sit behind lifecycle handles with readiness, health, and stop operations.

`ActivationRuntimeService` stages a candidate without replacing the current handle, enforces per-canvas operation exclusion and expected-active-revision checks, and swaps only after readiness and health pass. It durably records artifacts and activation metadata in a separate atomic repository for restart recovery. Candidate failure preserves the running revision; restart attempts are bounded; rollback starts the prior last-known-good artifact before swapping. Renderer process state and broker-fed widget state are ephemeral and never serialized into a canvas document. The runtime does not select a transport or codec and introduces no JSON live synchronization path.

## Implemented widget SDK validation slice

One deterministic showcase instance (`glansk.demo/sdk-status`, instance `footer`) exercises the universal web boundary without replacing the other host-rendered showcase tiles. The kiosk creates an iframe with exactly `sandbox="allow-scripts"`; omitting `allow-same-origin` gives packaged code an opaque (`null`) origin. The host binds a random nonce and the runtime-derived package/widget/instance identity to the iframe's exact `WindowProxy`. Bridge messages are accepted only when protocol, opaque origin, source window, identity, and nonce all match.

The packaged SDK currently implements `connect`, `onConfig`, `reportReady`, and snapshot `subscribe`. Subscription is mediated by a narrow same-host adapter: the host derives identity, allowlists the instance channel, and calls `WidgetStateSource`; widget code receives no bearer credential or direct broker access. `ShowcaseWidgetState` is backed by the existing revisioned `InMemoryStateBroker` and fails closed for every identity/channel outside this demonstration grant.

The packaged validation suite now adds three engine-facing widgets: `telemetry-chart` consumes an ordered snapshot plus deltas and explicitly resynchronizes on gaps; `command-control` invokes only `showcase.acknowledge` and displays correlated success/denial; `status-grid` consumes nested configuration and two independently authorized state channels with loading/empty/error rendering and unsubscribe cleanup. Deterministic server-side adapters seed all state and command outcomes through existing broker contracts.

The SDK surface is now `connect`, `onConfig`, `reportReady`, revision-aware `subscribe`/unsubscribe, and correlated `command`. Every iframe retains `sandbox="allow-scripts"` without same-origin authority. Host routing derives identity from the active runtime, checks exact source, opaque origin, nonce, protocol, message shape and a 16 KiB bound, and applies per-instance channel/command allowlists before same-host adapters run. Widgets receive no broker/device credential or ambient network access.

The packaged runtime now also includes `glansk.media/image-carousel`, selected through a narrow package/widget registry. Its two-image ping-pong renderer decodes one candidate before display, fades only opacity, uses one-shot timers and generation tokens, and receives authenticated `config-update`/`destroy` lifecycle messages over the existing source/origin/identity/nonce-bound bridge. Widget responses carry `default-src 'none'`, `connect-src 'none'`, and narrowly allow same-host scripts, styles, and images; the iframe remains `sandbox="allow-scripts"` with an opaque origin. Media routing accepts only package-local raster assets from the registered carousel.

This remains a validation suite, not the complete package runtime. Dynamic package discovery/install, manifest-derived grants, schema registry checks, rate limits, long-lived production streaming, and the production sync adapter remain future work.
