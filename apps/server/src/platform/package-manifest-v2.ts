/**
 * Package Manifest Schema v2.
 * Supports multi-widget packaging, design presets, topic/command capabilities,
 * rate quotas, and legacy widget aliases.
 */

import type { WidgetDesignPreset } from "./design-preset-schema";
import type { PackageSigner } from "./package-validator";

export type PackageKind = "widget" | "emitter" | "composite";

export interface ConfigSchemaField {
  readonly key: string;
  readonly type: "string" | "number" | "boolean" | "select" | "textarea" | "secret-ref" | "color" | "radius" | "range" | "media" | "toggle";
  readonly label: string;
  readonly default?: unknown;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly hint?: string;
  readonly options?: ReadonlyArray<{ readonly label: string; readonly value: string | number }>;
}

export interface WidgetDescriptorV2 {
  readonly id: string;
  readonly name: string;
  readonly entry: string;
  readonly description?: string;
  readonly category: "display" | "control" | "media" | "sensor" | "custom";
  readonly icon?: string;
  readonly configSchema?: readonly ConfigSchemaField[];
  readonly defaultConfig?: Readonly<Record<string, unknown>>;
  readonly defaultPreset?: string;
  readonly supportedPresets?: readonly string[];
  readonly dimensions: {
    readonly default: { readonly w: number; readonly h: number };
    readonly minimum: { readonly w: number; readonly h: number };
    readonly maximum?: { readonly w: number; readonly h: number };
    readonly aspectRatio?: number | null;
  };
  readonly capabilities?: {
    readonly publishTopics?: readonly string[];
    readonly subscribeTopics?: readonly string[];
    readonly commands?: readonly string[];
    readonly notifications?: readonly string[];
    readonly telemetry?: readonly string[];
  };
}

export interface EmitterDescriptorV2 {
  readonly id: string;
  readonly name: string;
  readonly category?: "sensor" | "media" | "system" | "custom";
  readonly runtime?: "declarative" | "python" | "node" | "system";
  readonly entry?: string;
  readonly configSchema?: readonly ConfigSchemaField[];
  readonly polling?: { readonly intervalMs: number; readonly url?: string };
  readonly controls?: ReadonlyArray<{ readonly name: string; readonly label: string; readonly type?: string }>;
}

export interface LegacyAlias {
  readonly legacyWidgetId: string;
  readonly widgetId: string;
  readonly configMigration?: string | undefined;
}

export interface PackageManifestV2 {
  readonly manifestVersion: 2;
  readonly id: string;
  readonly version: string;
  readonly versionCode?: number | undefined;
  readonly name: string;
  readonly kind: PackageKind;
  readonly description?: string | undefined;
  readonly author?: {
    readonly name: string;
    readonly email?: string | undefined;
    readonly url?: string | undefined;
  } | string | undefined;
  readonly compatibility: {
    readonly glansk: string;
    readonly protocol: "glansk.widget.v1";
    readonly requiredFeatures?: readonly string[] | undefined;
  };
  readonly widgets: readonly WidgetDescriptorV2[];
  readonly emitters?: readonly EmitterDescriptorV2[] | undefined;
  readonly presets?: readonly WidgetDesignPreset[] | undefined;
  readonly aliases?: readonly LegacyAlias[] | undefined;
  readonly capabilities?: {
    readonly publishTopics?: readonly string[] | undefined;
    readonly subscribeTopics?: readonly string[] | undefined;
    readonly commands?: readonly string[] | undefined;
    readonly notifications?: readonly string[] | undefined;
    readonly telemetry?: readonly string[] | undefined;
  } | undefined;
  readonly limits?: {
    readonly messagesPerSecond?: number | undefined;
    readonly maxMessageBytes?: number | undefined;
    readonly maxSubscriptions?: number | undefined;
  } | undefined;
  readonly files: Readonly<Record<string, string>>; // relative path -> SHA-256 hex
  readonly signature?: string | undefined;
  readonly keyId?: string | undefined;
  readonly signer?: PackageSigner | undefined;
  readonly changelog?: readonly PackageChangelogEntry[] | string | undefined;
}

export interface PackageChangelogEntry {
  readonly version: string;
  readonly versionCode?: number | undefined;
  readonly date?: string | undefined;
  readonly summary?: string | undefined;
  readonly changes?: readonly string[] | undefined;
}

function normalizeChangelog(raw: unknown): readonly PackageChangelogEntry[] | string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (Array.isArray(raw)) {
    const entries: PackageChangelogEntry[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      if (!entry.version) continue;
      const normalized: PackageChangelogEntry = {
        version: String(entry.version),
        ...(typeof entry.versionCode === "number" && Number.isInteger(entry.versionCode) && entry.versionCode > 0
          ? { versionCode: entry.versionCode }
          : {}),
        ...(entry.date ? { date: String(entry.date) } : {}),
        ...(entry.summary ? { summary: String(entry.summary) } : {}),
        ...(Array.isArray(entry.changes)
          ? { changes: entry.changes.filter((c: unknown) => typeof c === "string").map((c: string) => String(c)) }
          : {}),
      };
      entries.push(normalized);
    }
    return entries.length > 0 ? entries : undefined;
  }
  return undefined;
}

/**
 * Normalizes a v1 or v2 manifest into a strict PackageManifestV2 object.
 */
