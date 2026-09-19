import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSecureApp } from "../src/secure-app";
import { AuthService } from "../src/security/auth";
import { AuditLog } from "../src/security/operations";
import { ResetService } from "../src/operations/reset-service";
import { BackupService } from "../src/operations/backup-service";
import { DeviceBroker, MemoryDeviceProvider } from "../src/platform/device-broker";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { FileRuntimeRepository } from "../src/adapters/runtime/file-runtime-repository";
import { DeterministicRendererAdapter } from "../src/adapters/runtime/deterministic-renderer";
import { ActivationRuntimeService } from "../src/runtime/runtime-service";
import { ShowcaseWidgetState } from "../src/widget-sdk/showcase-state";

const jsonOf = async <T = any>(res: Response): Promise<T> => (await res.json()) as T;

async function setupTestApp() {
  const root = await mkdtemp(join(tmpdir(), "glansk-api-test-"));
  await mkdir(join(root, "runtime"), { recursive: true });
  await mkdir(join(root, "canvases"), { recursive: true });

  const canvases = new InMemoryCanvasService();
  const runtime = new ActivationRuntimeService(
    canvases,
    new FileRuntimeRepository(root),
    new DeterministicRendererAdapter()
  );
  await runtime.initialize();

  const auth = new AuthService("test-admin-secret");
  const audit = new AuditLog(join(root, "audit.ndjson"));
  const reset = new ResetService(root);
  const backup = new BackupService(root);
  const devices = new DeviceBroker(new MemoryDeviceProvider(), [4, 17, 18, 27]);
  await devices.start();

  const app = createSecureApp({
    canvases,
    runtime,
    widgetState: new ShowcaseWidgetState(),
    auth,
    audit,
    reset,
    backup,
    devices,
    allowedOrigins: ["http://127.0.0.1:3000", "http://localhost:3000"],
  });

  const cleanup = async () => {
    await devices.stop();
    await rm(root, { recursive: true, force: true });
  };

  return { app, cleanup };
}

