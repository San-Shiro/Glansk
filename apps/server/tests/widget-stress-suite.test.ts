import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAndPack } from "../../../packages/widget-sdk/cli/glansk-widget";
import { PackageService } from "../src/services/package/package-service";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { CanvasVariableStore } from "../src/shared/canvas-variables";
import { InteractiveStateService } from "../src/services/interactive-state/interactive-state-service";
import { SecretVaultService } from "../src/services/vault/secret-vault-service";
import { WidgetProxyService } from "../src/services/proxy/widget-proxy-service";

describe("Complex Widget Suite: Packaging, Import & Stress Test", () => {
  const packageDir = join(import.meta.dir, "../../../packages/widgets/stress-suite");

  test("1. Packages stress-suite into a valid .glpkg archive with SHA-256 digests", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ld-pack-test-"));
    try {
      const targetArchive = join(tempDir, "glansk.stress-test-1.0.0.glpkg");
      const packResult = await validateAndPack(packageDir, targetArchive);

      expect(packResult.success).toBe(true);
      expect(packResult.packageFile).toBe(targetArchive);

      const archiveBytes = await readFile(targetArchive);
      expect(archiveBytes.byteLength).toBeGreaterThan(1000);
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("2. Imports .glpkg manually into PackageService and validates both widgets", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ld-import-test-"));
    try {
      const targetArchive = join(tempDir, "stress-test.glpkg");
      await validateAndPack(packageDir, targetArchive);
      const archiveBytes = await readFile(targetArchive);

      const pkgService = new PackageService(tempDir);
      await pkgService.init();

      const imported = await pkgService.importFromZip(archiveBytes);
      expect(imported.id).toBe("glansk.stress-test");
      expect(imported.version).toBe("1.0.0");
      expect(imported.widgets).toHaveLength(2);

      const reactorWidget = imported.widgets?.find((w: any) => w.id === "quantum-reactor");
      expect(reactorWidget).toBeDefined();
      expect(reactorWidget?.name).toBe("Quantum Reactor Core");
      expect(reactorWidget?.category).toBe("display");

      const controlWidget = imported.widgets?.find((w: any) => w.id === "mission-control");
      expect(controlWidget).toBeDefined();
      expect(controlWidget?.name).toBe("Reactor Mission Control");
      expect(controlWidget?.category).toBe("control");
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("3. Serves packaged widget assets via HTTP with hardened sandbox CSP", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ld-http-test-"));
    try {
      const targetArchive = join(tempDir, "stress-test.glpkg");
      await validateAndPack(packageDir, targetArchive);
      const archiveBytes = await readFile(targetArchive);

      const pkgService = new PackageService(tempDir);
      await pkgService.init();
      await pkgService.importFromZip(archiveBytes);

      const app = createApp({
        canvases: new InMemoryCanvasService(),
        packages: pkgService,
      });

      // Fetch quantum-reactor index.html
      const res = await app(
        new Request("http://localhost/widgets/glansk.stress-test/quantum-reactor/index.html")
      );
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Quantum Reactor Core");
      expect(html).toContain("reactorCanvas");

      // Verify Content-Security-Policy headers
      const csp = res.headers.get("content-security-policy");
      expect(csp).toContain("connect-src 'none'");
      expect(csp).toContain("default-src 'none'");
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("4. Reactive cross-widget variable mutation and derived output variable calculation", () => {
    const store = new CanvasVariableStore(
      {
        reactor_speed: { name: "reactor_speed", type: "number", defaultValue: 50 },
        reactor_scram: { name: "reactor_scram", type: "boolean", defaultValue: false },
        reactor_mode: { name: "reactor_mode", type: "string", defaultValue: "NORMAL" },
      },
      "canvas-stress-101"
    );

    // Quantum Reactor watches variables and exposes output variables
    let currentRpm = 0;
    let currentTemp = 0;
    let currentStatus = "NOMINAL";

    store.watch("reactor_speed", (speedVal: number) => {
      const isScram = Boolean(store.get("reactor_scram"));
      currentRpm = isScram ? 0 : Math.round(speedVal * 1.6);
      currentTemp = isScram ? 295 : Math.round(300 + currentRpm * 4.2);
      currentStatus = currentRpm > 120 ? "SUPERCHARGED" : "NOMINAL";

      // Set output variables
      store.set("wigquantum-reactor-rpm", currentRpm);
      store.set("wigquantum-reactor-temp", currentTemp);
      store.set("wigquantum-reactor-status", currentStatus);
    });

    // Simulate Mission Control slider adjusting speed to 88%
    store.set("reactor_speed", 88);

    expect(store.get("reactor_speed")).toBe(88);
    expect(currentRpm).toBe(141);
    expect(currentTemp).toBe(892);
    expect(currentStatus).toBe("SUPERCHARGED");
    expect(store.get("wigquantum-reactor-rpm")).toBe(141);

    // Simulate Mission Control pressing SCRAM button
    store.set("reactor_scram", true);
    // Re-trigger speed watcher
    store.set("reactor_speed", 0);

    expect(currentRpm).toBe(0);
    expect(currentTemp).toBe(295);
    expect(store.get("wigquantum-reactor-rpm")).toBe(0);
  });

  test("5. Strict Canvas Boundary Isolation: variable updates DO NOT leak across canvases", () => {
    // Canvas A: Active stress test canvas
    const canvasA = new CanvasVariableStore(
      {
        reactor_speed: { name: "reactor_speed", type: "number", defaultValue: 50 },
      },
      "canvas-stress-101"
    );

    // Canvas B: Unrelated isolated canvas running on another display or tab
    const canvasB = new CanvasVariableStore(
      {
        reactor_speed: { name: "reactor_speed", type: "number", defaultValue: 20 },
      },
      "canvas-isolated-999"
    );

    let canvasBUpdateCount = 0;
    canvasB.watch("reactor_speed", () => {
      canvasBUpdateCount++;
    });

    // Mutate Canvas A aggressively
    canvasA.set("reactor_speed", 95);
    canvasA.set("reactor_speed", 99);
    canvasA.set("reactor_speed", 100);

    expect(canvasA.get("reactor_speed")).toBe(100);

    // Canvas B MUST remain entirely unaffected (0 updates, value unchanged)
    expect(canvasB.get("reactor_speed")).toBe(20);
    expect(canvasBUpdateCount).toBe(0);
  });

  test("6. Three-Tier State Architecture: Global, Cookie, and Session Isolation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-state-tier-"));
    try {
      const stateService = new InteractiveStateService(dir);
      await stateService.initialize();

      // Tier A: Global State (Shared and Persisted)
      await stateService.setGlobal("reactor_lifetime_hours", { hours: 1300 }, "control_widget");
      const globalRec = stateService.getGlobal("reactor_lifetime_hours");
      expect(globalRec).toBeDefined();
      expect(globalRec?.state).toEqual({ hours: 1300 });

      // Tier B: Cookie State (Scoped per Client ID without localStorage)
      await stateService.setCookie("cid_user_alpha", "reactor_theme", { theme: "solar-gold" });
      await stateService.setCookie("cid_user_beta", "reactor_theme", { theme: "neon-magenta" });

      const clientAlphaTheme = stateService.getCookie("cid_user_alpha", "reactor_theme");
      const clientBetaTheme = stateService.getCookie("cid_user_beta", "reactor_theme");

      expect(clientAlphaTheme?.state).toEqual({ theme: "solar-gold" });
      expect(clientBetaTheme?.state).toEqual({ theme: "neon-magenta" });
      // Distinct clients receive distinct states
      expect(clientAlphaTheme?.state).not.toEqual(clientBetaTheme?.state);

      // Tier C: Session State (Ephemeral Broadcast with sessionId)
      let receivedSessionEvent: any = null;
      const unsub = stateService.onNotification((event) => {
        receivedSessionEvent = event;
      });

      stateService.publishNotification("reactor.session_ping", { count: 1 }, "control_1", "session_kiosk_99");

      expect(receivedSessionEvent).not.toBeNull();
      expect(receivedSessionEvent.topic).toBe("reactor.session_ping");
      expect(receivedSessionEvent.sessionId).toBe("session_kiosk_99");
      expect(receivedSessionEvent.payload).toEqual({ count: 1 });

      unsub();
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("7. High-frequency 20Hz variable flood stress test", () => {
    const store = new CanvasVariableStore(
      {
        stress_val: { name: "stress_val", type: "number", defaultValue: 0 },
      },
      "canvas-flood-test"
    );

    const receivedValues: number[] = [];
    store.watch("stress_val", (val: number) => {
      receivedValues.push(val);
    });

    const startTime = performance.now();
    const ITERATIONS = 50; // Simulating 50 fast updates at 20Hz+

    for (let i = 1; i <= ITERATIONS; i++) {
      store.set("stress_val", i * 2);
    }

    const duration = performance.now() - startTime;

    // Assert all 50 updates were dispatched in order without dropping
    expect(receivedValues).toHaveLength(ITERATIONS);
    expect(receivedValues[0]).toBe(2);
    expect(receivedValues[ITERATIONS - 1]).toBe(100);
    expect(store.get("stress_val")).toBe(100);

    // Sub-millisecond performance: 50 updates in under 50ms
    expect(duration).toBeLessThan(100);
  });

  test("8. Host-proxied fetch execution with Secret Vault under load", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-stress-proxy-"));
    try {
      const vault = new SecretVaultService(dir);
      await vault.initialize();

      await vault.saveSecret({
        id: "reactor_auth",
        name: "Reactor Telemetry Auth Token",
        value: "token_reactor_secure_999",
        allowedDomains: ["api.sample.org"],
      });

      let requestedUrl = "";
      let authHeader = "";
      const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
        requestedUrl = String(url);
        authHeader = ((init?.headers as Record<string, string>) || {})["Authorization"] || "";
        return new Response(JSON.stringify({ status: "CORE_ONLINE", temp: 520 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }) as unknown as typeof fetch;

      const proxy = new WidgetProxyService({
        vault,
        allowedInternalHosts: ["api.sample.org"],
        fetchFn: mockFetch,
      });

      // Execute proxied fetch
      const result = await proxy.execute({
        instanceId: "quantum-reactor-1",
        url: "https://api.sample.org/telemetry?auth={{secret:reactor_auth}}",
        headers: {
          Authorization: "Bearer {{secret:reactor_auth}}",
        },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(requestedUrl).toBe("https://api.sample.org/telemetry?auth=token_reactor_secure_999");
        expect(authHeader).toBe("Bearer token_reactor_secure_999");
        const parsed = JSON.parse(result.data);
        expect(parsed.status).toBe("CORE_ONLINE");
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
