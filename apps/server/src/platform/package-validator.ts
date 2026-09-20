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

export interface PackageSigner {
  algorithm: "Ed25519";
  publicKey: string; // Base64-encoded raw 32-byte Ed25519 public key
  fingerprint: string; // "SHA256:<lowercase-hex-of-sha256(rawPublicKey)>"
  signature: string; // Base64-encoded 64-byte Ed25519 signature
  signedAt: string; // ISO 8601 string
}

export interface PackageManifest {
  schemaVersion?: 1;
  manifestVersion?: 2;
  id: string;
  version: string;
  versionCode?: number;
  name?: string;
  kind?: PackageKind;
  description?: string;
  author?: any;
  entry?: string;
  files: Record<string, string>;
  capabilities?: any;
  signature?: string;
  keyId?: string;
  signer?: PackageSigner;
  widgets?: WidgetDescriptor[];
  emitters?: EmitterDescriptor[];
  presets?: any[];
  aliases?: any[];
  limits?: any;
}

export interface PackageValidationResult {
  trusted: boolean;
  boundary: string;
  signerFingerprint?: string;
  signerPublicKey?: string;
  versionCode?: number;
}

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");

/**
 * Deterministic JSON Canonicalization Scheme (RFC 8785).
 * Recursively sorts object keys alphabetically and removes whitespace.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalizeJson).join(",") + "]";
  }
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort();
  const members = keys.map(k => JSON.stringify(k) + ":" + canonicalizeJson(obj[k]));
  return "{" + members.join(",") + "}";
}

/**
 * Computes SHA-256 fingerprint of a raw Ed25519 public key.
 */
export async function computeKeyFingerprint(rawPublicKey: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", rawPublicKey as unknown as BufferSource);
  return `SHA256:${hex(digest).toLowerCase()}`;
}

export async function validatePackage(
  manifest: PackageManifest,
  files: Map<string, Uint8Array>,
  trustedKeys: Map<string, CryptoKey> = new Map(),
  allowUnsigned = false
): Promise<PackageValidationResult> {
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

  // 1. Bidirectional File Verification (prevent unlisted file injection)
  const manifestFileKeys = new Set(Object.keys(manifest.files ?? {}));
  for (const name of files.keys()) {
    if (name === "manifest.json") continue;
    if (!manifestFileKeys.has(name)) {
      throw new Error(`unlisted file in package: '${name}'`);
    }
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

  // 2. Version code invariant (if present, must be 32-bit positive integer)
  if (manifest.versionCode !== undefined) {
    if (!Number.isInteger(manifest.versionCode) || manifest.versionCode < 1 || manifest.versionCode > 2147483647) {
      throw new Error("invalid manifest: versionCode must be a positive 32-bit integer (1 to 2147483647)");
    }
  }

  // 3. Android-style Ed25519 Developer Origin Signature Verification
  if (manifest.signer) {
    const { algorithm, publicKey, fingerprint, signature } = manifest.signer;
    if (algorithm !== "Ed25519") {
      throw new Error(`unsupported signature algorithm: ${algorithm}`);
    }
    if (!publicKey || !signature || !fingerprint) {
      throw new Error("malformed package signer block");
    }

    const rawPubKey = Uint8Array.from(atob(publicKey), c => c.charCodeAt(0));
    if (rawPubKey.byteLength !== 32) {
      throw new Error("invalid Ed25519 public key length; expected 32 bytes");
    }

    const computedFingerprint = await computeKeyFingerprint(rawPubKey);
    if (fingerprint.toLowerCase() !== computedFingerprint.toLowerCase()) {
      throw new Error("signer fingerprint mismatch");
    }

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      rawPubKey,
      { name: "Ed25519" },
      false,
      ["verify"]
    );

    // Canonicalize manifest omitting signature
    const unsignedManifest = {
      ...manifest,
      signer: {
        ...manifest.signer,
        signature: undefined,
      },
      signature: undefined,
    };
    const canonicalText = canonicalizeJson(unsignedManifest);
    const canonicalBytes = new TextEncoder().encode(canonicalText);
    const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      cryptoKey,
      sigBytes,
      canonicalBytes
    );

    if (!ok) throw new Error("invalid package signature");

    return {
      trusted: true,
      boundary: "manifest authenticated; developer origin verified",
      signerFingerprint: computedFingerprint,
      signerPublicKey: publicKey,
      versionCode: manifest.versionCode,
    };
  }

  // 4. Legacy signing format fallback (manifest.signature + trustedKeys)
  if (manifest.signature) {
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
    return { trusted: true, boundary: "manifest authenticated; widget remains sandboxed", versionCode: manifest.versionCode };
  }

  // 5. Unsigned package handling
  if (!allowUnsigned) throw new Error("unsigned package");
  return { trusted: false, boundary: "development-only unsigned package", versionCode: manifest.versionCode };
}