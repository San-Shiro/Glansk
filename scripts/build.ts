import { cp, rm, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");

// 1. Build Studio SPA (Vite)
console.log("--> Building Glansk Studio SPA (apps/studio)...");
const studio = Bun.spawnSync(["bun", "run", "build"], {
  cwd: resolve(rootDir, "apps/studio"),
  stdout: "inherit",
  stderr: "inherit",
});
if (studio.exitCode !== 0) {
  console.error("Glansk Studio build failed");
  process.exit(1);
}

// 2. Build Widget SDK
console.log("--> Building Glansk Widget SDK (packages/widget-sdk)...");
const sdk = Bun.spawnSync(["bun", "run", "build"], {
  cwd: resolve(rootDir, "packages/widget-sdk"),
  stdout: "inherit",
  stderr: "inherit",
});
if (sdk.exitCode !== 0) {
  console.error("Widget SDK build failed");
  process.exit(1);
}

// 3. Bundle Bun Server
console.log("--> Bundling Glansk Server (apps/server)...");
const buildDir = resolve(rootDir, "build");
await rm(buildDir, { recursive: true, force: true });
await mkdir(buildDir, { recursive: true });

const result = await Bun.build({
  entrypoints: [resolve(rootDir, "apps/server/src/main.ts")],
  target: "bun",
  outdir: buildDir,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// 4. Copy static surfaces (admin, kiosk, shared, widgets)
await cp(resolve(rootDir, "apps/server/src/admin"), resolve(buildDir, "admin"), { recursive: true });
await cp(resolve(rootDir, "apps/server/src/kiosk"), resolve(buildDir, "kiosk"), { recursive: true });
await cp(resolve(rootDir, "apps/server/src/shared"), resolve(buildDir, "shared"), { recursive: true });
await cp(resolve(rootDir, "apps/server/src/widgets"), resolve(buildDir, "widgets"), { recursive: true });

console.log("✓ Successfully built Glansk monorepo (Studio, Server, SDK, and static surfaces)!");
