#!/usr/bin/env bun
/**
 * End-to-End Test Harness: Widget Cryptographic Signing, Signer Pinning,
 * Anti-Rollback & Live Server Asset Delivery.
 */

import { rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  generateDeveloperKeypair,
  validateAndPack,
  verifyPackageArchive,
} from "../packages/widget-sdk/cli/glansk-widget";

const SERVER_URL = process.env.SERVER_URL || "http://127.0.0.1:38490";
const WORK_DIR = resolve(".tmp", "e2e-signing-test");
const STRESS_SUITE_DIR = resolve("packages", "widgets", "stress-suite");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  bold: "\x1b[1m",
};

function log(stage: string, message: string) {
  console.log(`${colors.cyan}[${stage}]${colors.reset} ${message}`);
}

function pass(message: string) {
  console.log(`  ${colors.green}✓ PASS:${colors.reset} ${message}`);
}

function fail(message: string): never {
  console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${message}`);
  process.exit(1);
}

async function main() {
  console.log(`\n${colors.bold}=== Glansk Cryptographic Package Signing & Live Import E2E Test ===${colors.reset}`);
  console.log(`Target Server: ${SERVER_URL}`);
  console.log(`Working Directory: ${WORK_DIR}\n`);

  // 0. Verify server connectivity
  log("SETUP", "Checking server health...");
  try {
    const healthRes = await fetch(`${SERVER_URL}/health`);
    if (!healthRes.ok) fail(`Server returned HTTP ${healthRes.status}`);
    pass(`Connected to server at ${SERVER_URL}`);
  } catch (err: any) {
    fail(`Could not connect to server at ${SERVER_URL}: ${err.message}`);
  }

  // Ensure clean baseline: uninstall prior test package if present on server
  try {
    await fetch(`${SERVER_URL}/api/v1/packages/glansk.stress-test`, { method: "DELETE" });
  } catch {}

  // Clean and prepare working directories
  await rm(WORK_DIR, { recursive: true, force: true });
  await mkdir(join(WORK_DIR, "keys", "authorized"), { recursive: true });
  await mkdir(join(WORK_DIR, "keys", "attacker"), { recursive: true });
  await mkdir(join(WORK_DIR, "dist"), { recursive: true });

  // 1. Generate Two Ed25519 Developer Keypairs
  log("STAGE 1", "Generating Developer Keypairs via WebCrypto Ed25519...");
  const devA = await generateDeveloperKeypair();
  const devB = await generateDeveloperKeypair();

  const devAPrivPath = join(WORK_DIR, "keys", "authorized", "developer.private.key");
  const devAPubPath = join(WORK_DIR, "keys", "authorized", "developer.public.key");
  await writeFile(devAPrivPath, devA.privateKey, "utf-8");
  await writeFile(devAPubPath, devA.publicKey, "utf-8");

  const devBPrivPath = join(WORK_DIR, "keys", "attacker", "attacker.private.key");
  const devBPubPath = join(WORK_DIR, "keys", "attacker", "attacker.public.key");
  await writeFile(devBPrivPath, devB.privateKey, "utf-8");
  await writeFile(devBPubPath, devB.publicKey, "utf-8");

  if (!devA.fingerprint.startsWith("SHA256:") || !devB.fingerprint.startsWith("SHA256:")) {
    fail("Key fingerprints must start with SHA256:<hex>");
  }
  if (devA.fingerprint === devB.fingerprint) {
    fail("Developer A and Developer B fingerprints must be distinct");
  }

  pass(`Developer A (Authorized): ${devA.fingerprint}`);
  pass(`Developer B (Attacker):   ${devB.fingerprint}`);

  // 2. Package & Sign Quantum Reactor Stress Suite (v1.0.0, versionCode: 100)
  log("STAGE 2", "Packaging & Cryptographically Signing Stress Suite (v1.0.0, versionCode: 100)...");
  const pkgV1Path = join(WORK_DIR, "dist", "glansk.stress-test-1.0.0.glpkg");
  const packV1Res = await validateAndPack(STRESS_SUITE_DIR, {
    outputPath: pkgV1Path,
    signKeyPath: devAPrivPath,
    publicKeyPath: devAPubPath,
    versionCode: 100,
  });

  if (!packV1Res.success) fail(`Packaging failed: ${packV1Res.error}`);
  if (packV1Res.fingerprint !== devA.fingerprint) fail("Package fingerprint does not match Developer A");
  pass(`Created signed package: ${pkgV1Path}`);

  // 3. Local Archive Verification
  log("STAGE 3", "Verifying archive integrity with glansk-widget verify...");
  const verifyV1Res = await verifyPackageArchive(pkgV1Path);
  if (!verifyV1Res.success) fail(`Archive verification failed: ${verifyV1Res.error}`);
  if (!verifyV1Res.signed) fail("Archive expected to be signed");
  if (verifyV1Res.fingerprint !== devA.fingerprint) fail("Signer fingerprint mismatch");
  if (verifyV1Res.versionCode !== 100) fail(`Expected versionCode 100, got ${verifyV1Res.versionCode}`);
  pass(`Verified ${verifyV1Res.filesCount} file hashes, positive versionCode 100, and Ed25519 signature`);

  // 4. Import Baseline Package into Live Server
  log("STAGE 4", "Uploading signed package to live server via POST /api/v1/packages/import...");
  const pkgV1Bytes = new Uint8Array(await readFile(pkgV1Path));
  const importV1Res = await fetch(`${SERVER_URL}/api/v1/packages/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buffer: Buffer.from(pkgV1Bytes).toString("base64") }),
  });

  if (importV1Res.status !== 201) {
    const errText = await importV1Res.text();
    fail(`Import failed with HTTP ${importV1Res.status}: ${errText}`);
  }

  const importV1Body = await importV1Res.json() as any;
  if (importV1Body.package.id !== "glansk.stress-test") fail("Package ID mismatch");
  if (importV1Body.package.versionCode !== 100) fail("Package versionCode mismatch");
  if (importV1Body.package.signerFingerprint !== devA.fingerprint) fail("Signer fingerprint mismatch");
  if (!importV1Body.package.trusted) fail("Package should be marked trusted");
  pass(`Installed 'glansk.stress-test' v1.0.0 (versionCode: 100) with origin pinned to ${devA.fingerprint}`);

  // 5. Verify Live Asset Delivery & Hardened CSP
  log("STAGE 5", "Verifying live asset delivery and CSP headers...");
  const reactorRes = await fetch(`${SERVER_URL}/widgets/glansk.stress-test/quantum-reactor/index.html`);
  if (!reactorRes.ok) fail(`Failed to fetch quantum-reactor index.html: HTTP ${reactorRes.status}`);
  const reactorText = await reactorRes.text();
  if (!reactorText.includes("Quantum Reactor Core")) fail("Quantum Reactor markup not found");

  const cspHeader = reactorRes.headers.get("content-security-policy") || "";
  if (!cspHeader.includes("connect-src 'none'")) fail("Hardened CSP connect-src 'none' missing");
  pass("Quantum Reactor asset served with hardened sandbox CSP (connect-src 'none')");

  const controlRes = await fetch(`${SERVER_URL}/widgets/glansk.stress-test/mission-control/index.html`);
  if (!controlRes.ok) fail(`Failed to fetch mission-control index.html: HTTP ${controlRes.status}`);
  const controlText = await controlRes.text();
  if (!controlText.includes("Reactor Mission Control")) fail("Mission Control markup not found");
  pass("Reactor Mission Control asset served successfully");

  // 6. Signer Pinning Attack Simulation (Origin Hijack Defense)
  log("STAGE 6", "Simulating hostile origin hijack attempt with Developer B (Attacker Key)...");
  const pkgAttackerPath = join(WORK_DIR, "dist", "glansk.stress-test-attacker-2.0.0.glpkg");
  const packAttackerRes = await validateAndPack(STRESS_SUITE_DIR, {
    outputPath: pkgAttackerPath,
    signKeyPath: devBPrivPath,
    publicKeyPath: devBPubPath,
    versionCode: 200,
  });
  if (!packAttackerRes.success) fail(`Packaging attacker suite failed: ${packAttackerRes.error}`);

  const pkgAttackerBytes = new Uint8Array(await readFile(pkgAttackerPath));
  const hijackRes = await fetch(`${SERVER_URL}/api/v1/packages/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buffer: Buffer.from(pkgAttackerBytes).toString("base64") }),
  });

  if (hijackRes.status !== 400) {
    fail(`Server accepted unauthorized developer key! Expected HTTP 400, got ${hijackRes.status}`);
  }
  const hijackBody = await hijackRes.json() as any;
  if (hijackBody.code !== "signer_mismatch") {
    fail(`Expected error code 'signer_mismatch', got '${hijackBody.code}'`);
  }
  pass(`Attacker update rejected with HTTP 400 'signer_mismatch': ${hijackBody.message}`);

  // Confirm installed package wasn't altered
  const verifyState1 = await (await fetch(`${SERVER_URL}/api/v1/packages`)).json() as any[];
  const pkgRecord1 = verifyState1.find((p: any) => p.id === "glansk.stress-test");
  if (pkgRecord1.signerFingerprint !== devA.fingerprint || pkgRecord1.versionCode !== 100) {
    fail("Installed package corrupted by failed hijack attack!");
  }
  pass("Origin Pinning intact: installed package retains Developer A fingerprint and versionCode 100");

  // 7. Anti-Rollback Defense Simulation (Downgrade Attack)
  log("STAGE 7", "Simulating downgrade attack with versionCode 50 (< 100)...");
  const pkgDowngradePath = join(WORK_DIR, "dist", "glansk.stress-test-0.9.0.glpkg");
  const packDowngradeRes = await validateAndPack(STRESS_SUITE_DIR, {
    outputPath: pkgDowngradePath,
    signKeyPath: devAPrivPath,
    publicKeyPath: devAPubPath,
    versionCode: 50,
  });
  if (!packDowngradeRes.success) fail(`Packaging downgrade suite failed: ${packDowngradeRes.error}`);

  const pkgDowngradeBytes = new Uint8Array(await readFile(pkgDowngradePath));
  const downgradeRes = await fetch(`${SERVER_URL}/api/v1/packages/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buffer: Buffer.from(pkgDowngradeBytes).toString("base64") }),
  });

  if (downgradeRes.status !== 400) {
    fail(`Server accepted package downgrade without override! Expected HTTP 400, got ${downgradeRes.status}`);
  }
  const downgradeBody = await downgradeRes.json() as any;
  if (downgradeBody.code !== "downgrade_rejected") {
    fail(`Expected error code 'downgrade_rejected', got '${downgradeBody.code}'`);
  }
  pass(`Downgrade attempt blocked with HTTP 400 'downgrade_rejected': ${downgradeBody.message}`);

  // 8. Administrative Downgrade Override Test
  log("STAGE 8", "Testing administrative downgrade override with ?allowDowngrade=true...");
  const overrideRes = await fetch(`${SERVER_URL}/api/v1/packages/import?allowDowngrade=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buffer: Buffer.from(pkgDowngradeBytes).toString("base64") }),
  });

  if (overrideRes.status !== 201) {
    const errText = await overrideRes.text();
    fail(`Downgrade override failed with HTTP ${overrideRes.status}: ${errText}`);
  }
  const overrideBody = await overrideRes.json() as any;
  if (overrideBody.package.versionCode !== 50) fail("Version code should be updated to 50");
  pass("Administrative override succeeded: versionCode safely downgraded to 50");

  // 9. Legitimate Version Upgrade
  log("STAGE 9", "Testing legitimate upgrade to versionCode 120 with Developer A key...");
  const pkgUpgradePath = join(WORK_DIR, "dist", "glansk.stress-test-1.2.0.glpkg");
  const packUpgradeRes = await validateAndPack(STRESS_SUITE_DIR, {
    outputPath: pkgUpgradePath,
    signKeyPath: devAPrivPath,
    publicKeyPath: devAPubPath,
    versionCode: 120,
  });
  if (!packUpgradeRes.success) fail(`Packaging upgrade suite failed: ${packUpgradeRes.error}`);

  const pkgUpgradeBytes = new Uint8Array(await readFile(pkgUpgradePath));
  const upgradeRes = await fetch(`${SERVER_URL}/api/v1/packages/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ buffer: Buffer.from(pkgUpgradeBytes).toString("base64") }),
  });

  if (upgradeRes.status !== 201) {
    const errText = await upgradeRes.text();
    fail(`Upgrade failed with HTTP ${upgradeRes.status}: ${errText}`);
  }
  const upgradeBody = await upgradeRes.json() as any;
  if (upgradeBody.package.versionCode !== 120) fail("Version code should be updated to 120");
  if (upgradeBody.package.signerFingerprint !== devA.fingerprint) fail("Signer fingerprint mismatch");
  pass("Legitimate upgrade succeeded: installed version is now versionCode 120");

  // 10. Clean Final Audit
  log("STAGE 10", "Running final platform audit...");
  const finalPkgs = await (await fetch(`${SERVER_URL}/api/v1/packages`)).json() as any[];
  const finalRecord = finalPkgs.find((p: any) => p.id === "glansk.stress-test");
  if (!finalRecord) fail("Package not found in final catalog");
  if (finalRecord.versionCode !== 120) fail("Final versionCode not 120");
  if (finalRecord.signerFingerprint !== devA.fingerprint) fail("Final fingerprint mismatch");
  if (!finalRecord.trusted) fail("Final package not marked trusted");

  pass(`Final installed state verified: id=${finalRecord.id}, versionCode=${finalRecord.versionCode}, trusted=${finalRecord.trusted}`);
  pass(`Origin Fingerprint: ${finalRecord.signerFingerprint}`);

  console.log(`\n${colors.green}${colors.bold}=== ALL 10 E2E VERIFICATION STAGES PASSED PERFECTLY ===${colors.reset}\n`);
}

main().catch(err => {
  console.error(`Unhandled error in test runner:`, err);
  process.exit(1);
});
