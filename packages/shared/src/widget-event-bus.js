// Shared lightweight in-memory event bus for widgets and canvas tiles.
// Enables sub-millisecond local screen reactivity between widgets.

export function createWidgetEventBus() {
  const listeners = new Map(); // topic -> Set<handler>

  return {
    /**
     * Publish an event to all subscribers of `topic`.
     * @param {string} topic Topic identifier (e.g. "media.playback", "sensor.motion")
     * @param {any} payload Event payload
     * @param {object} [meta] Metadata (e.g. { from: "instance-id", timestamp: Date.now() })
     */
    publish(topic, payload, meta = {}) {
      if (typeof topic !== "string" || !topic) return;
      const handlers = listeners.get(topic);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(payload, meta);
          } catch (err) {
            console.error(`[widget-event-bus] Error in subscriber for topic "${topic}":`, err);
          }
        }
      }
    },

    /**
     * Subscribe to events for `topic`.
     * @param {string} topic Topic to listen to
     * @param {function(payload, meta)} handler Callback function
     * @returns {function()} Unsubscribe function
     */
    subscribe(topic, handler) {
      if (typeof topic !== "string" || !topic || typeof handler !== "function") {
        return () => {};
      }
      const set = listeners.get(topic) || new Set();
      set.add(handler);
      listeners.set(topic, set);
      return () => {
        set.delete(handler);
        if (set.size === 0) {
          listeners.delete(topic);
        }
      };
    },

    /**
     * Check if a topic has any active listeners.
     */
    hasSubscribers(topic) {
      return (listeners.get(topic)?.size || 0) > 0;
    },

    /**
     * Clear all subscribers.
     */
    clear() {
      listeners.clear();
    },
  };
}

// Global canvas bus singleton shared across the page
export const canvasBus = createWidgetEventBus();

// Unique session id for this page load to prevent duplicate event delivery on remote broadcast
export const localSessionId = 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
