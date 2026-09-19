import { describe, expect, test } from "bun:test";
import { DomainError } from "../src/domain/errors";
import type { StateTransition } from "../src/services/state/contracts";
import { InMemoryStateBroker } from "../src/services/state/in-memory-state-broker";

type Counter = { value: number };
type Change = { amount: number };
const transition: StateTransition<Counter, Change> = {
  cloneState: state => ({ value: state.value }),
  cloneDelta: delta => ({ amount: delta.amount }),
  validateState: (_schema, state) => { if (!Number.isFinite(state.value)) throw new DomainError("schema_invalid", "Invalid counter"); },
  applyDelta: (_schema, state, delta) => ({ value: state.value + delta.amount }),
  measureState: () => 8,
  measureDelta: () => 8,
};
const cause = (expectedRevision: number, operationId: string) => ({ expectedRevision, operationId });

describe("non-JSON state broker", () => {
  test("applies representation-neutral deltas with monotonic revisions", () => {
    const broker = new InMemoryStateBroker(transition);
    expect(broker.publishSnapshot({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-1"), payload: { value: 2 } }).revision).toBe(1);
    expect(broker.publishDelta({ channel: "provider/counter", schema: "counter/1", causality: cause(1, "op-2"), payload: { amount: 3 } }).payload).toEqual({ value: 5 });
  });

  test("rejects stale, schema-mismatched, and duplicate operations", () => {
    const broker = new InMemoryStateBroker(transition);
    broker.publishSnapshot({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-1"), payload: { value: 0 } });
    expect(() => broker.publishDelta({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-2"), payload: { amount: 1 } })).toThrow(DomainError);
    expect(() => broker.publishDelta({ channel: "provider/counter", schema: "other/1", causality: cause(1, "op-3"), payload: { amount: 1 } })).toThrow(DomainError);
    expect(() => broker.publishDelta({ channel: "provider/counter", schema: "counter/1", causality: cause(1, "op-1"), payload: { amount: 1 } })).toThrow(DomainError);
  });

  test("defensively clones state", () => {
    const broker = new InMemoryStateBroker(transition);
    const input = { value: 7 };
    const returned = broker.publishSnapshot({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-1"), payload: input });
    input.value = 99;
    returned.payload.value = 88;
    expect(broker.getSnapshot("provider/counter")?.payload.value).toBe(7);
  });

  test("bounds subscriber queues and requires resync after overrun", async () => {
    const broker = new InMemoryStateBroker(transition);
    const subscription = broker.subscribe("provider/counter", { capacity: 1 });
    broker.publishSnapshot({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-1"), payload: { value: 0 } });
    broker.publishDelta({ channel: "provider/counter", schema: "counter/1", causality: cause(1, "op-2"), payload: { amount: 1 } });
    expect(await subscription.next()).toEqual({ kind: "resync_required", channel: "provider/counter", latestRevision: 2, reason: "subscriber_overrun" });
    subscription.close();
  });

  test("serves snapshots to fresh subscribers and identifies revision gaps", async () => {
    const broker = new InMemoryStateBroker(transition);
    broker.publishSnapshot({ channel: "provider/counter", schema: "counter/1", causality: cause(0, "op-1"), payload: { value: 1 } });
    expect((await broker.subscribe("provider/counter").next()).kind).toBe("update");
    expect(await broker.subscribe("provider/counter", { fromRevision: 9 }).next()).toEqual({ kind: "resync_required", channel: "provider/counter", latestRevision: 1, reason: "revision_gap" });
  });
});
