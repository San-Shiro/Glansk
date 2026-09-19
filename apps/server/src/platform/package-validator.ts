export type PackageKind = "widget" | "emitter" | "composite";

export interface WidgetDescriptor {
  id: string;
  name?: string;
  entry: string;
  description?: string;
  defaultGeometry?: { w: number; h: number };
  configSchema?: Record<string, any>;
  capabilities?: string[];
}

export interface EmitterDescriptor {
  id: string;
  name?: string;
  category?: "sensor" | "media" | "system" | "custom";
  runtime?: "declarative" | "python" | "node" | "system";
  entry?: string;
  configSchema?: Record<string, any>;
  polling?: { intervalMs: number; url?: string };
  controls?: Array<{ name: string; label: string; type?: string }>;
}

export interface PackageManifest {
  schemaVersion?: 1;
  manifestVersion?: 2;
  id: string;
  version: string;
  name?: string;
  kind?: PackageKind;
  description?: string;
  author?: any;
  entry?: string;
  files: Record<string, string>;
  capabilities?: any;
  signature?: string;
  keyId?: string;
  widgets?: WidgetDescriptor[];
  emitters?: EmitterDescriptor[];
  presets?: any[];
  aliases?: any[];
  limits?: any;
}

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");

export async function validatePackage(
  manifest: PackageManifest,
  files: Map<string, Uint8Array>,
  trustedKeys: Map<string, CryptoKey> = new Map(),
  allowUnsigned = false
): Promise<{ trusted: boolean; boundary: string }> {
  const version = manifest.manifestVersion ?? manifest.schemaVersion;
  if (version !== 1 && version !== 2) {
    throw new Error("invalid manifest: unsupported schemaVersion");
  }

  if (!manifest.id || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(manifest.id)) {
    throw new Error("invalid manifest: invalid id");
  }

  if (manifest.entry && (manifest.entry.includes("..") || manifest.entry.startsWith("/"))) {
    throw new Error("invalid manifest: invalid entry path");
  }

  if (manifest.widgets) {
    for (const w of manifest.widgets) {
      if (!w.entry || w.entry.includes("..") || w.entry.startsWith("/")) {
        throw new Error(`invalid manifest: invalid widget entry path '${w.entry}'`);
      }
    }
  }

  if (manifest.emitters) {
    for (const e of manifest.emitters) {
      if (e.entry && (e.entry.includes("..") || e.entry.startsWith("/"))) {
        throw new Error(`invalid manifest: invalid emitter entry path '${e.entry}'`);
      }
    }
  }

  if (files.size > 256) {
    throw new Error("package file quota exceeded");
  }

  for (const [name, expected] of Object.entries(manifest.files ?? {})) {
    const file = files.get(name);
    if (!file || name.includes("..") || name.startsWith("/")) {
      throw new Error("invalid package path");
    }
    const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(file).buffer);
    if (hex(digest) !== expected.toLowerCase()) {
      throw new Error("package hash mismatch");
    }
  }

  if (!manifest.signature) {
    if (!allowUnsigned) throw new Error("unsigned package");
    return { trusted: false, boundary: "development-only unsigned package" };
  }

  const key = manifest.keyId ? trustedKeys.get(manifest.keyId) : undefined;
  if (!key) throw new Error("untrusted signing key");

  const canonical = JSON.stringify({ ...manifest, signature: undefined });
  const ok = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    Uint8Array.from(atob(manifest.signature), c => c.charCodeAt(0)),
    new TextEncoder().encode(canonical)
  );

  if (!ok) throw new Error("invalid package signature");
  return { trusted: true, boundary: "manifest authenticated; widget remains sandboxed" };
}