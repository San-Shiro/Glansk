import type { CanvasDocument, JsonValue, WidgetInstance } from "../../domain/types";
import type {
  EmitterCommand,
  EmitterCommandResult,
  EmitterManifest,
  EmitterRegistration,
  EmitterStatus,
} from "../../domain/emitter";
import type { CanvasService } from "../contracts";

export interface EmitterStateBroker {
  publish(channel: string, payload: Record<string, JsonValue>): void;
  subscribe?(channel: string, listener: (payload: Record<string, JsonValue>) => void): () => void;
}

export type CommandHandlerResponse = {
  ok?: boolean;
  correlationId?: string;
  error?: string;
  state?: Record<string, JsonValue>;
};

export type CommandHandler = (cmd: EmitterCommand) => Promise<CommandHandlerResponse | void> | CommandHandlerResponse | void;

export class EmitterService {
  private readonly emitters = new Map<string, EmitterRegistration>();
  private readonly commandHandlers = new Map<string, CommandHandler>();
  private readonly stateListeners = new Set<(emitter: EmitterRegistration) => void>();
  private readonly eventListeners = new Set<(event: { type: string; emitterId: string; data: any }) => void>();
  private readonly broker?: EmitterStateBroker | undefined;
  private canvases?: CanvasService | undefined;
  private sweeperTimer?: ReturnType<typeof setInterval> | undefined;

  constructor(brokerOrCanvases?: EmitterStateBroker | CanvasService, canvases?: CanvasService) {
    if (brokerOrCanvases && ("open" in brokerOrCanvases || "getDraft" in brokerOrCanvases)) {
      this.canvases = brokerOrCanvases as CanvasService;
      this.broker = undefined;
    } else {
      this.broker = brokerOrCanvases as EmitterStateBroker | undefined;
      this.canvases = canvases;
    }

    this.startSweeper();
  }

  setCanvases(canvases: CanvasService): void {
    this.canvases = canvases;
  }

  /**
   * Start periodic heartbeat check (Presence Plane).
   */
  startSweeper(intervalMs: number = 2000): void {
    if (this.sweeperTimer) return;
    this.sweeperTimer = setInterval(() => {
      this.sweepHeartbeats();
    }, intervalMs);
  }

  /**
   * Stop sweeper (useful for tests and shutdown).
   */
  stopSweeper(): void {
    if (this.sweeperTimer) {
      clearInterval(this.sweeperTimer);
      this.sweeperTimer = undefined;
    }
  }

  private sweepHeartbeats(): void {
    const now = Date.now();
    for (const [id, reg] of this.emitters.entries()) {
      if (reg.status === "terminated") continue;

      const ttlSec = reg.manifest.lifecycle?.ttlSeconds ?? 30;
      const staleSec = reg.manifest.lifecycle?.staleSeconds ?? 10;
      const elapsedSec = (now - reg.lastSeen) / 1000;

      if (elapsedSec > ttlSec) {
        if (reg.status !== "offline") {
          const updated: EmitterRegistration = { ...reg, status: "offline" };
          this.emitters.set(id, updated);
          this.notifyEvent("emitter_status", id, { id, status: "offline", lastSeen: reg.lastSeen });

          const offlineBehavior = reg.manifest.lifecycle?.offlineBehavior ?? (reg.manifest.lifecycle?.transient ? "auto-remove" : "retain-dormant");
          if (offlineBehavior === "auto-remove") {
            this.pruneWidget(id).catch(() => {});
            this.notifyEvent("emitter_pruned", id, { id });
          }
        }
      } else if (elapsedSec > staleSec) {
        if (reg.status === "online") {
          const updated: EmitterRegistration = { ...reg, status: "stale" };
          this.emitters.set(id, updated);
          this.notifyEvent("emitter_status", id, { id, status: "stale", lastSeen: reg.lastSeen });
        }
      } else {
        if (reg.status !== "online") {
          const updated: EmitterRegistration = { ...reg, status: "online" };
          this.emitters.set(id, updated);
          this.notifyEvent("emitter_status", id, { id, status: "online", lastSeen: reg.lastSeen });
        }
      }
    }
  }

