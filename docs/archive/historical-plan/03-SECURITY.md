# LiteDash Security Model

> Status: required design baseline, not a statement of current implementation.

## Foundational correction

Node.js and Bun are runtimes, **not security sandboxes**. JavaScript and native child processes have the ambient OS authority of their process unless Linux isolation removes it. Language-level validation and a hidden API do not prevent filesystem, network, process, or device access.

LiteDash therefore treats frontend isolation, backend process isolation, protocol identity, and capability grants as separate controls.

## Assets and trust boundaries

Protect:

- administrator sessions, node credentials, package signing keys, and secrets;
- canvas and registry integrity;
- state channels and command authority;
- display availability and visual integrity;
- host files, network, GPIO/devices, media, and compute resources;
- audit evidence and rollback data.

Boundaries exist at package import, browser iframe/host messaging, provider/core IPC, remote node transport, broker APIs, media parsing, admin APIs, and OS/device access.

## Threat model

Assume malicious or compromised community package content, provider code, remote nodes, LAN clients, media files, and upstream services. Consider path traversal, archive bombs, signature confusion, XSS, iframe escape attempts, forged widget identity, command confusion, state poisoning, replay, credential theft, SSRF, local network discovery, filesystem escape, device damage, resource exhaustion, persistence corruption, downgrade, supply-chain replacement, and log/secret leakage.

Physical host compromise, kernel compromise, and malicious firmware are outside the application boundary, but deployments should document their impact.

## Frontend trust tiers

Trust derives from provenance and review state, never a manifest claim.

| Tier | Intended source | Baseline execution |
|---|---|---|
| `built-in` | shipped and reviewed with LiteDash | privileged host integration only where required and audited |
| `reviewed` | independently reviewed signed package | isolated by default; narrowly approved enhancements |
| `community` | unreviewed package | sandboxed iframe with least privilege |

Community widget UIs run in unique iframes without same-origin access to the host. The host generates a strict CSP from granted needs: no inline/eval unless a tier-specific exception is reviewed, restricted script/style/media/connect sources, no top navigation, no popups, no forms unless declared, and no direct admin credentials.

`postMessage` identity is derived from the receiving host's mapping of `event.source` to a created iframe and widget instance. Claimed instance, package, provider, or node IDs in the message are ignored for identity. Validate origin where meaningful, message shape, size, rate, lifecycle epoch, action declaration, and capability. Destroyed or replaced frames lose their mapping immediately.

Browser isolation limits UI authority; it does not make backend provider code safe.

## Backend provider isolation

### Preferred community runtime

WASM/WASI is the preferred portable provider runtime for community packages. It is **not the renderer**. Providers receive explicit host imports for approved state publication, commands, time, HTTP, secrets, and logical devices. Imports enforce grants, schemas, quotas, deadlines, and auditing. Disable undeclared filesystem, environment, process, socket, and device access. Bound memory, execution/fuel, output, concurrent requests, and persistent storage.

### Native or JavaScript providers

When needed, run each trust/installation boundary under a dedicated unprivileged user and a systemd transient unit or equivalent Linux controls. Apply, as available:

- `NoNewPrivileges`, capability bounding, syscall filtering, namespaces, and restricted address families;
- read-only system and package assets, explicit writable state directories, private temporary directories;
- device allow/deny policy and no raw GPIO access;
- CPU, memory, process, file descriptor, output, restart, and wall-clock quotas;
- restricted environment and working directory;
- network policy stronger than application URL checks for untrusted native code.

Do not execute shell command strings. A provider entry is an executable plus validated argv array. Do not invoke through a shell; do not interpolate configuration into commands. Package scripts do not run during install.

Hostname allowlists are useful policy and audit inputs but are **not perfect network isolation**: DNS rebinding, redirects, alternate addressing, proxies, and compromised destinations remain concerns. Untrusted native providers require stronger controls such as network namespaces, firewall/eBPF policy, or an authenticated outbound proxy with destination revalidation. If those controls are unavailable, deny native network access or deny the provider.

## Capability grants

Manifests request capabilities; administrators grant them. Runtime tokens/import handles represent the intersection of request, trust tier, node capability, and policy. Grants are scoped by package version, provider instance, operation, resource, destination, and expiry where appropriate.

