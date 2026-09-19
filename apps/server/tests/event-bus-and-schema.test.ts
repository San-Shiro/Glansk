import { describe, expect, test } from "bun:test";
import { createWidgetEventBus } from "../src/shared/widget-event-bus.js";
import { WIDGET_PROTOCOL, acceptsWidgetEvent } from "../src/widget-sdk/contracts";
import { InteractiveStateService } from "../src/services/interactive-state/interactive-state-service";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { getWidgetDefinition, WIDGET_DEFINITIONS } from "../src/shared/widget-definitions.js";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("Slice 2: Local In-Memory Event Bus (createWidgetEventBus)", () => {
  test("publishes to single and multiple subscribers on matching topics", () => {
    const bus = createWidgetEventBus();
    const callsA: any[] = [];
    const callsB: any[] = [];

    bus.subscribe("media.play", (payload, meta) => callsA.push({ payload, meta }));
    bus.subscribe("media.play", (payload, meta) => callsB.push({ payload, meta }));

    bus.publish("media.play", { track: 1 }, { from: "widget-a", timestamp: 1000 });

    expect(callsA).toHaveLength(1);
    expect(callsA[0]).toEqual({ payload: { track: 1 }, meta: { from: "widget-a", timestamp: 1000 } });
    expect(callsB).toHaveLength(1);
    expect(callsB[0]).toEqual({ payload: { track: 1 }, meta: { from: "widget-a", timestamp: 1000 } });
  });

  test("topic isolation: subscribers only receive events for their registered topic", () => {
    const bus = createWidgetEventBus();
    const audioEvents: any[] = [];
    const sensorEvents: any[] = [];

    bus.subscribe("audio.volume", (p) => audioEvents.push(p));
    bus.subscribe("sensor.temp", (p) => sensorEvents.push(p));

    bus.publish("audio.volume", { level: 80 });

    expect(audioEvents).toHaveLength(1);
    expect(sensorEvents).toHaveLength(0);

    bus.publish("sensor.temp", { celsius: 21.5 });

    expect(audioEvents).toHaveLength(1);
    expect(sensorEvents).toHaveLength(1);
  });

  test("unsubscribe cleans up handlers and removes topic entry when empty", () => {
    const bus = createWidgetEventBus();
    expect(bus.hasSubscribers("nav.tab")).toBe(false);

    const unsub1 = bus.subscribe("nav.tab", () => {});
    const unsub2 = bus.subscribe("nav.tab", () => {});

    expect(bus.hasSubscribers("nav.tab")).toBe(true);

    unsub1();
    expect(bus.hasSubscribers("nav.tab")).toBe(true);

    unsub2();
    expect(bus.hasSubscribers("nav.tab")).toBe(false);
  });

  test("error isolation: a throwing subscriber does not prevent subsequent subscribers from firing", () => {
    const bus = createWidgetEventBus();
    let secondSubscriberFired = false;

    bus.subscribe("fault.test", () => {
      throw new Error("Intentional subscriber crash");
    });
    bus.subscribe("fault.test", () => {
      secondSubscriberFired = true;
    });

    // Should not throw to caller
    expect(() => bus.publish("fault.test", { ok: true })).not.toThrow();
    expect(secondSubscriberFired).toBe(true);
  });

  test("edge cases: non-string or empty topics and invalid handlers are handled safely", () => {
    const bus = createWidgetEventBus();

    // Invalid subscriptions
    const unsubEmpty = bus.subscribe("", () => {});
    expect(typeof unsubEmpty).toBe("function");
    unsubEmpty();

    const unsubNull = (bus as any).subscribe(null, () => {});
    expect(typeof unsubNull).toBe("function");

    const unsubNoHandler = (bus as any).subscribe("test.topic", null);
    expect(typeof unsubNoHandler).toBe("function");

    // Invalid publications
    expect(() => bus.publish("", { data: 1 })).not.toThrow();
    expect(() => (bus as any).publish(null, { data: 1 })).not.toThrow();
    expect(() => (bus as any).publish(123, { data: 1 })).not.toThrow();
  });

  test("clear removes all registered subscribers across all topics", () => {
    const bus = createWidgetEventBus();
    bus.subscribe("t1", () => {});
    bus.subscribe("t2", () => {});

    expect(bus.hasSubscribers("t1")).toBe(true);
    expect(bus.hasSubscribers("t2")).toBe(true);

    bus.clear();

    expect(bus.hasSubscribers("t1")).toBe(false);
    expect(bus.hasSubscribers("t2")).toBe(false);
  });
});

