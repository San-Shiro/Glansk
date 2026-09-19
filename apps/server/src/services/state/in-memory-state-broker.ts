import { DomainError } from "../../domain/errors";
import type { PublishDelta, PublishSnapshot, StateDelta, StateSnapshot, StateUpdate, SubscriptionEvent, SubscriptionOptions } from "../../domain/state";
import type { StateBroker, StateBrokerLimits, StateSubscription, StateTransition } from "./contracts";

const CHANNEL = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]{0,190}$/;
const DEFAULT_LIMITS: StateBrokerLimits = { maxStateBytes: 256 * 1024, maxDeltaBytes: 64 * 1024, defaultSubscriptionCapacity: 32, maxSubscriptionCapacity: 1024 };

class Subscription<TState, TDelta> implements StateSubscription<TState, TDelta> {
  readonly #queue: SubscriptionEvent<TState, TDelta>[] = [];
  readonly #waiters: ((event: SubscriptionEvent<TState, TDelta>) => void)[] = [];
  #closed = false;
  constructor(readonly channel: string, readonly capacity: number, readonly cloneEvent: (event: SubscriptionEvent<TState, TDelta>) => SubscriptionEvent<TState, TDelta>, readonly onClose: () => void) {}
  push(event: SubscriptionEvent<TState, TDelta>): void {
    if (this.#closed) return;
    const waiter = this.#waiters.shift();
    if (waiter) { waiter(this.cloneEvent(event)); return; }
    if (this.#queue.length >= this.capacity) {
      this.#queue.length = 0;
      const revision = event.kind === "update" ? event.update.kind === "snapshot" ? event.update.revision : event.update.toRevision : event.kind === "resync_required" ? event.latestRevision : 0;
      this.#queue.push({ kind: "resync_required", channel: this.channel, latestRevision: revision, reason: "subscriber_overrun" });
      return;
    }
    this.#queue.push(this.cloneEvent(event));
  }
  next(): Promise<SubscriptionEvent<TState, TDelta>> {
    const event = this.#queue.shift();
    if (event) return Promise.resolve(this.cloneEvent(event));
    if (this.#closed) return Promise.resolve({ kind: "closed", reason: "subscription closed" });
    return new Promise(resolve => this.#waiters.push(resolve));
  }
  close(reason = "subscription closed"): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#queue.length = 0;
    for (const waiter of this.#waiters.splice(0)) waiter({ kind: "closed", reason });
    this.onClose();
  }
}

export class InMemoryStateBroker<TState, TDelta> implements StateBroker<TState, TDelta> {
  readonly #snapshots = new Map<string, StateSnapshot<TState>>();
  readonly #subscribers = new Map<string, Set<Subscription<TState, TDelta>>>();
  readonly #operations = new Map<string, { channel: string; revision: number }>();
  readonly #limits: StateBrokerLimits;
  constructor(readonly transition: StateTransition<TState, TDelta>, limits: Partial<StateBrokerLimits> = {}) { this.#limits = { ...DEFAULT_LIMITS, ...limits }; }

  publishSnapshot(request: PublishSnapshot<TState>): StateSnapshot<TState> {
    this.#assertRequest(request.channel, request.schema, request.causality.expectedRevision, request.causality.operationId);
    this.transition.validateState(request.schema, request.payload);
    if (this.transition.measureState(request.payload) > this.#limits.maxStateBytes) throw new DomainError("schema_invalid", "State payload exceeds limit");
    const snapshot = this.#store(request.channel, request.schema, request.payload);
    this.#record(request.causality.operationId, request.channel, snapshot.revision);
    this.#emit(snapshot);
    return this.#cloneSnapshot(snapshot);
  }

  publishDelta(request: PublishDelta<TDelta>): StateSnapshot<TState> {
    this.#assertRequest(request.channel, request.schema, request.causality.expectedRevision, request.causality.operationId);
    if (this.transition.measureDelta(request.payload) > this.#limits.maxDeltaBytes) throw new DomainError("schema_invalid", "Delta payload exceeds limit");
    const current = this.#snapshots.get(request.channel);
    if (!current) throw new DomainError("not_found", `State channel not found: ${request.channel}`);
    if (current.schema !== request.schema) throw new DomainError("schema_invalid", "State schema does not match channel");
    const nextState = this.transition.applyDelta(request.schema, this.transition.cloneState(current.payload), this.transition.cloneDelta(request.payload));
    this.transition.validateState(request.schema, nextState);
    if (this.transition.measureState(nextState) > this.#limits.maxStateBytes) throw new DomainError("schema_invalid", "Resulting state exceeds limit");
    const snapshot = this.#store(request.channel, request.schema, nextState);
    this.#record(request.causality.operationId, request.channel, snapshot.revision);
    const delta: StateDelta<TDelta> = { kind: "delta", channel: request.channel, schema: request.schema, fromRevision: current.revision, toRevision: snapshot.revision, payload: this.transition.cloneDelta(request.payload) };
    this.#emit(delta);
    return this.#cloneSnapshot(snapshot);
  }

  getSnapshot(channel: string): StateSnapshot<TState> | undefined { this.#assertChannel(channel); const snapshot = this.#snapshots.get(channel); return snapshot && this.#cloneSnapshot(snapshot); }

  subscribe(channel: string, options: Partial<SubscriptionOptions> = {}): StateSubscription<TState, TDelta> {
    this.#assertChannel(channel);
    const capacity = options.capacity ?? this.#limits.defaultSubscriptionCapacity;
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > this.#limits.maxSubscriptionCapacity) throw new DomainError("malformed", "Invalid subscription capacity");
    const set = this.#subscribers.get(channel) ?? new Set();
    const subscription = new Subscription<TState, TDelta>(channel, capacity, event => this.#cloneEvent(event), () => { set.delete(subscription); if (set.size === 0) this.#subscribers.delete(channel); });
    set.add(subscription); this.#subscribers.set(channel, set);
    const current = this.#snapshots.get(channel);
    if (current) {
      const from = options.fromRevision ?? 0;
      if (from !== current.revision) subscription.push(from === 0 ? { kind: "update", update: this.#cloneSnapshot(current) } : { kind: "resync_required", channel, latestRevision: current.revision, reason: "revision_gap" });
    }
    return subscription;
  }

  #store(channel: string, schema: string, payload: TState): StateSnapshot<TState> { const current = this.#snapshots.get(channel); const snapshot: StateSnapshot<TState> = { kind: "snapshot", channel, schema, revision: (current?.revision ?? 0) + 1, payload: this.transition.cloneState(payload) }; this.#snapshots.set(channel, snapshot); return snapshot; }
  #assertRequest(channel: string, schema: string, expected: number, operationId: string): void {
    this.#assertChannel(channel);
    if (!schema || !operationId) throw new DomainError("malformed", "Schema and operation ID are required");
    const currentRevision = this.#snapshots.get(channel)?.revision ?? 0;
    const prior = this.#operations.get(operationId);
    if (prior) throw new DomainError("revision_conflict", prior.channel === channel ? "Operation already applied" : "Operation ID reused for another channel", { currentRevision, appliedRevision: prior.revision });
    if (!Number.isSafeInteger(expected) || expected < 0 || expected !== currentRevision) throw new DomainError("revision_conflict", "Stale state transition", { currentRevision });
  }
  #record(id: string, channel: string, revision: number): void { this.#operations.set(id, { channel, revision }); }
  #assertChannel(channel: string): void { if (!CHANNEL.test(channel)) throw new DomainError("malformed", `Invalid state channel: ${channel}`); }
  #cloneSnapshot(snapshot: StateSnapshot<TState>): StateSnapshot<TState> { return { ...snapshot, payload: this.transition.cloneState(snapshot.payload) }; }
  #cloneEvent(event: SubscriptionEvent<TState, TDelta>): SubscriptionEvent<TState, TDelta> { if (event.kind !== "update") return { ...event }; const update = event.update; return update.kind === "snapshot" ? { kind: "update", update: this.#cloneSnapshot(update) } : { kind: "update", update: { ...update, payload: this.transition.cloneDelta(update.payload) } }; }
  #emit(update: StateUpdate<TState, TDelta>): void { for (const subscriber of this.#subscribers.get(update.channel) ?? []) subscriber.push({ kind: "update", update }); }
}