  /**
   * Register or update an external emitter.
   */
  register(
    manifest: EmitterManifest,
    initialState: Record<string, JsonValue> = {},
    transport: "http" | "ws" | "tmpfs" = "http"
  ): EmitterRegistration {
    if (!manifest || !manifest.id || typeof manifest.id !== "string") {
      throw new Error("Invalid emitter manifest: id is required");
    }

    const cleanId = manifest.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const existing = this.emitters.get(cleanId);

    const registration: EmitterRegistration = {
      manifest: {
        ...manifest,
        id: cleanId,
        name: manifest.name || cleanId,
        category: manifest.category || "custom",
        controls: manifest.controls || [],
        ...(manifest.display !== undefined ? { display: manifest.display } : {}),
        ...(manifest.autoMount !== undefined ? { autoMount: manifest.autoMount } : {}),
        ...(manifest.lifecycle !== undefined ? { lifecycle: manifest.lifecycle } : {}),
      },
      state: { ...(existing?.state || {}), ...initialState },
      lastSeen: Date.now(),
      transport,
      status: "online",
      instanceId: existing?.instanceId,
      sequence: (existing?.sequence ?? 0) + 1,
    };

    this.emitters.set(cleanId, registration);
    this.broker?.publish(`emitters/${cleanId}`, registration.state);
    this.notifyStateListeners(registration);
    this.notifyEvent("emitter_update", cleanId, registration);

    if (registration.manifest.autoMount?.enabled) {
      this.autoMountWidget(registration).catch(() => {});
    }

    return registration;
  }

  /**
   * Ingest state published by an external emitter.
   */
  publishState(
    emitterId: string,
    state: Record<string, JsonValue>,
    transport: "http" | "ws" | "tmpfs" = "http",
    manifestUpdate?: Partial<EmitterManifest>
  ): EmitterRegistration {
    const cleanId = emitterId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    let registration = this.emitters.get(cleanId);

    if (!registration) {
      registration = this.register(
        {
          id: cleanId,
          name: cleanId.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          category: "custom",
          ...manifestUpdate,
        },
        state,
        transport
      );
    } else {
      const mergedManifest = manifestUpdate
        ? { ...registration.manifest, ...manifestUpdate }
        : registration.manifest;

      registration = {
        ...registration,
        manifest: mergedManifest,
        state: { ...registration.state, ...state },
        lastSeen: Date.now(),
        transport,
        status: "online",
        sequence: (registration.sequence ?? 0) + 1,
      };
      this.emitters.set(cleanId, registration);
      this.broker?.publish(`emitters/${cleanId}`, registration.state);
      this.notifyStateListeners(registration);
      this.notifyEvent("emitter_update", cleanId, registration);

      if (registration.manifest.autoMount?.enabled) {
        this.autoMountWidget(registration).catch(() => {});
      }
    }

    return registration;
  }