export function normalizeManifestToV2(raw: Record<string, any>): PackageManifestV2 {
  const version = raw.manifestVersion ?? raw.schemaVersion;
  if (version !== 1 && version !== 2) {
    throw new Error(`unsupported manifest version '${version}', expected 1 or 2`);
  }

  // If already v2
  if (version === 2) {
    return {
      manifestVersion: 2,
      id: String(raw.id || ""),
      version: String(raw.version || "1.0.0"),
      ...(typeof raw.versionCode === "number" ? { versionCode: raw.versionCode } : {}),
      name: String(raw.name || raw.id || "Untitled Package"),
      kind: (raw.kind as PackageKind) || "widget",
      ...(raw.description !== undefined ? { description: String(raw.description) } : {}),
      ...(raw.author !== undefined ? { author: raw.author } : {}),
      compatibility: {
        glansk: raw.compatibility?.glansk || ">=0.4.0",
        protocol: "glansk.widget.v1",
        ...(raw.compatibility?.requiredFeatures !== undefined
          ? { requiredFeatures: raw.compatibility.requiredFeatures }
          : {}),
      },
      widgets: Array.isArray(raw.widgets)
        ? raw.widgets.map((w) => ({
            id: String(w.id || ""),
            name: String(w.name || w.id || ""),
            entry: String(w.entry || ""),
            ...(w.description !== undefined ? { description: w.description } : {}),
            category: w.category || "custom",
            ...(w.icon !== undefined ? { icon: w.icon } : {}),
            ...(w.configSchema !== undefined ? { configSchema: w.configSchema } : {}),
            ...(w.defaultConfig !== undefined ? { defaultConfig: w.defaultConfig } : {}),
            ...(w.defaultPreset !== undefined ? { defaultPreset: w.defaultPreset } : {}),
            ...(w.supportedPresets !== undefined ? { supportedPresets: w.supportedPresets } : {}),
            dimensions: {
              default: w.dimensions?.default || { w: 320, h: 220 },
              minimum: w.dimensions?.minimum || { w: 160, h: 100 },
              ...(w.dimensions?.maximum !== undefined ? { maximum: w.dimensions.maximum } : {}),
              aspectRatio: w.dimensions?.aspectRatio ?? null,
            },
            ...(w.capabilities !== undefined ? { capabilities: w.capabilities } : {}),
          }))
        : [],
      ...(Array.isArray(raw.emitters) ? { emitters: raw.emitters } : {}),
      ...(Array.isArray(raw.presets) ? { presets: raw.presets } : {}),
      ...(Array.isArray(raw.aliases) ? { aliases: raw.aliases } : {}),
      ...(raw.capabilities !== undefined ? { capabilities: raw.capabilities } : {}),
      ...(raw.limits !== undefined ? { limits: raw.limits } : {}),
      files: raw.files || {},
      ...(raw.signature !== undefined ? { signature: raw.signature } : {}),
      ...(raw.keyId !== undefined ? { keyId: raw.keyId } : {}),
      ...(raw.signer !== undefined ? { signer: raw.signer } : {}),
      ...(raw.changelog !== undefined
        ? (() => {
            const cl = normalizeChangelog(raw.changelog);
            return cl !== undefined ? { changelog: cl } : {};
          })()
        : {}),
    };
  }

  // Convert v1 to v2 adapter
  const v1Widgets: WidgetDescriptorV2[] = [];
  if (Array.isArray(raw.widgets)) {
    for (const w of raw.widgets) {
      v1Widgets.push({
        id: String(w.id || ""),
        name: String(w.name || w.id || ""),
        entry: String(w.entry || raw.entry || "index.html"),
        ...(w.description !== undefined ? { description: w.description } : {}),
        category: "custom",
        dimensions: {
          default: w.defaultGeometry || { w: 320, h: 220 },
          minimum: { w: 160, h: 100 },
        },
      });
    }
  } else if (raw.entry) {
    v1Widgets.push({
      id: raw.id,
      name: raw.name || raw.id,
      entry: raw.entry,
      category: "custom",
      dimensions: {
        default: { w: 320, h: 220 },
        minimum: { w: 160, h: 100 },
      },
    });
  }

  return {
    manifestVersion: 2,
    id: String(raw.id || ""),
    version: String(raw.version || "1.0.0"),
    name: String(raw.name || raw.id || "Package"),
    kind: (raw.kind as PackageKind) || "widget",
    ...(raw.description !== undefined ? { description: raw.description } : {}),
    ...(raw.author !== undefined ? { author: raw.author } : {}),
    compatibility: {
      glansk: ">=0.1.0",
      protocol: "glansk.widget.v1",
    },
    widgets: v1Widgets,
    ...(raw.emitters !== undefined ? { emitters: raw.emitters } : {}),
    ...(raw.capabilities ? { capabilities: { publishTopics: raw.capabilities } } : {}),
    files: raw.files || {},
    ...(raw.signature !== undefined ? { signature: raw.signature } : {}),
    ...(raw.keyId !== undefined ? { keyId: raw.keyId } : {}),
    ...(raw.changelog !== undefined
      ? (() => {
          const cl = normalizeChangelog(raw.changelog);
          return cl !== undefined ? { changelog: cl } : {};
        })()
      : {}),
  };
}
