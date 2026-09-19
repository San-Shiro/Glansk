import { DomainError } from "../domain/errors";
import type { JsonValue } from "../domain/types";
import { InMemoryStateBroker } from "../services/state/in-memory-state-broker";
import type { StateTransition } from "../services/state/contracts";
import type { WidgetCommandRequest, WidgetCommandResult, WidgetStateDelivery, WidgetStateRequest, WidgetStateSource } from "./contracts";

const clone = <T>(value: T): T => structuredClone(value);
const size = (value: JsonValue) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const schemas: Record<string, string> = {
  "showcase/operations": "glansk.showcase.operations/1",
  "showcase/telemetry": "glansk.showcase.telemetry/1",
  "showcase/services": "glansk.showcase.services/1",
  "showcase/incidents": "glansk.showcase.incidents/1",
};
const transition: StateTransition<JsonValue, JsonValue> = {
  cloneState: clone, cloneDelta: clone, measureState: size, measureDelta: size,
  validateState: (schema, state) => { if (!Object.values(schemas).includes(schema) || state === null || Array.isArray(state) || typeof state !== "object") throw new DomainError("schema_invalid", "Invalid showcase widget state"); },
  applyDelta: (schema, current, delta) => {
    if (schema !== schemas["showcase/telemetry"] || !current || !delta || Array.isArray(current) || Array.isArray(delta) || typeof current !== "object" || typeof delta !== "object") throw new DomainError("schema_invalid", "Invalid telemetry delta");
    const base = current as Record<string, JsonValue>, patch = delta as Record<string, JsonValue>;
    return { ...base, points: [...(Array.isArray(base.points) ? base.points : []), ...(Array.isArray(patch.append) ? patch.append : [])].slice(-12) };
  },
};
const grants: Record<string, readonly string[]> = {
  footer: ["showcase/operations"], telemetry: ["showcase/telemetry"], grid: ["showcase/services", "showcase/incidents"],
};

export class ShowcaseWidgetState implements WidgetStateSource {
  readonly #broker = new InMemoryStateBroker<JsonValue, JsonValue>(transition);
  readonly #telemetry: WidgetStateDelivery[] = [];
  constructor() {
    this.seed("showcase/operations", { status: "Broker online", detail: "revisioned snapshot", value: 73 });
    this.seed("showcase/services", { rows: [{ id: "api", name: "API", status: "healthy", region: "eu-west" }, { id: "worker", name: "Worker", status: "warning", region: "us-east" }, { id: "edge", name: "Edge", status: "healthy", region: "ap-south" }] });
    this.seed("showcase/incidents", { byService: { worker: "Queue lag: 42s" } });
    const initial = this.#broker.publishSnapshot({ channel: "showcase/telemetry", schema: schemas["showcase/telemetry"]!, causality: { expectedRevision: 0, operationId: "telemetry-1" }, payload: { series: ["cpu", "memory"], points: [{ t: "10:40", cpu: 42, memory: 61 }, { t: "10:41", cpu: 47, memory: 63 }] } });
    this.#telemetry.push(initial);
    for (const [id, point] of [["2", { t: "10:42", cpu: 53, memory: 64 }], ["3", { t: "10:43", cpu: 49, memory: 66 }]] as const) {
      const before = this.#broker.getSnapshot("showcase/telemetry")!;
      this.#broker.publishDelta({ channel: "showcase/telemetry", schema: schemas["showcase/telemetry"]!, causality: { expectedRevision: before.revision, operationId: `telemetry-${id}` }, payload: { append: [point] } });
      this.#telemetry.push({ kind: "delta", channel: "showcase/telemetry", schema: schemas["showcase/telemetry"]!, fromRevision: before.revision, toRevision: before.revision + 1, payload: { append: [point] } });
    }
  }
  private seed(channel: string, payload: JsonValue) { this.#broker.publishSnapshot({ channel, schema: schemas[channel]!, causality: { expectedRevision: 0, operationId: `seed-${channel}` }, payload }); }
  private authorize(request: WidgetStateRequest) {
    if (request.packageId !== "glansk.demo" || !grants[request.instanceId]?.includes(request.channel)) throw new DomainError("forbidden", "Widget state identity or channel denied");
    const expected = request.instanceId === "footer" ? "sdk-status" : request.instanceId === "telemetry" ? "telemetry-chart" : "status-grid";
    if (request.widgetId !== expected) throw new DomainError("forbidden", "Widget identity denied");
  }
  read(request: WidgetStateRequest): WidgetStateDelivery {
    this.authorize(request);
    if (request.channel === "showcase/telemetry") {
      if (request.fromRevision === undefined) return clone(this.#telemetry[0]!);
      const next = this.#telemetry.find(item => item.kind === "delta" && item.fromRevision === request.fromRevision);
      return next ? clone(next) : request.fromRevision === 3 ? clone(this.#broker.getSnapshot(request.channel)!) : { kind: "resync_required", channel: request.channel, latestRevision: 3, reason: "revision_gap" };
    }
    const snapshot = this.#broker.getSnapshot(request.channel);
    if (!snapshot) throw new DomainError("not_found", "Widget state unavailable");
    return clone(snapshot);
  }
  command(request: WidgetCommandRequest): WidgetCommandResult {
    if (request.packageId !== "glansk.demo" || request.widgetId !== "command-control" || request.instanceId !== "commander" || request.command !== "showcase.acknowledge") throw new DomainError("forbidden", "Widget command denied");
    if (!request.payload || Array.isArray(request.payload) || typeof request.payload !== "object" || (request.payload as Record<string, JsonValue>).target !== "worker") throw new DomainError("schema_invalid", "Command target must be worker");
    return { correlationId: request.correlationId, ok: true, payload: { status: "acknowledged", target: "worker" } };
  }
}