  /**
   * Auto-mount an emitter widget onto the target canvas if enabled.
   * Presence updates and routine heartbeats will NOT re-save drafts.
   */
  async autoMountWidget(registration: EmitterRegistration): Promise<void> {
    if (!this.canvases) return;
    const cleanId = registration.manifest.id;
    let targetCanvasId = registration.manifest.autoMount?.canvasId;

    if (!targetCanvasId || targetCanvasId === "active") {
      const list = await this.canvases.list();
      const showcase = list.find((c) => c.id === "glansk-demo-showcase");
      targetCanvasId = showcase ? showcase.id : list[0]?.id;
    }

    if (!targetCanvasId) return;

    try {
      const workspace = await this.canvases.open(targetCanvasId);
      if (!workspace) return;

      const doc = workspace.draft.document;
      const existingWidget = doc.widgets.find(
        (w) => w.config?.managedEmitterId === cleanId || w.config?.emitterId === cleanId
      );

      // Invariant: If widget already exists, do not clobber layout or trigger draft revisions on routine updates.
      if (existingWidget) {
        return;
      }

      // Compute non-overlapping layout slot
      const wWidth = registration.manifest.display?.defaultWidth ?? 380;
      const wHeight = registration.manifest.display?.defaultHeight ?? 240;
      const canvasWidth = doc.logicalSize?.width ?? 1280;
      const canvasHeight = doc.logicalSize?.height ?? 720;

      const { x, y } = this.calculateNextSlot(doc.widgets, wWidth, wHeight, canvasWidth, canvasHeight);

      const newWidget: WidgetInstance = {
        id: `em_${cleanId}_${Math.random().toString(36).slice(2, 8)}`,
        packageId: "glansk-core",
        widgetId: "emitter-widget",
        geometry: {
          x,
          y,
          width: wWidth,
          height: wHeight,
          zIndex: registration.manifest.display?.zIndex ?? 10,
        },
        config: {
          emitterId: cleanId,
          label: registration.manifest.name,
          category: registration.manifest.category,
          controls: (registration.manifest.controls || []) as unknown as JsonValue,
          managedBy: "emitter-auto-mount",
          managedEmitterId: cleanId,
          offlineBehavior:
            registration.manifest.lifecycle?.offlineBehavior ??
            (registration.manifest.lifecycle?.transient ? "auto-remove" : "retain-dormant"),
        },
      };

      const updatedDoc: CanvasDocument = {
        ...doc,
        widgets: [...doc.widgets, newWidget],
      };

      await this.canvases.save({
        document: updatedDoc,
        expectedDraftRevision: workspace.draft.draftRevision,
      });

      await this.canvases.publish(targetCanvasId);
    } catch (err) {
      console.warn(`[EmitterService] Auto-mount failed for ${cleanId}:`, err);
    }
  }

  /**
   * Calculate a non-overlapping coordinate for a new widget.
   */
  private calculateNextSlot(
    widgets: readonly WidgetInstance[],
    wWidth: number,
    wHeight: number,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } {
    const padding = 20;
    const cols = Math.max(1, Math.floor((canvasWidth - padding) / (wWidth + padding)));

    let col = 0;
    let row = 0;

    while (row < 20) {
      const candidateX = padding + col * (wWidth + padding);
      const candidateY = padding + row * (wHeight + padding);

      const overlaps = widgets.some((w) => {
        const wx = w.geometry.x;
        const wy = w.geometry.y;
        const ww = w.geometry.width;
        const wh = w.geometry.height;

        return !(
          candidateX + wWidth <= wx ||
          candidateX >= wx + ww ||
          candidateY + wHeight <= wy ||
          candidateY >= wy + wh
        );
      });

      if (!overlaps) {
        return { x: candidateX, y: candidateY };
      }

      col++;
      if (col >= cols) {
        col = 0;
        row++;
      }
    }

    return { x: padding, y: padding };
  }

  /**
   * Prune auto-mounted widgets for a given emitter from canvases.
   */
  async pruneWidget(emitterId: string): Promise<number> {
    if (!this.canvases) return 0;
    const cleanId = emitterId.trim().toLowerCase();
    let prunedCount = 0;

    try {
      const list = await this.canvases.list();
      for (const summary of list) {
        const workspace = await this.canvases.open(summary.id);
        if (!workspace) continue;

        const doc = workspace.draft.document;
        const remaining = doc.widgets.filter((w) => {
          const isManagedMatch =
            w.config?.managedBy === "emitter-auto-mount" &&
            (w.config?.managedEmitterId === cleanId || w.config?.emitterId === cleanId);
          return !isManagedMatch;
        });

        if (remaining.length !== doc.widgets.length) {
          prunedCount += doc.widgets.length - remaining.length;
          await this.canvases.save({
            document: { ...doc, widgets: remaining },
            expectedDraftRevision: workspace.draft.draftRevision,
          });
          await this.canvases.publish(summary.id);
        }
      }
    } catch (err) {
      console.warn(`[EmitterService] Prune failed for ${cleanId}:`, err);
    }

    return prunedCount;
  }