describe("Slice 2: Protocol Validation (acceptsWidgetEvent for Bus Messages)", () => {
  const source = {};
  const instanceId = "player-widget";
  const nonce = "secure-nonce-123";

  test("accepts valid broadcast messages with diverse JSON payloads", () => {
    const payloads = [
      { track: "Song 1", progress: 0.5 },
      [1, 2, 3],
      "simple string payload",
      42,
      true,
      null,
    ];

    for (const payload of payloads) {
      const msg = {
        protocol: WIDGET_PROTOCOL,
        type: "broadcast",
        instanceId,
        nonce,
        topic: "media.state",
        payload,
      };
      expect(acceptsWidgetEvent({ origin: "null", source, data: msg }, source, instanceId, nonce)).toBe(true);
    }
  });

  test("rejects broadcast messages violating security boundaries", () => {
    const base = {
      protocol: WIDGET_PROTOCOL,
      type: "broadcast",
      instanceId,
      nonce,
      topic: "media.state",
      payload: { valid: true },
    };

    // Non-opaque origin
    expect(acceptsWidgetEvent({ origin: "http://localhost:3000", source, data: base }, source, instanceId, nonce)).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source: {}, data: base }, source, instanceId, nonce)).toBe(false);

    // Mismatched identity / nonce
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, instanceId: "other" } }, source, instanceId, nonce)).toBe(false);
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, nonce: "wrong" } }, source, instanceId, nonce)).toBe(false);

    // Oversized topic (>128 chars)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, topic: "a".repeat(129) } }, source, instanceId, nonce)).toBe(false);
    // Boundary topic (=128 chars is allowed)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, topic: "a".repeat(128) } }, source, instanceId, nonce)).toBe(true);

    // Non-string topic
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, topic: 12345 } }, source, instanceId, nonce)).toBe(false);

    // Oversized payload (>16KB)
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...base, payload: "x".repeat(16385) } }, source, instanceId, nonce)).toBe(false);
  });

  test("accepts valid notify-subscribe and notify-unsubscribe messages", () => {
    const subMsg = {
      protocol: WIDGET_PROTOCOL,
      type: "notify-subscribe",
      instanceId,
      nonce,
      topic: "climate.thermostat",
    };
    expect(acceptsWidgetEvent({ origin: "null", source, data: subMsg }, source, instanceId, nonce)).toBe(true);

    const unsubMsg = {
      protocol: WIDGET_PROTOCOL,
      type: "notify-unsubscribe",
      instanceId,
      nonce,
      topic: "climate.thermostat",
    };
    expect(acceptsWidgetEvent({ origin: "null", source, data: unsubMsg }, source, instanceId, nonce)).toBe(true);

    // Rejects overlong subscription topics
    expect(acceptsWidgetEvent({ origin: "null", source, data: { ...subMsg, topic: "t".repeat(129) } }, source, instanceId, nonce)).toBe(false);
  });
});

