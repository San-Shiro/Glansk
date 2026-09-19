import type { JsonValue } from "../../domain/types";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface StateRecord {
  state: JsonValue;
  revision: number;
  updatedAt: number;
}

export interface StateUpdateEvent {
  mode: "global" | "cookie";
  key: string;
  clientId?: string;
  senderId?: string;
  state: JsonValue;
  revision: number;
  updatedAt: number;
}

export interface PersistedInteractiveState {
  schemaVersion: 1;
  global: Record<string, StateRecord>;
  cookies: Record<string, Record<string, StateRecord>>;
}

export interface NotificationEvent {
  topic: string;
  payload: JsonValue;
  senderId?: string;
  sessionId?: string;
  timestamp: number;
}

export class InteractiveStateService {
  readonly #root: string;
  readonly #file: string;
  readonly #global = new Map<string, StateRecord>();
  readonly #cookies = new Map<string, Map<string, StateRecord>>();
  readonly #subscribers = new Set<(event: StateUpdateEvent) => void>();
  readonly #notificationSubscribers = new Set<(event: NotificationEvent) => void>();
  #saveTimer: ReturnType<typeof setTimeout> | null = null;
  #isSaving = false;

  constructor(dataDirectory: string) {
    this.#root = resolve(dataDirectory);
    this.#file = join(this.#root, "interactive-state.json");
  }

  async initialize(): Promise<void> {
    await mkdir(this.#root, { recursive: true });
    try {
      const raw = await readFile(this.#file, "utf8");
      const data = JSON.parse(raw) as PersistedInteractiveState;
      if (data.schemaVersion === 1) {
        if (data.global && typeof data.global === "object") {
          for (const [k, v] of Object.entries(data.global)) {
            if (v && typeof v === "object" && "state" in v) {
              this.#global.set(k, {
                state: v.state,
                revision: Number(v.revision) || 1,
                updatedAt: Number(v.updatedAt) || Date.now(),
              });
            }
          }
        }
        if (data.cookies && typeof data.cookies === "object") {
          for (const [clientId, userMap] of Object.entries(data.cookies)) {
            if (userMap && typeof userMap === "object") {
              const inner = new Map<string, StateRecord>();
              for (const [k, v] of Object.entries(userMap)) {
                if (v && typeof v === "object" && "state" in v) {
                  inner.set(k, {
                    state: v.state,
                    revision: Number(v.revision) || 1,
                    updatedAt: Number(v.updatedAt) || Date.now(),
                  });
                }
              }
              this.#cookies.set(clientId, inner);
            }
          }
        }
      }
    } catch {
      // If file does not exist yet, start with fresh empty state
    }
  }

  getGlobal(key: string): StateRecord | undefined {
    return this.#global.get(key);
  }

  async setGlobal(key: string, state: JsonValue, senderId?: string): Promise<StateRecord> {
    const prev = this.#global.get(key);
    const nextRevision = (prev?.revision ?? 0) + 1;
    const record: StateRecord = {
      state,
      revision: nextRevision,
      updatedAt: Date.now(),
    };
    this.#global.set(key, record);
    this.#scheduleSave();

    const event: StateUpdateEvent = {
      mode: "global",
      key,
      ...(senderId !== undefined ? { senderId } : {}),
      state,
      revision: record.revision,
      updatedAt: record.updatedAt,
    };
    for (const sub of this.#subscribers) {
      try { sub(event); } catch {}
    }

    return record;
  }

  getCookie(clientId: string, key: string): StateRecord | undefined {
    return this.#cookies.get(clientId)?.get(key);
  }

  async setCookie(clientId: string, key: string, state: JsonValue, senderId?: string): Promise<StateRecord> {
    let userMap = this.#cookies.get(clientId);
    if (!userMap) {
      userMap = new Map<string, StateRecord>();
      this.#cookies.set(clientId, userMap);
    }
    const prev = userMap.get(key);
    const nextRevision = (prev?.revision ?? 0) + 1;
    const record: StateRecord = {
      state,
      revision: nextRevision,
      updatedAt: Date.now(),
    };
    userMap.set(key, record);
    this.#scheduleSave();

    const event: StateUpdateEvent = {
      mode: "cookie",
      key,
      clientId,
      ...(senderId !== undefined ? { senderId } : {}),
      state,
      revision: record.revision,
      updatedAt: record.updatedAt,
    };
    for (const sub of this.#subscribers) {
      try { sub(event); } catch {}
    }

    return record;
  }

  subscribe(cb: (event: StateUpdateEvent) => void): () => void {
    this.#subscribers.add(cb);
    return () => {
      this.#subscribers.delete(cb);
    };
  }

  /**
   * Ephemeral notification publish — bypasses disk persistence completely.
   */
  publishNotification(topic: string, payload: JsonValue, senderId?: string, sessionId?: string): NotificationEvent {
    const event: NotificationEvent = {
      topic,
      payload,
      ...(senderId !== undefined ? { senderId } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
      timestamp: Date.now(),
    };
    for (const sub of this.#notificationSubscribers) {
      try { sub(event); } catch {}
    }
    return event;
  }

  /**
   * Subscribe to ephemeral notifications.
   */
  onNotification(cb: (event: NotificationEvent) => void): () => void {
    this.#notificationSubscribers.add(cb);
    return () => {
      this.#notificationSubscribers.delete(cb);
    };
  }

  #scheduleSave(): void {
    if (this.#saveTimer) return;
    this.#saveTimer = setTimeout(() => {
      this.#saveTimer = null;
      this.#persist().catch(() => {});
    }, 150);
  }

  async #persist(): Promise<void> {
    if (this.#isSaving) {
      this.#scheduleSave();
      return;
    }
    this.#isSaving = true;
    try {
      const data: PersistedInteractiveState = {
        schemaVersion: 1,
        global: Object.fromEntries(this.#global.entries()),
        cookies: {},
      };
      for (const [cId, map] of this.#cookies.entries()) {
        data.cookies[cId] = Object.fromEntries(map.entries());
      }

      const tempFile = `${this.#file}.${crypto.randomUUID()}.tmp`;
      const handle = await open(tempFile, "wx");
      try {
        await handle.writeFile(`${JSON.stringify(data, null, 2)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tempFile, this.#file);
    } catch {
      // Continue safely if concurrent write occurred
    } finally {
      this.#isSaving = false;
    }
  }
}
