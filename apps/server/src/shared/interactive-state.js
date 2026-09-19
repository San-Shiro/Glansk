// Interactive State Bridge for Glansk Widgets
// Provides three-tier state management:
// 1. 'global': Server-stored, synchronized in real-time across all windows, tabs, and kiosk screens.
// 2. 'cookie': Server-stored, keyed by client cookie (ld_client_id) so each user has their own persistent state.
// 3. 'stateless': Ephemeral in-memory state that resets on reload.

import { canvasBus, localSessionId } from './widget-event-bus.js';

const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ld_interactive_state') : null;

// Shared SSE connection for global updates
let sseSource = null;
let sseSubscribers = new Set();

function getFallbackClientId() {
  try {
    let id = localStorage.getItem('ld_client_id');
    if (!id) {
      id = 'cid_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('ld_client_id', id);
    }
    return id;
  } catch {
    return 'cid_default';
  }
}

export function ensureSseConnection() {
  if (typeof EventSource === 'undefined') return;
  if (sseSource) return;

  try {
    sseSource = new EventSource('/api/v1/interactive-state/events');
    sseSource.addEventListener('state_update', (e) => {
      try {
        const data = JSON.parse(e.data);
        for (const sub of sseSubscribers) {
          try { sub(data); } catch {}
        }
      } catch {}
    });
    sseSource.addEventListener('notification', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.sessionId && data.sessionId === localSessionId) return;
        canvasBus.publish(data.topic, data.payload, { from: data.senderId, timestamp: data.timestamp, remote: true });
      } catch {}
    });
    sseSource.onerror = () => {
      // Reconnection handled automatically by browser EventSource
    };
  } catch {}
}

/**
 * Binds an interactive widget instance to state management.
 * @param {Object} options
 * @param {string} options.key - Unique key (e.g. 'canvasId:widgetInstanceId')
 * @param {'global'|'cookie'|'stateless'} [options.mode='global'] - State mode
 * @param {any} options.defaultState - Initial state fallback
 * @param {(state: any, isInitial: boolean) => void} options.onUpdate - Callback when state changes locally or remotely
 * @param {number} [options.debounceMs=150] - Debounce interval for network saves
 * @returns {{ getState: () => any, setState: (nextState: any, immediate?: boolean) => void, destroy: () => void }}
 */
export function bindInteractiveState({
  key,
  mode = 'global',
  defaultState,
  onUpdate,
  debounceMs = 150,
}) {
  const effectiveMode = (mode === 'global' || mode === 'cookie' || mode === 'stateless') ? mode : 'global';
  const clientId = getFallbackClientId();

  if (effectiveMode === 'stateless') {
    let state = structuredClone(defaultState);
    return {
      getState() {
        return state;
      },
      setState(nextState) {
        state = structuredClone(nextState);
        if (onUpdate) onUpdate(state, false);
      },
      destroy() {},
    };
  }

  let currentState = structuredClone(defaultState);
  let currentRevision = 0;
  let saveTimer = null;
  let isDestroyed = false;

  // 1. Initial state fetch from server
  fetch(`/api/v1/interactive-state?mode=${encodeURIComponent(effectiveMode)}&key=${encodeURIComponent(key)}&clientId=${encodeURIComponent(clientId)}`, {
    credentials: 'same-origin',
    headers: { 'X-Client-Id': clientId },
  })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (isDestroyed || !data) return;
      if (data.state !== null && data.state !== undefined) {
        const fetchedRev = Number(data.revision) || 1;
        if (fetchedRev >= currentRevision) {
          currentState = data.state;
          currentRevision = fetchedRev;
          if (onUpdate) onUpdate(currentState, true);
        }
      }
    })
    .catch(() => {});

  // 2. Local cross-tab / cross-window instant sync via BroadcastChannel
  const onBcMessage = (e) => {
    if (isDestroyed || !e.data) return;
    const msg = e.data;
    if (msg.key === key && msg.mode === effectiveMode && msg.senderId !== localSessionId) {
      if (msg.revision && msg.revision <= currentRevision) return;
      currentRevision = msg.revision || (currentRevision + 1);
      currentState = msg.state;
      if (onUpdate) onUpdate(currentState, false);
    }
  };

  if (bc) {
    bc.addEventListener('message', onBcMessage);
  }

  // 3. Remote cross-device / multi-kiosk sync via SSE (for global mode)
  const onSseUpdate = (data) => {
    if (isDestroyed || !data) return;
    if (data.mode === 'global' && data.key === key && data.senderId !== localSessionId) {
      if (data.revision && data.revision <= currentRevision) return;
      currentRevision = data.revision || (currentRevision + 1);
      currentState = data.state;
      if (onUpdate) onUpdate(currentState, false);
    }
  };

  if (effectiveMode === 'global') {
    ensureSseConnection();
    sseSubscribers.add(onSseUpdate);
  }

  function flushNetworkSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    fetch('/api/v1/interactive-state', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': clientId,
      },
      body: JSON.stringify({
        mode: effectiveMode,
        key,
        state: currentState,
        senderId: localSessionId,
      }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((res) => {
        if (res?.revision) currentRevision = Math.max(currentRevision, res.revision);
      })
      .catch(() => {});
  }

  return {
    getState() {
      return currentState;
    },
    setState(nextState, immediate = false) {
      if (isDestroyed) return;
      currentState = structuredClone(nextState);
      currentRevision += 1;

      // Immediately broadcast to local windows on the same origin (0ms latency)
      if (bc) {
        try {
          bc.postMessage({
            mode: effectiveMode,
            key,
            senderId: localSessionId,
            state: currentState,
            revision: currentRevision,
          });
        } catch {}
      }

      // Schedule or immediately flush network persistence
      if (immediate || debounceMs <= 0) {
        flushNetworkSave();
      } else {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(flushNetworkSave, debounceMs);
      }
    },
    destroy() {
      isDestroyed = true;
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      if (bc) {
        bc.removeEventListener('message', onBcMessage);
      }
      if (effectiveMode === 'global') {
        sseSubscribers.delete(onSseUpdate);
        if (sseSubscribers.size === 0 && sseSource) {
          try { sseSource.close(); } catch {}
          sseSource = null;
        }
      }
    },
  };
}
