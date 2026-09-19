import type { JsonValue } from "./types";

export type EmitterCategory = "media" | "metrics" | "sensor" | "switchboard" | "custom";
export type EmitterControlType = "toggle" | "action" | "range" | "select";
export type EmitterStatus = "online" | "stale" | "offline" | "terminated";
export type EmitterOfflineBehavior = "retain-dormant" | "auto-remove" | "hide";

export interface EmitterControl {
  readonly id: string;
  readonly type: EmitterControlType;
  readonly label: string;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly options?: Array<{ readonly label: string; readonly value: string | number }>;
  readonly icon?: string;
}

export interface EmitterDisplayProfile {
  readonly defaultWidth?: number;
  readonly defaultHeight?: number;
  readonly tone?: string;
  readonly zIndex?: number;
}

export interface EmitterAutoMountConfig {
  readonly enabled: boolean;
  readonly canvasId?: string;       // target canvas ID, or empty for active/default
  readonly position?: "auto" | { readonly x: number; readonly y: number };
  readonly updateExisting?: boolean;// default true: reuse & update existing widget
}

export interface EmitterLifecycleConfig {
  readonly ttlSeconds?: number;       // default 30s before marked offline
  readonly staleSeconds?: number;     // default 10s before marked stale
  readonly transient?: boolean;       // if true, defaults offlineBehavior to 'auto-remove'
  readonly offlineBehavior?: EmitterOfflineBehavior;
}

export interface EmitterManifest {
  readonly id: string;
  readonly name: string;
  readonly category: EmitterCategory;
  readonly description?: string;
  readonly icon?: string;
  readonly controls?: readonly EmitterControl[];
  readonly display?: EmitterDisplayProfile;
  readonly autoMount?: EmitterAutoMountConfig;
  readonly lifecycle?: EmitterLifecycleConfig;
}

export interface EmitterRegistration {
  readonly manifest: EmitterManifest;
  readonly state: Record<string, JsonValue>;
  readonly lastSeen: number;
  readonly transport: "http" | "ws" | "tmpfs";
  readonly status: EmitterStatus;
  readonly instanceId?: string | undefined;
  readonly sequence?: number | undefined;
}

export interface EmitterCommand {
  readonly emitterId: string;
  readonly controlId: string;
  readonly command?: string | undefined; // alias for controlId for backward/forward compatibility
  readonly payload?: JsonValue | undefined;
  readonly value?: JsonValue | undefined;
  readonly correlationId: string;
}

export interface EmitterCommandResult {
  readonly ok: boolean;
  readonly correlationId: string;
  readonly error?: string | undefined;
  readonly state?: Record<string, JsonValue> | undefined;
}

