import { describe, test, expect, afterEach } from "bun:test";
import { createApp } from "../src/app";
import { EmitterService } from "../src/services/emitter/emitter-service";
import type { CanvasDocument, CanvasWorkspace, PublishedCanvas } from "../src/domain/types";
import type { CanvasService, UpdateCanvasMetadataInput } from "../src/services/contracts";
import type { CanvasDraft, CanvasSummary, CreateCanvasInput } from "../src/domain/canvas";

class MockCanvasService implements CanvasService {
  public docs = new Map<string, CanvasDocument>();
  public revisions = new Map<string, number>();
  public publications = new Map<string, PublishedCanvas>();
  public saveDraftCalls = 0;
  public publishCalls = 0;

  constructor(initialDoc: CanvasDocument) {
    this.docs.set(initialDoc.id, structuredClone(initialDoc));
    this.revisions.set(initialDoc.id, 1);
  }

  async list() {
    return Array.from(this.docs.values()).map((d) => ({
      id: d.id,
      name: d.name,
      logicalSize: d.logicalSize,
      widgetCount: d.widgets.length,
      draftRevision: this.revisions.get(d.id) ?? 1,
      updatedAt: Date.now(),
    }));
  }

  async open(canvasId: string): Promise<CanvasWorkspace | undefined> {
    const doc = this.docs.get(canvasId);
    if (!doc) return undefined;
    return {
      draft: {
        document: structuredClone(doc),
        draftRevision: this.revisions.get(canvasId) ?? 1,
        updatedAt: Date.now(),
      },
    };
  }

  async save(input: { document: CanvasDocument; expectedDraftRevision: number }) {
    this.saveDraftCalls++;
    const currentRev = this.revisions.get(input.document.id) ?? 1;
    if (input.expectedDraftRevision !== currentRev) {
      throw new Error(`Revision conflict: expected ${input.expectedDraftRevision}, got ${currentRev}`);
    }
    this.docs.set(input.document.id, structuredClone(input.document));
    const nextRev = currentRev + 1;
    this.revisions.set(input.document.id, nextRev);
    return {
      document: structuredClone(input.document),
      draftRevision: nextRev,
      updatedAt: Date.now(),
    };
  }

  async saveDraft(document: CanvasDocument) {
    this.saveDraftCalls++;
    this.docs.set(document.id, structuredClone(document));
  }

  async getDraft(canvasId: string) {
    return this.docs.get(canvasId);
  }

  async publish(canvasId: string) {
    this.publishCalls++;
    const doc = this.docs.get(canvasId);
    if (!doc) throw new Error("Canvas not found");
    const pub: PublishedCanvas = {
      canvasId,
      revision: (this.publications.get(canvasId)?.revision ?? 0) + 1,
      publishedAt: Date.now(),
      document: structuredClone(doc),
    };
    this.publications.set(canvasId, pub);
    return pub;
  }

  async getPublished(canvasId: string) {
    return this.publications.get(canvasId);
  }

  async create(input: CreateCanvasInput): Promise<CanvasDraft> {
    const doc: CanvasDocument = {
      schemaVersion: 1,
      id: input.id,
      name: input.name,
      logicalSize: input.logicalSize ?? { width: 1280, height: 720 },
      background: "#000",
      widgets: [],
    };
    this.docs.set(doc.id, doc);
    return {
      document: structuredClone(doc),
      draftRevision: 1,
      updatedAt: Date.now(),
    };
  }

  async delete(canvasId: string): Promise<boolean> {
    const existed = this.docs.delete(canvasId);
    this.publications.delete(canvasId);
    this.revisions.delete(canvasId);
    return existed;
  }

  async updateMetadata(canvasId: string, input: UpdateCanvasMetadataInput): Promise<CanvasSummary> {
    const doc = this.docs.get(canvasId);
    if (!doc) throw new Error("Canvas not found");
    if (input.name) doc.name = input.name;
    return {
      id: doc.id,
      name: doc.name,
      logicalSize: doc.logicalSize,
      widgetCount: doc.widgets.length,
      draftRevision: this.revisions.get(canvasId) ?? 1,
      updatedAt: Date.now(),
    };
  }
}