describe("Slice 2: Ephemeral Notification Invariant & Zero Disk IO", () => {
  test("publishing notifications never writes to disk interactive-state.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-notify-zero-disk-"));
    try {
      const service = new InteractiveStateService(dir);
      await service.initialize();

      const stateFile = join(dir, "interactive-state.json");

      // Before any saves, file does not exist
      let fileExistsBefore = false;
      try {
        await stat(stateFile);
        fileExistsBefore = true;
      } catch {
        fileExistsBefore = false;
      }
      expect(fileExistsBefore).toBe(false);

      // Publish high-frequency ephemeral events (simulating a rapid slider or sensor pulse)
      for (let i = 0; i < 50; i++) {
        service.publishNotification("slider.move", { value: i }, "slider-1", "sess-test");
      }

      // Wait 300ms (longer than the 150ms debounce for persistent state saves)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Verify state file was STILL NOT created
      let fileExistsAfter = false;
      try {
        await stat(stateFile);
        fileExistsAfter = true;
      } catch {
        fileExistsAfter = false;
      }
      expect(fileExistsAfter).toBe(false);

      // Now set actual persistent state to verify disk write only happens for persistent state
      await service.setGlobal("real-state", { saved: true });
      await new Promise((resolve) => setTimeout(resolve, 300));

      const fileStats = await stat(stateFile);
      expect(fileStats.size).toBeGreaterThan(0);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe("Slice 2: HTTP Route POST /api/v1/widget-notify and SSE Stream", () => {
  test("POST /api/v1/widget-notify validates parameters and fans out to SSE stream", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-notify-http-"));
    try {
      const interactiveState = new InteractiveStateService(dir);
      await interactiveState.initialize();

      const canvases = new InMemoryCanvasService();
      const app = createApp({ canvases, interactiveState });

      // 1. Establish SSE stream connection
      const streamReq = new Request("http://localhost/api/v1/interactive-state/events");
      const streamRes = await app(streamReq);
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();

      // Read the initial ping
      const initialChunk = await reader.read();
      const initialText = decoder.decode(initialChunk.value);
      expect(initialText).toContain("event: ping");

      // 2. Post valid notification
      const notifyReq = new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "lights.livingroom",
          payload: { power: "on", brightness: 75 },
          senderId: "switch-widget",
          sessionId: "sess-abc",
        }),
      });

      const notifyRes = await app(notifyReq);
      expect(notifyRes.status).toBe(200);
      expect(await notifyRes.json()).toEqual({ ok: true });

      // 3. Verify event appears on the SSE stream
      const sseChunk = await reader.read();
      const sseText = decoder.decode(sseChunk.value);
      expect(sseText).toContain("event: notification");
      expect(sseText).toContain('"topic":"lights.livingroom"');
      expect(sseText).toContain('"brightness":75');
      expect(sseText).toContain('"senderId":"switch-widget"');
      expect(sseText).toContain('"sessionId":"sess-abc"');

      // 4. Cancel stream
      await reader.cancel();

      // 5. Test HTTP validation errors
      // Missing topic
      const resNoTopic = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: {} }),
      }));
      expect(resNoTopic.status).toBe(400);

      // Overlong topic (>128 chars)
      const resLongTopic = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "x".repeat(129), payload: {} }),
      }));
      expect(resLongTopic.status).toBe(400);

      // Oversized payload (>16KB)
      const resLargePayload = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "test.oversized", payload: "a".repeat(17000) }),
      }));
      expect(resLargePayload.status).toBe(413);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe("Slice 1: Schema-Driven Widget Definitions & Metadata Validation", () => {
  test("all migrated widgets expose valid, robust configSchema arrays", () => {
    const migratedWidgets = [
      "quick-notes",
      "music-player",
      "device-switchboard",
      "task-matrix",
      "emitter-widget",
    ];

    const validFieldTypes = new Set([
      "string",
      "number",
      "boolean",
      "select",
      "color",
      "textarea",
      "secret-ref",
      "string[]",
      "radius",
      "range",
      "media",
      "toggle",
    ]);

    for (const widgetId of migratedWidgets) {
      const def = getWidgetDefinition(widgetId);
      expect(def).toBeDefined();
      expect(Array.isArray(def?.configSchema)).toBe(true);
      expect(def!.configSchema!.length).toBeGreaterThan(0);

      for (const field of def!.configSchema!) {
        // Field contract checks
        const fieldKey = (field as any).name || field.key;
        expect(typeof fieldKey).toBe("string");
        expect(fieldKey.length).toBeGreaterThan(0);
        expect(typeof field.label).toBe("string");
        expect(field.label!.length).toBeGreaterThan(0);
        expect(validFieldTypes.has(field.type)).toBe(true);

        // Type-specific invariants
        if (field.type === "select") {
          expect(Array.isArray(field.options)).toBe(true);
          expect(field.options!.length).toBeGreaterThan(0);
          for (const opt of field.options!) {
            expect(typeof opt.value).toBe("string");
            expect(typeof opt.label).toBe("string");
          }
        }

        if (field.type === "number") {
          if (field.min !== undefined) expect(typeof field.min).toBe("number");
          if (field.max !== undefined) expect(typeof field.max).toBe("number");
          if (field.step !== undefined) expect(typeof field.step).toBe("number");
        }
      }
    }
  });

  test("all widgets in registry have responsive sizing bounds and valid color slot counts", () => {
    const allDefs = Object.values(WIDGET_DEFINITIONS);
    expect(allDefs.length).toBeGreaterThanOrEqual(6);

    for (const def of allDefs) {
      expect(def.title).toBeTruthy();
      expect(def.minWidth).toBeGreaterThan(0);
      expect(def.minHeight).toBeGreaterThan(0);
      expect(Array.isArray(def.colorSlots)).toBe(true);
      expect(def.colorSlots.length).toBeGreaterThan(0);
    }
  });
});
