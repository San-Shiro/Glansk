#!/usr/bin/env bun
import { resolve, relative, join, dirname } from "node:path";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import nodeCrypto from "node:crypto";
import { createZip, extractZip } from "../../../apps/server/src/platform/archive";
import { normalizeManifestToV2 } from "../../../apps/server/src/platform/package-manifest-v2";
import {
  generateDeveloperKeypair,
  signPackageManifest,
  verifyPackageManifest,
  computeKeyFingerprint,
  canonicalizeJson,
} from "../src/signing";

export {
  generateDeveloperKeypair,
  signPackageManifest,
  verifyPackageManifest,
  computeKeyFingerprint,
  canonicalizeJson,
};

const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export function derivePublicKeyBase64(privKeyBase64OrBytes: string | Uint8Array): string {
  let bytes: Uint8Array =
    typeof privKeyBase64OrBytes === "string"
      ? new Uint8Array(Buffer.from(privKeyBase64OrBytes.trim(), "base64"))
      : privKeyBase64OrBytes;

  if (bytes.byteLength === 32) {
    const combined = new Uint8Array(PKCS8_ED25519_PREFIX.byteLength + 32);
    combined.set(PKCS8_ED25519_PREFIX);
    combined.set(bytes, PKCS8_ED25519_PREFIX.byteLength);
    bytes = combined;
  }

  const priv = nodeCrypto.createPrivateKey({ key: Buffer.from(bytes), format: "der", type: "pkcs8" });
  const pub = nodeCrypto.createPublicKey(priv);
  const rawPub = pub.export({ type: "spki", format: "der" }).subarray(-32);
  return Buffer.from(rawPub).toString("base64");
}

async function collectFiles(dir: string, base: string = dir): Promise<Record<string, Uint8Array>> {
  const result: Record<string, Uint8Array> = {};
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".git") {
        Object.assign(result, await collectFiles(full, base));
      }
    } else if (entry.isFile()) {
      const rel = relative(base, full).replace(/\\/g, "/");
      result[rel] = new Uint8Array(await readFile(full));
    }
  }

  return result;
}

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");

export interface PackOptions {
  outputPath?: string;
  signKeyPath?: string;
  publicKeyPath?: string;
  versionCode?: number;
}