describe("Layer A: HTTP API boundary tests via createSecureApp", () => {
  test("authenticates login, rejects invalid secret, and revokes session on logout", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      // Failed login
      const failRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: "wrong-secret" }),
        })
      );
      expect(failRes.status).toBe(401);
      const failJson = await jsonOf(failRes);
      expect(failJson.error).toBe("invalid credentials");

      // Successful login
      const okRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: "test-admin-secret" }),
        })
      );
      expect(okRes.status).toBe(200);
      const session = await jsonOf(okRes);
      expect(session.token).toBeString();

      // Logout
      const logoutRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/logout", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({}),
        })
      );
      expect(logoutRes.status).toBe(200);

      // Subsequent access with revoked token fails
      const checkRes = await app(
        new Request("http://127.0.0.1:3000/api/pairing", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.token}`,
          },
        })
      );
      expect(checkRes.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  test("pairing lifecycle: create, claim, revoke, and verify 401", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      // Login as admin
      const loginRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: "test-admin-secret" }),
        })
      );
      const { token: adminToken } = await jsonOf(loginRes);

      // Create pairing without auth -> 401
      const unauthPair = await app(
        new Request("http://127.0.0.1:3000/api/pairing", { method: "POST" })
      );
      expect(unauthPair.status).toBe(401);

      // Create pairing with admin auth
      const pairRes = await app(
        new Request("http://127.0.0.1:3000/api/pairing", {
          method: "POST",
          headers: { authorization: `Bearer ${adminToken}` },
        })
      );
      expect(pairRes.status).toBe(200);
      const pairing = await jsonOf(pairRes);
      expect(pairing.id).toBeString();
      expect(pairing.code).toBeString();

      // Claim pairing -> issued paired-device token
      const claimRes = await app(
        new Request("http://127.0.0.1:3000/api/pairing/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: pairing.id, code: pairing.code }),
        })
      );
      expect(claimRes.status).toBe(200);
      const claimedSession = await jsonOf(claimRes);
      expect(claimedSession.token).toBeString();

      // Admin revokes claimed pairing token
      const revokeRes = await app(
        new Request("http://127.0.0.1:3000/api/pairing/revoke", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ token: claimedSession.token }),
        })
      );
      expect(revokeRes.status).toBe(200);

      // Revoked token immediately gets 401 on protected endpoint
      const revokedDeviceRes = await app(
        new Request("http://127.0.0.1:3000/api/devices/status", {
          headers: { authorization: `Bearer ${claimedSession.token}` },
        })
      );
      expect(revokedDeviceRes.status).toBe(401);
    } finally {
      await cleanup();
    }
  });

  test("optimistic concurrency rejects stale canvas edits with 409 conflict", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      // Create canvas
      const createRes = await app(
        new Request("http://127.0.0.1:3000/api/v1/canvases", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: "canvas-test-1", name: "Test Canvas" }),
        })
      );
      expect(createRes.status).toBe(201);
      const draft = await jsonOf(createRes);
      expect(draft.draftRevision).toBe(1);

      // Save valid update based on revision 1
      const updateRes = await app(
        new Request("http://127.0.0.1:3000/api/v1/canvases/canvas-test-1/draft", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedDraftRevision: 1,
            document: {
              schemaVersion: 1,
              id: "canvas-test-1",
              name: "Updated Name",
              logicalSize: { width: 1920, height: 1080 },
              background: "#0b1020",
              widgets: [],
            },
          }),
        })
      );
      expect(updateRes.status).toBe(200);
      const updated = await jsonOf(updateRes);
      expect(updated.draftRevision).toBe(2);

      // Stale update (still targeting expectedDraftRevision: 1) -> 409 Conflict
      const staleRes = await app(
        new Request("http://127.0.0.1:3000/api/v1/canvases/canvas-test-1/draft", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedDraftRevision: 1,
            document: {
              schemaVersion: 1,
              id: "canvas-test-1",
              name: "Stale Conflict Name",
              logicalSize: { width: 1920, height: 1080 },
              background: "#0b1020",
              widgets: [],
            },
          }),
        })
      );
      expect(staleRes.status).toBe(409);
      const errorJson = await jsonOf(staleRes);
      expect(errorJson.code).toBe("revision_conflict");
    } finally {
      await cleanup();
    }
  });

  test("guarded reset requires authentication, valid challenge phrase, and is single-use", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      const loginRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: "test-admin-secret" }),
        })
      );
      const { token: adminToken } = await jsonOf(loginRes);

      // Request reset challenge
      const challengeRes = await app(
        new Request("http://127.0.0.1:3000/api/reset/runtime/challenge", {
          method: "POST",
          headers: { authorization: `Bearer ${adminToken}` },
        })
      );
      expect(challengeRes.status).toBe(200);
      const challenge = await jsonOf(challengeRes);
      expect(challenge.token).toBeString();
      expect(challenge.phrase).toBeString();

      // Execute with wrong confirmation phrase -> 400
      const wrongRes = await app(
        new Request("http://127.0.0.1:3000/api/reset/runtime", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ token: challenge.token, confirmation: "WRONG" }),
        })
      );
      expect(wrongRes.status).toBe(400);

      // Execute with exact confirmation phrase -> 202 Accepted
      const validRes = await app(
        new Request("http://127.0.0.1:3000/api/reset/runtime", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ token: challenge.token, confirmation: challenge.phrase }),
        })
      );
      expect(validRes.status).toBe(202);
      const tx = await jsonOf(validRes);
      expect(tx.state).toBe("committed");

      // Attempting to reuse the same challenge token fails
      const reuseRes = await app(
        new Request("http://127.0.0.1:3000/api/reset/runtime", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ token: challenge.token, confirmation: challenge.phrase }),
        })
      );
      expect(reuseRes.status).toBe(400);
    } finally {
      await cleanup();
    }
  });

  test("device broker memory GPIO pin read, write, and pin boundary checks", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      const loginRes = await app(
        new Request("http://127.0.0.1:3000/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ secret: "test-admin-secret" }),
        })
      );
      const { token: adminToken } = await jsonOf(loginRes);

      // Read default pin 17 value -> 0
      const read0 = await app(
        new Request("http://127.0.0.1:3000/api/devices/pins/17", {
          headers: { authorization: `Bearer ${adminToken}` },
        })
      );
      expect(read0.status).toBe(200);
      const read0Json = await jsonOf(read0);
      expect(read0Json.value).toBe(0);

      // Write pin 17 to 1
      const write1 = await app(
        new Request("http://127.0.0.1:3000/api/devices/pins/17", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ value: 1 }),
        })
      );
      expect(write1.status).toBe(200);
      const write1Json = await jsonOf(write1);
      expect(write1Json.value).toBe(1);

      // Read back pin 17 -> 1
      const read1 = await app(
        new Request("http://127.0.0.1:3000/api/devices/pins/17", {
          headers: { authorization: `Bearer ${adminToken}` },
        })
      );
      expect(read1.status).toBe(200);
      const read1Json = await jsonOf(read1);
      expect(read1Json.value).toBe(1);

      // Access pin 99 (not in [4, 17, 18, 27]) -> fails closed
      const readInvalid = await app(
        new Request("http://127.0.0.1:3000/api/devices/pins/99", {
          headers: { authorization: `Bearer ${adminToken}` },
        })
      );
      expect(readInvalid.status).toBe(400);
    } finally {
      await cleanup();
    }
  });

  test("static markup & security headers tripwire: CSP and sandbox attributes", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      // Check /health endpoint
      const healthRes = await app(new Request("http://127.0.0.1:3000/health"));
      expect(healthRes.status).toBe(200);
      const csp = healthRes.headers.get("content-security-policy");
      expect(csp).toBeString();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(healthRes.headers.get("x-content-type-options")).toBe("nosniff");
      expect(healthRes.headers.get("referrer-policy")).toBe("no-referrer");

      // Check packaged widget CSP policy
      const widgetRes = await app(
        new Request("http://127.0.0.1:3000/widgets/glansk.demo/sdk-status/index.html")
      );
      if (widgetRes.status === 200) {
        const widgetCsp = widgetRes.headers.get("content-security-policy");
        expect(widgetCsp).toBeString();
        expect(widgetCsp).toContain("default-src 'none'");
        expect(widgetCsp).toContain("connect-src 'none'");
        expect(widgetCsp).toContain("object-src 'none'");
      }

      // Check shared widget-host script sets sandbox="allow-scripts" without allow-same-origin
      const widgetHostFile = Bun.file(join(import.meta.dir, "../src/shared/widget-host.js"));
      expect(await widgetHostFile.exists()).toBe(true);
      const widgetHostCode = await widgetHostFile.text();
      expect(widgetHostCode).toContain("frame.sandbox = 'allow-scripts'");
      expect(widgetHostCode).not.toContain("frame.sandbox = 'allow-scripts allow-same-origin'");
      expect(widgetHostCode).not.toContain("allow-same-origin'");

      // Check runtime projection sets sandbox="allow-scripts"
      const projectionFile = Bun.file(join(import.meta.dir, "../src/runtime/projection.ts"));
      expect(await projectionFile.exists()).toBe(true);
      const projectionCode = await projectionFile.text();
      expect(projectionCode).toContain('sandbox:"allow-scripts"');
    } finally {
      await cleanup();
    }
  });

  test("upload endpoint handles base64 images, generates unique URLs and serves static uploads", async () => {
    const { app, cleanup } = await setupTestApp();
    try {
      // 1. Rejects missing dataUrl
      const badReq1 = await app(
        new Request("http://127.0.0.1:3000/api/v1/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(badReq1.status).toBe(400);

      // 2. Rejects unsupported MIME type
      const badReq2 = await app(
        new Request("http://127.0.0.1:3000/api/v1/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl: "data:text/plain;base64,aGVsbG8=" }),
        })
      );
      expect(badReq2.status).toBe(400);

      // 3. Accepts valid base64 webp/png
      // 1x1 transparent PNG:
      const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const uploadRes = await app(
        new Request("http://127.0.0.1:3000/api/v1/uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl: png1x1, filename: "test.png" }),
        })
      );
      expect(uploadRes.status).toBe(201);
      const data = (await uploadRes.json()) as { url: string; filename: string; size: number };
      expect(data.url).toMatch(/^\/uploads\/up-[a-f0-9]+\.png$/);
      expect(data.size).toBeGreaterThan(0);

      // 4. Serves uploaded image via GET /uploads/:filename
      const getRes = await app(new Request(`http://127.0.0.1:3000${data.url}`));
      expect(getRes.status).toBe(200);
      expect(getRes.headers.get("content-type")).toBe("image/png");
      expect(getRes.headers.get("cache-control")).toContain("immutable");

      // 5. Returns 404 for nonexistent upload
      const missingRes = await app(new Request("http://127.0.0.1:3000/uploads/nonexistent-xyz.png"));
      expect(missingRes.status).toBe(404);
    } finally {
      await cleanup();
    }
  });
});