describe("Emitter Lifecycle, Auto-Mount, and Pruning Engine", () => {
  let emitterService: EmitterService;

  afterEach(() => {
    emitterService?.stopSweeper();
  });

  test("auto-mount adds emitter-widget to target canvas without clobbering", async () => {
    const initialDoc: CanvasDocument = {
      schemaVersion: 1,
      id: "glansk-demo-showcase",
      name: "Demo Showcase",
      logicalSize: { width: 1280, height: 720 },
      background: "#000",
      widgets: [],
    };

    const mockCanvases = new MockCanvasService(initialDoc);
    emitterService = new EmitterService(mockCanvases);

    // Register with autoMount enabled
    emitterService.register({
      id: "go-system-monitor",
      name: "Host Telemetry (Go)",
      category: "metrics",
      autoMount: { enabled: true },
      lifecycle: { offlineBehavior: "retain-dormant" },
    }, { cpu: "12%", memory: "34MB" });

    // Wait for autoMount async task
    await new Promise((r) => setTimeout(r, 50));

    const doc = await mockCanvases.getDraft("glansk-demo-showcase");
    expect(doc?.widgets.length).toBe(1);

    const widget = doc?.widgets[0];
    expect(widget?.widgetId).toBe("emitter-widget");
    expect(widget?.config?.emitterId).toBe("go-system-monitor");
    expect(widget?.config?.managedBy).toBe("emitter-auto-mount");
    expect(widget?.config?.managedEmitterId).toBe("go-system-monitor");
    expect(mockCanvases.saveDraftCalls).toBe(1);
    expect(mockCanvases.publishCalls).toBe(1);

    // Invariant check: routine heartbeats and publishState do NOT re-save drafts or bump revisions!
    const previousSaves = mockCanvases.saveDraftCalls;
    emitterService.publishState("go-system-monitor", { cpu: "18%", memory: "36MB" });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockCanvases.saveDraftCalls).toBe(previousSaves);
    expect(doc?.widgets.length).toBe(1);
  });

  test("auto-remove prunes transient widget when offline TTL expires", async () => {
    const initialDoc: CanvasDocument = {
      schemaVersion: 1,
      id: "glansk-demo-showcase",
      name: "Demo Showcase",
      logicalSize: { width: 1280, height: 720 },
      background: "#000",
      widgets: [
        {
          id: "w_user_created",
          packageId: "glansk-core",
          widgetId: "emitter-widget",
          geometry: { x: 10, y: 10, width: 300, height: 200, zIndex: 1 },
          config: {
            emitterId: "user-persistent-sensor",
            managedBy: "user", // user-created, should NOT be pruned
          },
        },
      ],
    };

    const mockCanvases = new MockCanvasService(initialDoc);
    emitterService = new EmitterService(mockCanvases);

    // Register transient emitter with very short TTL
    emitterService.register({
      id: "go-transient-player",
      name: "Transient Player (Go)",
      category: "media",
      autoMount: { enabled: true },
      lifecycle: {
        staleSeconds: 1,
        ttlSeconds: 2,
        transient: true,
        offlineBehavior: "auto-remove",
      },
    });

    await new Promise((r) => setTimeout(r, 50));

    let doc = await mockCanvases.getDraft("glansk-demo-showcase");
    // Should now have 2 widgets: the user one and the auto-mounted one
    expect(doc?.widgets.length).toBe(2);

    const autoMounted = doc?.widgets.find((w) => w.config?.managedBy === "emitter-auto-mount");
    expect(autoMounted).toBeDefined();

    // Trigger sweeper by advancing lastSeen backward
    const reg = emitterService.getEmitter("go-transient-player")!;
    (reg as any).lastSeen = Date.now() - 3000; // 3 seconds ago (> TTL of 2s)

    // Trigger a sweep
    (emitterService as any).sweepHeartbeats();
    await new Promise((r) => setTimeout(r, 50));

    doc = await mockCanvases.getDraft("glansk-demo-showcase");
    // Auto-mounted widget was pruned, but user-created widget is intact!
    expect(doc?.widgets.length).toBe(1);
    expect(doc?.widgets[0]?.id).toBe("w_user_created");
  });

  test("DELETE /api/v1/emitters/:id cleanly unregisters and prunes transient emitter", async () => {
    const initialDoc: CanvasDocument = {
      schemaVersion: 1,
      id: "glansk-demo-showcase",
      name: "Demo Showcase",
      logicalSize: { width: 1280, height: 720 },
      background: "#000",
      widgets: [],
    };

    const mockCanvases = new MockCanvasService(initialDoc);
    emitterService = new EmitterService(mockCanvases);

    const app = createApp({ canvases: mockCanvases, emitters: emitterService });

    // Register via HTTP POST /state
    const regRes = await app(new Request("http://localhost:3000/api/v1/emitters/media-app/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        manifest: {
          id: "media-app",
          name: "Media App",
          category: "media",
          autoMount: { enabled: true },
          lifecycle: { offlineBehavior: "auto-remove" },
        },
        state: { playing: true },
      }),
    }));
    expect(regRes.status).toBe(200);

    await new Promise((r) => setTimeout(r, 50));
    let doc = await mockCanvases.getDraft("glansk-demo-showcase");
    expect(doc?.widgets.length).toBe(1);

    // Call DELETE /api/v1/emitters/media-app
    const delRes = await app(new Request("http://localhost:3000/api/v1/emitters/media-app", {
      method: "DELETE",
    }));
    expect(delRes.status).toBe(200);

    const delData = await delRes.json();
    expect(delData.ok).toBe(true);

    await new Promise((r) => setTimeout(r, 50));

    // Widget should be removed from canvas
    doc = await mockCanvases.getDraft("glansk-demo-showcase");
    expect(doc?.widgets.length).toBe(0);

    // Emitter should no longer be in registry
    expect(emitterService.getEmitter("media-app")).toBeUndefined();
  });
});
