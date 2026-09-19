# LiteDash Documentation Baseline

LiteDash is a greenfield, Linux-first dashboard design informed by selected PiDashboard assets. These documents describe intent and contracts; they do not claim the LiteDash implementation already exists.

## Documents

1. [Vision](./00-VISION.md) — product goals, non-goals, principles, roles, and renderer direction.
2. [Architecture](./01-ARCHITECTURE.md) — greenfield core boundaries, topology, reuse inventory, rewrites, and Bun bootstrap strategy.
3. [Protocol](./02-PROTOCOL.md) — canonical CBOR wire model, transports, envelopes, state, commands, nodes, limits, and recovery.
4. [Security](./03-SECURITY.md) — trust tiers, iframe/CSP isolation, provider controls, capabilities, secrets, GPIO, packages, nodes, and threat model.
5. [Widget SDK](./04-WIDGET-SDK.md) — package layout, manifests, universal web path, portable profile, scene IR, providers, media, and logical hardware.
6. [Development Plan](./05-DEVELOPMENT-PLAN.md) — phased delivery through product, native rendering, migration, release operations, and community ecosystem.

## Terminology

- **Package:** versioned installable unit containing manifest, widget UI assets, optional providers, schemas, and media.
- **Widget UI:** visual module instantiated on a canvas.
- **Provider:** non-visual module that publishes state channels or handles commands.
- **Node:** authenticated participant hosting one or more roles/capabilities.
- **Display:** node role that presents a canvas.
- **Renderer:** adapter that turns a canvas and widget UIs into pixels.
- **State channel:** named, schema-bound, revisioned state stream.

## Current decisions

- Beauty-first HTML/CSS/JS community authoring.
- Fixed logical-pixel canvas with output scaling.
- WPE WebKit/Cog is the universal/reference web renderer, normally hosted by Cage.
- Native/LVGL rendering is optional and progressively supports a portable profile through scene IR; unsupported content stays in WPE.
- Display, provider, and hardware roles may run on different nodes.
- Linux is the initial supported platform. ESP32 is a controller/hardware/native-lite node, not the rich-display ceiling.
- Bun bootstraps the core behind replaceable interfaces; Rust replacement requires measured justification.
- CBOR is the canonical machine wire encoding. MessagePack is only an explicit negotiated adapter if needed.
- JSON remains for human-authored manifests, canvases, configuration, and debug export—not high-frequency live traffic.
- Community widget UIs use iframe+CSP isolation and source-derived identity.
- Community providers prefer WASM/WASI; native/JS providers require OS isolation and explicit capability grants.
- Packages install transactionally with validation, checksums/signature policy, and rollback.
- GPIO, secrets, filesystem, network, and media access are brokered capabilities.

## Open decisions

These require prototypes, measurements, or operational review:

- Final package archive extension, canonicalization rules, and publisher trust policy.
- Exact JSON schemas and compatibility/deprecation windows.
- CBOR library/profile details and whether any deployment genuinely needs a MessagePack adapter.
- Local socket paths, remote mutual-TLS versus token profile, pairing UX, and credential storage backend.
- Persistence engine and state replay/checkpoint defaults.
- Concrete frame, state, queue, command, provider, and media limits derived from benchmarks.
- Reviewed-tier frontend privileges and CSP exception process.
- Linux isolation minimums and supported fallback behavior across distributions.
- WASM runtime and host import ABI.
- Initial portable HTML/CSS/JS subset and scene IR schema.
- Supported boards, GPIO backend matrix, and ESP32 transport/profile.
- Video codecs/hardware-decode matrix and media fallback generation policy.
- Native/LVGL production threshold and whether mixed renderer composition is viable.
- PiDashboard migration coverage per widget/provider/canvas feature.
- Release packaging, update channels, and reproducible build/signing infrastructure.

## PiDashboard relationship

Candidate reuse is deliberately narrow: selected React visual components, Bun HTTP/static-serving concepts, Cage+Cog setup knowledge, `.wig` staging/validation/rollback lessons, widget manifests/assets as migration fixtures, and fixed-canvas editor ideas. The canvas domain, protocol, state broker, security boundary, provider runtime, and node protocol are rewritten. Details are in [Architecture](./01-ARCHITECTURE.md).

## Reading order

Start with [Vision](./00-VISION.md), then [Architecture](./01-ARCHITECTURE.md). Protocol, Security, and Widget SDK are parallel contracts. Use the [Development Plan](./05-DEVELOPMENT-PLAN.md) as the execution and exit-gate checklist.
