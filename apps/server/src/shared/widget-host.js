// Sandboxed-iframe host for packaged widgets. Shared by kiosk + admin so live
// widgets render and stream state identically in both surfaces.
import { WIDGET_PROTOCOL, acceptsWidgetEvent } from './widget-protocol.js';
import { packagedWidgetPath } from './packaged-widget-registry.js';
import { canvasBus, localSessionId } from './widget-event-bus.js';
import { getActiveVariableStore, resolveDynamicConfig } from './canvas-variables.js';

const entries = new Set();
const allowedChannels = widget => Array.isArray(widget.config?.channels) ? widget.config.channels : widget.config?.channel ? [widget.config.channel] : [];
const allowedCommands = widget => Array.isArray(widget.config?.commands) ? widget.config.commands : [];
const message = (entry, body) => entry.frame.contentWindow?.postMessage({ protocol: WIDGET_PROTOCOL, instanceId: entry.widget.id, nonce: entry.nonce, ...body }, '*');

export function broadcastVariableUpdate(name, value, variables) {
  for (const entry of entries) {
    message(entry, { type: 'variable-update', name, value, variables });
  }
}

// Subscribe to global canvas variable changes to forward updates to all widget iframes
canvasBus.subscribe('canvas:variables_changed', (evt) => {
  if (evt && evt.name) {
    broadcastVariableUpdate(evt.name, evt.value, evt.all);
    const store = getActiveVariableStore();
    // If any widget has dynamic config bindings, push updated config reactively
    for (const entry of entries) {
      if (entry.widget?.config && JSON.stringify(entry.widget.config).includes('$bind')) {
        const resolved = resolveDynamicConfig(entry.widget.config, store);
        message(entry, { type: 'config-update', config: resolved });
      }
    }
  }
});

// Compute a deterministic, URL-safe namespace scoped to display × package × widget × instance.
// Mirrors makeStorageNamespace in src/widget-sdk/contracts.ts — keep both in sync.
// encodeURIComponent encodes | to %7C, so | is unambiguous as a separator.
const makeStorageNamespace = (displayId, packageId, widgetId, instanceId) =>
  'gl_' + btoa([displayId, packageId, widgetId, instanceId].map(s => encodeURIComponent(s)).join('|'))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Shared SSE connection for cross-kiosk global updates
let sseSource = null;
function ensureHostSse() {
  if (typeof EventSource === 'undefined' || sseSource) return;
  try {
    sseSource = new EventSource('/api/v1/interactive-state/events');
    sseSource.addEventListener('state_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data && data.mode === 'global' && typeof data.key === 'string') {
          for (const entry of entries) {
            if (entry.sharedKeys?.has(data.key)) {
              message(entry, {
                type: 'shared-update',
                key: data.key,
                value: data.state,
                revision: data.revision,
                meta: { remote: true, from: data.senderId },
              });
            }
          }
        }
      } catch {}
    });
    sseSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  } catch {}
}

/**
 * Create a sandboxed iframe for a packaged widget.
 *
 * @param widget        Normalised widget descriptor (id, packageId, widgetId, config, geometry).
 * @param renderContext Optional context supplied by the calling surface. When
 *                      renderContext.display.id is set the widget's 'connected'
 *                      handshake will include a display object {id, storageNamespace}.
 *                      Admin editor previews never supply a renderContext, so they
 *                      receive no display identity — by design.
 */
export function createWidgetFrame(widget, renderContext) {
  const path = packagedWidgetPath(widget.packageId, widget.widgetId);
  if (!path) return undefined;
  const frame = document.createElement('iframe');
  frame.className = 'widget-frame';
  frame.title = String(widget.config?.label || 'Glansk widget');
  frame.sandbox = 'allow-scripts'; // intentionally NO allow-same-origin
  frame.src = path;
  frame.dataset.instanceId = widget.id;
  frame.dataset.ready = 'false';

  // Compute display identity only when the kiosk surface provides a display id.
  // The id comes from the host (kiosk URL path); it is never derived from the
  // widget message payload or from iframe query strings.
  const displayId = renderContext?.display?.id;
  const display = displayId
    ? { id: displayId, storageNamespace: makeStorageNamespace(displayId, widget.packageId, widget.widgetId, widget.id) }
    : undefined;

  entries.add({ frame, widget, nonce: crypto.randomUUID(), subscriptions: new Set(), notifyUnsubscribers: new Map(), sharedKeys: new Set(), display });
  return frame;
}

