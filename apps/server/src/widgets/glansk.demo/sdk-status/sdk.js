// Glansk Widget SDK — canonical source.
//
// This file is the single authoritative implementation of the client-side SDK.
// Because sandboxed iframes run with an opaque ("null") origin (sandbox="allow-scripts"
// without allow-same-origin), they cannot import cross-origin or same-origin resources
// at runtime. Each packaged widget therefore ships a verbatim copy of this file as
// sdk.js in its own directory.
//
// When editing this file, update all copies:
//   src/widgets/glansk.demo/aurora-metric/sdk.js
//   src/widgets/glansk.demo/command-control/sdk.js
//   src/widgets/glansk.demo/sdk-status/sdk.js
//   src/widgets/glansk.demo/status-grid/sdk.js
//   src/widgets/glansk.demo/telemetry-chart/sdk.js
//   src/widgets/glansk.media/image-carousel/sdk.js
//
// API surface (resolved value of Glansk.connect()):
//   widget.identity      — { instanceId, packageId, widgetId }
//   widget.display       — { id, storageNamespace } | null
//                          null when rendering in the admin editor preview.
//                          storageNamespace is a deterministic, URL-safe key prefix
//                          scoped to display × package × widget × instance, for use
//                          with future host-brokered per-screen storage.
//                          NOTE: localStorage/sessionStorage/cookies/IndexedDB are
//                          unavailable in the null-origin sandbox — do not use them.
//   widget.onConfig(fn)  — subscribe to config updates; returns unsubscribe fn
//   widget.onDestroy(fn) — subscribe to destroy lifecycle; returns unsubscribe fn
//   widget.reportReady() — signal iframe is ready to display
//   widget.subscribe(channel, fn, opts?) — subscribe to a state channel; returns unsub fn
//   widget.command(cmd, payload, correlationId?) — send a command; returns Promise
//   widget.broadcast(topic, payload) — broadcast ephemeral event to canvas and screens
//   widget.onNotification(topic, fn) — subscribe to broadcast events; returns unsub fn

const PROTOCOL = 'glansk.widget.v1';
let hostOrigin, identity, display, nonce, config, resolveConnect, destroyed = false;
let connectTimer = null;
const configListeners = new Set(), destroyListeners = new Set(), subscriptions = new Map(), commands = new Map(), notifications = new Map(), fetches = new Map();
const storagePromises = new Map(), sharedListeners = new Map(), sharedCache = new Map(), sharedSaveTimers = new Map(), storageSaveTimers = new Map();
const connected = new Promise(resolve => resolveConnect = resolve);

const send = body => {
  if (!destroyed) parent.postMessage({ protocol: PROTOCOL, ...(identity ? { instanceId: identity.instanceId, nonce } : {}), ...body }, hostOrigin || '*');
};

const sendConnect = () => {
  if (!identity && !destroyed) send({ type: 'connect' });
};

addEventListener('message', event => {
  if (event.source !== parent || !event.data || event.data.protocol !== PROTOCOL) return;
  const data = event.data;

  // Initial handshake from the host — accept only once, before identity is bound.
  if (data.type === 'connected' && !identity) {
    if (connectTimer) {
      clearInterval(connectTimer);
      connectTimer = null;
    }
    hostOrigin = event.origin;
    identity = data.identity;
    // display is present only when rendered from a named kiosk target.
    // Admin editor previews intentionally omit it; expose null for consistent typing.
    display = data.display ?? null;
    nonce = data.nonce;
    config = data.config;
    resolveConnect(api);
    for (const listener of configListeners) listener(config);
    return;
  }

  // All subsequent messages must come from the same origin, source, identity, and nonce.
  if (event.origin !== hostOrigin || !identity || data.instanceId !== identity.instanceId || data.nonce !== nonce) return;

  if (data.type === 'config-update') {
    config = data.config;
    for (const listener of configListeners) listener(config);
  }
  if ((data.type === 'state' || data.type === 'state-error') && subscriptions.has(data.channel)) {
    for (const listener of subscriptions.get(data.channel)) listener(data.delivery || { kind: 'error', channel: data.channel, error: data.error });
  }
  if (data.type === 'notification' && notifications.has(data.topic)) {
    for (const listener of notifications.get(data.topic)) {
      try { listener(data.payload, data.meta); } catch (e) { console.error(e); }
    }
  }
  if (data.type === 'command-result' && commands.has(data.correlationId)) {
    commands.get(data.correlationId)(data);
    commands.delete(data.correlationId);
  }
  if (data.type === 'fetch-result' && fetches.has(data.correlationId)) {
    fetches.get(data.correlationId)(data);
    fetches.delete(data.correlationId);
  }
  if (data.type === 'storage-result' && storagePromises.has(data.correlationId)) {
    storagePromises.get(data.correlationId)(data);
    storagePromises.delete(data.correlationId);
  }
  if (data.type === 'shared-update' && typeof data.key === 'string') {
    sharedCache.set(data.key, { value: data.value, revision: data.revision || 0 });
    if (sharedListeners.has(data.key)) {
      for (const listener of sharedListeners.get(data.key)) {
        try { listener(data.value, data.meta || {}); } catch (e) { console.error(e); }
      }
    }
  }
  if (data.type === 'destroy' && !destroyed) {
    destroyed = true;
    if (connectTimer) {
      clearInterval(connectTimer);
      connectTimer = null;
    }
    for (const listener of destroyListeners) listener();
    for (const t of sharedSaveTimers.values()) clearTimeout(t);
    sharedSaveTimers.clear();
    for (const t of storageSaveTimers.values()) clearTimeout(t);
    storageSaveTimers.clear();
    configListeners.clear();
    destroyListeners.clear();
    subscriptions.clear();
    commands.clear();
    notifications.clear();
    fetches.clear();
    storagePromises.clear();
    sharedListeners.clear();
    sharedCache.clear();
  }
});

