# ADR 0003: Transport- and codec-neutral synchronization broker

- Status: Accepted

## Context

The base synchronization service changed and JSON is no longer used for synchronization. No replacement service API, wire format, codec, framing, or state representation is currently defined. Previous JSON patch and concrete protocol scaffolding cannot safely define the new architecture.

## Decision

The broker uses generic state and delta types and delegates cloning, validation, delta application, and size measurement to `StateTransition`. It owns per-channel schema and monotonic revisions, expected-revision causality, operation identity, immutable snapshots, bounded subscriptions, and fail-closed conflict policy.

A `Codec` boundary maps typed integration messages to opaque byte frames. A `SyncAdapter` boundary owns delivery, lifecycle, backpressure, and retryable errors. Neither belongs to broker core. The core defines no envelope, framing, byte order, codec, transport, delta language, or retry timer.

Queue overrun or an unavailable revision chain produces `resync_required`; the broker never silently skips an invalid causal path.

## Consequences

The broker can survive replacement of the synchronization service and representation. Integration remains intentionally incomplete until the external service facts listed in `docs/STATUS.md` are available. ADR 0002 is superseded.
