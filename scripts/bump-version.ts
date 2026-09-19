#!/usr/bin/env bun
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const targetVersion = process.argv[2];
if (!targetVersion) {
  console.error("Usage: bun run bump <new-version>");
  console.error("Example: bun run bump 0.1.2-alpha");
  process.exit(1);
}

const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
if (!semverRegex.test(targetVersion)) {
  console.error(`Invalid semver format: "${targetVersion}". Expected format like "0.1.2" or "0.1.2-alpha"`);
  process.exit(1);
}

const rootDir = resolve(import.meta.dir, "..");
const packageFiles = [
  "package.json",
  "apps/server/package.json",
  "apps/studio/package.json",
  "packages/widget-sdk/package.json",
  "packages/shared/package.json",
];

console.log(`Bumping Glansk to v${targetVersion}...`);

for (const relPath of packageFiles) {
  const fullPath = resolve(rootDir, relPath);
  try {
    const raw = await readFile(fullPath, "utf-8");
    const json = JSON.parse(raw);
    const oldVersion = json.version;
    json.version = targetVersion;
    await writeFile(fullPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
    console.log(`✓ Updated ${relPath} (${oldVersion} -> ${targetVersion})`);
  } catch (err) {
    console.warn(`! Could not update ${relPath}:`, (err as Error).message);
  }
}

// Update packages/shared/src/version.ts
const versionTsPath = resolve(rootDir, "packages/shared/src/version.ts");
const channel = targetVersion.includes("-") ? targetVersion.split("-")[1].split(".")[0] : "release";
const versionTsContent = `/**
 * Glansk Core - Single Source of Truth Version Constants
 * This file is automatically maintained by \`scripts/bump-version.ts\`.
 */
export const GLANSK_VERSION = "${targetVersion}";
export const GLANSK_RELEASE_CHANNEL = "${channel}";
export const GLANSK_BUILD_TIMESTAMP = "${new Date().toISOString()}";
`;

await writeFile(versionTsPath, versionTsContent, "utf-8");
console.log(`✓ Updated packages/shared/src/version.ts`);
console.log(`\nSuccessfully bumped Glansk to v${targetVersion}!`);
