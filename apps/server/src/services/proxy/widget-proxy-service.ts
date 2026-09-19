import type { SecretVaultService } from "../vault/secret-vault-service";
import { validateTargetUrl, substituteSecretsInString } from "./ssrf";

export interface WidgetProxyRequest {
  instanceId: string;
  packageId?: string;
  widgetId?: string;
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: string | unknown;
  timeoutMs?: number;
}

export interface WidgetProxySuccess {
  ok: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string;
}

export interface WidgetProxyError {
  ok: false;
  error: {
    code:
      | "forbidden"
      | "ssrf_denied"
      | "secret_denied"
      | "timeout"
      | "rate_limited"
      | "network_error"
      | "response_too_large"
      | "payload_too_large";
    message: string;
  };
}

export type WidgetProxyResult = WidgetProxySuccess | WidgetProxyError;

export interface WidgetProxyOptions {
  vault?: SecretVaultService | undefined;
  allowedInternalHosts?: string[] | undefined;
  maxRequestBodyBytes?: number | undefined; // default 256 KiB
  maxResponseBodyBytes?: number | undefined; // default 2 MiB
  defaultTimeoutMs?: number | undefined; // default 8000ms
  maxTimeoutMs?: number | undefined; // default 15000ms
  rateLimitPerMinute?: number | undefined; // default 60
  maxConcurrentPerInstance?: number | undefined; // default 4
  fetchFn?: ((input: any, init?: any) => Promise<Response>) | typeof fetch | undefined; // Injectable for unit testing
}

const FORBIDDEN_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "transfer-encoding",
]);

const SCRUBBED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "server",
  "x-powered-by",
]);

export class WidgetProxyService {
  readonly #vault?: SecretVaultService | undefined;
  readonly #allowedInternalHosts: string[];
  readonly #maxRequestBodyBytes: number;
  readonly #maxResponseBodyBytes: number;
  readonly #defaultTimeoutMs: number;
  readonly #maxTimeoutMs: number;
  readonly #rateLimitPerMinute: number;
  readonly #maxConcurrentPerInstance: number;
  readonly #fetchFn: (input: any, init?: any) => Promise<Response>;

  // Rate limiting: instanceId -> timestamps[]
  readonly #rateLimits = new Map<string, number[]>();
  // Concurrency tracking: instanceId -> active count
  readonly #concurrency = new Map<string, number>();

  constructor(options: WidgetProxyOptions = {}) {
    this.#vault = options.vault;
    this.#allowedInternalHosts = options.allowedInternalHosts ?? [];
    this.#maxRequestBodyBytes = options.maxRequestBodyBytes ?? 256 * 1024;
    this.#maxResponseBodyBytes = options.maxResponseBodyBytes ?? 2 * 1024 * 1024;
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 8000;
    this.#maxTimeoutMs = options.maxTimeoutMs ?? 15000;
    this.#rateLimitPerMinute = options.rateLimitPerMinute ?? 60;
    this.#maxConcurrentPerInstance = options.maxConcurrentPerInstance ?? 4;
    this.#fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async execute(request: WidgetProxyRequest): Promise<WidgetProxyResult> {
    const { instanceId, url: rawUrl, method = "GET", headers: rawHeaders, body: rawBody } = request;

    if (!instanceId || typeof instanceId !== "string") {
      return { ok: false, error: { code: "forbidden", message: "Missing instanceId" } };
    }

    // 1. Concurrency Check
    const activeCount = this.#concurrency.get(instanceId) ?? 0;
    if (activeCount >= this.#maxConcurrentPerInstance) {
      return {
        ok: false,
        error: { code: "rate_limited", message: "Concurrent request limit exceeded for widget instance" },
      };
    }

    // 2. Rate Limit Check (Sliding 60-second window)
    const now = Date.now();
    const windowStart = now - 60_000;
    const history = (this.#rateLimits.get(instanceId) ?? []).filter((t) => t > windowStart);
    if (history.length >= this.#rateLimitPerMinute) {
      return {
        ok: false,
        error: { code: "rate_limited", message: "Rate limit exceeded (max 60 req/min per widget)" },
      };
    }
    history.push(now);
    this.#rateLimits.set(instanceId, history);

    // Track active concurrency
    this.#concurrency.set(instanceId, activeCount + 1);

    try {
      return await this.#executeInternal(request);
    } finally {
      const current = this.#concurrency.get(instanceId) ?? 1;
      if (current <= 1) {
        this.#concurrency.delete(instanceId);
      } else {
        this.#concurrency.set(instanceId, current - 1);
      }
    }
  }

  async #executeInternal(request: WidgetProxyRequest): Promise<WidgetProxyResult> {
    const { rawUrl, method = "GET", headers: rawHeaders, body: rawBody, timeoutMs } = {
      rawUrl: request.url,
      method: request.method || "GET",
      headers: request.headers || {},
      body: request.body,
      timeoutMs: request.timeoutMs,
    };

    // 1. Initial URL validation before secret substitution
    let initialParsed: URL;
    try {
      initialParsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: { code: "forbidden", message: "Invalid URL" } };
    }

