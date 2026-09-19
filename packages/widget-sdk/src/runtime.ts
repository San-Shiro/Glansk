import {
  WIDGET_PROTOCOL,
  type ConnectedPayload,
  type WidgetIdentity,
  type DisplayIdentity,
  type WidgetPresetTokens,
  type WidgetCustomTab,
  type WidgetOutputVariableDef,
  type WidgetFetchInit,
  type WidgetResponse,
  type WidgetResponseHeaders,
  type Unsubscribe,
} from "./contracts";

export interface WidgetContext<C = Record<string, unknown>> {
  readonly instanceId: string;
  readonly identity: WidgetIdentity;
  readonly config: Readonly<C>;
  readonly display?: Readonly<DisplayIdentity> | undefined;
  readonly preset?: Readonly<WidgetPresetTokens> | undefined;

  readonly http: {
    fetch(url: string, init?: WidgetFetchInit): Promise<WidgetResponse>;
    get<T = unknown>(url: string, init?: Omit<WidgetFetchInit, "method" | "body">): Promise<T>;
    post<T = unknown>(url: string, body?: unknown, init?: Omit<WidgetFetchInit, "method" | "body">): Promise<T>;
  };

  readonly events: {
    subscribe(topic: string, handler: (data: unknown) => void): Unsubscribe;
    publish(topic: string, data: unknown): void;
  };

  readonly commands: {
    invoke<T = unknown>(command: string, payload?: unknown): Promise<T>;
  };

  readonly notifications: {
    subscribe(topic: string, handler: (payload: unknown) => void): Unsubscribe;
  };

  readonly telemetry: {
    emit(metric: string, value: unknown): void;
  };

  readonly variables: {
    get<T = unknown>(name: string): T | undefined;
    set(name: string, value: unknown): void;
    update(name: string, updater: (prev: unknown) => unknown): void;
    watch<T = unknown>(name: string, handler: (value: T, prev: T) => void): Unsubscribe;
    getAll(): Readonly<Record<string, unknown>>;
    setOutput(name: string, value: unknown): void;
    getOutput<T = unknown>(name: string): T | undefined;
  };

  readonly output: {
    set(name: string, value: unknown): void;
    get<T = unknown>(name: string): T | undefined;
    getVariableName(name: string): string;
  };
}

export interface WidgetDefinition<C = Record<string, unknown>> {
  readonly customTabs?: readonly WidgetCustomTab[] | undefined;
  readonly outputVariables?: Record<string, WidgetOutputVariableDef> | undefined;
  mount(context: WidgetContext<C>, container: HTMLElement): Unsubscribe | void | Promise<Unsubscribe | void>;
  configChanged?(newConfig: C, context: WidgetContext<C>): void;
  themeChanged?(preset: WidgetPresetTokens, context: WidgetContext<C>): void;
  destroy?(): void;
}

export class WidgetRuntime<C = Record<string, unknown>> {
  private instanceId = "";
  private nonce = "";
  private identity: WidgetIdentity = { instanceId: "", packageId: "", widgetId: "" };
  private config: C = {} as C;
  private display?: DisplayIdentity | undefined;
  private preset?: WidgetPresetTokens | undefined;
  private isConnected = false;
  private pendingOutbound: Array<Record<string, unknown>> = [];
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();
  private notifyHandlers = new Map<string, Set<(payload: unknown) => void>>();
  private pendingCommands = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
  private pendingFetches = new Map<string, { resolve: (val: WidgetResponse) => void; reject: (err: any) => void }>();
  private variables = new Map<string, unknown>();
  private variableWatchers = new Map<string, Set<(val: any, prev: any) => void>>();
  private messageListener?: (event: MessageEvent) => void;
  private cleanupMount?: Unsubscribe | void;

  constructor(
    private definition: WidgetDefinition<C>,
    private container?: HTMLElement,
    private messageBus: {
      postMessage: (msg: any, targetOrigin: string) => void;
      addEventListener: (type: string, listener: any) => void;
      removeEventListener: (type: string, listener: any) => void;
    } = typeof window !== "undefined"
      ? {
          postMessage: (m, o) => window.parent?.postMessage(m, o),
          addEventListener: (t, l) => window.addEventListener(t, l),
          removeEventListener: (t, l) => window.removeEventListener(t, l),
        }
      : {
          postMessage: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        }
  ) {}