const api = {
  /**
   * The widget instance identity assigned by the host.
   * { instanceId, packageId, widgetId }
   */
  get identity() { return identity; },

  /**
   * Display context for this widget, or null when running in the admin editor
   * preview (which intentionally receives no display identity).
   *
   * When non-null:
   *   display.id               — opaque identifier for the physical screen
   *   display.storageNamespace — deterministic, URL-safe key prefix scoped to
   *                              display × package × widget × instance, for
   *                              future host-brokered per-screen storage.
   *
   * IMPORTANT: display identity is informational only. Do not use it to
   * authorize actions; all authorization is enforced server-side.
   */
  get display() { return display; },

  /** Subscribe to configuration updates from the host. Returns an unsubscribe function. */
  onConfig(listener) {
    configListeners.add(listener);
    if (config !== undefined) listener(config);
    return () => configListeners.delete(listener);
  },

  /** Subscribe to the destroy lifecycle event. Returns an unsubscribe function. */
  onDestroy(listener) {
    destroyListeners.add(listener);
    return () => destroyListeners.delete(listener);
  },

  /** Signal to the host that the widget iframe has rendered and is ready to display. */
  reportReady() { send({ type: 'ready' }); },

  /**
   * Subscribe to a state channel. `listener` is called with each delivery.
   * Returns an unsubscribe function.
   */
  subscribe(channel, listener, options = {}) {
    const listeners = subscriptions.get(channel) || new Set();
    listeners.add(listener);
    subscriptions.set(channel, listeners);
    send({ type: 'subscribe', channel, fromRevision: options.fromRevision });
    return () => {
      listeners.delete(listener);
      if (!listeners.size) { subscriptions.delete(channel); send({ type: 'unsubscribe', channel }); }
    };
  },

  /**
   * Send a host-declared command. Returns a Promise that resolves with the
   * command result when the host replies.
   */
  command(command, payload, correlationId = crypto.randomUUID()) {
    return new Promise(resolve => {
      commands.set(correlationId, resolve);
      send({ type: 'command', command, payload, correlationId });
    });
  },

  /**
   * Broadcast an ephemeral notification to other widgets on the canvas and across screens.
   */
  broadcast(topic, payload) {
    send({ type: 'broadcast', topic, payload });
  },

  /**
   * Subscribe to an ephemeral notification topic. Returns an unsubscribe function.
   */
  onNotification(topic, listener) {
    const listeners = notifications.get(topic) || new Set();
    listeners.add(listener);
    notifications.set(topic, listeners);
    send({ type: 'notify-subscribe', topic });
    return () => {
      listeners.delete(listener);
      if (!listeners.size) {
        notifications.delete(topic);
        send({ type: 'notify-unsubscribe', topic });
      }
    };
  },

  /**
   * Perform a secure, host-brokered fetch to an external API.
   * Vault credentials ({{secret:<id>}}) are injected by the host.
   */
  fetch(url, options = {}) {
    const correlationId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      fetches.set(correlationId, result => {
        if (result.ok) {
          const headersMap = new Map();
          if (result.headers) {
            for (const [k, v] of Object.entries(result.headers)) {
              headersMap.set(k.toLowerCase(), v);
            }
          }
          resolve({
            ok: result.status >= 200 && result.status < 300,
            status: result.status,
            statusText: result.statusText,
            headers: {
              get: name => headersMap.get(name.toLowerCase()) ?? null,
              has: name => headersMap.has(name.toLowerCase()),
              entries: () => Array.from(headersMap.entries()),
            },
            text: async () => result.data ?? '',
            json: async () => JSON.parse(result.data ?? 'null'),
          });
        } else {
          const err = new Error(result.error?.message || 'Proxy fetch failed');
          err.code = result.error?.code;
          reject(err);
        }
      });
      send({
        type: 'fetch',
        correlationId,
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        timeoutMs: options.timeoutMs,
      });
    });
  },

  /**
   * Client-scoped personal storage (sandbox-safe equivalent of localStorage).
   * Persists on this browser profile across page refreshes under the client's ld_client_id cookie.
   * Fresh / empty when opened in an incognito window or separate browser.
   */
  storage: {
    get(key, defaultValue = undefined) {
      const correlationId = crypto.randomUUID();
      return new Promise(resolve => {
        storagePromises.set(correlationId, (res) => {
          if (res && res.ok && res.value !== null && res.value !== undefined) {
            resolve(res.value);
          } else {
            resolve(defaultValue);
          }
        });
        send({ type: 'storage-get', key, correlationId });
      });
    },

    set(key, value, debounceMs = 150) {
      return new Promise(resolve => {
        const correlationId = crypto.randomUUID();
        storagePromises.set(correlationId, () => resolve());
        const flush = () => {
          storageSaveTimers.delete(key);
          send({ type: 'storage-set', key, value, correlationId });
        };
        if (debounceMs <= 0) {
          if (storageSaveTimers.has(key)) {
            clearTimeout(storageSaveTimers.get(key));
            storageSaveTimers.delete(key);
          }
          flush();
        } else {
          if (storageSaveTimers.has(key)) {
            clearTimeout(storageSaveTimers.get(key));
          }
          storageSaveTimers.set(key, setTimeout(flush, debounceMs));
        }
      });
    },

    delete(key) {
      const correlationId = crypto.randomUUID();
      return new Promise(resolve => {
        storagePromises.set(correlationId, () => resolve());
        send({ type: 'storage-delete', key, correlationId });
      });
    },
  },

  /**
   * Real-time cross-kiosk shared state.
   * Persists to server disk and syncs live across all connected screens and kiosks (<50ms via SSE).
   */
  shared: {
    get(key, fallback = undefined) {
      const record = sharedCache.get(key);
      return record !== undefined ? record.value : fallback;
    },

    set(key, value, options = {}) {
      const debounceMs = options.debounceMs ?? 150;
      sharedCache.set(key, { value, revision: (sharedCache.get(key)?.revision || 0) + 1 });
      const flush = () => {
        sharedSaveTimers.delete(key);
        send({ type: 'shared-set', key, value });
      };
      if (debounceMs <= 0) {
        if (sharedSaveTimers.has(key)) {
          clearTimeout(sharedSaveTimers.get(key));
          sharedSaveTimers.delete(key);
        }
        flush();
      } else {
        if (sharedSaveTimers.has(key)) {
          clearTimeout(sharedSaveTimers.get(key));
        }
        sharedSaveTimers.set(key, setTimeout(flush, debounceMs));
      }
    },

    on(key, listener) {
      let listeners = sharedListeners.get(key);
      const isFirst = !listeners || listeners.size === 0;
      if (!listeners) {
        listeners = new Set();
        sharedListeners.set(key, listeners);
      }
      listeners.add(listener);

      if (isFirst) {
        send({ type: 'shared-subscribe', key });
      } else if (sharedCache.has(key)) {
        try { listener(sharedCache.get(key).value, { initial: true }); } catch (e) { console.error(e); }
      }

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          sharedListeners.delete(key);
          send({ type: 'shared-unsubscribe', key });
        }
      };
    },

    bind(key, options = {}) {
      const defVal = options.default;
      const debounceMs = options.debounceMs ?? 150;
      if (!sharedCache.has(key) && defVal !== undefined) {
        sharedCache.set(key, { value: defVal, revision: 0 });
      }
      if (options.onChange) {
        this.on(key, options.onChange);
      } else {
        if (!sharedListeners.has(key)) {
          sharedListeners.set(key, new Set());
          send({ type: 'shared-subscribe', key });
        }
      }
      return {
        get: () => this.get(key, defVal),
        set: (val) => this.set(key, val, { debounceMs }),
        subscribe: (fn) => this.on(key, fn),
      };
    },
  },

  /**
   * Unified reactive state handle helper.
   * Supports 'session' (plain in-memory), 'cookie' (widget.storage), and 'global' (widget.shared).
   */
  state(key, options = {}) {
    const scope = options.scope || 'global';
    if (scope === 'session') {
      let val = options.default;
      const subs = new Set();
      if (options.onChange) subs.add(options.onChange);
      return {
        get: () => val,
        set: (v) => { val = v; for (const fn of subs) fn(val, { from: 'local' }); },
        subscribe: (fn) => { subs.add(fn); fn(val, { from: 'initial' }); return () => subs.delete(fn); },
      };
    }
    if (scope === 'cookie') {
      let val = options.default;
      const subs = new Set();
      if (options.onChange) subs.add(options.onChange);
      this.storage.get(key, options.default).then(fetched => {
        if (fetched !== undefined && fetched !== null) {
          val = fetched;
          for (const fn of subs) fn(val, { from: 'initial' });
        }
      });
      return {
        get: () => val,
        set: (v) => { val = v; for (const fn of subs) fn(val, { from: 'local' }); this.storage.set(key, v, options.debounceMs); },
        subscribe: (fn) => { subs.add(fn); fn(val, { from: 'initial' }); return () => subs.delete(fn); },
      };
    }
    return this.shared.bind(key, options);
  },
};

globalThis.Glansk = {
  /** Initiate the host handshake. Returns a Promise that resolves to the widget API. */
  connect() {
    sendConnect();
    if (!connectTimer && !identity) {
      connectTimer = setInterval(sendConnect, 200);
    }
    return connected;
  },
};
