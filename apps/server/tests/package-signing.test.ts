import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { PackageService, SignerMismatchError, PackageDowngradeError } from "../src/services/package/package-service";
import { createApp } from "../src/app";
import {
  generateDeveloperKeypair,
  signPackageManifest,
  validateAndPack,
  verifyPackageArchive,
} from "../../../packages/widget-sdk/cli/glansk-widget";
import { createZip, extractZip } from "../src/platform/archive";
import { rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Cryptographic Package Signing & Anti-Rollback (Origin Continuity)", () => {
  let testRoot: string;
  let dataDir: string;
  let pkgService: PackageService;

  beforeEach(async () => {
    testRoot = join(tmpdir(), "gl_pkg_signing_test_" + Math.random().toString(36).substring(2, 8));
    dataDir = join(testRoot, "data");
    await mkdir(dataDir, { recursive: true });
    pkgService = new PackageService(dataDir);
    await pkgService.init();
  });

  afterEach(async () => {
    await rm(testRoot, { recursive: true, force: true });
  });

  it("packages, signs, and imports a valid .glpkg with origin pinning", async () => {
    const devA = await generateDeveloperKeypair();
    const pkgSourceDir = join(testRoot, "source_pkg_v1");
    await mkdir(pkgSourceDir, { recursive: true });

    const privKeyPath = join(pkgSourceDir, "dev.private.key");
    const pubKeyPath = join(pkgSourceDir, "dev.public.key");
    await writeFile(privKeyPath, devA.privateKey, "utf-8");
    await writeFile(pubKeyPath, devA.publicKey, "utf-8");

    const manifest = {
      manifestVersion: 2,
      id: "org.glansk.weather",
      version: "1.0.0",
      versionCode: 100,
      name: "Glansk Weather Widget",
      kind: "widget",
      widgets: [{ id: "weather-view", name: "Weather View", entry: "index.html" }],
      files: {},
    };

    await writeFile(join(pkgSourceDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(pkgSourceDir, "index.html"), "<h1>Weather 1.0.0</h1>");

    const glpkgPath = join(testRoot, "weather-1.0.0.glpkg");
    const packRes = await validateAndPack(pkgSourceDir, {
      outputPath: glpkgPath,
      signKeyPath: privKeyPath,
      publicKeyPath: pubKeyPath,
      versionCode: 100,
    });

    expect(packRes.success).toBe(true);
    expect(packRes.fingerprint).toBe(devA.fingerprint);

    // Verify archive locally
    const verifyRes = await verifyPackageArchive(glpkgPath);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.signed).toBe(true);
    expect(verifyRes.fingerprint).toBe(devA.fingerprint);
    expect(verifyRes.versionCode).toBe(100);

    // Import into PackageService
    const archiveBytes = new Uint8Array(await readFile(glpkgPath));
    const imported = await pkgService.importFromZip(archiveBytes);

    expect(imported.id).toBe("org.glansk.weather");
    expect(imported.version).toBe("1.0.0");
    expect(imported.versionCode).toBe(100);
    expect(imported.trusted).toBe(true);
    expect(imported.signerFingerprint).toBe(devA.fingerprint);
    expect(imported.signerPublicKey).toBe(devA.publicKey);
  });

  it("enforces Signer Pinning: rejects updates from a different developer key or unsigned", async () => {
    const devA = await generateDeveloperKeypair();
    const devB = await generateDeveloperKeypair();

    // 1. Install version 1.0.0 signed by devA
    const pkgDirA = join(testRoot, "pkg_devA");
    await mkdir(pkgDirA, { recursive: true });
    await writeFile(join(pkgDirA, "dev.key"), devA.privateKey);
    await writeFile(join(pkgDirA, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.secure",
      version: "1.0.0",
      versionCode: 1,
      widgets: [{ id: "sec", entry: "sec.html" }],
      files: {},
    }));
    await writeFile(join(pkgDirA, "sec.html"), "<h1>Secure 1.0</h1>");

    const glpkgA = join(testRoot, "secure-v1.glpkg");
    await validateAndPack(pkgDirA, {
      outputPath: glpkgA,
      signKeyPath: join(pkgDirA, "dev.key"),
      versionCode: 1,
    });

    await pkgService.importFromZip(new Uint8Array(await readFile(glpkgA)));
    const installed = pkgService.getInstalled("org.glansk.secure");
    expect(installed?.signerFingerprint).toBe(devA.fingerprint);

    // 2. Attacker devB attempts to update org.glansk.secure to 1.1.0 (versionCode 2)
    const pkgDirB = join(testRoot, "pkg_devB");
    await mkdir(pkgDirB, { recursive: true });
    await writeFile(join(pkgDirB, "dev.key"), devB.privateKey);
    await writeFile(join(pkgDirB, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.secure",
      version: "1.1.0",
      versionCode: 2,
      widgets: [{ id: "sec", entry: "sec.html" }],
      files: {},
    }));
    await writeFile(join(pkgDirB, "sec.html"), "<h1>Compromised 1.1</h1>");

    const glpkgB = join(testRoot, "secure-v1.1-attacker.glpkg");
    await validateAndPack(pkgDirB, {
      outputPath: glpkgB,
      signKeyPath: join(pkgDirB, "dev.key"),
      versionCode: 2,
    });

    // Should reject with SignerMismatchError
    await expect(
      pkgService.importFromZip(new Uint8Array(await readFile(glpkgB)))
    ).rejects.toThrow(SignerMismatchError);

    // 3. Legitimate devA updates org.glansk.secure to 1.1.0 (versionCode 2) -> SUCCEEDS
    const glpkgA_v2 = join(testRoot, "secure-v1.1-legit.glpkg");
    await writeFile(join(pkgDirA, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.secure",
      version: "1.1.0",
      versionCode: 2,
      widgets: [{ id: "sec", entry: "sec.html" }],
      files: {},
    }));
    await writeFile(join(pkgDirA, "sec.html"), "<h1>Legit 1.1</h1>");

    await validateAndPack(pkgDirA, {
      outputPath: glpkgA_v2,
      signKeyPath: join(pkgDirA, "dev.key"),
      versionCode: 2,
    });

    const updated = await pkgService.importFromZip(new Uint8Array(await readFile(glpkgA_v2)));
    expect(updated.version).toBe("1.1.0");
    expect(updated.versionCode).toBe(2);
    expect(updated.signerFingerprint).toBe(devA.fingerprint);
  });

  it("enforces Anti-Rollback: blocks downgrades unless allowDowngrade override is set", async () => {
    const dev = await generateDeveloperKeypair();
    const pkgDir = join(testRoot, "pkg_rollback");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "dev.key"), dev.privateKey);

    // 1. Install version 2.0.0 with versionCode 200
    await writeFile(join(pkgDir, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.rollback",
      version: "2.0.0",
      versionCode: 200,
      widgets: [{ id: "r", entry: "index.html" }],
      files: {},
    }));
    await writeFile(join(pkgDir, "index.html"), "<h1>V2.0</h1>");

    const glpkgV2 = join(testRoot, "rollback-2.0.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgV2,
      signKeyPath: join(pkgDir, "dev.key"),
      versionCode: 200,
    });

    await pkgService.importFromZip(new Uint8Array(await readFile(glpkgV2)));

    // 2. Prepare an older version 1.0.0 with versionCode 100
    await writeFile(join(pkgDir, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.rollback",
      version: "1.0.0",
      versionCode: 100,
      widgets: [{ id: "r", entry: "index.html" }],
      files: {},
    }));
    await writeFile(join(pkgDir, "index.html"), "<h1>V1.0</h1>");

    const glpkgV1 = join(testRoot, "rollback-1.0.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgV1,
      signKeyPath: join(pkgDir, "dev.key"),
      versionCode: 100,
    });

    const v1Bytes = new Uint8Array(await readFile(glpkgV1));

    // Default import must throw PackageDowngradeError
    await expect(pkgService.importFromZip(v1Bytes)).rejects.toThrow(PackageDowngradeError);

    // Check that installed package is still 2.0.0 (atomic rollback protection)
    expect(pkgService.getInstalled("org.glansk.rollback")?.versionCode).toBe(200);

    // 3. Override allowDowngrade: true allows the downgrade
    const downgraded = await pkgService.importFromZip(v1Bytes, { allowDowngrade: true });
    expect(downgraded.version).toBe("1.0.0");
    expect(downgraded.versionCode).toBe(100);
  });

  it("detects unlisted file injection in package archive", async () => {
    const dev = await generateDeveloperKeypair();
    const pkgDir = join(testRoot, "pkg_injection");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "dev.key"), dev.privateKey);

    await writeFile(join(pkgDir, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.inject",
      version: "1.0.0",
      widgets: [{ id: "i", entry: "index.html" }],
      files: {},
    }));
    await writeFile(join(pkgDir, "index.html"), "<h1>Clean</h1>");

    const glpkgClean = join(testRoot, "clean.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgClean,
      signKeyPath: join(pkgDir, "dev.key"),
    });

    const cleanBytes = new Uint8Array(await readFile(glpkgClean));
    const extracted = extractZip(cleanBytes);

    // Maliciously inject an unlisted payload file
    extracted.set("backdoor.js", new TextEncoder().encode("console.log('malicious');"));
    const modifiedZip = await createZip(extracted);

    // Importing should fail because backdoor.js is not listed in manifest
    await expect(pkgService.importFromZip(modifiedZip)).rejects.toThrow("unlisted file in package");
  });

  it("validates full HTTP flow in createApp including allowDowngrade query parameter", async () => {
    const devA = await generateDeveloperKeypair();
    const devB = await generateDeveloperKeypair();

    const app = createApp({
      packages: pkgService,
    } as any);

    // Prepare package v2 (versionCode: 20)
    const pkgDir = join(testRoot, "http_pkg");
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "dev.key"), devA.privateKey);
    await writeFile(join(pkgDir, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.http",
      version: "2.0.0",
      versionCode: 20,
      widgets: [{ id: "hw", entry: "index.html" }],
      files: {},
    }));
    await writeFile(join(pkgDir, "index.html"), "<h1>HTTP 2.0</h1>");

    const glpkgV2 = join(testRoot, "http-2.0.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgV2,
      signKeyPath: join(pkgDir, "dev.key"),
      versionCode: 20,
    });
    const v2Bytes = new Uint8Array(await readFile(glpkgV2));

    // 1. Initial install via POST /api/v1/packages/import
    const res1 = await app(new Request("http://localhost/api/v1/packages/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer: Buffer.from(v2Bytes).toString("base64") }),
    }));
    expect(res1.status).toBe(201);
    const body1 = await res1.json() as any;
    expect(body1.package.versionCode).toBe(20);
    expect(body1.package.signerFingerprint).toBe(devA.fingerprint);

    // Prepare package v1 (versionCode: 10)
    await writeFile(join(pkgDir, "manifest.json"), JSON.stringify({
      manifestVersion: 2,
      id: "org.glansk.http",
      version: "1.0.0",
      versionCode: 10,
      widgets: [{ id: "hw", entry: "index.html" }],
      files: {},
    }));
    await writeFile(join(pkgDir, "index.html"), "<h1>HTTP 1.0</h1>");

    const glpkgV1 = join(testRoot, "http-1.0.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgV1,
      signKeyPath: join(pkgDir, "dev.key"),
      versionCode: 10,
    });
    const v1Bytes = new Uint8Array(await readFile(glpkgV1));

    // 2. Attempt downgrade without allowDowngrade -> returns 400 downgrade_rejected
    const res2 = await app(new Request("http://localhost/api/v1/packages/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer: Buffer.from(v1Bytes).toString("base64") }),
    }));
    expect(res2.status).toBe(400);
    const body2 = await res2.json() as any;
    expect(body2.code).toBe("downgrade_rejected");

    // 3. Attempt downgrade with allowDowngrade=true in URL query -> returns 201 OK
    const res3 = await app(new Request("http://localhost/api/v1/packages/import?allowDowngrade=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer: Buffer.from(v1Bytes).toString("base64") }),
    }));
    expect(res3.status).toBe(201);
    const body3 = await res3.json() as any;
    expect(body3.package.versionCode).toBe(10);

    // 4. Attempt signer mismatch with devB key -> returns 400 signer_mismatch
    await writeFile(join(pkgDir, "devB.key"), devB.privateKey);
    const glpkgHijack = join(testRoot, "http-hijack.glpkg");
    await validateAndPack(pkgDir, {
      outputPath: glpkgHijack,
      signKeyPath: join(pkgDir, "devB.key"),
      versionCode: 30,
    });
    const hijackBytes = new Uint8Array(await readFile(glpkgHijack));

    const res4 = await app(new Request("http://localhost/api/v1/packages/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer: Buffer.from(hijackBytes).toString("base64") }),
    }));
    expect(res4.status).toBe(400);
    const body4 = await res4.json() as any;
    expect(body4.code).toBe("signer_mismatch");
  });
});
