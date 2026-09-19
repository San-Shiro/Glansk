import type { JsonValue } from "../domain/types";

export const WIDGET_PROTOCOL = "glansk.widget.v1" as const;
export const ISOLATED_WIDGET_ORIGIN = "null" as const;

export interface WidgetIdentity {
  readonly instanceId: string;
  readonly packageId: string;
  readonly widgetId: string;
}

/**
 * Screen identity propagated to a widget iframe by the kiosk surface.
 * Host-issued: derived from the kiosk URL path segment, never from widget-supplied data.
 *
 * IMPORTANT: display identity is informational only and MUST NOT be used to
 * authorize actions. All authorization is enforced server-side by the widget broker.
 */
export interface DisplayIdentity {
  /**
   * Opaque identifier for the physical display, derived from /kiosk/<displayId>.
   * Stable for the lifetime of the kiosk route for that path segment.
   */
  readonly id: string;
  /**
   * Deterministic, URL-safe namespace string scoped to
   * display × package × widget × instance.
   * Suitable as a key prefix for future host-brokered per-screen storage.
   *
   * NOTE: localStorage, sessionStorage, cookies, and IndexedDB are all
   * unavailable to sandboxed "null"-origin iframes. Widgets MUST use the
   * host message broker for any persistent or cross-tab state (planned future
   * capability). Do not attempt to write to browser storage APIs from a widget.
   */
  readonly storageNamespace: string;
}

/**
 * Compute a deterministic, URL-safe storage namespace scoped to a specific
 * display × package × widget × instance combination.
 * Stable across process restarts for the same four inputs; opaque enough to
 * avoid accidental key collisions between displays or widget instances.
 *
 * Implementation note: mirrors the inline `makeStorageNamespace` in
 * src/shared/widget-host.js — keep both in sync.
 */
export function makeStorageNamespace(
  displayId: string,
  packageId: string,
  widgetId: string,
  instanceId: string,
): string {
  // Percent-encode each part so the | separator cannot appear in any key.
  // encodeURIComponent encodes | to %7C, so it is unambiguous as a separator.
  // btoa input is pure ASCII (encodeURIComponent guarantees this), so btoa is safe.
  const raw = [displayId, packageId, widgetId, instanceId]
    .map((s) => encodeURIComponent(s))
    .join("|");
  return "gl_" + btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface WidgetStateRequest extends WidgetIdentity {
  readonly channel: string;
  readonly fromRevision?: number;
}

export interface WidgetStateSnapshot {
  readonly kind: "snapshot";
  readonly channel: string;
  readonly schema: string;
  readonly revision: number;
  readonly payload: JsonValue;
}
export interface WidgetStateDelta {
  readonly kind: "delta";
  readonly channel: string;
  readonly schema: string;
  readonly fromRevision: number;
  readonly toRevision: number;
  readonly payload: JsonValue;
}
export interface WidgetResyncRequired {
  readonly kind: "resync_required";
  readonly channel: string;
  readonly latestRevision: number;
  readonly reason: "revision_gap";
}
export type WidgetStateDelivery = WidgetStateSnapshot | WidgetStateDelta | WidgetResyncRequired;

export interface WidgetCommandRequest extends WidgetIdentity {
  readonly command: string;
  readonly correlationId: string;
  readonly payload: JsonValue;
}
export interface WidgetCommandResult { readonly correlationId: string; readonly ok: true; readonly payload: JsonValue }

export interface WidgetStateSource {
  read(request: WidgetStateRequest): WidgetStateDelivery;
  command?(request: WidgetCommandRequest): WidgetCommandResult;
}

export type ConnectMessage = { readonly protocol: typeof WIDGET_PROTOCOL; readonly type: "connect" };

/**
 * Host → widget handshake reply.
 * `display` is present only when rendering from a named kiosk target.
 * Admin editor previews receive no display identity (display is absent/undefined).
 */
export type ConnectedMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "connected";
  readonly instanceId: string;
  readonly nonce: string;
  readonly identity: WidgetIdentity;
  readonly config: unknown;
  readonly display?: DisplayIdentity;
  readonly variables?: Record<string, unknown>;
};
export type IdentifiedWidgetMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "ready" | "subscribe" | "unsubscribe" | "command" | "broadcast" | "notify-subscribe" | "notify-unsubscribe" | "variable-set" | "fetch" | "storage-get" | "storage-set" | "storage-delete" | "shared-subscribe" | "shared-unsubscribe" | "shared-set";
  readonly instanceId: string;
  readonly nonce: string;
  readonly channel?: string;
  readonly command?: string;
  readonly correlationId?: string;
  readonly topic?: string;
  readonly payload?: unknown;
  readonly name?: string;
  readonly value?: unknown;
  readonly key?: string;
  readonly url?: string;
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly timeoutMs?: number;
};

