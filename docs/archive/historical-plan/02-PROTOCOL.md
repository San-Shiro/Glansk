# LiteDash Protocol

> Status: protocol design baseline. CBOR is the canonical machine wire encoding from day one.

## Encoding decision

- Canonical live encoding: **CBOR** using deterministic map encoding where signatures or golden vectors require it.
- MessagePack is available only behind an explicitly negotiated codec adapter if interoperability evidence requires it.
- A session uses one negotiated codec; messages never ambiguously mix CBOR and MessagePack.
- JSON is for human-authored manifests, canvases, configuration, diagnostic display, and debug export. It is never the high-frequency live transport.
- Examples below use diagnostic JSON notation for readability; integers and byte strings retain their protocol types in CBOR.

## Transports

### Local Unix socket

Default path is installation-configured under a protected runtime directory. The stream is framed:

```text
uint32_be frame_length | frame bytes
```

`frame_length` excludes the four-byte prefix. Zero length, oversize frames, truncated frames, and trailing undecoded data are protocol errors. Peer credentials are read from the OS and mapped to an allowed local principal; payload identity cannot override them.

### Remote WebSocket

Remote nodes use TLS WebSockets with binary frames only. Authentication uses paired node credentials, with mutual TLS or a short-lived token bound to the paired node according to deployment mode. Origin checks protect browser-facing endpoints but are not node authentication. Each WebSocket binary message contains exactly one encoded envelope; fragmentation is handled by the WebSocket stack.

## Negotiation

Transport authentication happens first. The initiator sends `hello`; the responder selects a mutually supported protocol and codec.

```json
{
  "v": 1,
  "kind": "hello",
  "id": "01J...",
  "ts": 1730000000000,
  "body": {
    "protocols": [1],
    "codecs": ["cbor"],
    "role": "node",
    "features": ["patch-v1", "command-ack-v1"],
    "maxFrame": 262144
  }
}
```

The selected response includes `protocol`, `codec`, `sessionId`, negotiated limits, heartbeat interval, and accepted features. No overlap closes the connection with `unsupported_version`. MessagePack may appear in `codecs` only when the adapter is enabled; CBOR remains preferred and mandatory for conforming core components.

## Envelope

All messages share:

| Field | Type | Meaning |
|---|---|---|
| `v` | unsigned integer | selected protocol major |
| `kind` | text | message schema discriminator |
| `id` | text | unique message ID for tracing |
| `ts` | unsigned integer | sender time in epoch milliseconds; diagnostic, not ordering authority |
| `session` | text, optional during hello | negotiated session ID |
| `replyTo` | text, optional | message ID being answered |
| `trace` | text, optional | end-to-end correlation |
| `body` | map | kind-specific schema |

Unknown required fields, invalid types, invalid UTF-8, excessive nesting, and unknown `kind` are rejected. Minor additive fields are ignored only where the schema marks them extensible.

## Channels, snapshots, and patches

A **state channel** is named `namespace/name`, scoped by tenant/installation and authorization. A channel has a schema ID and monotonically increasing unsigned `rev`.

Subscribe:

```json
{"v":1,"kind":"subscribe","id":"m1","ts":1730000000000,"body":{"channels":[{"name":"provider/weather/front-porch","fromRev":41}],"wantSnapshot":true}}
```

Snapshot:

```json
{"v":1,"kind":"snapshot","id":"m2","ts":1730000000010,"body":{"channel":"provider/weather/front-porch","schema":"weather.state/1","rev":42,"value":{"temperature":18.4,"condition":"rain"}}}
```

Patch:

```json
{"v":1,"kind":"patch","id":"m3","ts":1730000001010,"body":{"channel":"provider/weather/front-porch","schema":"weather.state/1","baseRev":42,"rev":43,"ops":[{"op":"replace","path":["temperature"],"value":18.2}]}}
```

Patch paths are arrays of text keys or unsigned array indexes, avoiding textual pointer escaping. Core operations are `add`, `replace`, `remove`, and `test`; limits apply to operation count, depth, and resulting state size. A patch is applied only when `baseRev` equals the broker's current revision and the result validates against the channel schema. Otherwise the broker sends `revision_conflict`; subscribers request or receive a snapshot.

Unsubscribe names explicit channels. Authorization is evaluated for every subscription and publication, including wildcard expansion. Wildcards, if enabled, have bounded expansion and cannot bypass grants.

## Commands and acknowledgements

Widget UIs address a host-issued widget instance and declared action—not a provider process, executable, or GPIO pin.

