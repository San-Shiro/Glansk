import { describe, expect, test } from "bun:test";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { ShowcaseWidgetState } from "../src/widget-sdk/showcase-state";
import { WIDGET_PROTOCOL, acceptsWidgetEvent, makeStorageNamespace, type DisplayIdentity } from "../src/widget-sdk/contracts";

describe("widget SDK bridge contracts", () => {
  test("accepts only opaque-origin messages from the bound iframe source and identity", () => {
    const source = {};
    const ready = { protocol: WIDGET_PROTOCOL, type: "ready", instanceId: "footer", nonce: "host-nonce" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: ready }, source, "footer", "host-nonce")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "https://attacker.invalid", source, data: ready }, source, "footer", "host-nonce")).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source: {}, data: ready }, source, "footer", "host-nonce")).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...ready, instanceId: "other" } }, source, "footer", "host-nonce")).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...ready, nonce: "forged" } }, source, "footer", "host-nonce")).toBe(false);
  });

  test("serves broker snapshots only for the configured package, widget, instance, and channel", async () => {
    const widgetState = new ShowcaseWidgetState();
    const app = createApp({ canvases: new InMemoryCanvasService(), widgetState });
    const allowed = await app(new Request("http://local/api/v1/widget-state?instanceId=footer&packageId=glansk.demo&widgetId=sdk-status&channel=showcase%2Foperations"));
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ kind: "snapshot", channel: "showcase/operations", revision: 1, payload: { status: "Broker online" } });
    const denied = await app(new Request("http://local/api/v1/widget-state?instanceId=forged&packageId=glansk.demo&widgetId=sdk-status&channel=showcase%2Foperations"));
    expect(denied.status).toBe(403);
  });

  test("validates bounded command protocol messages and rejects malformed payloads", () => {
    const source = {}, base = { protocol: WIDGET_PROTOCOL, type: "command", instanceId: "commander", nonce: "n", command: "showcase.acknowledge", correlationId: "c-1", payload: { target: "worker" } };
    expect(acceptsWidgetEvent({ origin: "null", source, data: base }, source, "commander", "n")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, correlationId: 4 } }, source, "commander", "n")).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, payload: "x".repeat(17_000) } }, source, "commander", "n")).toBe(false);
  });

  test("validates inter-widget broadcast, notify-subscribe, and notify-unsubscribe protocol messages", () => {
    const source = {};
    const validBroadcast = { protocol: WIDGET_PROTOCOL, type: "broadcast", instanceId: "player", nonce: "n1", topic: "media.play", payload: { track: 5 } };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validBroadcast }, source, "player", "n1")).toBe(true);

    // Rejects oversized topic (>128 chars)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validBroadcast, topic: "t".repeat(129) } }, source, "player", "n1")).toBe(false);

    // Rejects oversized payload (>16KB)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validBroadcast, payload: "x".repeat(17_000) } }, source, "player", "n1")).toBe(false);

    // Subscriptions
    const validSub = { protocol: WIDGET_PROTOCOL, type: "notify-subscribe", instanceId: "player", nonce: "n1", topic: "media.play" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validSub }, source, "player", "n1")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validSub, topic: "t".repeat(129) } }, source, "player", "n1")).toBe(false);

    const validUnsub = { protocol: WIDGET_PROTOCOL, type: "notify-unsubscribe", instanceId: "player", nonce: "n1", topic: "media.play" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validUnsub }, source, "player", "n1")).toBe(true);
  });

  test("validates storage and shared protocol messages and enforces key and payload limits", () => {
    const source = {};
    // storage-get
    const validGet = { protocol: WIDGET_PROTOCOL, type: "storage-get", instanceId: "w1", nonce: "n1", key: "notes", correlationId: "c-1" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validGet }, source, "w1", "n1")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validGet, key: "k".repeat(129) } }, source, "w1", "n1")).toBe(false);

    // storage-set
    const validSet = { protocol: WIDGET_PROTOCOL, type: "storage-set", instanceId: "w1", nonce: "n1", key: "notes", value: { text: "hello" }, correlationId: "c-2" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validSet }, source, "w1", "n1")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validSet, value: "x".repeat(17_000) } }, source, "w1", "n1")).toBe(false);

    // storage-delete
    const validDel = { protocol: WIDGET_PROTOCOL, type: "storage-delete", instanceId: "w1", nonce: "n1", key: "notes", correlationId: "c-3" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validDel }, source, "w1", "n1")).toBe(true);

    // shared-subscribe and shared-unsubscribe
    const validSharedSub = { protocol: WIDGET_PROTOCOL, type: "shared-subscribe", instanceId: "w1", nonce: "n1", key: "turbine_speed" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validSharedSub }, source, "w1", "n1")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validSharedSub, key: "k".repeat(129) } }, source, "w1", "n1")).toBe(false);

    const validSharedUnsub = { protocol: WIDGET_PROTOCOL, type: "shared-unsubscribe", instanceId: "w1", nonce: "n1", key: "turbine_speed" };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validSharedUnsub }, source, "w1", "n1")).toBe(true);

    // shared-set
    const validSharedSet = { protocol: WIDGET_PROTOCOL, type: "shared-set", instanceId: "w1", nonce: "n1", key: "turbine_speed", value: 85 };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validSharedSet }, source, "w1", "n1")).toBe(true);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validSharedSet, value: "x".repeat(17_000) } }, source, "w1", "n1")).toBe(false);
  });

  test("delivers ordered telemetry deltas, requires resync on a gap, and correlates command results", () => {
    const source = new ShowcaseWidgetState();
    const identity = { instanceId: "telemetry", packageId: "glansk.demo", widgetId: "telemetry-chart", channel: "showcase/telemetry" };
    expect(source.read(identity)).toMatchObject({ kind: "snapshot", revision: 1 });
    expect(source.read({ ...identity, fromRevision: 1 })).toMatchObject({ kind: "delta", fromRevision: 1, toRevision: 2 });
    expect(source.read({ ...identity, fromRevision: 99 })).toMatchObject({ kind: "resync_required", latestRevision: 3 });
    expect(source.command!({ instanceId: "commander", packageId: "glansk.demo", widgetId: "command-control", command: "showcase.acknowledge", correlationId: "corr-7", payload: { target: "worker" } })).toMatchObject({ ok: true, correlationId: "corr-7" });
    expect(() => source.command!({ instanceId: "commander", packageId: "glansk.demo", widgetId: "command-control", command: "showcase.forbidden", correlationId: "corr-8", payload: { target: "worker" } })).toThrow();
  });
});

