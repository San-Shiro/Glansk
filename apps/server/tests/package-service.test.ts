import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PackageService } from "../src/services/package/package-service";
import { extractZip, createZip } from "../src/platform/archive";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { isPackagedWidget } from "../src/widgets/registry";

describe("Universal Package & Extension Subsystem", () => {
  let tempDir: string;
  let packageService: PackageService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "glansk-pkg-test-"));
    packageService = new PackageService(tempDir);
    await packageService.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("Archive Engine (archive.ts)", () => {
    test("roundtrip creates and extracts zip files with CRC-32 verification", () => {
      const files = {
        "manifest.json": JSON.stringify({ id: "test.pkg", version: "1.0.0" }),
        "index.html": "<!DOCTYPE html><html><body>Test</body></html>",
        "nested/styles.css": "body { color: red; }",
      };

      const zipBytes = createZip(files);
      expect(zipBytes.byteLength).toBeGreaterThan(0);

      const extracted = extractZip(zipBytes);
      expect(extracted.size).toBe(3);
      expect(new TextDecoder().decode(extracted.get("manifest.json")!)).toContain("test.pkg");
      expect(new TextDecoder().decode(extracted.get("index.html")!)).toContain("Test");
      expect(new TextDecoder().decode(extracted.get("nested/styles.css")!)).toContain("color: red");
    });

    test("zip-slip rejection prevents path traversal", () => {
      expect(() => createZip({ "../evil.txt": "evil" })).toThrow();
      expect(() => createZip({ "C:\\Windows\\system32\\calc.exe": "evil" })).toThrow();
    });

    test("quota limits enforce max file count and max byte size", () => {
      const largeFiles: Record<string, string> = {};
      for (let i = 0; i < 260; i++) {
        largeFiles[`file_${i}.txt`] = `content ${i}`;
      }
      const zipBytes = createZip(largeFiles);
      expect(() => extractZip(zipBytes, { maxFiles: 256 })).toThrow("quota exceeded");
    });
  });

  describe("Package Lifecycle & Multi-Kind Extensions", () => {
    test("creates a custom widget package and registers in dynamic registry", async () => {
      const pkg = await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.custom.dial",
          version: "1.0.0",
          name: "Neon Dial",
          kind: "widget",
          description: "Custom neon dial widget",
          author: "Admin",
          entry: "index.html",
          capabilities: ["interactive-state"],
          widgets: [
            { id: "dial", name: "Dial Widget", entry: "index.html" },
          ],
        },
        files: {
          "index.html": "<h1>Neon Dial</h1>",
          "styles.css": "h1 { color: cyan; }",
          "main.js": "console.log('dial active');",
        },
      });

      expect(pkg.id).toBe("com.custom.dial");
      expect(pkg.kind).toBe("widget");
      expect(pkg.files["index.html"]).toBeDefined();
      expect(isPackagedWidget("com.custom.dial", "dial")).toBe(true);

      const retrieved = packageService.getInstalled("com.custom.dial");
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe("Neon Dial");

      const files = await packageService.getPackageFiles("com.custom.dial");
      expect(files?.["index.html"]).toBe("<h1>Neon Dial</h1>");
      expect(files?.["styles.css"]).toBe("h1 { color: cyan; }");
    });

    test("creates an emitter package with declarative polling", async () => {
      let telemetryPushed = false;
      const testService = new PackageService(tempDir, {
        onEmitterTelemetry: async (id, data) => {
          if (id === "test-sensor") telemetryPushed = true;
        },
      });
      await testService.init();

      const pkg = await testService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.sensors.temp",
          version: "1.0.0",
          name: "Temperature Sensor",
          kind: "emitter",
          description: "Declarative temperature sensor",
          author: "Admin",
          capabilities: ["telemetry-emitter"],
          emitters: [
            {
              id: "test-sensor",
              name: "Temperature Emitter",
              category: "sensor",
              runtime: "declarative",
            },
          ],
        },
        files: {
          "README.md": "# Temp Sensor",
        },
      });

      expect(pkg.id).toBe("com.sensors.temp");
      expect(pkg.kind).toBe("emitter");
      expect(pkg.emitters?.[0]?.id).toBe("test-sensor");
    });

    test("live updates package files, recomputes SHA-256 hashes, and preserves runtime registration", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.editable.widget",
          version: "1.0.0",
          name: "Editable Widget",
          kind: "widget",
          entry: "index.html",
          capabilities: [],
        },
        files: {
          "index.html": "<p>Initial</p>",
        },
      });

      const updated = await packageService.updatePackageFiles("com.editable.widget", {
        "index.html": "<p>Updated Content</p>",
        "new-script.js": "alert(1);",
      });

      expect(updated.updatedAt).toBeDefined();
      const files = await packageService.getPackageFiles("com.editable.widget");
      expect(files?.["index.html"]).toBe("<p>Updated Content</p>");
      expect(files?.["new-script.js"]).toBe("alert(1);");
    });

    test("exports package to .glpkg zip archive and re-imports on fresh service", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.exportable.pack",
          version: "2.1.0",
          name: "Exportable Pack",
          kind: "composite",
          entry: "index.html",
          capabilities: ["interactive-state"],
          widgets: [{ id: "ui", entry: "index.html" }],
          emitters: [{ id: "daemon", entry: "daemon.py" }],
        },
        files: {
          "index.html": "<div>Pack UI</div>",
          "daemon.py": "print('running')",
        },
      });

      const exportedZip = await packageService.exportPackageZip("com.exportable.pack");
      expect(exportedZip.byteLength).toBeGreaterThan(0);

      // Re-import into fresh service instance
      const secondDir = await mkdtemp(join(tmpdir(), "glansk-import-test-"));
      try {
        const secondService = new PackageService(secondDir);
        await secondService.init();

        const imported = await secondService.importFromZip(exportedZip);
        expect(imported.id).toBe("com.exportable.pack");
        expect(imported.version).toBe("2.1.0");
        expect(imported.kind).toBe("composite");

        const secondFiles = await secondService.getPackageFiles("com.exportable.pack");
        expect(secondFiles?.["index.html"]).toBe("<div>Pack UI</div>");
        expect(secondFiles?.["daemon.py"]).toBe("print('running')");
      } finally {
        await rm(secondDir, { recursive: true, force: true });
      }
    });

    test("uninstalls package and unregisters from dynamic registry", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.to.delete",
          version: "1.0.0",
          name: "To Delete",
          kind: "widget",
          entry: "index.html",
          capabilities: [],
          widgets: [{ id: "temp-widget", entry: "index.html" }],
        },
        files: { "index.html": "<p>temp</p>" },
      });

      expect(isPackagedWidget("com.to.delete", "temp-widget")).toBe(true);

      const uninstalled = await packageService.uninstallPackage("com.to.delete");
      expect(uninstalled).toBe(true);
      expect(packageService.getInstalled("com.to.delete")).toBeNull();
      expect(isPackagedWidget("com.to.delete", "temp-widget")).toBe(false);
    });
  });

  describe("Repository Feeds & Local Hub", () => {
    test("manages repository feed sources", async () => {
      const initial = await packageService.listRepositories();
      expect(initial.length).toBeGreaterThan(0);

      const added = await packageService.addRepository("Custom LAN Repo", "http://192.168.1.100:8080/repo/index.json");
      expect(added.name).toBe("Custom LAN Repo");

      const listAfter = await packageService.listRepositories();
      expect(listAfter.some(r => r.id === added.id)).toBe(true);

      const removed = await packageService.removeRepository(added.id);
      expect(removed).toBe(true);

      const listFinal = await packageService.listRepositories();
      expect(listFinal.some(r => r.id === added.id)).toBe(false);
    });

    test("generates local repository feed index for fleet deployment", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.fleet.clock",
          version: "1.0.0",
          name: "Fleet Clock",
          kind: "widget",
          entry: "index.html",
          capabilities: [],
        },
        files: { "index.html": "<p>Clock</p>" },
      });

      const repoIndex = packageService.generateRepositoryIndex("http://localhost:8080");
      expect(repoIndex.schemaVersion).toBe(1);
      expect(repoIndex.packages.length).toBe(1);
      expect(repoIndex.packages[0]!.id).toBe("com.fleet.clock");
      expect(repoIndex.packages[0]!.downloadUrl).toBe("http://localhost:8080/api/v1/packages/com.fleet.clock/export");
    });

    test("aggregates starter catalog with templates", async () => {
      const catalog = await packageService.syncCatalog();
      expect(catalog.length).toBeGreaterThanOrEqual(4);
      expect(catalog.some(c => c.id === "glansk.gauge.circular")).toBe(true);
      expect(catalog.some(c => c.kind === "emitter")).toBe(true);
    });
  });

  describe("HTTP Routes in createApp", () => {
    test("serves dynamic widget assets with hardened CSP", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.test.card",
          version: "1.0.0",
          name: "Card",
          kind: "widget",
          entry: "index.html",
          capabilities: [],
          widgets: [{ id: "card", entry: "index.html" }],
        },
        files: {
          "index.html": "<html><body>Card Content</body></html>",
          "styles.css": "body { margin: 0; }",
        },
      });

      const app = createApp({
        canvases: new InMemoryCanvasService(),
        packages: packageService,
      });

      const resHtml = await app(new Request("http://localhost:8080/widgets/com.test.card/card/index.html"));
      expect(resHtml.status).toBe(200);
      expect(await resHtml.text()).toContain("Card Content");
      expect(resHtml.headers.get("content-security-policy")).toContain("connect-src 'none'");

      const resCss = await app(new Request("http://localhost:8080/widgets/com.test.card/card/styles.css"));
      expect(resCss.status).toBe(200);
      expect(await resCss.text()).toContain("margin: 0");
    });

    test("serves /api/v1/packages and /api/v1/packages/widgets", async () => {
      await packageService.createPackage({
        manifest: {
          schemaVersion: 1,
          id: "com.studio.gauge",
          version: "1.0.0",
          name: "Studio Gauge",
          kind: "widget",
          entry: "index.html",
          capabilities: [],
          widgets: [{ id: "gauge", name: "Gauge Tile", entry: "index.html" }],
        },
        files: { "index.html": "<div>Gauge</div>" },
      });

      const app = createApp({
        canvases: new InMemoryCanvasService(),
        packages: packageService,
      });

      const listRes = await app(new Request("http://localhost:8080/api/v1/packages"));
      expect(listRes.status).toBe(200);
      const pkgs = await listRes.json();
      expect(pkgs.some((p: any) => p.id === "com.studio.gauge")).toBe(true);

      const widgetsRes = await app(new Request("http://localhost:8080/api/v1/packages/widgets"));
      expect(widgetsRes.status).toBe(200);
      const widgetData = await widgetsRes.json();
      expect(widgetData.widgets.some((w: any) => w.widgetId === "gauge")).toBe(true);
    });

    test("creates package via POST /api/v1/packages/create", async () => {
      const app = createApp({
        canvases: new InMemoryCanvasService(),
        packages: packageService,
      });

      const postRes = await app(
        new Request("http://localhost:8080/api/v1/packages/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            manifest: {
              schemaVersion: 1,
              id: "com.api.created",
              version: "1.0.0",
              name: "API Created",
              kind: "widget",
              entry: "index.html",
              capabilities: [],
            },
            files: {
              "index.html": "<h1>API Created</h1>",
            },
          }),
        })
      );

      expect(postRes.status).toBe(201);
      const data = await postRes.json();
      expect(data.ok).toBe(true);
      expect(data.package.id).toBe("com.api.created");
    });
  });
});