export async function validateAndPack(
  sourceDir: string,
  optionsOrOutPath?: string | PackOptions
): Promise<{ success: boolean; packageFile?: string; fingerprint?: string; error?: string }> {
  const options: PackOptions =
    typeof optionsOrOutPath === "string"
      ? { outputPath: optionsOrOutPath }
      : (optionsOrOutPath ?? {});

  try {
    const manifestPath = resolve(sourceDir, "manifest.json");
    const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    const files = await collectFiles(sourceDir);

    // Apply versionCode if provided in options or validate existing in manifest
    if (options.versionCode !== undefined) {
      rawManifest.versionCode = options.versionCode;
    }
    if (rawManifest.versionCode !== undefined) {
      if (
        !Number.isInteger(rawManifest.versionCode) ||
        rawManifest.versionCode < 1 ||
        rawManifest.versionCode > 2147483647
      ) {
        throw new Error("Invalid manifest: versionCode must be a positive 32-bit integer (1 to 2147483647)");
      }
    }

    // Compute SHA-256 digests for all files except manifest.json
    const fileDigests: Record<string, string> = {};
    for (const [path, data] of Object.entries(files)) {
      if (path === "manifest.json") continue;
      const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
      fileDigests[path] = hex(digest);
    }

    rawManifest.files = fileDigests;
    let manifest = normalizeManifestToV2(rawManifest);

    // Verify all widget entries exist
    for (const w of manifest.widgets) {
      if (!files[w.entry]) {
        throw new Error(`Widget '${w.id}' entry file '${w.entry}' not found in package directory`);
      }
    }

    let signerFingerprint: string | undefined;

    // Handle package signing if signKeyPath is provided
    if (options.signKeyPath) {
      const privKeyRaw = await readFile(resolve(options.signKeyPath), "utf-8");
      let pubKeyBase64: string;

      if (options.publicKeyPath) {
        pubKeyBase64 = (await readFile(resolve(options.publicKeyPath), "utf-8")).trim();
      } else {
        // Try auto-discovering <dir>/developer.public.key, or derive directly from private key
        const candidatePubPath = join(dirname(resolve(options.signKeyPath)), "developer.public.key");
        try {
          pubKeyBase64 = (await readFile(candidatePubPath, "utf-8")).trim();
        } catch {
          pubKeyBase64 = derivePublicKeyBase64(privKeyRaw);
        }
      }

      manifest = await signPackageManifest(manifest, privKeyRaw, pubKeyBase64);
      signerFingerprint = manifest.signer?.fingerprint;
    }

    // Update manifest.json in the file map with canonical formatting
    files["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    const outPath = options.outputPath || resolve(sourceDir, `../${manifest.id}-${manifest.version}.glpkg`);
    if (!outPath.endsWith(".glpkg")) {
      throw new Error(`Invalid package filename: Glansk packages must have the '.glpkg' extension. Received: ${outPath}`);
    }

    const zipBytes = await createZip(files);
    await writeFile(outPath, zipBytes);

    return { success: true, packageFile: outPath, fingerprint: signerFingerprint };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface VerifyPackageResult {
  success: boolean;
  manifest?: any;
  signed: boolean;
  fingerprint?: string;
  publicKey?: string;
  versionCode?: number;
  filesCount?: number;
  error?: string;
}

export async function verifyPackageArchive(
  archivePathOrBytes: string | Uint8Array
): Promise<VerifyPackageResult> {
  try {
    let archiveBytes: Uint8Array;
    if (typeof archivePathOrBytes === "string") {
      archiveBytes = new Uint8Array(await readFile(resolve(archivePathOrBytes)));
    } else {
      archiveBytes = archivePathOrBytes;
    }

    const files = extractZip(archiveBytes);
    const manifestBytes = files.get("manifest.json");
    if (!manifestBytes) {
      return { success: false, signed: false, error: "Missing manifest.json in package root" };
    }

    const manifestText = new TextDecoder("utf-8").decode(manifestBytes);
    const manifest = JSON.parse(manifestText);

    // 1. Bidirectional File Verification
    const manifestFileKeys = new Set(Object.keys(manifest.files ?? {}));
    for (const name of files.keys()) {
      if (name === "manifest.json") continue;
      if (!manifestFileKeys.has(name)) {
        return { success: false, signed: false, error: `Unlisted file in package archive: '${name}'` };
      }
    }

    for (const [name, expected] of Object.entries(manifest.files ?? {})) {
      const fileData = files.get(name);
      if (!fileData) {
        return { success: false, signed: false, error: `File '${name}' declared in manifest is missing from archive` };
      }
      const digest = await crypto.subtle.digest("SHA-256", fileData as unknown as BufferSource);
      if (hex(digest) !== (expected as string).toLowerCase()) {
        return { success: false, signed: false, error: `File '${name}' hash mismatch` };
      }
    }

    // 2. Version Code validation
    if (manifest.versionCode !== undefined) {
      if (
        !Number.isInteger(manifest.versionCode) ||
        manifest.versionCode < 1 ||
        manifest.versionCode > 2147483647
      ) {
        return { success: false, signed: false, error: "Invalid manifest: versionCode must be a positive 32-bit integer" };
      }
    }

    // 3. Signature verification
    if (manifest.signer) {
      const res = await verifyPackageManifest(manifest);
      if (!res.valid) {
        return { success: false, signed: true, error: res.error };
      }
      return {
        success: true,
        manifest,
        signed: true,
        fingerprint: res.fingerprint,
        publicKey: res.publicKey,
        versionCode: manifest.versionCode,
        filesCount: Object.keys(manifest.files ?? {}).length,
      };
    }

    return {
      success: true,
      manifest,
      signed: false,
      versionCode: manifest.versionCode,
      filesCount: Object.keys(manifest.files ?? {}).length,
    };
  } catch (err: any) {
    return { success: false, signed: false, error: err.message };
  }
}

// Command-Line Interface Entrypoint
if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0] || "help";

  if (cmd === "keygen") {
    let outDir = process.cwd();
    let keyName = "developer";

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--out" && args[i + 1]) outDir = args[++i]!;
      else if (args[i] === "--name" && args[i + 1]) keyName = args[++i]!;
    }

    (async () => {
      await mkdir(outDir, { recursive: true });
      const keypair = await generateDeveloperKeypair();
      const privPath = join(outDir, `${keyName}.private.key`);
      const pubPath = join(outDir, `${keyName}.public.key`);

      await writeFile(privPath, keypair.privateKey, "utf-8");
      await writeFile(pubPath, keypair.publicKey, "utf-8");

      console.log(`[Glansk Keygen] Generated Ed25519 Developer Keypair:`);
      console.log(`  Private Key:      ${privPath}`);
      console.log(`  Public Key:       ${pubPath}`);
      console.log(`  Origin Identity:  ${keypair.fingerprint}`);
      console.log(`\nKeep your private key secure. Distribute packages signed with this key to maintain developer identity continuity.`);
    })().catch(err => {
      console.error(`[Glansk Keygen Error]`, err);
      process.exit(1);
    });
  } else if (cmd === "pack") {
    let targetDir = process.cwd();
    let signKeyPath: string | undefined;
    let publicKeyPath: string | undefined;
    let versionCode: number | undefined;
    let outputPath: string | undefined;

    for (let i = 1; i < args.length; i++) {
      const arg = args[i]!;
      if (arg === "--sign" && args[i + 1]) signKeyPath = args[++i]!;
      else if (arg === "--public-key" && args[i + 1]) publicKeyPath = args[++i]!;
      else if (arg === "--version-code" && args[i + 1]) versionCode = parseInt(args[++i]!, 10);
      else if (arg === "--out" && args[i + 1]) outputPath = args[++i]!;
      else if (!arg.startsWith("--")) targetDir = arg;
    }

    console.log(`Packaging Glansk widget package from: ${targetDir}...`);
    validateAndPack(targetDir, { outputPath, signKeyPath, publicKeyPath, versionCode }).then((res) => {
      if (res.success) {
        console.log(`Successfully generated package: ${res.packageFile}`);
        if (res.fingerprint) {
          console.log(`Signed with Origin Identity: ${res.fingerprint}`);
        } else {
          console.log(`Warning: Unsigned package (development only)`);
        }
      } else {
        console.error(`Packaging failed: ${res.error}`);
        process.exit(1);
      }
    });
  } else if (cmd === "verify") {
    const pkgPath = args[1];
    if (!pkgPath) {
      console.error("Usage: glansk-widget verify <path-to-package.glpkg>");
      process.exit(1);
    }

    verifyPackageArchive(pkgPath).then((res) => {
      if (!res.success) {
        console.error(`[Glansk Verify FAILED]: ${res.error}`);
        process.exit(1);
      }

      console.log(`[Glansk Verify] Package Integrity Verified:`);
      console.log(`  Package ID:     ${res.manifest?.id}`);
      console.log(`  Version:        ${res.manifest?.version} ${res.versionCode ? `(versionCode: ${res.versionCode})` : ""}`);
      console.log(`  Files Verified: ${res.filesCount} file(s) matched SHA-256 digests`);
      if (res.signed) {
        console.log(`  Status:         AUTHENTICATED (Signed)`);
        console.log(`  Developer ID:   ${res.fingerprint}`);
      } else {
        console.log(`  Status:         UNSIGNED (Development Only)`);
      }
    });
  } else {
    console.log(`Glansk Widget SDK CLI`);
    console.log(`Usage:`);
    console.log(`  glansk-widget keygen [--out <dir>] [--name <prefix>]`);
    console.log(`  glansk-widget pack [directory] [--sign <key-file>] [--version-code <int>] [--out <file.glpkg>]`);
    console.log(`  glansk-widget verify <file.glpkg>`);
  }
}