- **Filesystem:** package assets read-only; named storage areas, not arbitrary paths.
- **Network:** scheme, destination, port, method, redirect, response-size, and rate policy.
- **Devices/GPIO:** logical capabilities through a broker, not `/dev` or physical pin access.
- **Commands:** declared action schemas and instance ownership.
- **Media:** brokered assets/streams with type and quota checks.
- **Secrets:** handles or one-operation use, not general environment injection.

Unknown or missing grants fail closed.

## Secret broker

Secrets are stored separately from packages, canvases, logs, and state channels. Providers request a named secret capability; the broker verifies instance grants and returns a short-lived use handle or performs the operation without revealing the value when possible. Redact values and derived authorization headers from logs, errors, metrics, crash reports, and debug exports. Rotation does not require package changes.

## GPIO broker

Packages name logical capabilities such as `kitchen.light` or `front.button`. Administrator/node policy maps these to controller lines, safe modes, polarity, debounce, and allowed operations. The broker enforces ownership, rate limits, startup/shutdown safe states, conflict detection, and auditing. The core and providers do not run as root merely to access GPIO.

## Packages and updates

- Canonical manifest and per-file checksums; reject duplicate/case-colliding paths, links, traversal, device files, size/count/depth excess, and undeclared executables.
- Verify signatures against configured publishers when required; signatures bind identity, version, manifest, and all content.
- Stage outside the active tree; validate schemas, compatibility, permissions, renderer profile, and provider entries.
- Record requested/granted capability diffs for updates.
- Activate via journaled atomic transaction; retain last-known-good content and metadata.
- Roll back on activation/health failure without executing old/new package code during file swap.
- Never let a package declare itself built-in or reviewed.

Checksums provide integrity, not publisher trust. Signing does not make code safe; isolation and grants still apply.

## Remote node security

Pair through an administrator-confirmed, short-lived ceremony displaying both node identity and key fingerprint/code. Issue unique node credentials; never share one fleet token. Bind claimed node ID and roles to credentials. Encrypt remote transport, protect against replay, rotate tokens/certificates, support overlap during rotation, and revoke lost nodes.

Capability advertisement is a claim intersected with server policy. Sensitive assignments require an authenticated current session. Rate-limit pairing and authentication, record credential events, and fail closed on expiry, revocation, version downgrade, or identity mismatch.

## Fail-closed rules

Deny or stop when:

- package provenance, signature policy, checksum, schema, or compatibility cannot be verified;
- protocol/codec or feature negotiation has no safe overlap;
- identity is payload-derived, stale, revoked, or ambiguous;
- a command/action, state schema, resource, node capability, or grant is unknown;
- revision continuity is broken until resync;
- isolation controls required by package trust are unavailable;
- quotas cannot be applied to an untrusted provider;
- a package transaction cannot prove its active/rollback state;
- GPIO safe-state or exclusive ownership cannot be established.

Availability fallback must not silently increase privilege.

## Audit logging

Record authenticated actor/node/provider identity, action, target, decision, grant used, package/revision, result, timestamps, and trace/idempotency IDs. Include pairing, credential rotation/revocation, login, package transactions, grant changes, provider lifecycle, secret access metadata, GPIO writes, command decisions, policy denials, and rollback.

Logs are structured, bounded, rotated, tamper-evident where operationally justified, and access-controlled. Never log secret values, raw tokens, full sensitive state, or unnecessary personal data. Clock uncertainty and remote-node timestamps are distinguished from server receipt time.

## Verification gates

- Frontend tests forge claimed IDs from sibling frames and prove source-derived isolation.
- CSP and iframe escape regression corpus.
- Provider tests attempt forbidden files, network, processes, devices, syscalls, memory, and CPU.
- Package parser fuzzing and crash-point transaction tests.
- Protocol malformed/replay/downgrade and authorization matrix tests.
- Secret redaction scans and audit completeness checks.
- Remote pairing, rotation, revocation, stolen-token, and reconnect tests.
- GPIO safe-state and conflict tests on supported boards.

Security gates and threat-model changes are release blockers, not optional hardening work.
