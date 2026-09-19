# LiteDash Development Plan

> Status: execution plan from greenfield baseline through product and ecosystem. Each phase exits through evidence, not feature claims.

## Priorities

- **P0:** contracts, correctness, security boundary, transactional recovery, reference web renderer.
- **P1:** complete distributable Linux product, remote nodes, hardware, media, migration, operations.
- **P2:** native renderer progression and community scale after P0/P1 contracts stabilize.

## Measurement policy

Raspberry Pi Zero 2 W is the constrained reference for core and web-display budgets, not a promise that every package or video workload runs there. At Phase 0, record board revision, OS/kernel, power mode, storage, display mode, WPE/Cog/Bun versions, thermal conditions, package/canvas fixture, and test duration. Capture boot-to-ready, idle/active CPU, RSS/PSS, frame cadence and missed frames, input-to-command latency, state fan-out latency, reconnect time, package install/rollback time, storage writes, temperature/throttling, and crash recovery.

The first repeatable runs establish baselines; no guaranteed values are invented here. Each metric gets an owner, method, raw artifact location, median/tail summary where relevant, and an approved regression threshold. Thresholds are committed with the benchmark manifest and changed only by reviewed evidence. CI uses representative host tests; scheduled/hardware release runs enforce Pi gates.

## Phase 0 — Branch baseline and inventory (P0)

**Deliverables**
- Freeze LiteDash branch reference and inventory PiDashboard assets, licenses, test status, security findings, and data formats.
- Classify files/components as reuse candidate, migration fixture, reference only, or discard.
- Create architecture decision log, terminology, hardware benchmark manifest, risk register, and documentation ownership.
- Capture existing canvases/widgets as visual and migration fixtures without asserting compatibility.

**Dependencies:** none.

**Exit criteria**
- Reproducible PiDashboard build/test/deploy observations are recorded.
- No unexplained reusable component or persisted data class remains.
- Initial Pi Zero 2 W baseline run and raw artifacts are stored.

**Tests/gates:** repository integrity, license scan, fixture checksums, baseline repeatability, no modifications to legacy fixtures during capture.

**Migration/reuse:** identify React components, Bun serving patterns, Cage+Cog setup, `.wig` transaction ideas, manifests/assets, and fixed-canvas editor concepts.

## Phase 1 — Contracts and skeleton (P0)

**Deliverables**
- Versioned JSON schemas for package, widget UI, provider, canvas, configuration, capabilities, state, commands, and scene-IR placeholder.
- CBOR envelope, Unix framing, WebSocket negotiation, error, limit, revision, and idempotency contracts.
- Service interfaces for all architecture boundaries and a Bun composition root.
- Golden CBOR vectors, generated test fixtures, protocol diagnostic exporter, and ADRs.

**Dependencies:** Phase 0 inventory.

**Exit criteria**
- Independent encoder/decoder implementations pass golden vectors.
- Every service boundary has contract tests and explicit error semantics.
- JSON is absent from high-frequency protocol test paths.

**Tests/gates:** malformed/fuzzed frame corpus, deterministic encoding checks, version negotiation matrix, schema compatibility checks, memory-bounded decoder tests.

**Migration/reuse:** legacy JSON formats receive read-only analyzers; do not bend new contracts around file IPC.

## Phase 2 — Persistence, canvas, registry, and state broker (P0)

**Deliverables**
- Atomic persistence adapter and migration journal.
- Package registry model and immutable canvas draft/publish revisions.
- In-memory state broker with snapshots, patches, schemas, revisions, subscriptions, bounded replay, freshness, and checkpoints.
- Command router with instance ownership, action schema validation, deadlines, acknowledgements, idempotency, and rate limits.

**Dependencies:** Phase 1 contracts.

**Exit criteria**
- Restart restores published canvas, registry, grants, and broker checkpoints consistently.
- Revision gaps trigger replay or snapshot; stale patches never apply.
- Duplicate command keys do not duplicate side effects in the conformance provider.

**Tests/gates:** property tests for patch/revision logic, crash injection around persistence, fan-out/backpressure load, reconnect storms, state-size and subscription limits, command authorization matrix.

**Performance gate:** record Pi Zero 2 W broker throughput/latency/memory under fixed fixtures; approve regression thresholds from measured baseline.

**Migration/reuse:** fixed logical pixel ideas inform the canvas schema; existing canvas JSON becomes importer input only.

## Phase 3 — Web renderer and editor parity (P0)

**Deliverables**
- WPE/Cog renderer adapter in Cage, fixed logical canvas scaling, lifecycle, health, last-known-good revision, and diagnostics.
- Isolated widget iframe host, generated CSP, source-derived message identity, SDK bridge, state bindings, actions, config, preview fixtures.
- React admin shell and canvas editor connected to new services; selectively reuse low-coupled visual components.
- Visual fixture corpus imported from existing widgets where licensing permits.