async function subscribe(entry, channel, fromRevision) {
  if (!allowedChannels(entry.widget).includes(channel)) return message(entry, { type: 'state-error', channel, error: 'channel_denied' });
  entry.subscriptions.add(channel);
  const query = new URLSearchParams({ instanceId: entry.widget.id, packageId: entry.widget.packageId, widgetId: entry.widget.widgetId, channel });
  if (Number.isSafeInteger(fromRevision)) query.set('fromRevision', String(fromRevision));
  const response = await fetch(`/api/v1/widget-state?${query}`);
  if (!response.ok) return message(entry, { type: 'state-error', channel, error: (await response.json()).code || 'state_error' });
  const delivery = await response.json(); message(entry, { type: 'state', channel, delivery });
  if (delivery.kind === 'snapshot' && channel === 'showcase/telemetry' && entry.subscriptions.has(channel) && delivery.revision < 3) queueMicrotask(() => subscribe(entry, channel, delivery.revision));
  if (delivery.kind === 'delta' && entry.subscriptions.has(channel) && delivery.toRevision < 3) queueMicrotask(() => subscribe(entry, channel, delivery.toRevision));
  if (delivery.kind === 'resync_required' && entry.subscriptions.has(channel)) queueMicrotask(() => subscribe(entry, channel));
}

async function command(entry, data) {
  if (!allowedCommands(entry.widget).includes(data.command)) return message(entry, { type: 'command-result', correlationId: data.correlationId, ok: false, error: 'command_denied' });
  const response = await fetch('/api/v1/widget-command', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instanceId: entry.widget.id, packageId: entry.widget.packageId, widgetId: entry.widget.widgetId, command: data.command, correlationId: data.correlationId, payload: data.payload }) });
  const body = await response.json(); message(entry, response.ok ? { type: 'command-result', ...body } : { type: 'command-result', correlationId: data.correlationId, ok: false, error: body.code || 'command_error' });
}

async function proxyFetch(entry, data) {
  try {
    const urlStr = String(data.url || '');

    // Dedicated internal host bridge path for /api/v1/interactive-state
    if (urlStr.startsWith('/api/v1/interactive-state')) {
      const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
      const method = (data.method || 'GET').toUpperCase();
      if (!allowedMethods.includes(method)) {
        return message(entry, {
          type: 'fetch-result',
          correlationId: data.correlationId,
          ok: false,
          error: { code: 'forbidden', message: 'Method not allowed for internal state bridge' },
        });
      }

      const response = await fetch(urlStr, {
        method,
        headers: { 'content-type': 'application/json', ...(data.headers || {}) },
        body: method !== 'GET' && data.body ? (typeof data.body === 'string' ? data.body : JSON.stringify(data.body)) : undefined,
        credentials: 'same-origin',
      });

      const responseText = await response.text();
      const responseHeaders = {};
      try {
        response.headers.forEach((v, k) => { responseHeaders[k] = v; });
      } catch {}

      return message(entry, {
        type: 'fetch-result',
        correlationId: data.correlationId,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseText,
      });
    }

    // Reject other relative URLs
    if (urlStr.startsWith('/') || !urlStr.includes('://')) {
      return message(entry, {
        type: 'fetch-result',
        correlationId: data.correlationId,
        ok: false,
        error: { code: 'forbidden', message: 'Invalid URL: relative URLs not permitted' },
      });
    }

    // Absolute external URLs proceed through widget proxy
    const response = await fetch('/api/v1/widget-proxy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        instanceId: entry.widget.id,
        packageId: entry.widget.packageId,
        widgetId: entry.widget.widgetId,
        url: data.url,
        method: data.method,
        headers: data.headers,
        body: data.body,
        timeoutMs: data.timeoutMs,
      }),
    });
    const body = await response.json();
    message(entry, {
      type: 'fetch-result',
      correlationId: data.correlationId,
      ...body,
    });
  } catch (err) {
    message(entry, {
      type: 'fetch-result',
      correlationId: data.correlationId,
      ok: false,
      error: { code: 'network_error', message: err?.message || 'Proxy fetch failed' },
    });
  }
}

export function clearWidgetFrames(reason = 'host-destroy') {
  for (const entry of entries) {
    message(entry, { type: 'destroy', reason });
    entry.subscriptions.clear();
    for (const unsub of entry.notifyUnsubscribers.values()) {
      try { unsub(); } catch {}
    }
    entry.notifyUnsubscribers.clear();
    entry.sharedKeys?.clear();
  }
  entries.clear();
  if (sseSource) {
    try { sseSource.close(); } catch {}
    sseSource = null;
  }
}
export function updateWidgetConfig(instanceId, config) {
  const entry = [...entries].find(item => item.widget.id === instanceId);
  if (!entry) return false;
  entry.widget = { ...entry.widget, config };
  const store = getActiveVariableStore();
  const resolved = resolveDynamicConfig(config, store);
  message(entry, { type: 'config-update', config: resolved });
  return true;
}

