// Glansk sandboxed-widget message protocol. Shared verbatim between kiosk and
// admin so packaged widgets behave identically in preview and on the display.
export const WIDGET_PROTOCOL = 'glansk.widget.v1';
const bounded = value => { try { return JSON.stringify(value).length <= 16384; } catch { return false; } };
const FORBIDDEN_VAR_NAMES = new Set(['__proto__', 'constructor', 'prototype']);
export function acceptsWidgetEvent(event, source, instanceId, nonce) {
  const data = event.data;
  const isTrustedOrigin = event.origin === 'null' || event.origin === '' || (typeof location !== 'undefined' && event.origin === location.origin);
  if (!isTrustedOrigin || event.source !== source || !data || typeof data !== 'object' || Array.isArray(data) || !bounded(data) || data.protocol !== WIDGET_PROTOCOL) return false;
  if (instanceId === undefined || nonce === undefined) return data.type === 'connect';
  if (data.instanceId !== instanceId || data.nonce !== nonce) return false;
  if (data.type === 'ready') return true;
  if ((data.type === 'subscribe' || data.type === 'unsubscribe') && typeof data.channel === 'string' && data.channel.length <= 192) return true;
  if (data.type === 'broadcast') return typeof data.topic === 'string' && data.topic.length <= 128 && bounded(data.payload);
  if (data.type === 'notify-subscribe' || data.type === 'notify-unsubscribe') return typeof data.topic === 'string' && data.topic.length <= 128;
  if (data.type === 'variable-set') return typeof data.name === 'string' && data.name.length <= 128 && !FORBIDDEN_VAR_NAMES.has(data.name) && bounded(data.value);
  if (data.type === 'storage-get' || data.type === 'storage-delete') return typeof data.key === 'string' && data.key.length <= 128 && typeof data.correlationId === 'string' && data.correlationId.length <= 128;
  if (data.type === 'storage-set') return typeof data.key === 'string' && data.key.length <= 128 && bounded(data.value);
  if (data.type === 'shared-subscribe' || data.type === 'shared-unsubscribe') return typeof data.key === 'string' && data.key.length <= 128;
  if (data.type === 'shared-set') return typeof data.key === 'string' && data.key.length <= 128 && bounded(data.value);
  if (data.type === 'fetch') return typeof data.url === 'string' && data.url.length <= 2048 && typeof data.correlationId === 'string' && data.correlationId.length <= 128;
  return data.type === 'command' && typeof data.command === 'string' && data.command.length <= 80 && typeof data.correlationId === 'string' && data.correlationId.length <= 128 && bounded(data.payload);
}