```json
{"v":1,"kind":"command","id":"m10","ts":1730000010000,"body":{"instance":"display-a/canvas-main/volume-1","action":"set-volume","params":{"level":35},"idempotencyKey":"01J...","deadlineMs":5000}}
```

Accepted acknowledgement:

```json
{"v":1,"kind":"command_ack","id":"m11","replyTo":"m10","ts":1730000010020,"body":{"status":"accepted","idempotencyKey":"01J..."}}
```

Terminal result:

```json
{"v":1,"kind":"command_result","id":"m12","replyTo":"m10","ts":1730000010120,"body":{"status":"succeeded","result":{"appliedLevel":35}}}
```

Statuses are `accepted`, `rejected`, `succeeded`, `failed`, `expired`, or `unknown`. Schema validation, authorization, rate limits, and routing occur before `accepted`. A result describes provider knowledge; hardware commands should report requested versus observed state when possible.

### Idempotency

The caller supplies an unpredictable idempotency key for retriable side effects. The command router stores a bounded, expiring result keyed by authorized caller, target, action, and key. A duplicate returns the prior acceptance/result without re-executing. Reusing a key with different parameters is an error. Non-idempotent commands without a key are not automatically retried.

## Node registration and capabilities

After pairing and negotiation, a node registers claims that are intersected with server policy:

```json
{"v":1,"kind":"node_register","id":"n1","ts":1730000020000,"body":{"nodeId":"node-kitchen","agentVersion":"0.1.0","roles":["display","hardware"],"capabilities":{"renderers":[{"id":"web-wpe","version":1}],"gpio":[{"controller":"gpiochip0","logical":["kitchen-button"]}],"media":{"video":true,"codecs":["h264"]}},"labels":{"location":"kitchen"}}}
```

The response records accepted roles/capabilities and a capability revision. Capability changes use `node_capabilities` with `baseRev`/`rev`. The manager may issue role assignments, canvas assignments, or revocations; a node must not self-authorize based on its claims.

Heartbeats report session health and bounded metrics. Missing heartbeats transition through `suspect` to `offline`; commands fail rather than silently target another node.

## Errors

```json
{"v":1,"kind":"error","id":"e1","replyTo":"m3","ts":1730000030000,"body":{"code":"revision_conflict","message":"Channel revision changed","retryable":true,"details":{"currentRev":44}}}
```

Stable codes include `malformed`, `unauthenticated`, `forbidden`, `unsupported_version`, `unsupported_codec`, `not_found`, `schema_invalid`, `revision_conflict`, `rate_limited`, `overloaded`, `deadline_exceeded`, `capability_unavailable`, and `internal`. Messages are safe for operators and do not expose secrets or sensitive paths.

## Limits

Negotiation can lower, never raise, administrator maxima. The baseline specification requires configured bounds for:

- frame bytes and messages per second;
- decoded nesting, map entries, strings, arrays, and byte strings;
- channel count per session and wildcard expansion;
- snapshot size, patch operation count, resulting state size, and update frequency;
- in-flight commands, command parameter size, idempotency cache, and deadlines;
- node capability document size;
- outbound queue bytes and age.

Exact defaults are established by measured implementation phases and documented in release configuration, not guessed here.

## Backpressure

Each connection has bounded priority queues. Control, authentication, command results, and errors outrank replaceable telemetry. For coalescible channels, newer snapshots/patches may replace unsent older updates while preserving a valid revision path; if that is impossible, send a fresh snapshot. Exceeding queue limits yields `overloaded`, pauses reads where safe, sheds replaceable updates, and ultimately disconnects a persistently slow peer. Memory is never allowed to grow without bound.

## Reconnect and resynchronization

A client reconnects with exponential backoff and jitter, reauthenticates, renegotiates, and resubscribes with its last applied revision. The broker either replays a bounded contiguous patch history or sends a snapshot. Session IDs are not durable identity. In-flight commands are reconciled by idempotency key; callers must handle `unknown` when execution may have occurred but no durable result is available.

## Version evolution

- Major versions change incompatible envelope or semantic behavior and require negotiation.
- Compatible schema additions use new optional fields and feature flags.
- State and command schemas carry independent IDs/versions.
- Golden CBOR vectors, decoder conformance, cross-version reconnect, and downgrade tests are release gates.
- Debug tooling may export any envelope as JSON with byte strings represented explicitly; imported debug JSON is never accepted as authenticated live traffic.