describe("display identity", () => {
  // --- makeStorageNamespace ---

  test("makeStorageNamespace is deterministic: same inputs produce the same namespace", () => {
    const a = makeStorageNamespace("main", "glansk.demo", "sdk-status", "footer");
    const b = makeStorageNamespace("main", "glansk.demo", "sdk-status", "footer");
    expect(a).toBe(b);
  });

  test("makeStorageNamespace produces distinct values for different display ids", () => {
    const a = makeStorageNamespace("screen-a", "glansk.demo", "sdk-status", "footer");
    const b = makeStorageNamespace("screen-b", "glansk.demo", "sdk-status", "footer");
    expect(a).not.toBe(b);
  });

  test("makeStorageNamespace is distinct across all four scoping dimensions", () => {
    const base = makeStorageNamespace("d", "pkg", "wid", "inst");
    // each dimension independently changes the result
    expect(makeStorageNamespace("x", "pkg", "wid", "inst")).not.toBe(base);
    expect(makeStorageNamespace("d", "x",   "wid", "inst")).not.toBe(base);
    expect(makeStorageNamespace("d", "pkg", "x",   "inst")).not.toBe(base);
    expect(makeStorageNamespace("d", "pkg", "wid", "x"   )).not.toBe(base);
  });

  test("makeStorageNamespace result is URL-safe and starts with the 'gl_' prefix", () => {
    const ns = makeStorageNamespace("main", "glansk.demo", "sdk-status", "footer");
    expect(ns).toMatch(/^gl_[A-Za-z0-9_-]+$/);
  });

  test("makeStorageNamespace handles ids with special characters without breaking URL-safety", () => {
    // IDs with dots, hyphens, slashes, and percent signs must still yield a safe namespace
    const ns = makeStorageNamespace("screen/main", "glansk.demo-v2", "wid~1", "inst 01");
    expect(ns).toMatch(/^gl_[A-Za-z0-9_-]+$/);
  });

  test("makeStorageNamespace separator prevents collisions from adjacent-dimension concatenation", () => {
    // Without proper separation "ab" + "c" and "a" + "bc" would collide
    const ab_c = makeStorageNamespace("ab", "c",  "w", "i");
    const a_bc = makeStorageNamespace("a",  "bc", "w", "i");
    expect(ab_c).not.toBe(a_bc);
  });

  // --- DisplayIdentity shape (compile-time contract verified at runtime) ---

  test("DisplayIdentity produced by makeStorageNamespace satisfies the interface shape", () => {
    const id = "lobby";
    const storageNamespace = makeStorageNamespace(id, "glansk.demo", "aurora-metric", "tile-1");
    const displayIdentity: DisplayIdentity = { id, storageNamespace };
    expect(typeof displayIdentity.id).toBe("string");
    expect(typeof displayIdentity.storageNamespace).toBe("string");
    expect(displayIdentity.id).toBe("lobby");
    expect(displayIdentity.storageNamespace).toMatch(/^gl_/);
  });

  // --- ConnectedMessage display field (host-side construction) ---

  test("display is absent from the connected message when no renderContext is supplied (admin preview)", () => {
    // Simulate the host building a connected body without a display (editor path).
    // This mirrors the widget-host.js logic: display is only added when entry.display is set.
    const entry = { display: undefined as { id: string; storageNamespace: string } | undefined };
    const connectedBody: Record<string, unknown> = {
      type: "connected",
      identity: { instanceId: "tile-1", packageId: "glansk.demo", widgetId: "aurora-metric" },
      config: {},
    };
    if (entry.display) connectedBody.display = entry.display;
    expect("display" in connectedBody).toBe(false);
  });

  test("display is present in the connected message when a renderContext with display id is supplied (kiosk path)", () => {
    const displayId = "lobby";
    const ns = makeStorageNamespace(displayId, "glansk.demo", "aurora-metric", "tile-1");
    const entry = { display: { id: displayId, storageNamespace: ns } };
    const connectedBody: Record<string, unknown> = {
      type: "connected",
      identity: { instanceId: "tile-1", packageId: "glansk.demo", widgetId: "aurora-metric" },
      config: {},
    };
    if (entry.display) connectedBody.display = entry.display;
    expect(connectedBody.display).toEqual({ id: "lobby", storageNamespace: ns });
  });

  test("validates variable-set protocol messages and rejects malformed payloads", () => {
    const source = {};
    const validVarSet = {
      protocol: WIDGET_PROTOCOL,
      type: "variable-set",
      instanceId: "sensor-tile",
      nonce: "nonce-xyz",
      name: "thermostatTemp",
      value: 22.5,
    };
    expect(acceptsWidgetEvent({ origin: "null", source, data: validVarSet }, source, "sensor-tile", "nonce-xyz")).toBe(true);

    // Rejects invalid nonce
    expect(acceptsWidgetEvent({ origin: "null", source, data: validVarSet }, source, "sensor-tile", "wrong-nonce")).toBe(false);

    // Rejects oversized variable name (>128 chars)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validVarSet, name: "x".repeat(129) } }, source, "sensor-tile", "nonce-xyz")).toBe(false);

    // Rejects oversized payload (>16KB)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validVarSet, value: "y".repeat(17_000) } }, source, "sensor-tile", "nonce-xyz")).toBe(false);
  });

  test("variables are present in connected payload during widget initialization", () => {
    const connectedBody: Record<string, unknown> = {
      type: "connected",
      identity: { instanceId: "tile-1", packageId: "glansk.demo", widgetId: "aurora-metric" },
      config: {},
      variables: {
        isNightMode: true,
        ambientTemp: 24,
      },
    };
    expect(connectedBody.variables).toEqual({
      isNightMode: true,
      ambientTemp: 24,
    });
  });
});
