import { readdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");

// 1. Rename directories
const dirRenames = [
  ["apps/server/src/widgets/litedash.demo", "apps/server/src/widgets/glansk.demo"],
  ["apps/server/src/widgets/litedash.media", "apps/server/src/widgets/glansk.media"],
];

for (const [oldRel, newRel] of dirRenames) {
  const oldPath = join(rootDir, oldRel);
  const newPath = join(rootDir, newRel);
  try {
    await rename(oldPath, newPath);
    console.log(`Renamed directory: ${oldRel} -> ${newRel}`);
  } catch {
    // Already renamed or missing
  }
}

// 2. Scan and replace in files
const targetDirs = [
  "apps/server/src",
  "apps/server/tests",
  "apps/server/schemas",
  "apps/studio/src",
  "apps/studio/index.html",
  "packages/widget-sdk/src",
  "packages/widget-sdk/cli",
  "packages/widget-sdk/tests",
  "packages/widgets",
  "packages/shared/src",
  "docs/spec",
];

const extensions = [".ts", ".tsx", ".js", ".json", ".html", ".css", ".md"];

async function walk(dir: string, fileList: string[] = []): Promise<string[]> {
  try {
    const s = await stat(dir);
    if (!s.isDirectory()) {
      fileList.push(dir);
      return fileList;
    }
  } catch {
    return fileList;
  }

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (["node_modules", ".git", "dist", "build"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, fileList);
    } else {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        fileList.push(full);
      }
    }
  }
  return fileList;
}

const allFiles: string[] = [];
for (const rel of targetDirs) {
  await walk(join(rootDir, rel), allFiles);
}

console.log(`Found ${allFiles.length} files to scan for rebranding...`);

let modifiedCount = 0;

for (const file of allFiles) {
  const content = await readFile(file, "utf-8");

  let updated = content;

  // Exact protocol & namespace updates first
  updated = updated.replace(/\"ld_\"/g, '"gl_"');
  updated = updated.replace(/'ld_'/g, "'gl_'");
  updated = updated.replace(/`ld_/g, "`gl_");
  updated = updated.replace(/\.ldpkg/g, ".glpkg");

  // Rebrand casing variants
  // 1. LITEDASH -> GLANSK
  updated = updated.replace(/LITEDASH/g, "GLANSK");

  // 2. LiteDash -> Glansk
  updated = updated.replace(/LiteDash/g, "Glansk");

  // 3. litedash -> glansk
  updated = updated.replace(/litedash/g, "glansk");

  if (updated !== content) {
    await writeFile(file, updated, "utf-8");
    modifiedCount++;
  }
}

console.log(`✓ Rebranded ${modifiedCount} files to Glansk!`);