export type NotificationMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "notification";
  readonly instanceId: string;
  readonly nonce: string;
  readonly topic: string;
  readonly payload: unknown;
  readonly meta?: {
    readonly from?: string;
    readonly timestamp?: number;
    readonly remote?: boolean;
  };
};

export type StorageResultMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "storage-result";
  readonly instanceId: string;
  readonly nonce: string;
  readonly correlationId: string;
  readonly ok: boolean;
  readonly key: string;
  readonly value?: unknown;
  readonly error?: string;
};

export type SharedUpdateMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "shared-update";
  readonly instanceId: string;
  readonly nonce: string;
  readonly key: string;
  readonly value: unknown;
  readonly revision?: number;
  readonly meta?: {
    readonly remote?: boolean;
    readonly initial?: boolean;
  };
};

export type VariableUpdateMessage = {
  readonly protocol: typeof WIDGET_PROTOCOL;
  readonly type: "variable-update";
  readonly instanceId: string;
  readonly nonce: string;
  readonly name: string;
  readonly value: unknown;
  readonly variables: Record<string, unknown>;
};

export interface WidgetCustomTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: string;
}

export interface WidgetOutputVariableDef {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "json";
  readonly defaultValue: unknown;
  readonly description?: string;
}

export const FORBIDDEN_VAR_NAMES = new Set(["__proto__", "constructor", "prototype"]);
const MAX_MESSAGE_BYTES = 16 * 1024;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const bounded = (value: unknown): boolean => { try { return JSON.stringify(value).length <= MAX_MESSAGE_BYTES; } catch { return false; } };
export function isConnectMessage(value: unknown): value is ConnectMessage {
  return record(value) && bounded(value) && value.protocol === WIDGET_PROTOCOL && value.type === "connect";
}
export function isIdentifiedWidgetMessage(value: unknown, instanceId: string, nonce: string): value is IdentifiedWidgetMessage {
  if (!record(value) || !bounded(value) || value.protocol !== WIDGET_PROTOCOL || value.instanceId !== instanceId || value.nonce !== nonce) return false;
  if (value.type === "ready") return true;
  if ((value.type === "subscribe" || value.type === "unsubscribe") && typeof value.channel === "string" && value.channel.length <= 192) return true;
  if (value.type === "broadcast") return typeof value.topic === "string" && value.topic.length <= 128 && bounded(value.payload);
  if (value.type === "notify-subscribe" || value.type === "notify-unsubscribe") return typeof value.topic === "string" && value.topic.length <= 128;
  if (value.type === "variable-set") return typeof value.name === "string" && value.name.length <= 128 && !FORBIDDEN_VAR_NAMES.has(value.name) && bounded(value.value);
  if (value.type === "storage-get" || value.type === "storage-delete") {
    return typeof value.key === "string" && value.key.length <= 128 && typeof value.correlationId === "string" && value.correlationId.length <= 128;
  }
  if (value.type === "storage-set") {
    return typeof value.key === "string" && value.key.length <= 128 && bounded(value.value) && (value.correlationId === undefined || (typeof value.correlationId === "string" && value.correlationId.length <= 128));
  }
  if (value.type === "shared-subscribe" || value.type === "shared-unsubscribe") {
    return typeof value.key === "string" && value.key.length <= 128;
  }
  if (value.type === "shared-set") {
    return typeof value.key === "string" && value.key.length <= 128 && bounded(value.value);
  }
  if (value.type === "fetch") {
    return (
      typeof value.correlationId === "string" &&
      value.correlationId.length <= 128 &&
      typeof value.url === "string" &&
      value.url.length <= 2048 &&
      (value.method === undefined || typeof value.method === "string") &&
      (value.headers === undefined || (record(value.headers) && bounded(value.headers))) &&
      (value.body === undefined || typeof value.body === "string" || bounded(value.body)) &&
      (value.timeoutMs === undefined || typeof value.timeoutMs === "number")
    );
  }
  return value.type === "command" && typeof value.command === "string" && value.command.length <= 80 && typeof value.correlationId === "string" && value.correlationId.length <= 128 && bounded(value.payload);
}
export function acceptsWidgetEvent(event: { origin: string; source: unknown; data: unknown }, source: unknown, instanceId?: string, nonce?: string): boolean {
  const isTrustedOrigin = event.origin === ISOLATED_WIDGET_ORIGIN || event.origin === "" || (typeof location !== "undefined" && event.origin === location.origin);
  if (!isTrustedOrigin || event.source !== source) return false;
  return instanceId === undefined || nonce === undefined ? isConnectMessage(event.data) : isIdentifiedWidgetMessage(event.data, instanceId, nonce);
}
