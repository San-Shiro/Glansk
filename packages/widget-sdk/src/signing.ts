export interface PackageSigner {
  algorithm: "Ed25519";
  publicKey: string; // Base64-encoded raw 32-byte Ed25519 public key
  fingerprint: string; // "SHA256:<lowercase-hex-of-sha256(rawPublicKey)>"
  signature: string; // Base64-encoded 64-byte Ed25519 signature
  signedAt: string; // ISO 8601 string
}

export interface PackageChangelogEntry {
  readonly version: string;
  readonly versionCode?: number;
  readonly date?: string;
  readonly summary?: string;
  readonly changes?: readonly string[];
}

export interface DeveloperKeypair {
  publicKey: string; // Base64-encoded raw 32-byte Ed25519 public key
  privateKey: string; // Base64-encoded private key (PKCS#8 48-byte or raw 32-byte seed)
  fingerprint: string; // SHA256:<lowercase-hex>
}

const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

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

/**
 * Generates an Ed25519 developer keypair suitable for package signing.
 */
export async function generateDeveloperKeypair(): Promise<DeveloperKeypair> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "Ed25519" },
    true,
    ["sign", "verify"]
  );

  const rawPub = new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey));
  const pkcs8Priv = new Uint8Array(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey));

  const pubBase64 = Buffer.from(rawPub).toString("base64");
  const privBase64 = Buffer.from(pkcs8Priv).toString("base64");
  const fingerprint = await computeKeyFingerprint(rawPub);

  return {
    publicKey: pubBase64,
    privateKey: privBase64,
    fingerprint,
  };
}

/**
 * Imports an Ed25519 private key from base64 string or Uint8Array.
 * Supports both 48-byte PKCS#8 envelopes and 32-byte raw seeds.
 */
export async function importPrivateKey(keyInput: string | Uint8Array): Promise<CryptoKey> {
  let bytes: Uint8Array =
    typeof keyInput === "string" ? new Uint8Array(Buffer.from(keyInput.trim(), "base64")) : keyInput;

  if (bytes.byteLength === 32) {
    // Wrap 32-byte seed in standard Ed25519 PKCS#8 structure
    const combined = new Uint8Array(PKCS8_ED25519_PREFIX.byteLength + 32);
    combined.set(PKCS8_ED25519_PREFIX);
    combined.set(bytes, PKCS8_ED25519_PREFIX.byteLength);
    bytes = combined;
  }

  if (bytes.byteLength !== 48) {
    throw new Error(`Invalid Ed25519 private key length: expected 32 or 48 bytes, got ${bytes.byteLength}`);
  }

  return await crypto.subtle.importKey(
    "pkcs8",
    bytes as unknown as BufferSource,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

/**
 * Imports an Ed25519 public key from base64 string or Uint8Array (32 bytes).
 */
export async function importPublicKey(keyInput: string | Uint8Array): Promise<CryptoKey> {
  const bytes: Uint8Array =
    typeof keyInput === "string" ? new Uint8Array(Buffer.from(keyInput.trim(), "base64")) : keyInput;

  if (bytes.byteLength !== 32) {
    throw new Error(`Invalid Ed25519 public key length: expected 32 bytes, got ${bytes.byteLength}`);
  }

  return await crypto.subtle.importKey(
    "raw",
    bytes as unknown as BufferSource,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
}

/**
 * Signs a package manifest using the developer's private key.
 * Appends the `signer` block to the manifest.
 */
export async function signPackageManifest(
  manifest: any,
  privateKeyInput: CryptoKey | string | Uint8Array,
  publicKeyBase64: string
): Promise<any> {
  const rawPubKey = new Uint8Array(Buffer.from(publicKeyBase64.trim(), "base64"));
  if (rawPubKey.byteLength !== 32) {
    throw new Error("Invalid public key length; expected 32-byte base64 encoded string");
  }

  const fingerprint = await computeKeyFingerprint(rawPubKey);

  const privateKey =
    privateKeyInput instanceof CryptoKey
      ? privateKeyInput
      : await importPrivateKey(privateKeyInput);

  // Prepare unsigned manifest clone omitting signature fields
  const unsignedManifest = {
    ...manifest,
    signer: {
      algorithm: "Ed25519" as const,
      publicKey: publicKeyBase64.trim(),
      fingerprint,
      signature: undefined,
      signedAt: new Date().toISOString(),
    },
    signature: undefined,
  };

  const canonicalText = canonicalizeJson(unsignedManifest);
  const dataToSign = new TextEncoder().encode(canonicalText);

  const signatureBuffer = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    dataToSign
  );

  const signatureBase64 = Buffer.from(signatureBuffer).toString("base64");

  return {
    ...unsignedManifest,
    signer: {
      ...unsignedManifest.signer,
      signature: signatureBase64,
    },
  };
}

/**
 * Verifies a package manifest's Ed25519 signature and origin fingerprint.
 */
export async function verifyPackageManifest(
  manifest: any
): Promise<{ valid: boolean; fingerprint?: string; publicKey?: string; error?: string }> {
  if (!manifest.signer) {
    return { valid: false, error: "Manifest is unsigned (missing 'signer' object)" };
  }

  const { algorithm, publicKey, fingerprint, signature } = manifest.signer;
  if (algorithm !== "Ed25519") {
    return { valid: false, error: `Unsupported signature algorithm: ${algorithm}` };
  }

  if (!publicKey || !signature || !fingerprint) {
    return { valid: false, error: "Malformed package signer block" };
  }

  try {
    const rawPubKey = new Uint8Array(Buffer.from(publicKey.trim(), "base64"));
    if (rawPubKey.byteLength !== 32) {
      return { valid: false, error: "Invalid public key length; expected 32 bytes" };
    }

    const computedFingerprint = await computeKeyFingerprint(rawPubKey);
    if (fingerprint.toLowerCase() !== computedFingerprint.toLowerCase()) {
      return { valid: false, error: "Signer fingerprint mismatch" };
    }

    const cryptoKey = await importPublicKey(rawPubKey);

    const unsignedManifest = {
      ...manifest,
      signer: {
        ...manifest.signer,
        signature: undefined,
      },
      signature: undefined,
    };

    const canonicalText = canonicalizeJson(unsignedManifest);
    const dataToVerify = new TextEncoder().encode(canonicalText);
    const sigBytes = new Uint8Array(Buffer.from(signature.trim(), "base64"));

    const ok = await crypto.subtle.verify(
      { name: "Ed25519" },
      cryptoKey,
      sigBytes,
      dataToVerify
    );

    if (!ok) {
      return { valid: false, error: "Cryptographic signature verification failed" };
    }

    return {
      valid: true,
      fingerprint: computedFingerprint,
      publicKey,
    };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
