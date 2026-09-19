# LiteDash Vision

> Status: design baseline; implementation has not started.

LiteDash is a Linux-first, beauty-first dashboard platform for displays ranging from small embedded panels to rich HDMI screens. It makes HTML, CSS, and JavaScript the primary community authoring medium, while preserving a path for constrained native rendering where measurement proves it useful.

## Product promise

Authors should be able to build a polished **widget UI** with familiar web tools, place it precisely on a fixed logical-pixel canvas, connect it to state and commands without owning transport code, and deploy the resulting **package** to one or many **displays**. Data-producing **providers**, hardware controllers, and displays may run on different **nodes**.

The universal and reference renderer is WPE WebKit/Cog, normally hosted in Cage. An optional native/LVGL renderer may progressively support the portable subset; it must not force rich displays down to the capabilities of the smallest device.

## Goals

- Put visual quality, typography, animation, composition, and author ergonomics first.
- Use a fixed logical-pixel canvas so editing, preview, and display placement are deterministic; renderer adapters scale it to physical output.
- Make standards-based HTML/CSS/JS the universal widget UI path.
- Provide a constrained portable profile that can be analyzed and, over time, compiled through a scene IR for native/LVGL rendering.
- Keep unsupported content on the WPE/Cog path instead of degrading or rejecting visual design.
- Separate roles: a display renders; a provider produces state or handles commands; a node hosts one or more roles; hardware access is brokered.
- Allow display, provider, and hardware roles to run on different authenticated nodes.
- Be Linux-first, including installation, supervision, rendering, and isolation.
- Treat ESP32-class devices as controller, hardware, or native-lite nodes—not as the ceiling for the whole product.
- Make packages installable, inspectable, permissioned, transactional, and recoverable.
- Establish measurable reliability, performance, and security gates on Raspberry Pi Zero 2 W and representative richer Linux hardware.

## Non-goals

- Pixel-identical output across web and native renderers for arbitrary web content.
- Running arbitrary community native code with the authority of the LiteDash core.
- Treating Node.js or Bun as a security sandbox.
- Making JSON the high-frequency live transport.
- Shipping every renderer, operating system, board, or media codec in the first release.
- Prematurely rewriting the bootstrap core in Rust before profiles identify a justified boundary.
- Forcing rich widget UIs into a lowest-common-denominator embedded component model.
- Providing a renderer on ESP32 for unrestricted HTML/CSS/JS.

## Principles

1. **Beauty before artificial portability.** The reference web result is authoritative. Portability is additive and declared, not achieved by silently reducing quality.
2. **Contracts before components.** Protocol, schemas, capabilities, and lifecycle interfaces precede replaceable implementations.
3. **One canonical wire encoding.** CBOR is the machine format; alternate codecs are explicit negotiated adapters.
4. **Human formats remain human.** Manifests, canvases, configuration, and debug exports use JSON.
5. **Least authority by default.** Identity comes from the authenticated transport or embedding relationship, never a self-declared payload field.
6. **Distributed by design.** Local is an optimized topology, not an architectural assumption.
7. **Fail closed, recover visibly.** Unknown capability, invalid package, stale revision, or unverifiable identity is denied with an actionable diagnostic.
8. **Transactional change.** Package, canvas, and configuration changes validate and stage before atomic activation; a last-known-good revision remains available.
9. **Measure before replacing.** Bun bootstraps the core. A Rust replacement is considered only against recorded bottlenecks and stable interfaces.
10. **Progressive compatibility.** The portable profile expands over time; unsupported modules remain fully usable through WPE/Cog.
11. **Hardware is logical.** Widget UIs request named GPIO/device capabilities; physical pins and buses belong to node policy.
12. **Documentation is a contract.** Decisions, compatibility, limits, and migration behavior are versioned with the product.

## Success indicators

- A community author can produce a visually polished package without writing transport or device-specific code.
- The same package can use a remote provider or hardware node without changing its widget UI contract.
- Displays reconnect and resynchronize without stale or duplicated commands.
- Installation failure cannot replace the active package or leak package authority.
- Performance and security regressions are detected by repeatable gates rather than anecdote.
- Native compatibility can increase without splitting the package ecosystem.

## Relationship to PiDashboard

PiDashboard supplies evidence and reusable assets, not the LiteDash architecture. Its React admin visual work, Bun serving approach, fixed-canvas ideas, widget manifests/assets, `.wig` staging concepts, and Cage+Cog deployment knowledge are valuable inputs. LiteDash deliberately redesigns the canvas domain, live protocol, state broker, security boundary, provider runtime, and node protocol. See [Architecture](./01-ARCHITECTURE.md).
