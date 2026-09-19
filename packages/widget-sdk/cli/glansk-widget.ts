#!/usr/bin/env bun
import { resolve, relative, join } from "node:path";
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { createZip } from "../../../apps/server/src/platform/archive";
import { normalizeManifestToV2 } from "../../../apps/server/src/platform/package-manifest-v2";

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

export async function validateAndPack(sourceDir: string, outputPath?: string): Promise<{ success: boolean; packageFile?: string; error?: string }> {
  try {
    const manifestPath = resolve(sourceDir, "manifest.json");
    const rawManifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    const files = await collectFiles(sourceDir);

    // Compute SHA-256 digests for all files except manifest.json
    const fileDigests: Record<string, string> = {};
    for (const [path, data] of Object.entries(files)) {
      if (path === "manifest.json") continue;
      const digest = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
      fileDigests[path] = hex(digest);
    }

    rawManifest.files = fileDigests;
    const manifest = normalizeManifestToV2(rawManifest);

    // Verify all widget entries exist
    for (const w of manifest.widgets) {
      if (!files[w.entry]) {
        throw new Error(`Widget '${w.id}' entry file '${w.entry}' not found in package directory`);
      }
    }

    // Update manifest.json in the file map
    files["manifest.json"] = new TextEncoder().encode(JSON.stringify(manifest, null, 2));

    const outPath = outputPath || resolve(sourceDir, `../${manifest.id}-${manifest.version}.glpkg`);
    const zipBytes = await createZip(files);
    await writeFile(outPath, zipBytes);

    return { success: true, packageFile: outPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// If run from command line
if (import.meta.main) {
  const args = process.argv.slice(2);
  const cmd = args[0] || "pack";
  const targetDir = args[1] || process.cwd();

  if (cmd === "pack") {
    console.log(`Packaging Glansk widget package from: ${targetDir}...`);
    validateAndPack(targetDir).then((res) => {
      if (res.success) {
        console.log(`Successfully generated package: ${res.packageFile}`);
      } else {
        console.error(`Packaging failed: ${res.error}`);
        process.exit(1);
      }
    });
  } else {
    console.log("Usage: ld-widget pack <directory>");
  }
}
