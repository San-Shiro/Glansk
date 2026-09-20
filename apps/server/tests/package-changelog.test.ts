import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PackageService } from "../src/services/package/package-service";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { generateDeveloperKeypair, validateAndPack, verifyPackageArchive } from "../../../packages/widget-sdk/cli/glansk-widget";

describe("Package Changelog Specification & Custom Package Import", () => {
  let tempDir: string;
  let packageService: PackageService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "glansk-changelog-test-"));
    packageService = new PackageService(tempDir);
    await packageService.init();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("validates and extracts structured changelog and bundled CHANGELOG.md from .glpkg", async () => {
    const dev = await generateDeveloperKeypair();
    const pkgDir = join(tempDir, "test-widget");
    const distDir = join(tempDir, "dist");
    const outPkg = join(distDir, "glansk.test.cl-1.0.0.glpkg");

    await Bun.write(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        manifestVersion: 2,
        id: "glansk.test.cl",
        version: "1.0.0",
        versionCode: 100,
        name: "Test Changelog Widget",
        kind: "widget",
        changelog: [
          {
            version: "1.0.0",
            versionCode: 100,
            date: "2026-09-20",
            summary: "Initial test release",
            changes: ["Added base counter", "Fixed layout"],
          },
        ],
        widgets: [
          {
            id: "counter",
            name: "Counter",
            entry: "index.html",
            category: "custom",
            dimensions: { default: { w: 300, h: 200 }, minimum: { w: 100, h: 100 } },
          },
        ],
        files: {},
      })
    );
    await Bun.write(join(pkgDir, "index.html"), "<h1>Counter</h1>");
    await Bun.write(join(pkgDir, "CHANGELOG.md"), "# Release Notes\n\n- v1.0.0: Initial test release.");

    const packRes = await validateAndPack(pkgDir, {
      outputPath: outPkg,
      signKeyPath: await (async () => {
        const p = join(tempDir, "dev.key");
        await Bun.write(p, dev.privateKey);
        return p;
      })(),
      publicKeyPath: await (async () => {
        const p = join(tempDir, "dev.pub");
        await Bun.write(p, dev.publicKey);
        return p;
      })(),
      versionCode: 100,
    });

    expect(packRes.success).toBe(true);

    const verifyRes = await verifyPackageArchive(outPkg);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.signed).toBe(true);
    expect(verifyRes.changelogCount).toBe(1);
    expect(verifyRes.hasChangelogMarkdown).toBe(true);

    const pkgBytes = new Uint8Array(await readFile(outPkg));
    const imported = await packageService.importFromZip(pkgBytes);

    expect(imported.id).toBe("glansk.test.cl");
    expect(imported.versionCode).toBe(100);
    expect(Array.isArray(imported.changelog)).toBe(true);
    expect((imported.changelog as any[])[0].version).toBe("1.0.0");
    expect((imported.changelog as any[])[0].changes).toEqual(["Added base counter", "Fixed layout"]);
    expect(imported.changelogMarkdown).toContain("# Release Notes");
  });

  test("GET /api/v1/packages/:id/changelog returns structured entries and markdown", async () => {
    const dev = await generateDeveloperKeypair();
    const pkgDir = join(tempDir, "api-cl-widget");
    const outPkg = join(tempDir, "glansk.api.cl-2.0.0.glpkg");

    await Bun.write(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        manifestVersion: 2,
        id: "glansk.api.cl",
        version: "2.0.0",
        versionCode: 200,
        name: "API Changelog Widget",
        kind: "widget",
        changelog: [
          {
            version: "2.0.0",
            versionCode: 200,
            date: "2026-09-20",
            summary: "Major overhaul",
            changes: ["feat: Complete rewrite"],
          },
        ],
        widgets: [
          {
            id: "view",
            name: "View",
            entry: "index.html",
            category: "display",
            dimensions: { default: { w: 300, h: 200 }, minimum: { w: 100, h: 100 } },
          },
        ],
        files: {},
      })
    );
    await Bun.write(join(pkgDir, "index.html"), "<h1>View</h1>");
    await Bun.write(join(pkgDir, "CHANGELOG.md"), "## v2.0.0\nComplete rewrite.");

    await validateAndPack(pkgDir, {
      outputPath: outPkg,
      signKeyPath: await (async () => {
        const p = join(tempDir, "api-dev.key");
        await Bun.write(p, dev.privateKey);
        return p;
      })(),
      publicKeyPath: await (async () => {
        const p = join(tempDir, "api-dev.pub");
        await Bun.write(p, dev.publicKey);
        return p;
      })(),
      versionCode: 200,
    });

    const app = createApp({
      canvases: new InMemoryCanvasService(),
      packages: packageService,
    });

    const pkgBytes = new Uint8Array(await readFile(outPkg));
    const importRes = await app(
      new Request("http://localhost/api/v1/packages/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buffer: Buffer.from(pkgBytes).toString("base64") }),
      })
    );
    expect(importRes.status).toBe(201);

    // Call /api/v1/packages/:id/changelog
    const clRes = await app(new Request("http://localhost/api/v1/packages/glansk.api.cl/changelog"));
    expect(clRes.status).toBe(200);

    const clBody = (await clRes.json()) as any;
    expect(clBody.id).toBe("glansk.api.cl");
    expect(clBody.version).toBe("2.0.0");
    expect(clBody.versionCode).toBe(200);
    expect(clBody.changelog).toHaveLength(1);
    expect(clBody.changelog[0].summary).toBe("Major overhaul");
    expect(clBody.changelogMarkdown).toContain("Complete rewrite.");

    // Nonexistent package returns 404
    const notFoundRes = await app(new Request("http://localhost/api/v1/packages/nonexistent/changelog"));
    expect(notFoundRes.status).toBe(404);
  });

  test("rejects invalid changelog definitions during packaging/validation", async () => {
    const pkgDir = join(tempDir, "invalid-cl-widget");
    const outPkg = join(tempDir, "glansk.invalid.cl-1.0.0.glpkg");

    // Case 1: Empty string changelog
    await Bun.write(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        manifestVersion: 2,
        id: "glansk.invalid.cl",
        version: "1.0.0",
        name: "Invalid",
        kind: "widget",
        changelog: "   ",
        widgets: [{ id: "w", entry: "index.html", category: "custom", dimensions: { default: { w: 100, h: 100 }, minimum: { w: 50, h: 50 } } }],
        files: {},
      })
    );
    await Bun.write(join(pkgDir, "index.html"), "<p>x</p>");

    const packRes1 = await validateAndPack(pkgDir, { outputPath: outPkg });
    expect(packRes1.success).toBe(false);
    expect(packRes1.error).toContain("changelog string cannot be empty");

    // Case 2: Changelog entry missing version string
    await Bun.write(
      join(pkgDir, "manifest.json"),
      JSON.stringify({
        manifestVersion: 2,
        id: "glansk.invalid.cl",
        version: "1.0.0",
        name: "Invalid",
        kind: "widget",
        changelog: [{ summary: "Missing version field" }],
        widgets: [{ id: "w", entry: "index.html", category: "custom", dimensions: { default: { w: 100, h: 100 }, minimum: { w: 50, h: 50 } } }],
        files: {},
      })
    );

    const packRes2 = await validateAndPack(pkgDir, { outputPath: outPkg });
    expect(packRes2.success).toBe(false);
    expect(packRes2.error).toContain("must have a string 'version'");
  });

  test("imports built glansk.neon-pulse-1.1.0.glpkg custom test package cleanly", async () => {
    const neonPkgPath = resolve("packages", "widgets", "neon-pulse", "dist", "glansk.neon-pulse-1.1.0.glpkg");
    const pkgBytes = new Uint8Array(await readFile(neonPkgPath));

    const app = createApp({
      canvases: new InMemoryCanvasService(),
      packages: packageService,
    });

    const importRes = await app(
      new Request("http://localhost/api/v1/packages/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buffer: Buffer.from(pkgBytes).toString("base64") }),
      })
    );

    expect(importRes.status).toBe(201);
    const body = (await importRes.json()) as any;
    expect(body.package.id).toBe("glansk.neon-pulse");
    expect(body.package.version).toBe("1.1.0");
    expect(body.package.versionCode).toBe(110);
    expect(body.package.trusted).toBe(true);
    expect(body.package.changelog).toHaveLength(2);
    expect(body.package.changelogMarkdown).toContain("Particle Pulse Waveform");

    // Verify live asset delivery with hardened sandbox CSP
    const assetRes = await app(new Request("http://localhost/widgets/glansk.neon-pulse/neon-pulse-hud/index.html"));
    expect(assetRes.status).toBe(200);
    const assetHtml = await assetRes.text();
    expect(assetHtml).toContain("NEON PULSE HUD");
    expect(assetHtml).toContain("glansk:widget:variable:set");
    expect(assetRes.headers.get("content-security-policy")).toContain("connect-src 'none'");

    // Verify /changelog endpoint
    const clRes = await app(new Request("http://localhost/api/v1/packages/glansk.neon-pulse/changelog"));
    expect(clRes.status).toBe(200);
    const clData = (await clRes.json()) as any;
    expect(clData.changelog[0].version).toBe("1.1.0");
    expect(clData.changelog[0].versionCode).toBe(110);
    expect(clData.changelog[1].version).toBe("1.0.0");
    expect(clData.changelogMarkdown).toContain("All notable changes to this widget package");
  });
});
