import { DomainError } from "./domain/errors";
import type { CreateCanvasInput, SaveCanvasDraftInput } from "./domain/canvas";
import type { CanvasService } from "./services/contracts";
import type { RuntimeService } from "./runtime/contracts";
import { projectDocument } from "./runtime/projection";
import type { WidgetStateSource } from "./widget-sdk/contracts";
import type { InteractiveStateService } from "./services/interactive-state/interactive-state-service";
import type { EmitterService } from "./services/emitter/emitter-service";
import type { SecretVaultService } from "./services/vault/secret-vault-service";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { PackageService } from "./services/package/package-service";
import { WidgetProxyService } from "./services/proxy/widget-proxy-service";

export interface AppDependencies {
  canvases: CanvasService;
  runtime?: RuntimeService;
  widgetState?: WidgetStateSource;
  interactiveState?: InteractiveStateService;
  emitters?: EmitterService;
  vault?: SecretVaultService;
  packages?: PackageService;
  proxy?: WidgetProxyService;
}
const json = (value: unknown, status = 200, extraHeaders?: HeadersInit) =>
  Response.json(value, extraHeaders ? { status, headers: extraHeaders } : { status });
const parseCookies = (header: string | null): Record<string, string> => {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx !== -1) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    }
  }
  return out;
};
const assetName = (pathname: string, prefix: "admin" | "kiosk" | "shared") => {
  if (pathname === `/${prefix}` || pathname === `/${prefix}/`) return "index.html";
  const marker = `/${prefix}/`;
  if (!pathname.startsWith(marker)) return undefined;
  const name = pathname.slice(marker.length);
  return name && !name.includes("..") && !name.includes("/") ? name : undefined;
};
const contentType = (name: string) => name.endsWith(".css") ? "text/css; charset=utf-8" : name.endsWith(".js") ? "text/javascript; charset=utf-8" : name.endsWith(".json") ? "application/json" : name.endsWith(".png") ? "image/png" : name.endsWith(".jpg") || name.endsWith(".jpeg") ? "image/jpeg" : name.endsWith(".webp") ? "image/webp" : name.endsWith(".avif") ? "image/avif" : name.endsWith(".svg") ? "image/svg+xml" : "text/html; charset=utf-8";
const widgetCsp = (origin: string) => `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src ${origin}/widgets/ ${origin}/uploads/ data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
const widgetAsset = (pathname: string) => {
  const match = pathname.match(/^\/widgets\/([a-z0-9._-]+)\/([a-z0-9._-]+)\/(.+)$/i);
  if (!match) return undefined;
  const packageId = match[1]!;
  const widgetId = match[2]!;
  const asset = match[3]!;
  if (asset.includes("..") || asset.startsWith("/") || asset.includes("\\") || asset.includes("\0")) return undefined;
  return { packageId, widgetId, asset };
};

export function createApp(dependencies: AppDependencies): (request: Request) => Promise<Response> {
  const proxy = dependencies.proxy ?? new WidgetProxyService(dependencies.vault ? { vault: dependencies.vault } : {});
  return async request => {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });
      if (request.method === "GET" && url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
      if (request.method === "GET" && url.pathname.startsWith("/uploads/")) {
        const name = url.pathname.slice("/uploads/".length);
        if (name && !name.includes("..") && !name.includes("/")) {
          const file = Bun.file(new URL(`./uploads/${name}`, import.meta.url));
          if (await file.exists()) {
            return new Response(file, {
              headers: {
                "content-type": contentType(name),
                "cache-control": "public, max-age=31536000, immutable",
              },
            });
          }
        }
        return json({ code: "not_found", message: "Upload not found" }, 404);
      }
      if (request.method === "GET") {
        for (const prefix of ["kiosk", "admin", "shared"] as const) {
          const asset = assetName(url.pathname, prefix);
          if (!asset) continue;
          const file = Bun.file(new URL(`./${prefix}/${asset}`, import.meta.url));
          if (await file.exists()) return new Response(file, { headers: { "content-type": contentType(asset) } });
        }
        // Kiosk SPA fallback: /kiosk/<canvasId> serves the display shell so each
        // physical screen has its own path (and its own cookie scope). The flat
        // asset links (/kiosk/app.js, /kiosk/styles.css) are resolved above; any
        // remaining single, safe segment is a display target -> serve index.html.
        if (url.pathname.startsWith("/kiosk/")) {
          const target = url.pathname.slice("/kiosk/".length);
          if (target && !target.includes("/") && !target.includes("..")) {
            const file = Bun.file(new URL("./kiosk/index.html", import.meta.url));
            if (await file.exists()) return new Response(file, { headers: { "content-type": contentType("index.html") } });
          }
        }
        if (url.pathname.startsWith("/canvas/") || url.pathname.startsWith("/admin/canvas/")) {
          const target = url.pathname.startsWith("/admin/") ? url.pathname.slice("/admin".length) : url.pathname;
          const proto = request.headers.get("x-forwarded-proto") || (url.hostname.endsWith(".trycloudflare.com") ? "https" : url.protocol.replace(":", ""));
          const host = request.headers.get("host") || url.host;
          return Response.redirect(`${proto}://${host}/#${target}${url.search}`, 302);
        }
        if (url.pathname === "/" || url.pathname === "/admin" || url.pathname === "/admin/") {
          const file = Bun.file(new URL("./admin/index.html", import.meta.url));
          return new Response(file, { headers: { "content-type": contentType("index.html") } });
        }
      }
      if (request.method === "GET") {
        const asset = widgetAsset(url.pathname);
        if (asset) {
          const builtinFile = Bun.file(new URL(`./widgets/${asset.packageId}/${asset.widgetId}/${asset.asset}`, import.meta.url));
          if (await builtinFile.exists()) {
            return new Response(builtinFile, { headers: { "content-type": contentType(asset.asset), "content-security-policy": widgetCsp(url.origin), "x-content-type-options": "nosniff" } });
          }
          if (dependencies.packages) {
            const pkgDir = dependencies.packages.getPackagesDir();
            const directFile = Bun.file(join(pkgDir, asset.packageId, asset.asset));
            if (await directFile.exists()) {
              return new Response(directFile, { headers: { "content-type": contentType(asset.asset), "content-security-policy": widgetCsp(url.origin), "x-content-type-options": "nosniff" } });
            }
            const nestedFile = Bun.file(join(pkgDir, asset.packageId, asset.widgetId, asset.asset));
            if (await nestedFile.exists()) {
              return new Response(nestedFile, { headers: { "content-type": contentType(asset.asset), "content-security-policy": widgetCsp(url.origin), "x-content-type-options": "nosniff" } });
            }
          }
        }
      }
      if (request.method === "POST" && url.pathname === "/api/v1/uploads") {
        const body = await request.json() as { dataUrl?: string; filename?: string };
        if (!body?.dataUrl || typeof body.dataUrl !== "string") {
          return json({ code: "invalid_argument", message: "dataUrl is required" }, 400);
        }
        const match = body.dataUrl.match(/^data:image\/(webp|png|jpe?g|svg\+xml);base64,(.+)$/i);
        if (!match) {
          return json({ code: "invalid_argument", message: "Supported formats: base64 webp, png, jpeg, svg" }, 400);
        }
        const rawExt = match[1]!.toLowerCase();
        const ext = rawExt.includes("svg") ? "svg" : rawExt === "jpeg" ? "jpg" : rawExt;
        const buffer = Buffer.from(match[2]!, "base64");
        if (buffer.byteLength > 5 * 1024 * 1024) {
          return json({ code: "payload_too_large", message: "Image exceeds 5MB limit" }, 413);
        }
        const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
        const filename = `up-${hash}.${ext}`;
        const targetUrl = new URL(`./uploads/${filename}`, import.meta.url);
        await Bun.write(targetUrl, buffer);
        return json({ url: `/uploads/${filename}`, filename, size: buffer.byteLength }, 201);
      }
      if (dependencies.interactiveState && request.method === "GET" && url.pathname === "/api/v1/interactive-state/events") {
        const stream = new ReadableStream({
          start(controller) {
            const unsub = dependencies.interactiveState?.subscribe(event => {
              if (event.mode === "global") {
                const chunk = new TextEncoder().encode(`event: state_update\ndata: ${JSON.stringify(event)}\n\n`);
                try { controller.enqueue(chunk); } catch {}
              }
            });
            const unsubNotify = dependencies.interactiveState?.onNotification(event => {
              const chunk = new TextEncoder().encode(`event: notification\ndata: ${JSON.stringify(event)}\n\n`);
              try { controller.enqueue(chunk); } catch {}
            });
            const ping = new TextEncoder().encode(`event: ping\ndata: {}\n\n`);
            try { controller.enqueue(ping); } catch {}
            const pingInterval = setInterval(() => {
              try { controller.enqueue(ping); } catch {}
            }, 5000);

            request.signal.addEventListener("abort", () => {
              clearInterval(pingInterval);
              try { unsub?.(); } catch {}
              try { unsubNotify?.(); } catch {}
              try { controller.close(); } catch {}
            });
          }
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
          },
        });
      }
      if (dependencies.interactiveState && request.method === "GET" && url.pathname === "/api/v1/interactive-state") {
        const mode = url.searchParams.get("mode") || "global";
        const key = url.searchParams.get("key") || "";
        if (!key) return json({ code: "invalid_argument", message: "key is required" }, 400);

        const cookies = parseCookies(request.headers.get("cookie"));
        let clientId = cookies["gl_client_id"] || cookies["ld_client_id"] || request.headers.get("x-client-id") || url.searchParams.get("clientId");
        let setCookie = false;
        if (!clientId || typeof clientId !== "string" || clientId.length > 64 || !/^[a-zA-Z0-9_\-:]{4,64}$/.test(clientId)) {
          clientId = `cid_${crypto.randomUUID().slice(0, 16)}`;
          setCookie = true;
        }
        const cookieHeader = setCookie
          ? { "Set-Cookie": `gl_client_id=${clientId}; Path=/; SameSite=Lax; Max-Age=31536000` }
          : undefined;

        if (mode === "global") {
          const rec = dependencies.interactiveState.getGlobal(key);
          return json({ mode: "global", key, state: rec?.state ?? null, revision: rec?.revision ?? 0, updatedAt: rec?.updatedAt ?? 0 }, 200, cookieHeader);
        } else if (mode === "cookie") {
          const rec = dependencies.interactiveState.getCookie(clientId, key);
          return json({ mode: "cookie", clientId, key, state: rec?.state ?? null, revision: rec?.revision ?? 0, updatedAt: rec?.updatedAt ?? 0 }, 200, cookieHeader);
        }
        return json({ code: "invalid_argument", message: "Invalid mode. Must be global or cookie" }, 400);
      }
      if (dependencies.interactiveState && request.method === "POST" && url.pathname === "/api/v1/interactive-state") {
        const body = await request.json() as { mode?: string; key?: string; state?: import("./domain/types").JsonValue; senderId?: string };
        const mode = body.mode || "global";
        const key = body.key || "";
        if (!key) return json({ code: "invalid_argument", message: "key is required" }, 400);

        const cookies = parseCookies(request.headers.get("cookie"));
        let clientId = cookies["gl_client_id"] || cookies["ld_client_id"] || request.headers.get("x-client-id") || url.searchParams.get("clientId");
        let setCookie = false;
        if (!clientId || typeof clientId !== "string" || clientId.length > 64 || !/^[a-zA-Z0-9_\-:]{4,64}$/.test(clientId)) {
          clientId = `cid_${crypto.randomUUID().slice(0, 16)}`;
          setCookie = true;
        }
        const cookieHeader = setCookie
          ? { "Set-Cookie": `gl_client_id=${clientId}; Path=/; SameSite=Lax; Max-Age=31536000` }
          : undefined;

        if (mode === "global") {
          const rec = await dependencies.interactiveState.setGlobal(key, body.state ?? null, body.senderId);
          return json({ ok: true, mode: "global", key, revision: rec.revision, updatedAt: rec.updatedAt }, 200, cookieHeader);
        } else if (mode === "cookie") {
          const rec = await dependencies.interactiveState.setCookie(clientId, key, body.state ?? null, body.senderId);
          return json({ ok: true, mode: "cookie", clientId, key, revision: rec.revision, updatedAt: rec.updatedAt }, 200, cookieHeader);
        }
        return json({ code: "invalid_argument", message: "Invalid mode. Must be global or cookie" }, 400);
      }
      if (dependencies.interactiveState && request.method === "POST" && url.pathname === "/api/v1/widget-notify") {
        const body = await request.json() as { topic?: string; payload?: import("./domain/types").JsonValue; senderId?: string; sessionId?: string };
        if (!body?.topic || typeof body.topic !== "string" || body.topic.length > 128) {
          return json({ code: "invalid_argument", message: "Valid topic required (<= 128 chars)" }, 400);
        }
        let payloadStr: string;
        try {
          payloadStr = JSON.stringify(body.payload);
          if (payloadStr.length > 16384) {
            return json({ code: "payload_too_large", message: "Payload exceeds 16KB limit" }, 413);
          }
        } catch {
          return json({ code: "invalid_argument", message: "Invalid payload JSON" }, 400);
        }
        dependencies.interactiveState.publishNotification(body.topic, body.payload ?? null, body.senderId, body.sessionId);
        return json({ ok: true });
      }
      if (dependencies.emitters && request.method === "GET" && url.pathname === "/api/v1/emitters/events") {
        const stream = new ReadableStream({
          start(controller) {
            const unsub = dependencies.emitters?.onEvent(event => {
              const chunk = new TextEncoder().encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
              try { controller.enqueue(chunk); } catch {}
            });
            const ping = new TextEncoder().encode(`event: ping\ndata: {}\n\n`);
            try { controller.enqueue(ping); } catch {}
            const pingInterval = setInterval(() => {
              try { controller.enqueue(ping); } catch {}
            }, 15000);

            request.signal.addEventListener("abort", () => {
              clearInterval(pingInterval);
              try { unsub?.(); } catch {}
              try { controller.close(); } catch {}
            });
          }
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-transform",
            "connection": "keep-alive",
          },
        });
      }
      if (dependencies.emitters && request.method === "GET" && url.pathname === "/api/v1/emitters") {
        return json(dependencies.emitters.listEmitters());
      }
      const emitterMatch = url.pathname.match(/^\/api\/v1\/emitters\/([a-zA-Z0-9_\-.:]+)(?:\/(state|command|commands))?$/);
      if (dependencies.emitters && emitterMatch) {
        const emitterId = emitterMatch[1]!;
        const action = emitterMatch[2];
        if (request.method === "GET" && !action) {
          const reg = dependencies.emitters.getEmitter(emitterId);
          return reg ? json(reg) : json({ code: "not_found", message: "Emitter not found" }, 404);
        }
        if (request.method === "DELETE" && !action) {
          const ok = await dependencies.emitters.unregister(emitterId);
          return json({ ok, unregistered: ok });
        }
        if (request.method === "GET" && (action === "commands" || action === "command")) {
          const stream = new ReadableStream({
            start(controller) {
              const ping = new TextEncoder().encode(`event: ping\ndata: {}\n\n`);
              try { controller.enqueue(ping); } catch {}
              const pingInterval = setInterval(() => {
                try { controller.enqueue(ping); } catch {}
              }, 15000);

              const unbind = dependencies.emitters!.bindCommandHandler(emitterId, async (cmd) => {
                const chunk = new TextEncoder().encode(`event: command\ndata: ${JSON.stringify(cmd)}\n\n`);
                try {
                  controller.enqueue(chunk);
                  return { ok: true, correlationId: cmd.correlationId };
                } catch {
                  return { ok: false, correlationId: cmd.correlationId, error: "Stream closed" };
                }
              });

              request.signal.addEventListener("abort", () => {
                clearInterval(pingInterval);
                try { unbind(); } catch {}
                try { controller.close(); } catch {}
              });
            }
          });

          return new Response(stream, {
            headers: {
              "content-type": "text/event-stream; charset=utf-8",
              "cache-control": "no-cache, no-transform",
              "connection": "keep-alive",
            },
          });
        }
        if (request.method === "POST" && action === "state") {
          const body = await request.json() as { state?: Record<string, import("./domain/types").JsonValue>; manifest?: import("./domain/emitter").EmitterManifest };
          if (!body || typeof body !== "object") {
            return json({ code: "invalid_argument", message: "Valid body required" }, 400);
          }
          let reg: import("./domain/emitter").EmitterRegistration;
          if (body.manifest) {
            reg = dependencies.emitters.register({ ...body.manifest, id: emitterId }, body.state || {}, "http");
          } else {
            reg = dependencies.emitters.publishState(emitterId, body.state || {}, "http");
          }
          return json({ ok: true, registration: reg });
        }
        if (request.method === "POST" && action === "command") {
          const body = await request.json() as { command?: string; payload?: import("./domain/types").JsonValue; timeoutMs?: number };
          if (!body?.command || typeof body.command !== "string") {
            return json({ code: "invalid_argument", message: "command name is required" }, 400);
          }
          const result = await dependencies.emitters.dispatchCommand(emitterId, body.command, body.payload, body.timeoutMs ?? 3000);
          return json(result, result.ok ? 200 : 400);
        }
      }
      if (dependencies.widgetState && request.method === "GET" && url.pathname === "/api/v1/widget-state") return json(dependencies.widgetState.read({ instanceId: url.searchParams.get("instanceId") ?? "", packageId: url.searchParams.get("packageId") ?? "", widgetId: url.searchParams.get("widgetId") ?? "", channel: url.searchParams.get("channel") ?? "", ...(url.searchParams.has("fromRevision") ? { fromRevision: Number(url.searchParams.get("fromRevision")) } : {}) }));
      if (dependencies.widgetState?.command && request.method === "POST" && url.pathname === "/api/v1/widget-command") {
        const body = await request.json() as { instanceId?: string; packageId?: string; widgetId?: string; command?: string; correlationId?: string; payload?: import("./domain/types").JsonValue };
        return json(dependencies.widgetState.command({ instanceId: body.instanceId ?? "", packageId: body.packageId ?? "", widgetId: body.widgetId ?? "", command: body.command ?? "", correlationId: body.correlationId ?? "", payload: body.payload ?? null }));
      }
      if (request.method === "POST" && url.pathname === "/api/v1/widget-proxy") {
        const body = await request.json() as import("./services/proxy/widget-proxy-service").WidgetProxyRequest;
        const result = await proxy.execute(body);
        const status = result.ok ? 200 : (result.error.code === "forbidden" ? 403 : result.error.code === "payload_too_large" ? 413 : result.error.code === "rate_limited" ? 429 : 400);
        return json(result, status);
      }
      if (dependencies.vault && request.method === "GET" && url.pathname === "/api/v1/vault/secrets") {
        return json(dependencies.vault.listSecrets());
      }
      if (dependencies.vault && request.method === "POST" && url.pathname === "/api/v1/vault/secrets") {
        const body = await request.json() as import("./services/vault/secret-vault-service").SaveSecretInput;
        try {
          const meta = await dependencies.vault.saveSecret(body);
          return json({ ok: true, secret: meta }, 201);
        } catch (err: any) {
          return json({ code: "invalid_argument", message: err.message }, 400);
        }
      }
      const vaultMatch = url.pathname.match(/^\/api\/v1\/vault\/secrets\/([a-zA-Z0-9_\-:]{2,64})$/);
      if (dependencies.vault && vaultMatch && request.method === "DELETE") {
        const id = vaultMatch[1]!;
        const ok = await dependencies.vault.deleteSecret(id);
        if (!ok) {
          return json({ code: "not_found", message: `Secret ${id} not found` }, 404);
        }
        return json({ ok: true, deleted: true });
      }
      // --- Packages & Extensions API ---
      if (dependencies.packages) {
        if (request.method === "GET" && url.pathname === "/api/v1/packages") {
          const kind = url.searchParams.get("kind") as any;
          return json(dependencies.packages.listInstalled(kind));
        }
        if (request.method === "GET" && url.pathname === "/api/v1/packages/widgets") {
          const installed = dependencies.packages.listInstalled();
          const widgetsList: Array<{
            id: string;
            packageId: string;
            widgetId: string;
            name: string;
            kind: string;
            description: string;
            entryPath: string;
            defaultGeometry?: { w: number; h: number };
            configSchema?: Record<string, any>;
          }> = [];

          // Builtin widgets
          widgetsList.push(
            { id: "glansk.demo.telemetry-chart", packageId: "glansk.demo", widgetId: "telemetry-chart", name: "Telemetry Chart", kind: "widget", description: "Live streaming canvas chart", entryPath: "/widgets/glansk.demo/telemetry-chart/index.html" },
            { id: "glansk.demo.sdk-status", packageId: "glansk.demo", widgetId: "sdk-status", name: "SDK Status", kind: "widget", description: "SDK connection monitor", entryPath: "/widgets/glansk.demo/sdk-status/index.html" },
            { id: "glansk.demo.status-grid", packageId: "glansk.demo", widgetId: "status-grid", name: "Status Grid", kind: "widget", description: "Grid of service health pills", entryPath: "/widgets/glansk.demo/status-grid/index.html" },
            { id: "glansk.demo.command-control", packageId: "glansk.demo", widgetId: "command-control", name: "Command Control", kind: "widget", description: "Interactive button controls", entryPath: "/widgets/glansk.demo/command-control/index.html" },
            { id: "glansk.demo.aurora-metric", packageId: "glansk.demo", widgetId: "aurora-metric", name: "Aurora Metric", kind: "widget", description: "Glowing metric card", entryPath: "/widgets/glansk.demo/aurora-metric/index.html" },
            { id: "glansk.media.image-carousel", packageId: "glansk.media", widgetId: "image-carousel", name: "Image Carousel", kind: "widget", description: "Multi-slide photo carousel", entryPath: "/widgets/glansk.media/image-carousel/index.html" }
          );

          for (const pkg of installed) {
            if (pkg.widgets && pkg.widgets.length > 0) {
              for (const w of pkg.widgets) {
                widgetsList.push({
                  id: `${pkg.id}.${w.id}`,
                  packageId: pkg.id,
                  widgetId: w.id,
                  name: w.name || w.id,
                  kind: pkg.kind,
                  description: w.description || pkg.description,
                  entryPath: `/widgets/${pkg.id}/${w.id}/${w.entry}`,
                  defaultGeometry: w.defaultGeometry,
                  configSchema: w.configSchema,
                });
              }
            } else if (pkg.entry && (pkg.kind === "widget" || pkg.kind === "composite")) {
              const widgetId = pkg.id.includes(".") ? pkg.id.split(".").pop()! : pkg.id;
              widgetsList.push({
                id: pkg.id,
                packageId: pkg.id,
                widgetId,
                name: pkg.name,
                kind: pkg.kind,
                description: pkg.description,
                entryPath: `/widgets/${pkg.id}/${widgetId}/${pkg.entry}`,
              });
            }
          }

          return json({ widgets: widgetsList });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/packages/templates") {
          return json(dependencies.packages.getStarterTemplates());
        }
        const templateMatch = url.pathname.match(/^\/api\/v1\/packages\/templates\/([a-z0-9._-]+)\.glpkg$/);
        if (request.method === "GET" && templateMatch) {
          const tId = templateMatch[1]!;
          const zip = dependencies.packages.getStarterTemplateZip(tId);
          if (!zip) return json({ code: "not_found", message: "Template not found" }, 404);
          return new Response(zip as any, {
            headers: {
              "content-type": "application/zip",
              "content-disposition": `attachment; filename="${tId}.glpkg"`,
            },
          });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/packages/catalog") {
          const catalog = await dependencies.packages.syncCatalog();
          return json({ catalog });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/packages/repositories") {
          const repos = await dependencies.packages.listRepositories();
          return json(repos);
        }
        if (request.method === "POST" && url.pathname === "/api/v1/packages/repositories") {
          const body = await request.json() as { name?: string; url?: string };
          if (!body?.url) return json({ code: "invalid_argument", message: "url is required" }, 400);
          const repo = await dependencies.packages.addRepository(body.name || "Custom Repo", body.url);
          return json({ ok: true, repository: repo }, 201);
        }
        const repoDeleteMatch = url.pathname.match(/^\/api\/v1\/packages\/repositories\/([a-z0-9._-]+)$/);
        if (request.method === "DELETE" && repoDeleteMatch) {
          const ok = await dependencies.packages.removeRepository(repoDeleteMatch[1]!);
          return json({ ok, removed: ok });
        }
        if (request.method === "GET" && url.pathname === "/api/v1/packages/repository/index.json") {
          return json(dependencies.packages.generateRepositoryIndex(url.origin));
        }
        if (request.method === "POST" && url.pathname === "/api/v1/packages/import") {
          try {
            const contentTypeHeader = request.headers.get("content-type") || "";
            let archiveBytes: Uint8Array;
            let allowUnsigned = true;

            if (contentTypeHeader.includes("multipart/form-data")) {
              const formData = await request.formData();
              const file = formData.get("file") || formData.get("package");
              if (!file || !(file instanceof Blob)) {
                return json({ code: "invalid_argument", message: "File blob required in form-data ('file' or 'package')" }, 400);
              }
              archiveBytes = new Uint8Array(await file.arrayBuffer());
              allowUnsigned = formData.get("allowUnsigned") !== "false";
            } else if (contentTypeHeader.includes("application/json")) {
              const body = await request.json() as { buffer?: string; allowUnsigned?: boolean };
              if (!body?.buffer) {
                return json({ code: "invalid_argument", message: "Base64 buffer required in JSON payload" }, 400);
              }
              archiveBytes = Buffer.from(body.buffer, "base64");
              allowUnsigned = body.allowUnsigned !== false;
            } else {
              archiveBytes = new Uint8Array(await request.arrayBuffer());
            }

            if (archiveBytes.byteLength === 0) {
              return json({ code: "invalid_argument", message: "Archive payload cannot be empty" }, 400);
            }

            const pkg = await dependencies.packages.importFromZip(archiveBytes, allowUnsigned);
            return json({ ok: true, package: pkg }, 201);
          } catch (err: any) {
            return json({ code: "invalid_package", message: err.message }, 400);
          }
        }
        if (request.method === "POST" && url.pathname === "/api/v1/packages/install-remote") {
          const body = await request.json() as { url?: string; allowUnsigned?: boolean };
          if (!body?.url) {
            return json({ code: "invalid_argument", message: "url is required" }, 400);
          }
          try {
            const pkg = await dependencies.packages.importFromUrl(body.url, body.allowUnsigned !== false);
            return json({ ok: true, package: pkg }, 201);
          } catch (err: any) {
            return json({ code: "install_failed", message: err.message }, 400);
          }
        }
        if (request.method === "POST" && url.pathname === "/api/v1/packages/create") {
          const body = await request.json() as any;
          if (!body?.manifest || !body?.files) {
            return json({ code: "invalid_argument", message: "manifest and files are required" }, 400);
          }
          try {
            const pkg = await dependencies.packages.createPackage({
              manifest: body.manifest,
              files: body.files,
              allowUnsigned: body.allowUnsigned !== false,
            });
            return json({ ok: true, package: pkg }, 201);
          } catch (err: any) {
            return json({ code: "creation_failed", message: err.message }, 400);
          }
        }
        const pkgMatch = url.pathname.match(/^\/api\/v1\/packages\/([a-z0-9._-]+)(?:\/(files|export))?$/);
        if (pkgMatch) {
          const id = pkgMatch[1]!;
          const action = pkgMatch[2];

          if (request.method === "GET" && !action) {
            const pkg = dependencies.packages.getInstalled(id);
            if (!pkg) return json({ code: "not_found", message: `Package ${id} not found` }, 404);
            const files = await dependencies.packages.getPackageFiles(id);
            return json({ package: pkg, files });
          }
          if (request.method === "PUT" && action === "files") {
            const body = await request.json() as { files?: Record<string, string> };
            if (!body?.files || typeof body.files !== "object") {
              return json({ code: "invalid_argument", message: "files dictionary required" }, 400);
            }
            try {
              const updated = await dependencies.packages.updatePackageFiles(id, body.files);
              return json({ ok: true, package: updated });
            } catch (err: any) {
              return json({ code: "update_failed", message: err.message }, 400);
            }
          }
          if (request.method === "GET" && action === "export") {
            try {
              const zip = await dependencies.packages.exportPackageZip(id);
              return new Response(zip as any, {
                headers: {
                  "content-type": "application/zip",
                  "content-disposition": `attachment; filename="${id}.glpkg"`,
                },
              });
            } catch (err: any) {
              return json({ code: "not_found", message: err.message }, 404);
            }
          }
          if (request.method === "DELETE" && !action) {
            const ok = await dependencies.packages.uninstallPackage(id);
            if (!ok) return json({ code: "not_found", message: `Package ${id} not found` }, 404);
            return json({ ok: true, uninstalled: true });
          }
        }
      }
      if (dependencies.runtime && request.method === "GET" && url.pathname === "/api/v1/runtime") return json(await dependencies.runtime.list());
      const runtimeMatch = url.pathname.match(/^\/api\/v1\/runtime\/([a-z0-9._-]+)(?:\/(activate|deactivate|rollback|restart|preview))?$/);
      if (dependencies.runtime && runtimeMatch) {
        const id = runtimeMatch[1]!, action = runtimeMatch[2];
        if (request.method === "GET" && !action) return json(await dependencies.runtime.status(id));
        if (request.method === "POST" && action === "activate") return json(await dependencies.runtime.activate({ canvasId: id, ...(await request.json().catch(() => ({})) as { expectedActiveRevision?: number; publicationRevision?: number }) }));
        if (request.method === "POST" && action === "deactivate") return json(await dependencies.runtime.deactivate(id));
        if (request.method === "POST" && action === "rollback") {
          const body = await request.json().catch(() => ({})) as { expectedActiveRevision?: number; targetRevision?: number };
          return json(await dependencies.runtime.rollback(id, body));
        }
        if (request.method === "POST" && action === "restart") return json(await dependencies.runtime.restart(id));
        if (request.method === "POST" && action === "preview") { const body = await request.json() as { document: SaveCanvasDraftInput["document"] }; if (body.document.id !== id) throw new DomainError("schema_invalid", "Preview path and document id differ"); return json(await projectDocument(body.document, 0)); }
      }
      if (request.method === "GET" && url.pathname === "/api/v1/canvases") return json(await dependencies.canvases.list());
      if (request.method === "POST" && url.pathname === "/api/v1/canvases") return json(await dependencies.canvases.create(await request.json() as CreateCanvasInput), 201);
      const match = url.pathname.match(/^\/api\/v1\/canvases\/([a-z0-9._-]+)(?:\/(draft|published|publish|metadata))?$/);
      if (match) {
        const id = match[1]!, action = match[2];
        if (request.method === "DELETE" && !action) {
          const deleted = await dependencies.canvases.delete(id);
          return json({ ok: deleted, deleted });
        }
        if (request.method === "PATCH" && action === "metadata") {
          const body = await request.json() as { name?: string; newId?: string; logicalSize?: { width: number; height: number } };
          const updated = await dependencies.canvases.updateMetadata(id, body);
          return json({ ok: true, canvas: updated });
        }
        if (request.method === "GET" && !action) { const workspace = await dependencies.canvases.open(id); return workspace ? json(workspace) : json({ code: "not_found" }, 404); }
        if (request.method === "PUT" && action === "draft") { const body = await request.json() as SaveCanvasDraftInput; if (body.document.id !== id) throw new DomainError("schema_invalid", "Canvas path and document id differ"); return json(await dependencies.canvases.save(body)); }
        if (request.method === "POST" && action === "publish") return json(await dependencies.canvases.publish(id), 201);
        if (request.method === "GET" && action === "published") { const canvas = await dependencies.canvases.getPublished(id); return canvas ? json(canvas) : json({ code: "not_found" }, 404); }
      }
      return json({ code: "not_found", message: "Route not found" }, 404);
    } catch (error) {
      if (error instanceof DomainError) { const status = error.code === "not_found" ? 404 : error.code === "revision_conflict" ? 409 : error.code === "forbidden" ? 403 : 400; return json({ code: error.code, message: error.message, details: error.details }, status); }
      console.error(error); return json({ code: "internal", message: "Internal server error" }, 500);
    }
  };
}
