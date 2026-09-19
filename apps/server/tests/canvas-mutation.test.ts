import { test, expect, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableCanvasService } from "../src/services/canvas/durable-canvas-service";
import { FileCanvasRepository } from "../src/adapters/persistence/file-canvas-repository";
import { createApp } from "../src/app";

const dirs: string[] = [];
afterEach(async () => Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true }))));

async function createService() {
  const root = await mkdtemp(join(tmpdir(), "glansk-mut-"));
  dirs.push(root);
  const repo = new FileCanvasRepository(root);
  const service = new DurableCanvasService(repo);
  return { root, service, repo };
}

test("DurableCanvasService: delete permanently removes canvas draft and publication", async () => {
  const { service } = await createService();
  await service.create({ id: "to-delete", name: "To Delete" });
  await service.publish("to-delete");

  expect((await service.list()).some((c) => c.id === "to-delete")).toBe(true);

  const deleted = await service.delete("to-delete");
  expect(deleted).toBe(true);

  expect((await service.list()).some((c) => c.id === "to-delete")).toBe(false);
  expect(await service.open("to-delete")).toBeUndefined();
  expect(await service.getPublished("to-delete")).toBeUndefined();
});

test("DurableCanvasService: updateMetadata renames display name and migrates slug ID", async () => {
  const { service } = await createService();
  await service.create({ id: "old-slug", name: "Original Name" });
  await service.publish("old-slug");

  // Rename and slug migration
  const updated = await service.updateMetadata("old-slug", {
    name: "Brand New Name",
    newId: "new-slug",
    logicalSize: { width: 1920, height: 1080 },
  });

  expect(updated.id).toBe("new-slug");
  expect(updated.name).toBe("Brand New Name");
  expect(updated.logicalSize).toEqual({ width: 1920, height: 1080 });

  // Old slug is gone, new slug is present
  expect(await service.open("old-slug")).toBeUndefined();
  const opened = await service.open("new-slug");
  expect(opened).toBeDefined();
  expect(opened?.draft.document.name).toBe("Brand New Name");
  expect(opened?.draft.document.id).toBe("new-slug");
  expect(opened?.publication?.canvasId).toBe("new-slug");
});

test("HTTP API: handles DELETE /api/v1/canvases/:id and PATCH metadata", async () => {
  const { service } = await createService();
  const app = createApp({ canvases: service } as any);

  // 1. Create canvas
  const createRes = await app(
    new Request("http://localhost/api/v1/canvases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "api-test", name: "API Test" }),
    })
  );
  expect(createRes.status).toBe(201);

  // 2. Patch metadata
  const patchRes = await app(
    new Request("http://localhost/api/v1/canvases/api-test/metadata", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated API Test", newId: "api-test-renamed" }),
    })
  );
  expect(patchRes.status).toBe(200);
  const patchData = (await patchRes.json()) as any;
  expect(patchData.ok).toBe(true);
  expect(patchData.canvas.id).toBe("api-test-renamed");
  expect(patchData.canvas.name).toBe("Updated API Test");

  // 3. Delete canvas
  const delRes = await app(
    new Request("http://localhost/api/v1/canvases/api-test-renamed", {
      method: "DELETE",
    })
  );
  expect(delRes.status).toBe(200);
  const delData = (await delRes.json()) as any;
  expect(delData.ok).toBe(true);

  // 4. Verify gone
  const getRes = await app(new Request("http://localhost/api/v1/canvases/api-test-renamed"));
  expect(getRes.status).toBe(404);
});
