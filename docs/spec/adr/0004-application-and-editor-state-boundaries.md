# ADR 0004: Application and editor state boundaries

Status: accepted

## Decision
The greenfield admin uses typed application contracts over an administrative HTTP adapter. Canvas documents are persisted drafts; editor sessions hold transient selection/tool/zoom/dirty state; publications are immutable revisioned snapshots; renderer/runtime state is separately derived and ephemeral.

JSON is permitted for administrative REST and persisted documents. It is not a synchronization encoding decision. Live synchronization continues through the transport-neutral broker and codec/adapter contracts, with CBOR planned for the canonical wire.

The first UI uses browser platform modules and CSS served by Bun. This keeps the vertical slice dependency-free while boundaries stabilize; a framework requires an ADR justified by editor complexity.

## Consequences
Optimistic draft revisions prevent silent overwrites. The editor cannot leak selection or tools into published canvases. Renderers consume publications rather than drafts. UI code cannot call the state broker as a JSON channel.