addEventListener('message', event => {
  const entry = [...entries].find(candidate => candidate.frame.contentWindow === event.source);
  if (!entry || !acceptsWidgetEvent(event, entry.frame.contentWindow, event.data?.type === 'connect' ? undefined : entry.widget.id, event.data?.type === 'connect' ? undefined : entry.nonce)) return;
  const data = event.data;
  if (data.type === 'connect') {
    // Build the connected handshake. Include display only when this render was
    // initiated from a named kiosk target — admin previews get no display identity.
    const store = getActiveVariableStore();
    const resolvedConfig = resolveDynamicConfig(entry.widget.config, store);
    const connectedBody = {
      type: 'connected',
      identity: { instanceId: entry.widget.id, packageId: entry.widget.packageId, widgetId: entry.widget.widgetId },
      config: resolvedConfig,
      variables: store ? store.getAll() : {},
    };
    if (entry.display) connectedBody.display = entry.display;
    message(entry, connectedBody);
  }
  if (data.type === 'ready') entry.frame.dataset.ready = 'true';
  if (data.type === 'variable-set') {
    const store = getActiveVariableStore();
    if (store && typeof data.name === 'string') {
      store.set(data.name, data.value);
    }
  }
  if (data.type === 'subscribe') void subscribe(entry, data.channel, Number.isSafeInteger(data.fromRevision) ? data.fromRevision : undefined);
  if (data.type === 'unsubscribe') entry.subscriptions.delete(data.channel);
  if (data.type === 'command') void command(entry, data);
  if (data.type === 'fetch') void proxyFetch(entry, data);
  if (data.type === 'storage-get') {
    fetch(`/api/v1/interactive-state?mode=cookie&key=${encodeURIComponent(data.key)}`, {
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        message(entry, {
          type: 'storage-result',
          correlationId: data.correlationId,
          ok: true,
          key: data.key,
          value: res?.state ?? null,
        });
      })
      .catch(err => {
        message(entry, {
          type: 'storage-result',
          correlationId: data.correlationId,
          ok: false,
          key: data.key,
          error: err?.message || 'Storage get failed',
        });
      });
  }
  if (data.type === 'storage-set') {
    fetch('/api/v1/interactive-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: 'cookie',
        key: data.key,
        state: data.value,
        senderId: entry.widget.id,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(() => {
        if (data.correlationId) {
          message(entry, {
            type: 'storage-result',
            correlationId: data.correlationId,
            ok: true,
            key: data.key,
            value: data.value,
          });
        }
      })
      .catch(err => {
        if (data.correlationId) {
          message(entry, {
            type: 'storage-result',
            correlationId: data.correlationId,
            ok: false,
            key: data.key,
            error: err?.message || 'Storage set failed',
          });
        }
      });
  }
  if (data.type === 'storage-delete') {
    fetch('/api/v1/interactive-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: 'cookie',
        key: data.key,
        state: null,
        senderId: entry.widget.id,
      }),
    })
      .then(() => {
        if (data.correlationId) {
          message(entry, {
            type: 'storage-result',
            correlationId: data.correlationId,
            ok: true,
            key: data.key,
          });
        }
      })
      .catch(() => {});
  }
  if (data.type === 'shared-subscribe') {
    if (!entry.sharedKeys) entry.sharedKeys = new Set();
    entry.sharedKeys.add(data.key);
    ensureHostSse();
    fetch(`/api/v1/interactive-state?mode=global&key=${encodeURIComponent(data.key)}`, {
      credentials: 'same-origin',
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res && res.state !== undefined && res.state !== null) {
          message(entry, {
            type: 'shared-update',
            key: data.key,
            value: res.state,
            revision: res.revision,
            meta: { initial: true },
          });
        }
      })
      .catch(() => {});
  }
  if (data.type === 'shared-unsubscribe') {
    entry.sharedKeys?.delete(data.key);
  }
  if (data.type === 'shared-set') {
    // 1. Immediately fan-out to other widget frames on the same canvas (0ms latency!)
    for (const other of entries) {
      if (other !== entry && other.sharedKeys?.has(data.key)) {
        message(other, {
          type: 'shared-update',
          key: data.key,
          value: data.value,
          meta: { remote: true, from: entry.widget.id },
        });
      }
    }
    // 2. Persist to server backend (which also sends SSE to other screens/kiosks)
    fetch('/api/v1/interactive-state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: 'global',
        key: data.key,
        state: data.value,
        senderId: entry.widget.id,
      }),
    }).catch(() => {});
  }
  if (data.type === 'broadcast') {
    // Local in-memory fan-out to all on-page widgets and canvas tiles
    canvasBus.publish(data.topic, data.payload, { from: entry.widget.id, timestamp: Date.now() });
    // Cross-screen propagation to server SSE broker
    fetch('/api/v1/widget-notify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic: data.topic, payload: data.payload, senderId: entry.widget.id, sessionId: localSessionId }),
    }).catch(() => {});
  }
  if (data.type === 'notify-subscribe') {
    if (!entry.notifyUnsubscribers.has(data.topic)) {
      const unsub = canvasBus.subscribe(data.topic, (payload, meta) => {
        message(entry, { type: 'notification', topic: data.topic, payload, meta });
      });
      entry.notifyUnsubscribers.set(data.topic, unsub);
    }
  }
  if (data.type === 'notify-unsubscribe') {
    const unsub = entry.notifyUnsubscribers.get(data.topic);
    if (unsub) {
      unsub();
      entry.notifyUnsubscribers.delete(data.topic);
    }
  }
});