  /**
   * Cleanly unregister / shutdown an emitter.
   */
  async unregister(emitterId: string): Promise<boolean> {
    const cleanId = emitterId.trim().toLowerCase();
    const reg = this.emitters.get(cleanId);
    if (!reg) return false;

    const updated: EmitterRegistration = { ...reg, status: "terminated" };
    this.emitters.set(cleanId, updated);
    this.notifyEvent("emitter_status", cleanId, { id: cleanId, status: "terminated", lastSeen: reg.lastSeen });

    const offlineBehavior = reg.manifest.lifecycle?.offlineBehavior ?? (reg.manifest.lifecycle?.transient ? "auto-remove" : "retain-dormant");
    if (offlineBehavior === "auto-remove") {
      await this.pruneWidget(cleanId);
      this.notifyEvent("emitter_pruned", cleanId, { id: cleanId });
    }

    this.emitters.delete(cleanId);
    this.commandHandlers.delete(cleanId);
    return true;
  }

  /**
   * Retrieve an emitter by ID.
   */
  getEmitter(emitterId: string): EmitterRegistration | undefined {
    const cleanId = emitterId.trim().toLowerCase();
    return this.emitters.get(cleanId);
  }

  /**
   * List all registered emitters.
   */
  listEmitters(maxAgeMs: number = 120_000): EmitterRegistration[] {
    const now = Date.now();
    const result: EmitterRegistration[] = [];

    for (const [id, reg] of this.emitters.entries()) {
      if (now - reg.lastSeen > maxAgeMs && reg.transport === "ws") {
        this.emitters.delete(id);
      } else {
        result.push(reg);
      }
    }

    return result.sort((a, b) => b.lastSeen - a.lastSeen);
  }

  /**
   * Bind a bidirectional command handler for an emitter.
   */
  bindCommandHandler(emitterId: string, handler: CommandHandler): () => void {
    const cleanId = emitterId.trim().toLowerCase();
    this.commandHandlers.set(cleanId, handler);
    return () => {
      if (this.commandHandlers.get(cleanId) === handler) {
        this.commandHandlers.delete(cleanId);
      }
    };
  }

  /**
   * Route a user command from canvas UI to the emitter's active handler.
   */
  async dispatchCommand(
    emitterId: string,
    command: string,
    payload?: JsonValue,
    timeoutMs: number = 3000
  ): Promise<EmitterCommandResult> {
    const correlationId = `cmd_${Math.random().toString(36).slice(2, 10)}`;
    const cmdPromise = this.sendCommand({
      emitterId,
      controlId: command,
      command,
      payload: payload ?? null,
      correlationId,
    });

    if (timeoutMs <= 0) return cmdPromise;

    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<EmitterCommandResult>((resolve) => {
      timer = setTimeout(() => {
        resolve({
          ok: false,
          correlationId,
          error: `Command '${command}' timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });

    try {
      return await Promise.race([cmdPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer!);
    }
  }

  async sendCommand(command: EmitterCommand): Promise<EmitterCommandResult> {
    const cleanId = command.emitterId.trim().toLowerCase();
    const handler = this.commandHandlers.get(cleanId);

    if (!handler) {
      return {
        ok: false,
        correlationId: command.correlationId,
        error: `No active command receiver for emitter '${cleanId}'`,
      };
    }

    try {
      const res = await handler(command);
      if (res && typeof res === "object") {
        return {
          ok: res.ok !== false,
          correlationId: command.correlationId,
          ...(res.error !== undefined ? { error: res.error } : {}),
          ...(res.state !== undefined ? { state: res.state } : {}),
        };
      }
      return {
        ok: true,
        correlationId: command.correlationId,
      };
    } catch (err) {
      return {
        ok: false,
        correlationId: command.correlationId,
        error: (err as Error).message || "Command execution failed",
      };
    }
  }

  /**
   * Subscribe to local emitter state changes.
   */
  onStateChange(listener: (emitter: EmitterRegistration) => void): () => void {
    this.stateListeners.add(listener);
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Subscribe to all emitter lifecycle events (state updates, status transitions, pruning).
   */
  onEvent(listener: (event: { type: string; emitterId: string; data: any }) => void): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private notifyStateListeners(emitter: EmitterRegistration) {
    for (const listener of this.stateListeners) {
      try {
        listener(emitter);
      } catch {}
    }
  }

  private notifyEvent(type: string, emitterId: string, data: any) {
    for (const listener of this.eventListeners) {
      try {
        listener({ type, emitterId, data });
      } catch {}
    }
  }
}
