import { describe, test, expect } from "bun:test";
import { createApp } from "../src/app";
import { EmitterService } from "../src/services/emitter/emitter-service";

describe("Emitter HTTP & SSE API", () => {
  const dummyCanvases = {
    list: async () => [],
    open: async () => null,
    create: async () => ({ id: "test", name: "test", publicationRevision: 0 }),
    save: async () => ({ revision: 1 }),
    publish: async () => ({ revision: 1 }),
    getPublished: async () => null,
  } as any;

  test("GET /api/v1/emitters returns list of emitters", async () => {
    const emitters = new EmitterService();
    emitters.register({
      id: "ytmusic",
      name: "YouTube Music Desktop",
      category: "media",
    }, { playing: true, track: "Starboy" });

    const app = createApp({ canvases: dummyCanvases, emitters });
    const res = await app(new Request("http://localhost:3000/api/v1/emitters"));
    expect(res.status).toBe(200);

    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
    expect(list[0].manifest.id).toBe("ytmusic");
    expect(list[0].state.track).toBe("Starboy");
  });

  test("GET /api/v1/emitters/:id returns single emitter", async () => {
    const emitters = new EmitterService();
    emitters.register({
      id: "sensor-pi",
      name: "Raspberry Pi Sensors",
      category: "sensor",
    }, { cpuTemp: 48.2 });

    const app = createApp({ canvases: dummyCanvases, emitters });
    const res = await app(new Request("http://localhost:3000/api/v1/emitters/sensor-pi"));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.manifest.id).toBe("sensor-pi");
    expect(data.state.cpuTemp).toBe(48.2);

    const res404 = await app(new Request("http://localhost:3000/api/v1/emitters/non-existent"));
    expect(res404.status).toBe(404);
  });

  test("POST /api/v1/emitters/:id/state updates state and auto-registers", async () => {
    const emitters = new EmitterService();
    const app = createApp({ canvases: dummyCanvases, emitters });

    const postRes = await app(new Request("http://localhost:3000/api/v1/emitters/gpio-relay/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state: { relay1: true, voltage: 5.0 } }),
    }));
    expect(postRes.status).toBe(200);

    const reg = emitters.getEmitter("gpio-relay");
    expect(reg).toBeDefined();
    expect(reg?.state.relay1).toBe(true);
    expect(reg?.state.voltage).toBe(5.0);
  });

  test("POST /api/v1/emitters/:id/command executes command and receives result", async () => {
    const emitters = new EmitterService();
    emitters.register({
      id: "ytmusic",
      name: "YouTube Music",
      category: "media",
    }, { playing: false });

    // Mock handler
    emitters.bindCommandHandler("ytmusic", async (cmd) => {
      if (cmd.command === "play") {
        emitters.publishState("ytmusic", { playing: true });
        return { ok: true, state: { playing: true } };
      }
      return { ok: false, error: "unknown_command" };
    });

    const app = createApp({ canvases: dummyCanvases, emitters });
    const cmdRes = await app(new Request("http://localhost:3000/api/v1/emitters/ytmusic/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "play", payload: {} }),
    }));

    expect(cmdRes.status).toBe(200);
    const body = await cmdRes.json();
    expect(body.ok).toBe(true);
    expect(body.state.playing).toBe(true);
    expect(emitters.getEmitter("ytmusic")?.state.playing).toBe(true);
  });

  test("GET /api/v1/emitters/:id/commands streams dispatched commands over SSE", async () => {
    const emitters = new EmitterService();
    emitters.register({
      id: "media-streamer",
      name: "Streaming Media Player",
      category: "media",
    }, { playing: false });

    const app = createApp({ canvases: dummyCanvases, emitters });

    // Open SSE command stream
    const sseRes = await app(new Request("http://localhost:3000/api/v1/emitters/media-streamer/commands"));
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial ping
    const firstChunk = await reader.read();
    const firstText = decoder.decode(firstChunk.value);
    expect(firstText).toContain("event: ping");

    // Dispatch command from canvas
    const postPromise = app(new Request("http://localhost:3000/api/v1/emitters/media-streamer/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "play_pause" }),
    }));

    // Read streamed command
    const secondChunk = await reader.read();
    const secondText = decoder.decode(secondChunk.value);
    expect(secondText).toContain("event: command");
    expect(secondText).toContain("play_pause");

    const cmdRes = await postPromise;
    expect(cmdRes.status).toBe(200);

    await reader.cancel();
  });
});

