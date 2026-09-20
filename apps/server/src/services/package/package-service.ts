import { join, resolve } from "node:path";
import { readdir, readFile, writeFile, mkdir, rm, stat, rename } from "node:fs/promises";
import {
  type PackageManifest,
  type PackageKind,
  type WidgetDescriptor,
  type EmitterDescriptor,
  type PackageSigner,
  validatePackage,
} from "../../platform/package-validator";
import { extractZip, createZip } from "../../platform/archive";
import { registerPackageWidget, unregisterPackage } from "../../widgets/registry";
import { registerPackageWidget as registerSharedWidget, unregisterPackage as unregisterSharedWidget } from "../../shared/packaged-widget-registry";
import { normalizeManifestToV2, type PackageManifestV2, type LegacyAlias } from "../../platform/package-manifest-v2";
import { type WidgetDesignPreset } from "../../platform/design-preset-schema";

export class SignerMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignerMismatchError";
  }
}

export class PackageDowngradeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PackageDowngradeError";
  }
}

export interface ImportPackageOptions {
  allowUnsigned?: boolean;
  allowDowngrade?: boolean;
}

export interface PackageRecord {
  id: string;
  version: string;
  versionCode?: number | undefined;
  name: string;
  kind: PackageKind;
  description: string;
  author: string;
  entry?: string | undefined;
  files: Record<string, string>;
  capabilities: any;
  signature?: string | undefined;
  signerFingerprint?: string | undefined;
  signerPublicKey?: string | undefined;
  signer?: PackageSigner | undefined;
  keyId?: string | undefined;
  trusted: boolean;
  installedAt: string;
  updatedAt: string;
  widgets?: readonly any[] | undefined;
  emitters?: readonly any[] | undefined;
  manifestVersion?: number | undefined;
  presets?: readonly WidgetDesignPreset[] | undefined;
  aliases?: readonly LegacyAlias[] | undefined;
}

export interface RepositoryFeed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastSyncedAt?: string;
  packageCount?: number;
}

export interface CatalogItem {
  id: string;
  version: string;
  name: string;
  kind: PackageKind;
  description: string;
  author: string;
  downloadUrl: string;
  sha256?: string;
  capabilities: string[];
  repositoryName: string;
  repositoryUrl: string;
  widgets?: WidgetDescriptor[];
  emitters?: EmitterDescriptor[];
}

export interface CreatePackageInput {
  manifest: Partial<PackageManifest> & { id: string; version: string; name: string };
  files: Record<string, string | Uint8Array>;
  allowUnsigned?: boolean;
}

export interface PackageServiceOptions {
  onEmitterTelemetry?: (emitterId: string, data: Record<string, any>) => Promise<void>;
}

const hex = (b: ArrayBuffer) =>
  Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");

export class PackageService {
  private packagesDir: string;
  private reposFile: string;
  private records = new Map<string, PackageRecord>();
  private activePollers = new Map<string, ReturnType<typeof setInterval>>();
  private cachedCatalog: CatalogItem[] = [];
  private onEmitterTelemetry?: ((emitterId: string, data: Record<string, any>) => Promise<void>) | undefined;

  constructor(dataDirectory: string, options: PackageServiceOptions = {}) {
    this.packagesDir = resolve(dataDirectory, "packages");
    this.reposFile = resolve(dataDirectory, "repositories.json");
    this.onEmitterTelemetry = options.onEmitterTelemetry;
  }

  public async init(): Promise<void> {
    await mkdir(this.packagesDir, { recursive: true });
    await this.loadAllPackages();
  }

  public getPackagesDir(): string {
    return this.packagesDir;
  }

