import { watch, readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join, basename } from "node:path";
import type { EmitterService } from "./emitter-service";
import type { EmitterCommand } from "../../domain/emitter";

export interface TmpfsWatcherOptions {
  directory?: string;
  debounceMs?: number;
}

export class TmpfsEmitterWatcher {
  private watcher?: ReturnType<typeof watch> | undefined;
  private readonly dir: string;
  private readonly debounceTimers = new Map<string, Timer>();
  private readonly debounceMs: number;
  private running = false;

  constructor(
    private readonly emitterService: EmitterService,
    options: TmpfsWatcherOptions = {}
  ) {
    // Priority: /dev/shm/glansk/emitters on Linux (RAM disk tmpfs), or fallback to .tmp/emitters
    if (options.directory) {
      this.dir = options.directory;
    } else if (process.platform === "linux" && existsSync("/dev/shm")) {
      this.dir = "/dev/shm/glansk/emitters";
    } else {
      this.dir = join(process.cwd(), ".tmp", "emitters");
    }
    this.debounceMs = options.debounceMs ?? 40;
  }

  get directory(): string {
    return this.dir;
  }

  start(): void {
    if (this.running) return;
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {}

    // 1. Initial scan of existing files
    this.scanDir();

    // 2. Watch for file updates
    try {
      this.watcher = watch(this.dir, (eventType, filename) => {
        if (!filename || typeof filename !== "string") return;
        if (!filename.endsWith(".json") || filename.endsWith(".cmd.json")) return;
        this.queueIngest(filename);
      });
      this.running = true;
    } catch (err) {
      console.warn(`[TmpfsEmitterWatcher] Could not watch ${this.dir}:`, err);
    }
  }

  stop(): void {
    if (this.watcher) {
      try {
        this.watcher.close();
      } catch {}
      this.watcher = undefined;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.running = false;
  }

  /**
   * Bind command listener to write <emitterId>.cmd.json into the tmpfs directory
   * so the external script/daemon can consume it.
   */
  bindCommandBridge(emitterId: string): () => void {
    return this.emitterService.bindCommandHandler(emitterId, async (cmd: EmitterCommand) => {
      try {
        const cmdPath = join(this.dir, `${emitterId}.cmd.json`);
        writeFileSync(cmdPath, JSON.stringify(cmd, null, 2), "utf8");
        return { ok: true, correlationId: cmd.correlationId };
      } catch (err) {
        return { ok: false, correlationId: cmd.correlationId, error: (err as Error).message };
      }
    });
  }

  private scanDir(): void {
    try {
      if (!existsSync(this.dir)) return;
      const files = readdirSync(this.dir);
      for (const file of files) {
        if (file.endsWith(".json") && !file.endsWith(".cmd.json")) {
          this.ingestFile(file);
        }
      }
    } catch {}
  }

  private queueIngest(filename: string): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(filename);
      this.ingestFile(filename);
    }, this.debounceMs);

    this.debounceTimers.set(filename, timer);
  }

  private ingestFile(filename: string): void {
    const fullPath = join(this.dir, filename);
    if (!existsSync(fullPath)) return;

    try {
      const content = readFileSync(fullPath, "utf8");
      if (!content.trim()) return;

      const parsed = JSON.parse(content);
      const emitterId = basename(filename, ".json");

      // Check if file is full manifest + state or just state
      if (parsed && typeof parsed === "object") {
        if (parsed.manifest && parsed.state) {
          this.emitterService.register(parsed.manifest, parsed.state, "tmpfs");
        } else {
          this.emitterService.publishState(emitterId, parsed, "tmpfs");
        }
        // Ensure command bridge is active for this emitter
        this.bindCommandBridge(emitterId);
      }
    } catch (err) {
      // Ignore transient read errors while external script is mid-write
    }
  }
}