**Dependencies:** Phase 2 published canvas/broker; frontend security design.

**Exit criteria**
- Reference fixtures render, update state, issue commands, resize, reload, and recover after renderer restart.
- Editor preview and display consume the same widget UI contract.
- Unsupported/failed widget UIs are isolated and cannot take down the canvas.

**Tests/gates:** screenshot plus semantic parity, animation/frame traces, iframe identity forgery, CSP regression, input focus, font/media failure, display restart and canvas rollback.

**Performance gate:** record boot-to-ready, idle/active memory/CPU, frame cadence, and state-to-pixel latency on Pi Zero 2 W; thresholds derive from baseline review.

**Migration/reuse:** reuse React visual design selectively and Cage+Cog operational knowledge; compositor/runtime code is rewritten.

## Phase 4 — Packaging and security boundary (P0)

**Deliverables**
- Transactional package manager, canonical file list/checksums, optional/required signature policy, provenance, grants UI, update diff, rollback.
- Trust tiers and frontend policy.
- Provider supervisor with argv execution, dedicated users/systemd transient units or equivalent controls, quotas, health/restart budgets.
- WASM/WASI provider host with explicit imports and quotas.
- Secret broker, structured audit log, and security operator diagnostics.

**Dependencies:** Phases 1–3; Linux isolation probes.

**Exit criteria**
- Install interruption at every journal step leaves old or new package valid, never a mixed active tree.
- Community package cannot elevate trust or acquire undeclared capabilities.
- Required isolation failure prevents provider start.
- Secret values do not appear in logs/debug exports.

**Tests/gates:** archive/parser fuzzing, signature/checksum tampering, zip-bomb/path/link cases, process/filesystem/network/device escape attempts, quota exhaustion, CSP tests, audit completeness, rollback health failure.

**Security gate:** threat-model review and independent abuse-case pass before accepting public community packages.

**Migration/reuse:** adapt `.wig` staging/validation/backup lessons; define a new package format and importer.

## Phase 5 — Remote nodes (P1)

**Deliverables**
- Pairing ceremony, unique credentials, TLS WebSocket sessions, token/certificate rotation and revocation.
- Node registration, capability revisions, labels, role/display assignments, health, offline behavior, and remote provider placement.
- Store-and-resync policy and operator fleet views.

**Dependencies:** protocol, broker, capability manager, audit log.

**Exit criteria**
- Display, provider, and controller roles operate on three separate nodes.
- Lost/revoked nodes cannot reconnect or retain command authority.
- Disconnect/reconnect preserves revision and idempotency semantics.

**Tests/gates:** MITM/replay/downgrade attempts, pairing brute force limits, clock skew, credential overlap rotation, network partitions, slow links, duplicate connections, capability spoofing, queue bounds.

**Performance gate:** measured reconnect/resync and remote state/command latency under documented network profiles.

**Migration/reuse:** PiDashboard's remote-host seam is conceptual evidence only; node protocol and ingress are new.

## Phase 6 — Hardware and GPIO (P1)

**Deliverables**
- Board/node capability profiles; Linux GPIO broker using current kernel interfaces.
- Logical capability mapping, safe states, polarity, debounce, exclusivity, input state channels, and output commands.
- Controller-node agent; ESP32 protocol/profile for controller or native-lite role where justified.
- Admin mapping, simulation, and emergency disable controls.

**Dependencies:** capability manager, command router, remote nodes, audit.

**Exit criteria**
- Widget package contains no physical pin/node assumptions.
- Startup, shutdown, disconnect, crash, and conflict return hardware to defined behavior.
- Unauthorized packages cannot observe or drive ungranted lines.

**Tests/gates:** supported-board matrix, loopback rigs, debounce/noise, conflicting grants, provider crash, node loss, rate abuse, safe-state verification.

**Migration/reuse:** existing GPIO concepts/configuration are migration research; runtime is rewritten around logical capabilities.

## Phase 7 — Media pipeline and optimization (P1)

**Deliverables**
- Content-addressed import, metadata, validation, quotas, thumbnails, renderer variants, fallback policy, cache lifecycle.
- Images, SVG, Lottie/GIF, fonts, and capable-Linux video path with poster/static fallbacks.
- Hardware decode capability reporting and workload admission diagnostics.

**Dependencies:** package manager, renderer/node capabilities, persistence.

**Exit criteria**
- Invalid/oversize media fails safely; missing capability selects declared fallback.
- Cache cleanup cannot delete active package media.
- Representative canvases meet approved Pi budgets or produce clear admission warnings.

**Tests/gates:** malformed media corpus, decompression bombs, codec absence, disk-full recovery, cache races, color/orientation, long-duration playback, thermal/throttling runs.