  private async loadAllPackages(): Promise<void> {
    try {
      const entries = await readdir(this.packagesDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pkgId = entry.name;
          try {
            const manifestPath = join(this.packagesDir, pkgId, "manifest.json");
            const manifestRaw = await readFile(manifestPath, "utf-8");
            const raw = JSON.parse(manifestRaw);
            const manifest = normalizeManifestToV2(raw);

            const authorStr = typeof manifest.author === "string"
              ? manifest.author
              : (manifest.author?.name || "Unknown");
            const entryPoint = manifest.widgets?.[0]?.entry;

            const record: PackageRecord = {
              id: manifest.id,
              version: manifest.version,
              versionCode: manifest.versionCode,
              name: manifest.name || manifest.id,
              kind: manifest.kind || (manifest.emitters && manifest.widgets ? "composite" : manifest.emitters ? "emitter" : "widget"),
              description: manifest.description || "",
              author: authorStr,
              entry: entryPoint,
              files: manifest.files || {},
              capabilities: manifest.capabilities || [],
              signature: manifest.signature,
              signerFingerprint: manifest.signer?.fingerprint,
              signerPublicKey: manifest.signer?.publicKey,
              signer: manifest.signer,
              keyId: manifest.keyId,
              trusted: Boolean(manifest.signature || manifest.signer),
              installedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              widgets: manifest.widgets,
              emitters: manifest.emitters,
              manifestVersion: manifest.manifestVersion,
              presets: manifest.presets,
              aliases: manifest.aliases,
            };

            this.records.set(pkgId, record);
            this.registerRuntimeArtifacts(record);
          } catch (err) {
            console.warn(`[PackageService] failed to load package ${pkgId}:`, err);
          }
        }
      }
    } catch {
      // directory might be empty or unreadable initially
    }
  }

  private registerRuntimeArtifacts(record: PackageRecord): void {
    // Register widgets in dynamic registries
    if (record.widgets && record.widgets.length > 0) {
      for (const w of record.widgets) {
        registerPackageWidget(record.id, w.id);
        registerSharedWidget(record.id, w.id);
      }
    } else if (record.entry && (record.kind === "widget" || record.kind === "composite")) {
      const widgetId = record.id.includes(".") ? record.id.split(".").pop()! : record.id;
      registerPackageWidget(record.id, widgetId);
      registerSharedWidget(record.id, widgetId);
    }

    // Register aliases so legacy widget IDs resolve to this package
    if (record.aliases && record.aliases.length > 0) {
      for (const alias of record.aliases) {
        registerPackageWidget(record.id, alias.legacyWidgetId);
        registerSharedWidget(record.id, alias.legacyWidgetId);
      }
    }

    // Start declarative pollers if configured
    if (record.emitters) {
      for (const e of record.emitters) {
        if (e.runtime === "declarative" && e.polling && e.polling.intervalMs >= 1000 && e.polling.url) {
          this.startDeclarativePoller(e.id, e.polling.url, e.polling.intervalMs);
        }
      }
    }
  }

  private unregisterRuntimeArtifacts(packageId: string): void {
    unregisterPackage(packageId);
    unregisterSharedWidget(packageId);

    const record = this.records.get(packageId);
    if (record?.emitters) {
      for (const e of record.emitters) {
        const timer = this.activePollers.get(e.id);
        if (timer) {
          clearInterval(timer);
          this.activePollers.delete(e.id);
        }
      }
    }
  }

  private startDeclarativePoller(emitterId: string, url: string, intervalMs: number): void {
    const existing = this.activePollers.get(emitterId);
    if (existing) clearInterval(existing);

    const poll = async () => {
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (res.ok) {
          const data = await res.json();
          if (this.onEmitterTelemetry) {
            await this.onEmitterTelemetry(emitterId, typeof data === "object" && data !== null ? data : { value: data });
          }
        }
      } catch (err) {
        console.warn(`[PackageService] declarative poller for ${emitterId} failed:`, err);
      }
    };

    // Run once after 100ms
    setTimeout(poll, 100);
    const timer = setInterval(poll, Math.max(1000, intervalMs));
    this.activePollers.set(emitterId, timer);
  }

  public listInstalled(filterKind?: PackageKind): PackageRecord[] {
    const list = Array.from(this.records.values());
    if (filterKind) {
      return list.filter(p => p.kind === filterKind);
    }
    return list;
  }

  public getInstalled(id: string): PackageRecord | null {
    return this.records.get(id) || null;
  }

  public async getPackageFiles(id: string): Promise<Record<string, string> | null> {
    const record = this.records.get(id);
    if (!record) return null;

    const pkgPath = join(this.packagesDir, id);
    const result: Record<string, string> = {};

    const readDirRecursive = async (dir: string, base: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await readDirRecursive(full, rel);
        } else if (entry.isFile()) {
          // Read text files, encode binaries if needed
          const buf = await readFile(full);
          const isText = rel.match(/\.(html|css|js|json|py|sh|txt|md|svg)$/i);
          result[rel] = isText ? new TextDecoder("utf-8").decode(buf) : `[binary: ${buf.byteLength} bytes]`;
        }
      }
    };

    await readDirRecursive(pkgPath, "");
    return result;
  }

  public async createPackage(input: CreatePackageInput): Promise<PackageRecord> {
    const { manifest: rawManifest, files, allowUnsigned = true } = input;
    const encoder = new TextEncoder();

    if (!rawManifest.id || !/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(rawManifest.id)) {
      throw new Error("Invalid package ID: must be 2-64 alphanumeric characters, dots, or dashes");
    }

    const filesMap = new Map<string, Uint8Array>();
    const fileHashes: Record<string, string> = {};

    for (const [name, content] of Object.entries(files)) {
      const cleanPath = name.replace(/\\/g, "/").replace(/^\/+/, "");
      if (cleanPath.includes("..") || cleanPath.includes("\0") || /^[a-zA-Z]:/.test(cleanPath)) {
        throw new Error(`Invalid file path in package: ${cleanPath}`);
      }
      const data = typeof content === "string" ? encoder.encode(content) : content;
      filesMap.set(cleanPath, data);
      const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(data).buffer);
      fileHashes[cleanPath] = hex(digest);
    }

    const kind: PackageKind = rawManifest.kind || (rawManifest.emitters && rawManifest.widgets ? "composite" : rawManifest.emitters ? "emitter" : "widget");

    const manifest: PackageManifest = {
      schemaVersion: 1,
      id: rawManifest.id,
      version: rawManifest.version || "1.0.0",
      ...(rawManifest.versionCode !== undefined ? { versionCode: rawManifest.versionCode } : {}),
      name: rawManifest.name || rawManifest.id,
      kind,
      description: rawManifest.description || "",
      author: rawManifest.author || "Admin",
      ...(rawManifest.entry ? { entry: rawManifest.entry } : {}),
      files: fileHashes,
      capabilities: rawManifest.capabilities || [],
      ...(rawManifest.signer ? { signer: rawManifest.signer } : {}),
      ...(rawManifest.widgets ? { widgets: rawManifest.widgets } : {}),
      ...(rawManifest.emitters ? { emitters: rawManifest.emitters } : {}),
    };

    // Auto-create default widget descriptor if needed
    if ((kind === "widget" || kind === "composite") && (!manifest.widgets || manifest.widgets.length === 0)) {
      const entryPoint = manifest.entry || "index.html";
      if (filesMap.has(entryPoint)) {
        const widgetId = manifest.id.includes(".") ? manifest.id.split(".").pop()! : manifest.id;
        manifest.widgets = [
          {
            id: widgetId,
            ...(manifest.name ? { name: manifest.name } : {}),
            entry: entryPoint,
            ...(manifest.description ? { description: manifest.description } : {}),
          },
        ];
        manifest.entry = entryPoint;
      }
    }

    // Auto-create manifest.json entry
    const manifestJsonText = JSON.stringify(manifest, null, 2);
    const manifestJsonBytes = encoder.encode(manifestJsonText);
    filesMap.set("manifest.json", manifestJsonBytes);
    const manifestDigest = await crypto.subtle.digest("SHA-256", new Uint8Array(manifestJsonBytes).buffer);
    manifest.files["manifest.json"] = hex(manifestDigest);

    // Validate package integrity and boundary
    const validation = await validatePackage(manifest, filesMap, new Map(), allowUnsigned);

    // Persist files to disk
    const targetDir = join(this.packagesDir, manifest.id);
    await rm(targetDir, { recursive: true, force: true });
    await mkdir(targetDir, { recursive: true });

    for (const [name, data] of filesMap.entries()) {
      const fullPath = join(targetDir, name);
      const parent = resolve(fullPath, "..");
      await mkdir(parent, { recursive: true });
      await writeFile(fullPath, data);
    }

    const v2 = normalizeManifestToV2(manifest);
    const record: PackageRecord = {
      id: manifest.id,
      version: manifest.version,
      versionCode: manifest.versionCode,
      name: manifest.name || manifest.id,
      kind: manifest.kind || "widget",
      description: manifest.description || "",
      author: manifest.author || "Admin",
      entry: manifest.entry,
      files: manifest.files,
      capabilities: manifest.capabilities,
      signature: manifest.signature,
      signerFingerprint: validation.signerFingerprint || manifest.signer?.fingerprint,
      signerPublicKey: validation.signerPublicKey || manifest.signer?.publicKey,
      signer: manifest.signer,
      keyId: manifest.keyId,
      trusted: validation.trusted,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: manifest.widgets,
      emitters: manifest.emitters,
      manifestVersion: v2.manifestVersion,
      presets: v2.presets,
      aliases: v2.aliases,
    };

    this.records.set(manifest.id, record);
    this.registerRuntimeArtifacts(record);

    return record;
  }

  public async importFromZip(
    archiveData: Uint8Array,
    optionsOrAllowUnsigned: boolean | ImportPackageOptions = true
  ): Promise<PackageRecord> {
    const options: ImportPackageOptions =
      typeof optionsOrAllowUnsigned === "boolean"
        ? { allowUnsigned: optionsOrAllowUnsigned, allowDowngrade: false }
        : { allowUnsigned: true, allowDowngrade: false, ...optionsOrAllowUnsigned };
    const allowUnsigned = options.allowUnsigned !== false;
    const allowDowngrade = options.allowDowngrade === true;

    const extracted = extractZip(archiveData);

    const manifestBytes = extracted.get("manifest.json");
    if (!manifestBytes) {
      throw new Error("Invalid extension package: missing manifest.json at package root");
    }

    const manifestText = new TextDecoder("utf-8").decode(manifestBytes);
    let manifest: PackageManifest;
    try {
      manifest = JSON.parse(manifestText);
    } catch {
      throw new Error("Invalid manifest.json: syntax error");
    }

    // Validate package
    const validation = await validatePackage(manifest, extracted, new Map(), allowUnsigned);

    // Origin Continuity (Signer Pinning) and Anti-Rollback (Downgrade Prevention)
    const existing = this.records.get(manifest.id);
    if (existing) {
      // 1. Signer Pinning: If an installed package was signed, any update must have the exact same signer fingerprint
      if (existing.signerFingerprint) {
        const newFingerprint = validation.signerFingerprint || manifest.signer?.fingerprint;
        if (!newFingerprint || newFingerprint.toLowerCase() !== existing.signerFingerprint.toLowerCase()) {
          throw new SignerMismatchError(
            `Update rejected: package signer does not match installed developer origin for '${manifest.id}'. Installed: ${existing.signerFingerprint}, Provided: ${newFingerprint ?? "unsigned"}`
          );
        }
      }

      // 2. Anti-Rollback: Monotonic versionCode check
      if (existing.versionCode !== undefined && manifest.versionCode !== undefined) {
        if (manifest.versionCode < existing.versionCode) {
          if (!allowDowngrade) {
            throw new PackageDowngradeError(
              `Cannot downgrade package '${manifest.id}' from versionCode ${existing.versionCode} to ${manifest.versionCode}. Enable downgrade override to proceed.`
            );
          }
        }
      }
    }

    // Atomic disk extraction using temporary staging directory
    const targetDir = join(this.packagesDir, manifest.id);
    const stagingDir = join(this.packagesDir, `.tmp-pkg-${manifest.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    try {
      await mkdir(stagingDir, { recursive: true });

      for (const [name, data] of extracted.entries()) {
        const fullPath = join(stagingDir, name);
        const parent = resolve(fullPath, "..");
        await mkdir(parent, { recursive: true });
        await writeFile(fullPath, data);
      }

      // Staging write succeeded; atomically replace targetDir
      await rm(targetDir, { recursive: true, force: true });
      await rename(stagingDir, targetDir);
    } catch (err) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
      throw err;
    }

    const v2 = normalizeManifestToV2(manifest);
    const record: PackageRecord = {
      id: manifest.id,
      version: manifest.version,
      versionCode: manifest.versionCode,
      name: manifest.name || manifest.id,
      kind: manifest.kind || (manifest.emitters && manifest.widgets ? "composite" : manifest.emitters ? "emitter" : "widget"),
      description: manifest.description || "",
      author: typeof manifest.author === "string" ? manifest.author : (manifest.author?.name || "Unknown"),
      entry: manifest.entry,
      files: manifest.files,
      capabilities: manifest.capabilities || [],
      signature: manifest.signature,
      signerFingerprint: validation.signerFingerprint || manifest.signer?.fingerprint,
      signerPublicKey: validation.signerPublicKey || manifest.signer?.publicKey,
      signer: manifest.signer,
      keyId: manifest.keyId,
      trusted: validation.trusted,
      installedAt: existing?.installedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: manifest.widgets,
      emitters: manifest.emitters,
      manifestVersion: v2.manifestVersion,
      presets: v2.presets,
      aliases: v2.aliases,
    };

    if (existing) {
      this.unregisterRuntimeArtifacts(manifest.id);
    }
    this.records.set(manifest.id, record);
    this.registerRuntimeArtifacts(record);

    return record;
  }

  public async importFromUrl(
    url: string,
    optionsOrAllowUnsigned: boolean | ImportPackageOptions = true
  ): Promise<PackageRecord> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid URL: must be HTTP or HTTPS");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Failed to download package from URL: HTTP ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get("content-type") || "";
      const buf = new Uint8Array(await res.arrayBuffer());

      if (contentType.includes("application/zip") || url.endsWith(".zip") || url.endsWith(".glpkg")) {
        return await this.importFromZip(buf, optionsOrAllowUnsigned);
      }

      // Check for ZIP magic bytes (PK\x03\x04)
      if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04) {
        return await this.importFromZip(buf, optionsOrAllowUnsigned);
      }

      throw new Error("Unsupported remote package format: must be a ZIP or .glpkg archive");
    } finally {
      clearTimeout(timeout);
    }
  }

  public async updatePackageFiles(id: string, fileUpdates: Record<string, string>): Promise<PackageRecord> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Package '${id}' not found`);
    }

    const targetDir = join(this.packagesDir, id);
    const encoder = new TextEncoder();

    // Read all existing files
    const allFiles = new Map<string, Uint8Array>();
    const readDirRecursive = async (dir: string, base: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await readDirRecursive(full, rel);
        } else if (entry.isFile()) {
          allFiles.set(rel, new Uint8Array(await readFile(full)));
        }
      }
    };
    await readDirRecursive(targetDir, "");

    // Apply updates
    for (const [name, content] of Object.entries(fileUpdates)) {
      const clean = name.replace(/\\/g, "/").replace(/^\/+/, "");
      if (clean.includes("..") || clean.includes("\0") || /^[a-zA-Z]:/.test(clean)) {
        throw new Error(`Invalid file path in update: ${clean}`);
      }
      allFiles.set(clean, encoder.encode(content));
    }

    // Recompute hashes
    const newHashes: Record<string, string> = {};
    for (const [name, bytes] of allFiles.entries()) {
      if (name === "manifest.json") continue;
      const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
      newHashes[name] = hex(digest);
    }

    // Update manifest
    const manifestBytes = allFiles.get("manifest.json");
    let manifest: PackageManifest;
    if (manifestBytes) {
      manifest = JSON.parse(new TextDecoder("utf-8").decode(manifestBytes));
    } else {
      manifest = {
        schemaVersion: 1,
        id: record.id,
        version: record.version,
        name: record.name,
        kind: record.kind,
        files: {},
        capabilities: record.capabilities,
      };
    }
    manifest.files = newHashes;

    const manifestText = JSON.stringify(manifest, null, 2);
    const updatedManifestBytes = encoder.encode(manifestText);
    allFiles.set("manifest.json", updatedManifestBytes);
    const manifestDigest = await crypto.subtle.digest("SHA-256", updatedManifestBytes.buffer);
    manifest.files["manifest.json"] = hex(manifestDigest);

    // Validate
    await validatePackage(manifest, allFiles, new Map(), true);

    // Save updated files to disk
    for (const [name, bytes] of allFiles.entries()) {
      const fullPath = join(targetDir, name);
      const parent = resolve(fullPath, "..");
      await mkdir(parent, { recursive: true });
      await writeFile(fullPath, bytes);
    }

    record.files = manifest.files;
    record.updatedAt = new Date().toISOString();
    this.records.set(id, record);

    // Re-register runtime artifacts
    this.unregisterRuntimeArtifacts(id);
    this.registerRuntimeArtifacts(record);

    return record;
  }

  public async exportPackageZip(id: string): Promise<Uint8Array> {
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`Package '${id}' not found`);
    }

    const targetDir = join(this.packagesDir, id);
    const files = new Map<string, Uint8Array>();

    const readDirRecursive = async (dir: string, base: string) => {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const rel = base ? `${base}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await readDirRecursive(full, rel);
        } else if (entry.isFile()) {
          files.set(rel, new Uint8Array(await readFile(full)));
        }
      }
    };

    await readDirRecursive(targetDir, "");
    return createZip(files);
  }

  public async uninstallPackage(id: string): Promise<boolean> {
    const record = this.records.get(id);
    if (!record) return false;

    this.unregisterRuntimeArtifacts(id);
    this.records.delete(id);

    const targetDir = join(this.packagesDir, id);
    await rm(targetDir, { recursive: true, force: true });
    return true;
  }

  // --- Repository & Catalog Methods ---

  public async listRepositories(): Promise<RepositoryFeed[]> {
    try {
      const raw = await readFile(this.reposFile, "utf-8");
      return JSON.parse(raw);
    } catch {
      // Default curated repo feed
      return [
        {
          id: "official",
          name: "Glansk Official Extensions",
          url: "https://raw.githubusercontent.com/glansk/extensions/main/index.json",
          enabled: true,
          packageCount: 6,
        },
      ];
    }
  }

  public async saveRepositories(repos: RepositoryFeed[]): Promise<void> {
    await writeFile(this.reposFile, JSON.stringify(repos, null, 2), "utf-8");
  }

  public async addRepository(name: string, url: string): Promise<RepositoryFeed> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Invalid repository URL: must be HTTP or HTTPS");
    }
    const repos = await this.listRepositories();
    const id = `repo-${Date.now().toString(36)}`;
    const newRepo: RepositoryFeed = {
      id,
      name: name.trim() || "Community Feed",
      url: url.trim(),
      enabled: true,
    };
    repos.push(newRepo);
    await this.saveRepositories(repos);
    return newRepo;
  }

  public async removeRepository(id: string): Promise<boolean> {
    const repos = await this.listRepositories();
    const filtered = repos.filter(r => r.id !== id);
    if (filtered.length === repos.length) return false;
    await this.saveRepositories(filtered);
    return true;
  }

  public async syncCatalog(): Promise<CatalogItem[]> {
    const repos = await this.listRepositories();
    const aggregated: CatalogItem[] = [];

    // Always include built-in curated packages in the catalog
    aggregated.push(
      {
        id: "glansk.gauge.circular",
        version: "1.2.0",
        name: "Circular Arc Gauge",
        kind: "widget",
        description: "Responsive SVG radial gauge with dynamic range, tick marks, and state binding",
        author: "Glansk Team",
        downloadUrl: "/api/v1/packages/templates/circular-gauge.glpkg",
        capabilities: ["interactive-state"],
        repositoryName: "Glansk Core",
        repositoryUrl: "builtin",
      },
      {
        id: "glansk.media.controller",
        version: "2.0.1",
        name: "Universal Media Controller",
        kind: "widget",
        description: "Playback controller tile with album art, scrub bar, and multi-emitter routing",
        author: "Glansk Team",
        downloadUrl: "/api/v1/packages/templates/media-controller.glpkg",
        capabilities: ["emitter-controls"],
        repositoryName: "Glansk Core",
        repositoryUrl: "builtin",
      },
      {
        id: "glansk.emitter.rest-poller",
        version: "1.0.0",
        name: "HTTP REST API Poller",
        kind: "emitter",
        description: "Declarative background poller pushing external JSON APIs into Glansk state relay",
        author: "Glansk Team",
        downloadUrl: "/api/v1/packages/templates/rest-poller.glpkg",
        capabilities: ["telemetry-emitter"],
        repositoryName: "Glansk Core",
        repositoryUrl: "builtin",
      },
      {
        id: "glansk.emitter.sys-metrics",
        version: "1.4.0",
        name: "System Telemetry Daemon",
        kind: "emitter",
        description: "Python host telemetry daemon reporting CPU, memory, storage, and thermal metrics",
        author: "Glansk Team",
        downloadUrl: "/api/v1/packages/templates/sys-metrics.glpkg",
        capabilities: ["telemetry-emitter"],
        repositoryName: "Glansk Core",
        repositoryUrl: "builtin",
      },
      {
        id: "glansk.composite.gpio-bridge",
        version: "1.1.0",
        name: "GPIO Sensor & Relay Suite",
        kind: "composite",
        description: "Complete package bundling a Python GPIO bridge daemon and an interactive canvas toggle tile",
        author: "Glansk Team",
        downloadUrl: "/api/v1/packages/templates/gpio-suite.glpkg",
        capabilities: ["hardware-gpio", "interactive-state"],
        repositoryName: "Glansk Core",
        repositoryUrl: "builtin",
      }
    );

    // Sync remote feeds with 5s timeout
    for (const repo of repos) {
      if (!repo.enabled || repo.url === "builtin") continue;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(repo.url, { signal: controller.signal });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json() as { packages?: any[] };
          if (Array.isArray(data.packages)) {
            repo.packageCount = data.packages.length;
            repo.lastSyncedAt = new Date().toISOString();
            for (const p of data.packages) {
              if (p.id && p.name) {
                aggregated.push({
                  id: p.id,
                  version: p.version || "1.0.0",
                  name: p.name,
                  kind: p.kind || "widget",
                  description: p.description || "",
                  author: p.author || repo.name,
                  downloadUrl: p.downloadUrl || "",
                  sha256: p.sha256,
                  capabilities: p.capabilities || [],
                  repositoryName: repo.name,
                  repositoryUrl: repo.url,
                  widgets: p.widgets,
                  emitters: p.emitters,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[PackageService] failed to sync repository ${repo.name} (${repo.url}):`, err);
      }
    }

    await this.saveRepositories(repos);
    this.cachedCatalog = aggregated;
    return aggregated;
  }

  public getStarterTemplates(): Array<{
    id: string;
    name: string;
    kind: PackageKind;
    description: string;
    files: Record<string, string>;
  }> {
    return [
      {
        id: "glansk.gauge.circular",
        name: "Circular Arc Gauge",
        kind: "widget",
        description: "Responsive SVG radial gauge with dynamic range, tick marks, and state binding",
        files: {
          "manifest.json": JSON.stringify(
            {
              schemaVersion: 1,
              id: "glansk.gauge.circular",
              name: "Circular Arc Gauge",
              version: "1.0.0",
              kind: "widget",
              description: "Responsive SVG radial gauge reacting to state channel deltas",
              author: "Glansk",
              entry: "index.html",
              capabilities: ["interactive-state"],
              widgets: [
                {
                  id: "circular-gauge",
                  name: "Circular Arc Gauge",
                  entry: "index.html",
                  defaultGeometry: { w: 3, h: 3 },
                },
              ],
            },
            null,
            2
          ),
          "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Circular Arc Gauge</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="gauge-container">
    <svg class="gauge-svg" viewBox="0 0 120 120">
      <circle class="gauge-bg" cx="60" cy="60" r="50"></circle>
      <circle class="gauge-progress" id="progressArc" cx="60" cy="60" r="50"></circle>
    </svg>
    <div class="gauge-value" id="valDisplay">0%</div>
    <div class="gauge-label" id="labelDisplay">Telemetry</div>
  </div>
  <script src="/shared/widget-sdk.js"></script>
  <script src="main.js"></script>
</body>
</html>`,
          "styles.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: transparent;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  overflow: hidden;
}
.gauge-container {
  position: relative;
  width: 100%;
  max-width: 160px;
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.gauge-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.gauge-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.08);
  stroke-width: 10;
}
.gauge-progress {
  fill: none;
  stroke: #38bdf8;
  stroke-width: 10;
  stroke-linecap: round;
  stroke-dasharray: 314.159;
  stroke-dashoffset: 314.159;
  transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease;
}
.gauge-value {
  position: absolute;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f8fafc;
  text-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.gauge-label {
  position: absolute;
  bottom: 18%;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
}`,
          "main.js": `const arc = document.getElementById("progressArc");
const valDisplay = document.getElementById("valDisplay");
const labelDisplay = document.getElementById("labelDisplay");
const circumference = 2 * Math.PI * 50;

function setProgress(percent, label) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const offset = circumference - (p / 100) * circumference;
  arc.style.strokeDashoffset = offset;
  valDisplay.textContent = Math.round(p) + "%";
  if (label) labelDisplay.textContent = label;
  if (p > 85) arc.style.stroke = "#ef4444";
  else if (p > 65) arc.style.stroke = "#f59e0b";
  else arc.style.stroke = "#38bdf8";
}

setProgress(42, "CPU LOAD");

if (window.GlanskSDK) {
  GlanskSDK.init({
    onState: (state) => {
      if (state && typeof state.value !== "undefined") {
        setProgress(state.value, state.label || "SENSOR");
      }
    }
  });
}`,
        },
      },
      {
        id: "glansk.emitter.rest-poller",
        name: "HTTP REST API Poller",
        kind: "emitter",
        description: "Declarative background poller pushing external JSON APIs into Glansk state relay",
        files: {
          "manifest.json": JSON.stringify(
            {
              schemaVersion: 1,
              id: "glansk.emitter.rest-poller",
              name: "HTTP REST API Poller",
              version: "1.0.0",
              kind: "emitter",
              description: "Declarative background poller pushing external JSON APIs into Glansk state relay",
              author: "Glansk",
              capabilities: ["telemetry-emitter"],
              emitters: [
                {
                  id: "rest-poller-1",
                  name: "REST API Poller",
                  category: "custom",
                  runtime: "declarative",
                  polling: {
                    intervalMs: 5000,
                    url: "https://httpbin.org/json",
                  },
                },
              ],
            },
            null,
            2
          ),
          "README.md": `# HTTP REST API Poller
This extension periodically fetches a JSON endpoint and forwards the payload to the Glansk Universal Emitter Relay.

## Configuration
Edit \`manifest.json\` to customize:
- \`polling.url\`: Target JSON endpoint
- \`polling.intervalMs\`: Interval in milliseconds (minimum 1000ms)
`,
        },
      },
      {
        id: "glansk.emitter.sys-metrics",
        name: "System Telemetry Daemon",
        kind: "emitter",
        description: "Python host telemetry daemon reporting CPU, memory, storage, and thermal metrics",
        files: {
          "manifest.json": JSON.stringify(
            {
              schemaVersion: 1,
              id: "glansk.emitter.sys-metrics",
              name: "System Telemetry Daemon",
              version: "1.0.0",
              kind: "emitter",
              description: "Python host telemetry daemon reporting CPU, memory, storage, and thermal metrics",
              author: "Glansk",
              capabilities: ["telemetry-emitter"],
              emitters: [
                {
                  id: "sys-metrics-daemon",
                  name: "Host System Daemon",
                  category: "system",
                  runtime: "python",
                  entry: "daemon.py",
                },
              ],
            },
            null,
            2
          ),
          "daemon.py": `#!/usr/bin/env python3
"""
Glansk Host Telemetry Daemon
Collects CPU, memory, and disk usage and reports to Glansk Emitter API.
Requires Python 3.6+ (No external pip dependencies required).
"""
import sys, time, json, urllib.request, os

SERVER = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
EMITTER_ID = "sys-metrics-daemon"

def get_cpu():
    try:
        with open("/proc/loadavg", "r") as f:
            return float(f.read().split()[0]) * 10
    except:
        return 25.0

def get_mem():
    try:
        with open("/proc/meminfo", "r") as f:
            lines = f.readlines()
            total = int(lines[0].split()[1])
            free = int(lines[1].split()[1])
            return round((1.0 - (free / total)) * 100, 1)
    except:
        return 42.0

def main():
    print(f"[+] Glansk Telemetry Daemon started -> {SERVER}")
    endpoint = f"{SERVER}/api/v1/emitters/{EMITTER_ID}/state"
    while True:
        payload = {
            "state": {
                "cpu": get_cpu(),
                "memory": get_mem(),
                "timestamp": int(time.time()),
                "status": "online"
            }
        }
        try:
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                pass
        except Exception as e:
            print(f"[!] Warning: failed to send telemetry: {e}")
        time.sleep(3)

if __name__ == "__main__":
    main()
`,
        },
      },
    ];
  }

  public getStarterTemplateZip(templateId: string): Uint8Array | null {
    const template = this.getStarterTemplates().find(t => t.id === templateId);
    if (!template) return null;
    return createZip(template.files);
  }

  public generateRepositoryIndex(origin: string): {
    schemaVersion: 1;
    name: string;
    description: string;
    updatedAt: string;
    packages: Array<{
      id: string;
      version: string;
      name: string;
      kind: PackageKind;
      description: string;
      author: string;
      downloadUrl: string;
      capabilities: string[];
      widgets?: readonly any[] | undefined;
      emitters?: readonly any[] | undefined;
    }>;
  } {
    const packages = Array.from(this.records.values()).map(p => ({
      id: p.id,
      version: p.version,
      name: p.name,
      kind: p.kind,
      description: p.description,
      author: p.author,
      downloadUrl: `${origin}/api/v1/packages/${encodeURIComponent(p.id)}/export`,
      capabilities: p.capabilities,
      ...(p.widgets ? { widgets: p.widgets } : {}),
      ...(p.emitters ? { emitters: p.emitters } : {}),
    }));

    return {
      schemaVersion: 1,
      name: "Glansk Node Repository Hub",
      description: "Local package repository hosted on Glansk node",
      updatedAt: new Date().toISOString(),
      packages,
    };
  }
}