  public init(containerElement?: HTMLElement): void {
    if (containerElement) this.container = containerElement;

    this.messageListener = (event: any) => {
      this.handleHostMessage(event);
    };
    this.messageBus.addEventListener("message", this.messageListener);

    // Send initial handshake request to host
    this.postToHost({
      protocol: WIDGET_PROTOCOL,
      type: "connect",
    });
  }

  private postToHost(msg: Record<string, unknown>): void {
    this.messageBus.postMessage(msg, "*");
  }

  private sendIdentified(type: string, extra: Record<string, unknown> = {}): void {
    const payload = {
      protocol: WIDGET_PROTOCOL,
      type,
      instanceId: this.instanceId,
      nonce: this.nonce,
      ...extra,
    };

    if (!this.isConnected) {
      this.pendingOutbound.push(payload);
    } else {
      this.postToHost(payload);
    }
  }

  private handleHostMessage(event: MessageEvent): void {
    const data = event.data;
    if (!data || typeof data !== "object" || data.protocol !== WIDGET_PROTOCOL) return;

    if (data.type === "connected") {
      this.handleConnected(data as ConnectedPayload<C>);
      return;
    }

    if (!this.isConnected || data.instanceId !== this.instanceId || data.nonce !== this.nonce) return;

    if (data.type === "notification") {
      const handlers = this.notifyHandlers.get(data.topic);
      if (handlers) {
        for (const h of handlers) h(data.payload);
      }
      return;
    }

    if (data.type === "broadcast") {
      const handlers = this.eventHandlers.get(data.topic);
      if (handlers) {
        for (const h of handlers) h(data.payload);
      }
      return;
    }

    if (data.type === "command_result" || data.type === "command-result") {
      const entry = this.pendingCommands.get(data.correlationId);
      if (entry) {
        this.pendingCommands.delete(data.correlationId);
        if (data.ok) entry.resolve(data.payload);
        else entry.reject(new Error(data.error || "command failed"));
      }
      return;
    }

    if (data.type === "fetch_result" || data.type === "fetch-result") {
      const entry = this.pendingFetches.get(data.correlationId);
      if (entry) {
        this.pendingFetches.delete(data.correlationId);
        if (data.ok) {
          const headersMap = new Map<string, string>();
          if (data.headers && typeof data.headers === "object") {
            for (const [k, v] of Object.entries(data.headers as Record<string, unknown>)) {
              headersMap.set(k.toLowerCase(), String(v));
            }
          }
          const headers: WidgetResponseHeaders = {
            get: (name: string) => headersMap.get(name.toLowerCase()) ?? null,
            has: (name: string) => headersMap.has(name.toLowerCase()),
            entries: () => Array.from(headersMap.entries()),
          };
          entry.resolve({
            ok: data.status >= 200 && data.status < 300,
            status: data.status,
            statusText: data.statusText || "",
            headers,
            text: async () => data.data ?? "",
            json: async <T = unknown>() => JSON.parse(data.data ?? "null") as T,
          });
        } else {
          const msg = data.error?.message || data.error?.code || "Fetch failed";
          const err = new Error(msg);
          (err as any).code = data.error?.code;
          entry.reject(err);
        }
      }
      return;
    }

    if ((data.type === "config_update" || data.type === "config-update") && data.config) {
      this.config = data.config;
      this.definition.configChanged?.(this.config, this.createContext());
      return;
    }

    if ((data.type === "theme_update" || data.type === "theme-update") && data.preset) {
      const preset = data.preset as WidgetPresetTokens;
      this.preset = preset;
      this.definition.themeChanged?.(preset, this.createContext());
      return;
    }

    if (data.type === "variable_update" || data.type === "variable-update") {
      const name = data.name as string;
      const nextVal = data.value;
      const prevVal = this.variables.get(name);
      this.variables.set(name, nextVal);
      if (data.variables && typeof data.variables === "object") {
        for (const [k, v] of Object.entries(data.variables as Record<string, unknown>)) {
          this.variables.set(k, v);
        }
      }
      if (Object.is(prevVal, nextVal)) return;
      const watchers = this.variableWatchers.get(name);
      if (watchers) {
        for (const w of watchers) {
          try { w(nextVal, prevVal); } catch (err) { console.error(err); }
        }
      }
      return;
    }
  }

