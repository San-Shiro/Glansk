// Thin typed client for the Glansk backend.
//
// Auth note: canvas + runtime + widget-state routes are NOT auth-guarded by the
// server; only privileged ops (audit, reset, pairing, devices, backups) require
// a bearer token. We still log in and attach the token everywhere (harmless for
// open routes) so privileged views work and the studio feels gated.
import type {
  CanvasDraft, CanvasSummary, CanvasWorkspace, CanvasDocument,
  PublishedCanvas, RuntimeStatus, DeviceStatus, PinState,
  AuditEvent, BackupResult, ResetKind, ResetChallenge, TxRecord, Pairing,
  EmitterRegistration, VaultSecretMeta, SaveSecretInput, JsonValue,
  PackageRecord, PackageKind, RepositoryFeed, CatalogItem, StarterTemplate,
} from "./types";

const TOKEN_KEY = "glansk_token";

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(path, { ...init, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.code || data?.error || "error", data?.message || data?.error || res.statusText);
  }
  return data as T;
}

export const api = {
  // ---- auth ----
  async login(secret: string) {
    const out = await request<{ token: string; expiresAt: number }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ secret }),
    });
    setToken(out.token);
    return out;
  },
  async logout() {
    try { await request("/api/auth/logout", { method: "POST" }); } catch { /* ignore */ }
    setToken(null);
  },

  // ---- canvases ----
  listCanvases: () => request<CanvasSummary[]>("/api/v1/canvases"),
  createCanvas: (input: { id: string; name: string; logicalSize?: { width: number; height: number } }) =>
    request<CanvasDraft>("/api/v1/canvases", { method: "POST", body: JSON.stringify(input) }),
  openCanvas: (id: string) => request<CanvasWorkspace>(`/api/v1/canvases/${id}`),
  saveDraft: (id: string, document: CanvasDocument, expectedDraftRevision: number) =>
    request<CanvasDraft>(`/api/v1/canvases/${id}/draft`, {
      method: "PUT", body: JSON.stringify({ document, expectedDraftRevision }),
    }),
  publish: (id: string) => request<PublishedCanvas>(`/api/v1/canvases/${id}/publish`, { method: "POST" }),
  getPublished: (id: string) => request<PublishedCanvas>(`/api/v1/canvases/${id}/published`),
  deleteCanvas: (id: string) =>
    request<{ ok: boolean; deleted: boolean }>(`/api/v1/canvases/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateCanvasMeta: (id: string, input: { name?: string; newId?: string; logicalSize?: { width: number; height: number } }) =>
    request<{ ok: boolean; canvas: CanvasSummary }>(`/api/v1/canvases/${encodeURIComponent(id)}/metadata`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),

  // ---- runtime ----
  listRuntime: () => request<RuntimeStatus[]>("/api/v1/runtime"),
  runtimeStatus: (id: string) => request<RuntimeStatus>(`/api/v1/runtime/${id}`),
  activate: (id: string, body: { expectedActiveRevision?: number; publicationRevision?: number } = {}) =>
    request<RuntimeStatus>(`/api/v1/runtime/${id}/activate`, { method: "POST", body: JSON.stringify(body) }),
  deactivate: (id: string) => request<RuntimeStatus>(`/api/v1/runtime/${id}/deactivate`, { method: "POST" }),
  rollback: (id: string, body: { expectedActiveRevision?: number; targetRevision?: number } = {}) =>
    request<RuntimeStatus>(`/api/v1/runtime/${id}/rollback`, { method: "POST", body: JSON.stringify(body) }),
  restart: (id: string) => request<RuntimeStatus>(`/api/v1/runtime/${id}/restart`, { method: "POST" }),

  // ---- audit (requires admin token) ----
  audit: () => request<AuditEvent[]>("/api/audit"),

  // ---- devices / GPIO (requires device:control or admin) ----
  deviceStatus: () => request<DeviceStatus>("/api/devices/status"),
  readPin: (pin: number) => request<PinState>(`/api/devices/pins/${pin}`),
  writePin: (pin: number, value: 0 | 1) =>
    request<PinState>(`/api/devices/pins/${pin}`, { method: "POST", body: JSON.stringify({ value }) }),

  // ---- backups (requires backup:manage or admin) ----
  createBackup: (name?: string) =>
    request<BackupResult>("/api/backups", { method: "POST", body: JSON.stringify(name ? { name } : {}) }),

  // ---- reset (requires reset:<kind> or admin) ----
  resetChallenge: (kind: ResetKind) =>
    request<ResetChallenge>(`/api/reset/${kind}/challenge`, { method: "POST" }),
  resetExecute: (kind: ResetKind, token: string, confirmation: string) =>
    request<TxRecord>(`/api/reset/${kind}`, { method: "POST", body: JSON.stringify({ token, confirmation }) }),
  operationStatus: (id: string) => request<TxRecord>(`/api/operations/${id}`),

  // ---- node pairing (requires admin) ----
  createPairing: () => request<Pairing>("/api/pairing", { method: "POST" }),
  revokePairing: (token: string) =>
    request<{ ok: boolean }>("/api/pairing/revoke", { method: "POST", body: JSON.stringify({ token }) }),

  // ---- emitters / live apps ----
  listEmitters: () => request<EmitterRegistration[]>("/api/v1/emitters"),
  getEmitter: (id: string) => request<EmitterRegistration>(`/api/v1/emitters/${id}`),
  dispatchEmitterCommand: (id: string, command: string, payload?: JsonValue, timeoutMs?: number) =>
    request<{ ok: boolean; result?: JsonValue; error?: string }>(`/api/v1/emitters/${id}/command`, {
      method: "POST",
      body: JSON.stringify({ command, payload, timeoutMs }),
    }),
  unregisterEmitter: (id: string) => request<{ ok: boolean; unregistered: boolean }>(`/api/v1/emitters/${id}`, { method: "DELETE" }),

  // ---- vault / secrets ----
  listSecrets: () => request<VaultSecretMeta[]>("/api/v1/vault/secrets"),
  saveSecret: (input: SaveSecretInput) => request<{ ok: boolean; secret: VaultSecretMeta }>("/api/v1/vault/secrets", { method: "POST", body: JSON.stringify(input) }),
  deleteSecret: (id: string) => request<{ ok: boolean; deleted: boolean }>(`/api/v1/vault/secrets/${id}`, { method: "DELETE" }),

  // ---- event bus / notifications ----
  sendNotification: (topic: string, payload: JsonValue) =>
    request<{ ok: boolean }>("/api/v1/widget-notify", {
      method: "POST",
      body: JSON.stringify({ topic, payload }),
    }),

  // ---- packages & extensions subsystem ----
  listPackages: (kind?: PackageKind) =>
    request<PackageRecord[]>(`/api/v1/packages${kind ? `?kind=${kind}` : ""}`),
  getPackage: (id: string) =>
    request<{ package: PackageRecord; files: Record<string, string> }>(`/api/v1/packages/${encodeURIComponent(id)}`),
  createPackage: (input: { manifest: any; files: Record<string, string>; allowUnsigned?: boolean }) =>
    request<{ ok: boolean; package: PackageRecord }>("/api/v1/packages/create", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updatePackageFiles: (id: string, files: Record<string, string>) =>
    request<{ ok: boolean; package: PackageRecord }>(`/api/v1/packages/${encodeURIComponent(id)}/files`, {
      method: "PUT",
      body: JSON.stringify({ files }),
    }),
  importPackageZip: async (file: File | Blob, allowUnsigned = true) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("allowUnsigned", String(allowUnsigned));
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["authorization"] = `Bearer ${token}`;
    const res = await fetch("/api/v1/packages/import", {
      method: "POST",
      headers,
      body: formData,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, data?.code || "import_error", data?.message || res.statusText);
    return data as { ok: boolean; package: PackageRecord };
  },
  importPackageUrl: (url: string, allowUnsigned = true) =>
    request<{ ok: boolean; package: PackageRecord }>("/api/v1/packages/install-remote", {
      method: "POST",
      body: JSON.stringify({ url, allowUnsigned }),
    }),
  uninstallPackage: (id: string) =>
    request<{ ok: boolean; uninstalled: boolean }>(`/api/v1/packages/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getPackageExportUrl: (id: string) => `/api/v1/packages/${encodeURIComponent(id)}/export`,
  listStarterTemplates: () => request<StarterTemplate[]>("/api/v1/packages/templates"),
  getCatalog: () => request<{ catalog: CatalogItem[] }>("/api/v1/packages/catalog"),
  listRepositories: () => request<RepositoryFeed[]>("/api/v1/packages/repositories"),
  addRepository: (name: string, url: string) =>
    request<{ ok: boolean; repository: RepositoryFeed }>("/api/v1/packages/repositories", {
      method: "POST",
      body: JSON.stringify({ name, url }),
    }),
  deleteRepository: (id: string) =>
    request<{ ok: boolean; removed: boolean }>(`/api/v1/packages/repositories/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  getLocalRepositoryIndexUrl: () => `${window.location.origin}/api/v1/packages/repository/index.json`,
  listStudioWidgets: () => request<{ widgets: Array<any> }>("/api/v1/packages/widgets"),
};

// Canvas validation bounds mirrored from src/services/canvas/validation.ts
export const CANVAS_LIMITS = {
  id: /^[a-z0-9][a-z0-9._-]{0,127}$/,
  width: { min: 320, max: 7680 },
  height: { min: 240, max: 4320 },
  maxWidgets: 256,
};
