import { describe, expect, test } from "bun:test";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";

const canvas = {
  schemaVersion: 1 as const,
  id: "main",
  name: "Main",
  logicalSize: { width: 1920, height: 1080 },
  background: "#0d1117",
  theme: { preset: "aurora", variables: { "--canvas-accent": "#53e0bc" } },
  widgets: [],
};

describe("InMemoryCanvasService", () => {
  test("publishes immutable monotonic revisions", async () => {
    const service = new InMemoryCanvasService();
    await service.saveDraft(canvas);
    expect((await service.publish("main")).revision).toBe(1);
    await service.saveDraft({ ...canvas, name: "Updated" });
    expect((await service.publish("main")).revision).toBe(2);
    expect((await service.getPublished("main"))?.document.name).toBe("Updated");
    expect((await service.getPublished("main"))?.document.theme?.variables?.["--canvas-accent"]).toBe("#53e0bc");
  });
});