    // 2. Secret substitution
    let finalUrl = rawUrl;
    const finalHeaders: Record<string, string> = {};
    let finalBody: string | undefined = undefined;

    // Check if secrets exist anywhere
    const hasSecretReference =
      rawUrl.includes("{{secret:") ||
      Object.values(rawHeaders).some((v) => v.includes("{{secret:")) ||
      (typeof rawBody === "string" && rawBody.includes("{{secret:"));

    if (hasSecretReference) {
      if (!this.#vault) {
        return {
          ok: false,
          error: { code: "secret_denied", message: "Secret substitution requested but Vault is not configured" },
        };
      }

      // Substitute in URL
      const subUrl = substituteSecretsInString(rawUrl, this.#vault, initialParsed.hostname);
      if (!subUrl.success) {
        return { ok: false, error: { code: "secret_denied", message: subUrl.error } };
      }
      finalUrl = subUrl.result;

      // Substitute in Headers
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (typeof v !== "string") continue;
        const subH = substituteSecretsInString(v, this.#vault, initialParsed.hostname);
        if (!subH.success) {
          return { ok: false, error: { code: "secret_denied", message: subH.error } };
        }
        finalHeaders[k] = subH.result;
      }

      // Substitute in Body
      if (typeof rawBody === "string") {
        const subB = substituteSecretsInString(rawBody, this.#vault, initialParsed.hostname);
        if (!subB.success) {
          return { ok: false, error: { code: "secret_denied", message: subB.error } };
        }
        finalBody = subB.result;
      } else if (rawBody !== undefined && rawBody !== null) {
        const jsonBody = JSON.stringify(rawBody);
        const subB = substituteSecretsInString(jsonBody, this.#vault, initialParsed.hostname);
        if (!subB.success) {
          return { ok: false, error: { code: "secret_denied", message: subB.error } };
        }
        finalBody = subB.result;
      }
    } else {
      // No secrets to substitute
      for (const [k, v] of Object.entries(rawHeaders)) {
        if (typeof v === "string") finalHeaders[k] = v;
      }
      if (typeof rawBody === "string") {
        finalBody = rawBody;
      } else if (rawBody !== undefined && rawBody !== null) {
        finalBody = JSON.stringify(rawBody);
      }
    }

    // 3. Body size validation
    if (finalBody && Buffer.byteLength(finalBody, "utf8") > this.#maxRequestBodyBytes) {
      return {
        ok: false,
        error: { code: "payload_too_large", message: `Request body exceeds limit of ${this.#maxRequestBodyBytes} bytes` },
      };
    }

    // 4. SSRF Validation on the resolved URL
    const ssrfCheck = await validateTargetUrl(finalUrl, this.#allowedInternalHosts);
    if (!ssrfCheck.safe) {
      return {
        ok: false,
        error: { code: "ssrf_denied", message: `SSRF validation failed: ${ssrfCheck.reason}` },
      };
    }

    // 5. Clean request headers (remove forbidden headers)
    const outboundHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(finalHeaders)) {
      const lower = k.toLowerCase().trim();
      if (!FORBIDDEN_REQUEST_HEADERS.has(lower)) {
        outboundHeaders[k] = v;
      }
    }

    // 6. Timeout calculation
    const effectiveTimeout = Math.min(
      Math.max(100, timeoutMs ?? this.#defaultTimeoutMs),
      this.#maxTimeoutMs
    );

    // 7. Dispatch HTTP request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await this.#fetchFn(finalUrl, {
        method,
        headers: outboundHeaders,
        ...(!["GET", "HEAD"].includes(method.toUpperCase()) && finalBody !== undefined ? { body: finalBody } : {}),
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      // Check Content-Length header if present
      const cl = response.headers.get("content-length");
      if (cl) {
        const len = parseInt(cl, 10);
        if (len > this.#maxResponseBodyBytes) {
          return {
            ok: false,
            error: {
              code: "response_too_large",
              message: `Response Content-Length (${len} bytes) exceeds limit of ${this.#maxResponseBodyBytes} bytes`,
            },
          };
        }
      }

      // Read response body with streaming byte cap
      let responseText = "";
      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > this.#maxResponseBodyBytes) {
              await reader.cancel();
              return {
                ok: false,
                error: {
                  code: "response_too_large",
                  message: `Response body stream exceeded limit of ${this.#maxResponseBodyBytes} bytes`,
                },
              };
            }
            chunks.push(value);
          }
        }

        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        responseText = new TextDecoder().decode(merged);
      }

      // Clean response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => {
        const lower = k.toLowerCase();
        if (!SCRUBBED_RESPONSE_HEADERS.has(lower)) {
          responseHeaders[lower] = v;
        }
      });

      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseText,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError" || controller.signal.aborted) {
        return {
          ok: false,
          error: { code: "timeout", message: `Request timed out after ${effectiveTimeout}ms` },
        };
      }
      return {
        ok: false,
        error: { code: "network_error", message: `Network request failed: ${err?.message || err}` },
      };
    }
  }
}
