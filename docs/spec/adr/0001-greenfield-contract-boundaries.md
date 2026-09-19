# ADR 0001: Greenfield contract boundaries

- Status: Accepted
- Context: Glansk needs a distributed, replaceable architecture and must not inherit PiDashboard's file-centric coupling.

## Decision

Domain types and service contracts are independent from Bun, transport, persistence, renderer, and UI. Initial in-memory implementations establish behavior; adapters compose them at the edge. Canonical live transport will use CBOR, while JSON remains human/diagnostic.

## Consequences

Implementations can be replaced and contract-tested independently. The scaffold delivers less visible UI initially, but avoids binding future renderer, node, and provider work to bootstrap infrastructure.
