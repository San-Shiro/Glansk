import { describe, expect, it } from "bun:test";
import { InteractiveStateService } from "../src/services/interactive-state/interactive-state-service";
import { createApp } from "../src/app";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("InteractiveStateService", () => {
  it("stores and retrieves global state with monotonic revisions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-test-"));
    try {
      const service = new InteractiveStateService(dir);
      await service.initialize();

      expect(service.getGlobal("music-1")).toBeUndefined();

      const r1 = await service.setGlobal("music-1", { isPlaying: true, track: 2 });
      expect(r1.revision).toBe(1);
      expect(r1.state).toEqual({ isPlaying: true, track: 2 });

      const fetched = service.getGlobal("music-1");
      expect(fetched?.revision).toBe(1);
      expect(fetched?.state).toEqual({ isPlaying: true, track: 2 });

      const r2 = await service.setGlobal("music-1", { isPlaying: false, track: 3 });
      expect(r2.revision).toBe(2);
      expect(service.getGlobal("music-1")?.state).toEqual({ isPlaying: false, track: 3 });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("partitions cookie-based state so unique users have isolated data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-cookie-"));
    try {
      const service = new InteractiveStateService(dir);
      await service.initialize();

      const clientA = "cid_alice_123";
      const clientB = "cid_bob_456";

      await service.setCookie(clientA, "notes-widget", { text: "Alice secret memo" });
      await service.setCookie(clientB, "notes-widget", { text: "Bob project checklist" });

      const aliceState = service.getCookie(clientA, "notes-widget");
      const bobState = service.getCookie(clientB, "notes-widget");

      expect(aliceState?.state).toEqual({ text: "Alice secret memo" });
      expect(bobState?.state).toEqual({ text: "Bob project checklist" });

      // Alice updates her note, Bob's note remains unchanged
      await service.setCookie(clientA, "notes-widget", { text: "Alice revised memo" });
      expect(service.getCookie(clientA, "notes-widget")?.state).toEqual({ text: "Alice revised memo" });
      expect(service.getCookie(clientB, "notes-widget")?.state).toEqual({ text: "Bob project checklist" });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("notifies subscribers when state changes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-sub-"));
    try {
      const service = new InteractiveStateService(dir);
      await service.initialize();

      const events: any[] = [];
      const unsub = service.subscribe(e => events.push(e));

      await service.setGlobal("switchboard-1", { livingRoom: true }, "sender_tab_1");
      await service.setCookie("cid_user_1", "notes-1", { text: "Hello" }, "sender_tab_2");

      expect(events.length).toBe(2);
      expect(events[0].mode).toBe("global");
      expect(events[0].key).toBe("switchboard-1");
      expect(events[0].senderId).toBe("sender_tab_1");
      expect(events[0].state).toEqual({ livingRoom: true });

      expect(events[1].mode).toBe("cookie");
      expect(events[1].key).toBe("notes-1");
      expect(events[1].clientId).toBe("cid_user_1");

      unsub();
      await service.setGlobal("switchboard-1", { livingRoom: false });
      expect(events.length).toBe(2);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("survives restart and recovers persisted global and cookie state from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-durable-"));
    try {
      const service1 = new InteractiveStateService(dir);
      await service1.initialize();

      await service1.setGlobal("shared-board", { message: "System maintenance at 02:00" });
      await service1.setCookie("cid_persisted_user", "private-notes", { content: "Persistent note" });

      // Wait a moment for the debounced flush to complete
      await Bun.sleep(250);

      // Start fresh instance reading from same directory
      const service2 = new InteractiveStateService(dir);
      await service2.initialize();

      const restoredGlobal = service2.getGlobal("shared-board");
      expect(restoredGlobal?.state).toEqual({ message: "System maintenance at 02:00" });

      const restoredCookie = service2.getCookie("cid_persisted_user", "private-notes");
      expect(restoredCookie?.state).toEqual({ content: "Persistent note" });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("handles HTTP API routes with automatic cookie issuance and isolation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-http-"));
    try {
      const stateService = new InteractiveStateService(dir);
      await stateService.initialize();

      const mockCanvases: any = { list: async () => [] };
      const app = createApp({ canvases: mockCanvases, interactiveState: stateService });

      // 1. Initial GET without cookie -> receives state and Set-Cookie
      const getRes1 = await app(new Request("http://localhost/api/v1/interactive-state?mode=global&key=demo-switch"));
      expect(getRes1.status).toBe(200);
      const setCookieHeader = getRes1.headers.get("set-cookie");
      expect(setCookieHeader).toContain("gl_client_id=cid_");

      // Extract client cookie
      const match = setCookieHeader?.match(/gl_client_id=(cid_[a-zA-Z0-9_-]+)/);
      const clientId = match ? match[1] : "";
      expect(clientId).toBeTruthy();

      // 2. Global state mutation
      const postGlobal = await app(new Request("http://localhost/api/v1/interactive-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "global", key: "demo-switch", state: { lightsOn: true } }),
      }));
      expect(postGlobal.status).toBe(200);
      const globalBody = await postGlobal.json();
      expect(globalBody.ok).toBe(true);

      // Verify global read
      const getGlobal2 = await app(new Request("http://localhost/api/v1/interactive-state?mode=global&key=demo-switch"));
      const getGlobalBody = await getGlobal2.json();
      expect(getGlobalBody.state).toEqual({ lightsOn: true });

      // 3. Cookie state mutation with client cookie
      const postCookie = await app(new Request("http://localhost/api/v1/interactive-state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": `gl_client_id=${clientId}`,
        },
        body: JSON.stringify({ mode: "cookie", key: "my-note", state: { text: "Client note content" } }),
      }));
      expect(postCookie.status).toBe(200);

      // Verify cookie read
      const getCookie = await app(new Request("http://localhost/api/v1/interactive-state?mode=cookie&key=my-note", {
        headers: { "Cookie": `gl_client_id=${clientId}` },
      }));
      const getCookieBody = await getCookie.json();
      expect(getCookieBody.state).toEqual({ text: "Client note content" });

      // Separate visitor with different cookie has null state
      const getOther = await app(new Request("http://localhost/api/v1/interactive-state?mode=cookie&key=my-note", {
        headers: { "Cookie": `gl_client_id=cid_another_visitor` },
      }));
      const getOtherBody = await getOther.json();
      expect(getOtherBody.state).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it("dispatches ephemeral notifications without disk persistence and validates HTTP notify endpoint", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-notify-"));
    try {
      const service = new InteractiveStateService(dir);
      await service.initialize();

      const received: any[] = [];
      const unsub = service.onNotification((ev) => received.push(ev));

      service.publishNotification("media.playback", { action: "pause", trackId: "t-42" }, "widget-player", "sess-1");

      expect(received).toHaveLength(1);
      expect(received[0].topic).toBe("media.playback");
      expect(received[0].payload).toEqual({ action: "pause", trackId: "t-42" });
      expect(received[0].senderId).toBe("widget-player");
      expect(received[0].sessionId).toBe("sess-1");
      expect(typeof received[0].timestamp).toBe("number");

      // Verify unsubscribe works
      unsub();
      service.publishNotification("media.playback", { action: "play" });
      expect(received).toHaveLength(1);

      // Verify HTTP notify endpoint
      const app = createApp({ canvases: { list: async () => [], open: async () => null, create: async () => ({ id: "c1", revision: 1 }), save: async () => ({ id: "c1", revision: 2 }), publish: async () => ({ id: "c1", publicationRevision: 1 }), getPublished: async () => null } as any, interactiveState: service });

      const postNotify = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "sensor.temp", payload: { c: 24.5 }, senderId: "sensor-1", sessionId: "sess-2" }),
      }));
      expect(postNotify.status).toBe(200);
      expect(await postNotify.json()).toEqual({ ok: true });

      // Bad requests
      const badTopic = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "", payload: {} }),
      }));
      expect(badTopic.status).toBe(400);

      const oversized = await app(new Request("http://localhost/api/v1/widget-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "test", payload: "x".repeat(20_000) }),
      }));
      expect(oversized.status).toBe(413);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