**Performance gate:** record decode CPU/memory/frame impact and storage amplification by media class; thresholds are evidence-based.

## Phase 8 — Native renderer experimental (P2)

**Deliverables**
- Portable-profile validator, compatibility report, versioned scene IR compiler.
- Experimental native/LVGL adapter for selected layout/text/image/binding/action features.
- Explicit WPE fallback and developer comparison tooling.

**Dependencies:** stable widget SDK, media variants, protocol, fixture corpus.

**Exit criteria**
- Analyzer never executes package JS and reports every unsupported feature.
- Supported fixtures pass semantic/input/state lifecycle tests.
- Unsupported modules remain visually intact in WPE.

**Tests/gates:** compiler fuzzing, scene IR golden files, cross-renderer semantic tests, visual tolerances, memory leaks, locale/font/input cases.

**Deferral:** mixed-renderer production composition, arbitrary JS, video parity, and ESP32 display parity remain out of scope.

## Phase 9 — Native renderer production (P2)

**Deliverables**
- Production feature matrix, admission policy, stable IR/version migration, renderer crash isolation, telemetry, rollback, and author certification report.
- Supported native-lite node profiles based on measurements.

**Dependencies:** experimental evidence and real package corpus.

**Exit criteria**
- Declared supported subset meets documented correctness and performance gates across supported nodes.
- Renderer selection/fallback is deterministic and operator-visible.
- A renderer update can roll back without package/canvas data loss.

**Tests/gates:** soak, power-loss, upgrade/downgrade, long animation/state streams, accessibility/input where supported, fleet canary rollout.

## Phase 10 — Migration and product completion (P1)

**Deliverables**
- PiDashboard inventory importer for canvases, manifests/assets, media, configuration, and supported providers.
- Per-item compatibility report, preview, conflict resolution, backup, dry run, and rollback.
- Complete admin workflows: first-run, packages, editor, displays, nodes, grants, secrets, hardware, updates, diagnostics.

**Dependencies:** stable package/canvas/provider contracts and reference renderer.

**Exit criteria**
- Golden legacy fixtures migrate deterministically or report an actionable unsupported reason.
- Source data is never modified; repeated dry runs are idempotent.
- Representative users complete install-to-display and recovery workflows.

**Tests/gates:** corrupt/partial legacy data, duplicate IDs, unsupported scripts/providers, visual review, migration interruption, accessibility/usability studies.

**Reuse:** convert visual assets and editor concepts; rewrite domain/protocol/security/provider/node behavior.

## Phase 11 — Release and operations (P1)

**Deliverables**
- Signed Linux packages/images, installer/updater, service units, Cage/Cog session setup, backups/restores, health/readiness, logs/metrics, diagnostics bundle, release channels and rollback.
- Supported hardware/OS matrix, upgrade policy, security response, reproducible build evidence, operator documentation.

**Dependencies:** product workflows, package signing, benchmark gates.

**Exit criteria**
- Clean install, upgrade, rollback, backup restore, power-loss recovery, and factory reset pass on supported targets.
- Canary rollout detects and stops regressions.
- Release artifacts pass provenance, vulnerability, license, protocol, security, and Pi performance gates.

**Tests/gates:** unattended soak, disk-full/read-only/corruption, thermal/network loss, credential rotation, renderer/provider crash loops, old-to-new upgrades.

## Phase 12 — Community ecosystem (P2)

**Deliverables**
- SDK/tooling release, templates, examples, schema docs, local preview, validator, compatibility analyzer, signing/publishing flow, review policy, vulnerability reporting, deprecation cadence.
- Package catalog metadata and automated security/compatibility reports without implying review where none occurred.

**Dependencies:** stable SDK/package format and release operations.

**Exit criteria**
- External authors publish and update packages using documented tooling.
- Permission prompts are understandable; incompatible packages fail before activation.
- Protocol/SDK deprecations have telemetry, migration guidance, and tested overlap windows.

**Tests/gates:** author usability, malicious package corpus, ecosystem CI load, revoked publisher/update behavior, documentation link/schema examples.

## Explicit deferrals

Until measurements and earlier exit gates justify them:

- whole-core Rust rewrite;
- non-Linux core/renderer support;
- arbitrary HTML/JS native rendering;
- WASM as a renderer;
- unisolated community native providers;
- transparent migration of every PiDashboard daemon;
- video guarantees on Pi Zero 2 W or native-lite nodes;
- ESP32 as the product-wide UI capability ceiling;
- multi-tenant hosted control plane, marketplace commerce, and global cloud dependency;
- named compatibility with other dashboard ecosystems.

## Release definition of done

A release is complete only when relevant phase exit evidence, migration notes, threat model, protocol compatibility, benchmark artifacts, security gates, operations rollback, and user documentation are published together.
