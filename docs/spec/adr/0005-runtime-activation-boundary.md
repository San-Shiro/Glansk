# ADR 0005: Runtime projection and atomic activation boundary

Status: accepted for Phase 3 host implementation.

## Decision

Draft editor state, durable canvas documents, immutable publications, generated render artifacts, durable active-revision metadata, and ephemeral renderer processes are distinct. Preview and live activation call the same validated projection function. A candidate renderer must become ready and healthy before its revision replaces the active handle; failure preserves the prior handle and last-known-good artifact.

Renderer execution is behind `RendererAdapter`/`RendererHandle`. The deterministic adapter is for host integration and tests. A WPE/Cog adapter must use argv execution (not a shell string), Cage isolation, per-widget opaque iframe identity and CSP, bounded readiness, health probes, and supervised shutdown.

Runtime widget state is not stored in documents or activation metadata. It enters renderer hosts through typed broker subscriptions and remains independent of codec and transport. No JSON synchronization protocol is introduced; JSON in the runtime repository is control-plane recovery metadata only.

## Consequences

Activation is compare-and-set, idempotent for an already-ready revision, crash recoverable, and rollback safe. Hardware validation remains a release gate rather than a host-test claim.