  private async handleConnected(payload: ConnectedPayload<C>): Promise<void> {
    this.instanceId = payload.instanceId;
    this.nonce = payload.nonce;
    this.identity = payload.identity;
    this.config = payload.config;
    this.display = payload.display;
    this.preset = payload.preset;
    if (payload.variables && typeof payload.variables === "object") {
      for (const [k, v] of Object.entries(payload.variables)) {
        this.variables.set(k, v);
      }
    }
    this.isConnected = true;

    // Flush queued outbound messages
    while (this.pendingOutbound.length > 0) {
      const msg = this.pendingOutbound.shift()!;
      msg.instanceId = this.instanceId;
      msg.nonce = this.nonce;
      this.postToHost(msg);
    }

    // Mount widget
    if (this.container) {
      const ctx = this.createContext();
      this.cleanupMount = await this.definition.mount(ctx, this.container);
    }

    // Notify host that widget is mounted and ready
    this.sendIdentified("ready");
  }

  private createContext(): WidgetContext<C> {
    return {
      instanceId: this.instanceId,
      identity: this.identity,
      config: Object.freeze({ ...this.config }),
      display: this.display ? Object.freeze({ ...this.display }) : undefined,
      preset: this.preset ? Object.freeze({ ...this.preset }) : undefined,

      http: {
        fetch: (url: string, init?: WidgetFetchInit): Promise<WidgetResponse> => {
          return new Promise<WidgetResponse>((resolve, reject) => {
            const correlationId = "fetch_" + Math.random().toString(36).substring(2, 9);
            this.pendingFetches.set(correlationId, { resolve, reject });
            this.sendIdentified("fetch", {
              correlationId,
              url,
              method: init?.method ?? "GET",
              headers: init?.headers,
              body: init?.body,
              timeoutMs: init?.timeoutMs,
            });

            // Timeout client-side fallback after 16 seconds
            setTimeout(() => {
              if (this.pendingFetches.has(correlationId)) {
                this.pendingFetches.delete(correlationId);
                reject(new Error(`Fetch for '${url}' timed out`));
              }
            }, 16000);
          });
        },
        get: async <T = unknown>(url: string, init?: Omit<WidgetFetchInit, "method" | "body">): Promise<T> => {
          const res = await this.createContext().http.fetch(url, { ...init, method: "GET" });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json<T>();
        },
        post: async <T = unknown>(url: string, body?: unknown, init?: Omit<WidgetFetchInit, "method" | "body">): Promise<T> => {
          const res = await this.createContext().http.fetch(url, { ...init, method: "POST", body });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json<T>();
        },
      },

      events: {
        subscribe: (topic: string, handler: (data: unknown) => void) => {
          let set = this.eventHandlers.get(topic);
          if (!set) {
            set = new Set();
            this.eventHandlers.set(topic, set);
            this.sendIdentified("subscribe", { channel: topic });
          }
          set.add(handler);
          return () => {
            set!.delete(handler);
            if (set!.size === 0) {
              this.eventHandlers.delete(topic);
              this.sendIdentified("unsubscribe", { channel: topic });
            }
          };
        },
        publish: (topic: string, data: unknown) => {
          this.sendIdentified("broadcast", { topic, payload: data });
        },
      },

      commands: {
        invoke: <T = unknown>(command: string, payload?: unknown): Promise<T> => {
          return new Promise<T>((resolve, reject) => {
            const correlationId = "cmd_" + Math.random().toString(36).substring(2, 9);
            this.pendingCommands.set(correlationId, { resolve, reject });
            this.sendIdentified("command", { command, correlationId, payload });

            // Timeout after 8 seconds
            setTimeout(() => {
              if (this.pendingCommands.has(correlationId)) {
                this.pendingCommands.delete(correlationId);
                reject(new Error(`Command '${command}' timed out`));
              }
            }, 8000);
          });
        },
      },

      notifications: {
        subscribe: (topic: string, handler: (payload: unknown) => void) => {
          let set = this.notifyHandlers.get(topic);
          if (!set) {
            set = new Set();
            this.notifyHandlers.set(topic, set);
            this.sendIdentified("notify-subscribe", { topic });
          }
          set.add(handler);
          return () => {
            set!.delete(handler);
            if (set!.size === 0) {
              this.notifyHandlers.delete(topic);
              this.sendIdentified("notify-unsubscribe", { topic });
            }
          };
        },
      },

      telemetry: {
        emit: (metric: string, value: unknown) => {
          this.sendIdentified("telemetry", { metric, value });
        },
      },

      variables: {
        get: <T = unknown>(name: string): T | undefined => {
          return this.variables.get(name) as T | undefined;
        },
        set: (name: string, value: unknown): void => {
          const prev = this.variables.get(name);
          this.variables.set(name, value);
          this.sendIdentified("variable-set", { name, value });
          const watchers = this.variableWatchers.get(name);
          if (watchers) {
            for (const w of watchers) {
              try { w(value, prev); } catch (err) { console.error(err); }
            }
          }
        },
        update: (name: string, updater: (prev: unknown) => unknown): void => {
          const prev = this.variables.get(name);
          const next = updater(prev);
          this.variables.set(name, next);
          this.sendIdentified("variable-set", { name, value: next });
          const watchers = this.variableWatchers.get(name);
          if (watchers) {
            for (const w of watchers) {
              try { w(next, prev); } catch (err) { console.error(err); }
            }
          }
        },
        watch: <T = unknown>(name: string, handler: (value: T, prev: T) => void): Unsubscribe => {
          let set = this.variableWatchers.get(name);
          if (!set) {
            set = new Set();
            this.variableWatchers.set(name, set);
          }
          set.add(handler as (val: any, prev: any) => void);
          return () => {
            set!.delete(handler as (val: any, prev: any) => void);
            if (set!.size === 0) {
              this.variableWatchers.delete(name);
            }
          };
        },
        getAll: (): Readonly<Record<string, unknown>> => {
          const obj: Record<string, unknown> = {};
          for (const [k, v] of this.variables) {
            obj[k] = v;
          }
          return Object.freeze(obj);
        },
        setOutput: (name: string, value: unknown): void => {
          const varName = `wig${this.instanceId}-${name}`;
          const prev = this.variables.get(varName);
          this.variables.set(varName, value);
          this.sendIdentified("variable-set", { name: varName, value });
          const watchers = this.variableWatchers.get(varName);
          if (watchers) {
            for (const w of watchers) {
              try { w(value, prev); } catch (err) { console.error(err); }
            }
          }
          if (this.identity?.widgetId && this.identity.widgetId !== this.instanceId) {
            const aliasName = `wig${this.identity.widgetId}-${name}`;
            this.variables.set(aliasName, value);
            const aliasWatchers = this.variableWatchers.get(aliasName);
            if (aliasWatchers) {
              for (const w of aliasWatchers) {
                try { w(value, prev); } catch (err) { console.error(err); }
              }
            }
          }
        },
        getOutput: <T = unknown>(name: string): T | undefined => {
          const varName = `wig${this.instanceId}-${name}`;
          return this.variables.get(varName) as T | undefined;
        },
      },

      output: {
        set: (name: string, value: unknown): void => {
          const varName = `wig${this.instanceId}-${name}`;
          const prev = this.variables.get(varName);
          this.variables.set(varName, value);
          this.sendIdentified("variable-set", { name: varName, value });
          const watchers = this.variableWatchers.get(varName);
          if (watchers) {
            for (const w of watchers) {
              try { w(value, prev); } catch (err) { console.error(err); }
            }
          }
          if (this.identity?.widgetId && this.identity.widgetId !== this.instanceId) {
            const aliasName = `wig${this.identity.widgetId}-${name}`;
            this.variables.set(aliasName, value);
            const aliasWatchers = this.variableWatchers.get(aliasName);
            if (aliasWatchers) {
              for (const w of aliasWatchers) {
                try { w(value, prev); } catch (err) { console.error(err); }
              }
            }
          }
        },
        get: <T = unknown>(name: string): T | undefined => {
          const varName = `wig${this.instanceId}-${name}`;
          return this.variables.get(varName) as T | undefined;
        },
        getVariableName: (name: string): string => {
          return `wig${this.instanceId}-${name}`;
        },
      },
    };
  }

  public destroy(): void {
    if (this.cleanupMount) {
      try { this.cleanupMount(); } catch { /* ignore */ }
    }
    this.definition.destroy?.();
    if (this.messageListener) {
      this.messageBus.removeEventListener("message", this.messageListener);
    }
    this.eventHandlers.clear();
    this.notifyHandlers.clear();
    this.pendingCommands.clear();
    this.pendingFetches.clear();
    this.variableWatchers.clear();
  }
}
