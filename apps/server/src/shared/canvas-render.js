// The single canvas renderer shared by the kiosk display and the admin editor.
// Given a canvas/runtime document it builds an identical DOM tree in both
// surfaces, so "what you edit is what the display shows".
//
// A document looks like:
//   { name?, logicalSize:{width,height}, background?, theme?,
//     widgets:[{ id, packageId, widgetId, geometry:{x,y,width,height,zIndex}, config }] }
//
// Note: the runtime projection (/preview, /published) uses `instanceId` + `frame`
// instead of `id` + `geometry`; `normalizeWidget` accepts both shapes.
import { createWidgetFrame, clearWidgetFrames } from './widget-host.js';
import { resolvedTheme } from './canvas-themes.js';
import { widgetMarkup } from './widget-markup.js';
import { getWidgetDefinition } from './widget-definitions.js';
import { boxToCss, radiusToCss, colorToCss } from './appearance-normalize.js';
import { bindInteractiveState, ensureSseConnection } from './interactive-state.js';
import { canvasBus } from './widget-event-bus.js';
import { BUILTIN_DESIGN_PRESETS, resolvePresetCssVariables } from './design-presets.js';
import { CanvasVariableStore, setActiveVariableStore, getActiveVariableStore, resolveDynamicValue } from './canvas-variables.js';

if (typeof window !== 'undefined') {
  window.GlanskBus = canvasBus;
}

export function normalizeWidget(w) {
  const geometry = w.geometry || w.frame || {};
  return {
    id: w.id || w.instanceId,
    packageId: w.packageId,
    widgetId: w.widgetId,
    groupId: w.groupId || undefined,
    geometry: {
      x: Number(geometry.x) || 0,
      y: Number(geometry.y) || 0,
      width: Number(geometry.width) || 0,
      height: Number(geometry.height) || 0,
      zIndex: Number(geometry.zIndex) || 0,
    },
    config: w.config || {},
    visibility: w.visibility || undefined,
    disabled: Boolean(w.disabled),
  };
}

export function normalizeGroup(g) {
  const geometry = g.geometry || {};
  return {
    id: String(g.id),
    name: String(g.name || 'Group'),
    collapsed: Boolean(g.collapsed),
    geometry: {
      x: Number(geometry.x) || 0,
      y: Number(geometry.y) || 0,
      width: Number(geometry.width) || 100,
      height: Number(geometry.height) || 100,
      zIndex: Number(geometry.zIndex) || 0,
    },
    visibility: g.visibility || undefined,
    disabled: Boolean(g.disabled),
  };
}

const FORBIDDEN_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

export function resolveStatePath(state, path) {
  if (!state || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(state, path)) return state[path];
  const normalizedPath = path.startsWith('canvas.variables.')
    ? path.slice(17)
    : path.startsWith('variables.')
    ? path.slice(10)
    : path;
  if (Object.prototype.hasOwnProperty.call(state, normalizedPath)) return state[normalizedPath];
  const parts = normalizedPath.split('.');
  let curr = state;
  for (const part of parts) {
    if (curr == null || typeof curr !== 'object' || FORBIDDEN_PROPS.has(part)) return undefined;
    if (Object.prototype.hasOwnProperty.call(curr, part)) {
      curr = curr[part];
    } else {
      return undefined;
    }
  }
  return curr;
}

function evaluateOperator(currentVal, operator, targetVal) {
  switch (operator) {
    case 'eq': {
      if (typeof currentVal === 'boolean' || targetVal === 'true' || targetVal === 'false') {
        const bTarget = targetVal === true || targetVal === 'true' || targetVal === 1 || targetVal === '1';
        const bCurrent = Boolean(currentVal) && currentVal !== 'false' && currentVal !== '0';
        return bCurrent === bTarget;
      }
      return String(currentVal ?? '') === String(targetVal ?? '');
    }
    case 'neq': {
      if (typeof currentVal === 'boolean' || targetVal === 'true' || targetVal === 'false') {
        const bTarget = targetVal === true || targetVal === 'true' || targetVal === 1 || targetVal === '1';
        const bCurrent = Boolean(currentVal) && currentVal !== 'false' && currentVal !== '0';
        return bCurrent !== bTarget;
      }
      return String(currentVal ?? '') !== String(targetVal ?? '');
    }
    case 'gt': {
      const c = Number(currentVal);
      const t = Number(targetVal);
      return currentVal !== null && currentVal !== undefined && Number.isFinite(c) && Number.isFinite(t) && c > t;
    }
    case 'gte': {
      const c = Number(currentVal);
      const t = Number(targetVal);
      return currentVal !== null && currentVal !== undefined && Number.isFinite(c) && Number.isFinite(t) && c >= t;
    }
    case 'lt': {
      const c = Number(currentVal);
      const t = Number(targetVal);
      return currentVal !== null && currentVal !== undefined && Number.isFinite(c) && Number.isFinite(t) && c < t;
    }
    case 'lte': {
      const c = Number(currentVal);
      const t = Number(targetVal);
      return currentVal !== null && currentVal !== undefined && Number.isFinite(c) && Number.isFinite(t) && c <= t;
    }
    case 'truthy':
      return Boolean(currentVal) && currentVal !== 'false' && currentVal !== '0';
    case 'falsy':
      return !currentVal || currentVal === 'false' || currentVal === '0';
    case 'contains':
      return String(currentVal || '').includes(String(targetVal || ''));
    default:
      return true;
  }
}

export function evaluateVisibility(visibility, state = {}, options = {}) {
  if (!visibility) return true;
  if (visibility.defaultVisible === false && !visibility.timeRule?.enabled && !visibility.stateRule?.enabled) {
    return false;
  }

  // Time-based schedule rule
  if (visibility.timeRule?.enabled) {
    const { startTime, endTime, daysOfWeek } = visibility.timeRule;
    const now = options.now ? new Date(options.now) : new Date();
    if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
      const isoDay = now.getDay() === 0 ? 7 : now.getDay();
      if (!daysOfWeek.includes(isoDay)) return false;
    }
    if (startTime && endTime) {
      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      const curMin = now.getHours() * 60 + now.getMinutes();
      const startMin = sH * 60 + (sM || 0);
      const endMin = eH * 60 + (eM || 0);
      if (startMin <= endMin) {
        if (curMin < startMin || curMin > endMin) return false;
      } else {
        if (curMin < startMin && curMin > endMin) return false;
      }
    }
  }

  // Reactive state-based rule
  if (visibility.stateRule?.enabled) {
    const { variablePath, operator, value } = visibility.stateRule;
    const cur = resolveStatePath(state, variablePath);
    if (!evaluateOperator(cur, operator, value)) return false;
  }

  return true;
}

/**
 * Render `doc` into `host`.
 * options:
 *   fit           scale the canvas to fill `host` and center it (kiosk). default false
 *   scale         explicit scale when !fit (editor zoom). default 1
 *   mountWidgets  create live sandboxed iframes for packaged widgets. default true
 *   interactive   when false, tiles get pointer-events:none so an editor overlay
 *                 can own pointer interaction. default true
 *   renderContext optional surface-specific context forwarded to widget iframes.
 *                 When renderContext.display.id is set the host will include a
 *                 display identity object in each widget's 'connected' handshake.
 *                 The admin editor never supplies renderContext, so editor previews
 *                 receive no display identity — by design.
 * returns { canvasEl, tiles: Map<id,{el,widget}>, groups: Map<id,{el,group}>, scale, offset:{x,y}, destroy() }
 */
const activeCleanups = new Set();

export function renderCanvas(host, doc, options = {}) {
  const { fit = false, mountWidgets = true, interactive = true, renderContext } = options;
  clearWidgetFrames('remount');
  try { ensureSseConnection(); } catch {}
  for (const cleanup of activeCleanups) {
    try { cleanup(); } catch {}
  }
  activeCleanups.clear();

  const logicalSize = doc.logicalSize || { width: 1280, height: 720 };
  const groups = [...(doc.groups || [])]
    .map(normalizeGroup)
    .sort((a, b) => a.geometry.zIndex - b.geometry.zIndex || String(a.id).localeCompare(String(b.id)));

  const widgets = [...(doc.widgets || [])]
    .map(normalizeWidget)
    .sort((a, b) => a.geometry.zIndex - b.geometry.zIndex || String(a.id).localeCompare(String(b.id)));

  // Calculate actual content bounds so widgets or groups placed near or past nominal bounds never clip
  let contentW = logicalSize.width;
  let contentH = logicalSize.height;
  for (const g of groups) {
    if (g.geometry) {
      contentW = Math.max(contentW, (g.geometry.x || 0) + (g.geometry.width || 0));
      contentH = Math.max(contentH, (g.geometry.y || 0) + (g.geometry.height || 0));
    }
  }
  for (const w of widgets) {
    if (w.geometry) {
      const gx = w.groupId ? (groups.find(g => g.id === w.groupId)?.geometry.x || 0) : 0;
      const gy = w.groupId ? (groups.find(g => g.id === w.groupId)?.geometry.y || 0) : 0;
      contentW = Math.max(contentW, gx + (w.geometry.x || 0) + (w.geometry.width || 0));
      contentH = Math.max(contentH, gy + (w.geometry.y || 0) + (w.geometry.height || 0));
    }
  }

  let scale = options.scale ?? 1;
  let offsetX = 0;
  let offsetY = 0;
  if (fit) {
    const hostW = host.clientWidth || window.innerWidth;
    const hostH = host.clientHeight || window.innerHeight;
    scale = Math.min(hostW / contentW, hostH / contentH);
    offsetX = (hostW - contentW * scale) / 2;
    offsetY = (hostH - contentH * scale) / 2;
  }

  const theme = resolvedTheme(doc.theme, doc.background);
  const bgStyle = doc.background ? doc.background : (theme['--canvas-gradient'] || theme['--canvas-bg'] || '#07111f');

  // Full-bleed background fill: Ensure host container and document body fill the entire display seamlessly
  if (host && host.style) {
    for (const [key, val] of Object.entries(theme)) host.style.setProperty(key, val);
    host.style.background = bgStyle;
    host.style.color = theme['--canvas-text'] || '#e8f4ff';
  }
  if (typeof document !== 'undefined' && fit && document.body) {
    document.body.style.background = bgStyle;
    document.body.style.color = theme['--canvas-text'] || '#e8f4ff';
    if (document.documentElement) {
      document.documentElement.style.background = bgStyle;
    }
  }

  const canvas = document.createElement('div');
  canvas.className = 'glansk-canvas';
  for (const [key, val] of Object.entries(theme)) canvas.style.setProperty(key, val);
  canvas.style.width = `${contentW}px`;
  canvas.style.height = `${contentH}px`;
  canvas.style.transform = `translate(${offsetX}px,${offsetY}px) scale(${scale})`;
  if (fit) {
    canvas.style.background = 'transparent';
  }

  const variableStore = new CanvasVariableStore(doc.variables || {}, doc.id || 'default');
  setActiveVariableStore(variableStore);
  activeCleanups.add(() => variableStore.destroy());

  // Register output variables declared by widgets
  for (const w of widgets) {
    const wDef = getWidgetDefinition(w.widgetId);
    if (wDef?.outputVariables) {
      variableStore.registerOutputVariables(w.id, w.widgetId, wDef.outputVariables);
    }
  }

  const currentVars = variableStore.getAll();

  // Render Groups containers (creates CSS relative stacking contexts)
  const groupElements = new Map();
  for (const g of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'glansk-group';
    groupEl.dataset.groupId = g.id;
    groupEl.style.cssText = `position:absolute !important;left:${g.geometry.x}px;top:${g.geometry.y}px;width:${g.geometry.width}px;height:${g.geometry.height}px;z-index:${g.geometry.zIndex};pointer-events:${interactive ? 'auto' : 'none'};`;

    const isGroupVisible = evaluateVisibility(g.visibility, currentVars, { isEditor: !fit });
    if (!isGroupVisible) {
      if (!fit && g.visibility?.showInUiBuilder !== false) {
        groupEl.dataset.previewHidden = 'true';
        groupEl.style.opacity = '0.45';
      } else {
        groupEl.style.display = 'none';
      }
    }
    if (g.disabled) {
      groupEl.dataset.disabled = 'true';
      groupEl.style.pointerEvents = 'none';
      groupEl.style.opacity = '0.6';
    }

    canvas.append(groupEl);
    groupElements.set(g.id, { el: groupEl, group: g });
  }

  const tiles = new Map();
  for (const widget of widgets) {
    const tile = document.createElement('section');
    tile.className = `glansk-tile ${widget.config?.tone || ''} ${widget.widgetId}`.trim();
    tile.dataset.widget = widget.widgetId;
    tile.dataset.instanceId = widget.id;
    if (widget.groupId) tile.dataset.groupId = widget.groupId;
    tile.style.cssText = `position:absolute !important;left:${widget.geometry.x}px;top:${widget.geometry.y}px;width:${widget.geometry.width}px;height:${widget.geometry.height}px;z-index:${widget.geometry.zIndex};`;
    if (!interactive) tile.style.pointerEvents = 'none';

    // Visibility evaluation
    const isVisible = evaluateVisibility(widget.visibility, currentVars, { isEditor: !fit });
    if (!isVisible) {
      if (!fit && widget.visibility?.showInUiBuilder !== false) {
        tile.dataset.previewHidden = 'true';
        tile.style.opacity = '0.45';
        tile.style.filter = 'grayscale(0.5)';
      } else {
        tile.style.display = 'none';
      }
    }
    if (widget.disabled) {
      tile.dataset.disabled = 'true';
      tile.style.pointerEvents = 'none';
      tile.style.opacity = '0.6';
    }

    // Responsive unit calculation
    const w = widget.geometry.width;
    const h = widget.geometry.height;
    const unit = Math.max(0.45, Math.min(2.5, Math.min(w / 320, h / 180)));
    tile.style.setProperty('--widget-width', `${w}px`);
    tile.style.setProperty('--widget-height', `${h}px`);
    tile.style.setProperty('--widget-unit', String(unit));

    // Responsive format attributes based on dimension
    tile.dataset.size = (w < 220 || h < 130) ? 'compact' : (w >= 500 && h >= 300) ? 'large' : 'normal';
    tile.dataset.aspect = (w / h > 1.8) ? 'wide' : (h / w > 1.3) ? 'tall' : 'normal';

    // Apply appearance configurations
    applyTileAppearance(tile, widget, theme);

    const frame = mountWidgets
      ? createWidgetFrame({ ...widget, config: { ...widget.config, theme } }, renderContext)
      : undefined;
    if (frame) {
      tile.append(frame);
    } else {
      tile.innerHTML = widgetMarkup(widget);
      if (widget.widgetId === 'button') {
        const cleanup = initButtonWidget(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'image-slideshow') {
        const cleanup = initSlideshow(tile, widget.config);
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'music-player') {
        const cleanup = initMusicPlayer(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'device-switchboard') {
        const cleanup = initDeviceSwitchboard(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'task-matrix') {
        const cleanup = initTaskMatrix(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'quick-notes') {
        const cleanup = initQuickNotes(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      } else if (widget.widgetId === 'emitter-widget') {
        const cleanup = initEmitterWidget(tile, widget.config, { widgetId: widget.widgetId, instanceId: widget.id, canvasId: doc?.id || 'default' });
        if (cleanup) activeCleanups.add(cleanup);
      }
    }

    // Mount inside parent group container if grouped, else to canvas root
    const parentGroup = widget.groupId ? groupElements.get(widget.groupId) : null;
    if (parentGroup) {
      parentGroup.el.append(tile);
    } else {
      canvas.append(tile);
    }
    tiles.set(widget.id, { el: tile, widget });
  }

  // Reactive visibility updates on variable mutations (Zero-Remount Reactivity)
  const updateVisibility = () => {
    const vars = variableStore.getAll();
    for (const [id, { el, group }] of groupElements) {
      if (!group.visibility?.stateRule?.enabled) continue;
      const visible = evaluateVisibility(group.visibility, vars, { isEditor: !fit });
      if (visible) {
        el.style.display = '';
        delete el.dataset.previewHidden;
        el.style.opacity = group.disabled ? '0.6' : '';
      } else {
        if (!fit && group.visibility?.showInUiBuilder !== false) {
          el.style.display = '';
          el.dataset.previewHidden = 'true';
          el.style.opacity = '0.45';
        } else {
          el.style.display = 'none';
        }
      }
    }
    for (const [id, { el, widget }] of tiles) {
      // Re-apply appearance in case corner radius, padding, opacity, etc. have dynamic bindings
      applyTileAppearance(el, widget, theme);

      // Re-apply dynamic label text if present
      if (widget.widgetId === 'label' && (widget.config?.text?.$bind || widget.config?.value?.$bind)) {
        const textEl = el.querySelector('.primitive-label-text');
        if (textEl) {
          const resolved = resolveDynamicValue(widget.config.text ?? widget.config.value, variableStore, 'System Metric');
          textEl.textContent = String(resolved);
        }
      }

      if (!widget.visibility?.stateRule?.enabled) continue;
      const visible = evaluateVisibility(widget.visibility, vars, { isEditor: !fit });
      if (visible) {
        el.style.display = '';
        delete el.dataset.previewHidden;
        el.style.opacity = widget.disabled ? '0.6' : '';
        el.style.filter = '';
      } else {
        if (!fit && widget.visibility?.showInUiBuilder !== false) {
          el.style.display = '';
          el.dataset.previewHidden = 'true';
          el.style.opacity = '0.45';
          el.style.filter = 'grayscale(0.5)';
        } else {
          el.style.display = 'none';
        }
      }
    }
  };

  const unwatchVars = variableStore.watchAll(updateVisibility);
  activeCleanups.add(unwatchVars);

  host.replaceChildren(canvas);
  return {
    canvasEl: canvas,
    tiles,
    groups: groupElements,
    scale,
    offset: { x: offsetX, y: offsetY },
    variableStore,
    destroy() {
      for (const cleanup of activeCleanups) {
        try { cleanup(); } catch {}
      }
      activeCleanups.clear();
      clearWidgetFrames('host-destroy');
    },
  };
}

/**
 * Applies appearance styles directly to an existing tile DOM element.
 * Usable both during initial render and for 60fps live-patching without remounting frames.
 */
export function applyTileAppearance(tile, widget, theme = {}) {
  const app = widget.config?.appearance;
  const hasCardStyle = (
    app?.frame === 'card' ||
    app?.showBoundingBox === true ||
    widget.config?.frame === 'card' ||
    (Number(app?.borderWidth) > 0) ||
    app?.transparentBg === false ||
    Boolean(app?.presetId)
  );
  const isCard = (hasCardStyle || app?.frame === 'card') &&
    app?.showBoundingBox !== false &&
    app?.frame !== 'none' &&
    !app?.frameless &&
    widget.config?.frameless !== true;

  if (!isCard) {
    tile.dataset.frame = 'none';
    tile.dataset.boundingBox = 'false';
    tile.style.setProperty('--tile-bg', 'transparent');
    tile.style.setProperty('--tile-bg-gradient', 'none');
    tile.style.setProperty('--tile-border', 'none');
    tile.style.setProperty('--tile-border-color', 'transparent');
    tile.style.setProperty('--tile-shadow', 'none');
    tile.style.setProperty('--tile-padding', '0');
    tile.style.padding = '0';
  } else {
    tile.dataset.frame = 'card';
    tile.dataset.boundingBox = 'true';
    tile.style.removeProperty('--tile-border');
    tile.style.removeProperty('--tile-shadow');
    tile.style.removeProperty('padding');
  }

  if (app && typeof app === 'object') {
    const store = getActiveVariableStore();
    const resolvedPadding = resolveDynamicValue(app.padding, store, app.padding);
    const resolvedRadius = resolveDynamicValue(app.borderRadius, store, app.borderRadius);
    const resolvedOpacity = resolveDynamicValue(app.opacity, store, app.opacity);
    const resolvedBorderWidth = resolveDynamicValue(app.borderWidth, store, app.borderWidth);
    const resolvedBorderColor = resolveDynamicValue(app.borderColor, store, app.borderColor);
    const hasBoundingBox = isCard;

    // Custom Padding: set only if explicitly defined
    if (resolvedPadding !== undefined && resolvedPadding !== null) {
      const paddingCss = boxToCss(resolvedPadding);
      tile.style.setProperty('--tile-padding', paddingCss);
      if (!isCard) tile.style.padding = paddingCss;
    } else if (isCard) {
      tile.style.removeProperty('--tile-padding');
    }

    // Custom Border Radius: set only if explicitly defined and in bounding box
    if (resolvedRadius !== undefined && resolvedRadius !== null && isCard) {
      tile.style.setProperty('--tile-radius', radiusToCss(resolvedRadius));
    } else if (isCard) {
      tile.style.removeProperty('--tile-radius');
    }

    if (typeof app.fontScale === 'number') {
      tile.style.setProperty('--widget-font-scale', String(app.fontScale));
    } else {
      tile.style.removeProperty('--widget-font-scale');
    }

    if (resolvedOpacity !== undefined && resolvedOpacity !== null && !isNaN(Number(resolvedOpacity))) {
      tile.style.setProperty('--tile-opacity', String(resolvedOpacity));
    } else {
      tile.style.removeProperty('--tile-opacity');
    }

    if (app.transparentBg && isCard) {
      tile.style.setProperty('--tile-bg', 'transparent');
      tile.style.setProperty('--tile-bg-gradient', 'none');
      tile.style.setProperty('--tile-shadow', 'none');
    } else if (isCard) {
      tile.style.removeProperty('--tile-bg');
      tile.style.removeProperty('--tile-bg-gradient');
      tile.style.removeProperty('--tile-shadow');
    }

    if (resolvedBorderWidth !== undefined && resolvedBorderWidth !== null && isCard && !isNaN(Number(resolvedBorderWidth))) {
      tile.style.setProperty('--tile-border-width', `${resolvedBorderWidth}px`);
    } else {
      tile.style.removeProperty('--tile-border-width');
    }

    if (typeof app.borderStyle === 'string' && hasBoundingBox) {
      tile.style.setProperty('--tile-border-style', app.borderStyle);
    } else {
      tile.style.removeProperty('--tile-border-style');
    }

    if (typeof resolvedBorderColor === 'string' && hasBoundingBox && resolvedBorderColor.trim()) {
      const borderCol = colorToCss(resolvedBorderColor, 'cssVar', theme);
      if (borderCol) tile.style.setProperty('--tile-border-color', borderCol);
    } else {
      tile.style.removeProperty('--tile-border-color');
    }

    // Background image
    if (app.background && (app.background.url || app.background.source)) {
      const bgUrl = app.background.url;
      if (bgUrl) {
        tile.style.setProperty('--tile-bg-image', `url("${bgUrl}")`);
        tile.style.setProperty('--tile-bg-fit', app.background.objectFit || 'cover');
        tile.style.setProperty('--tile-bg-pos', app.background.objectPosition || 'center');
      } else {
        tile.style.removeProperty('--tile-bg-image');
        tile.style.removeProperty('--tile-bg-fit');
        tile.style.removeProperty('--tile-bg-pos');
      }
    } else {
      tile.style.removeProperty('--tile-bg-image');
      tile.style.removeProperty('--tile-bg-fit');
      tile.style.removeProperty('--tile-bg-pos');
    }

    // Design Preset Application (Curated Palettes)
    if ((app.followCanvasTheme === false || app.presetId) && app.presetId && BUILTIN_DESIGN_PRESETS[app.presetId]) {
      const presetVars = resolvePresetCssVariables(BUILTIN_DESIGN_PRESETS[app.presetId]);
      for (const [k, v] of Object.entries(presetVars)) {
        tile.style.setProperty(k, v);
      }
    }

    // Custom Color Slots (applied on top of preset)
    if (app.followCanvasTheme === false && app.slots && typeof app.slots === 'object') {
      const def = getWidgetDefinition(widget.widgetId);
      for (const slot of def.colorSlots) {
        const slotCfg = app.slots[slot.key];
        if (slotCfg && typeof slotCfg === 'object') {
          const slotVal = colorToCss(slotCfg, 'cssVar', theme);
          if (slotVal) {
            tile.style.setProperty(slot.property, slotVal);
            if (slot.key === 'border') {
              tile.style.setProperty('--tile-border-color', slotVal);
            }
          }
        }
      }
    }
  }
}

/**
 * Interactive Button Widget Engine.
 * Supports action types: 'toggle-variable', 'set-variable', 'increment-variable', 'command', 'url'.
 * Directly binds to CanvasVariableStore for sub-millisecond element state triggers.
 */
export function initButtonWidget(tile, config = {}, context = {}) {
  const btn = tile.querySelector('button.primitive-btn');
  if (!btn) return undefined;

  const onClick = (e) => {
    e.stopPropagation();
    const action = btn.dataset.action || config.actionType || 'toggle-variable';
    const rawTarget = btn.dataset.target || config.target || config.variableName;
    const target = typeof rawTarget === 'string' ? rawTarget.trim() : '';
    const value = btn.dataset.value ?? config.variableValue;
    const store = getActiveVariableStore();

    // Publish widget-generated output variables with reserved 'wig' prefix
    if (store && context.instanceId) {
      const countKey = `wig${context.instanceId}-clickCount`;
      const currentCount = Number(store.get(countKey) || 0);
      const nowIso = new Date().toISOString();
      store.set(countKey, currentCount + 1);
      store.set(`wig${context.instanceId}-lastClickedAt`, nowIso);
      if (context.widgetId) {
        store.set(`wig${context.widgetId}-clickCount`, currentCount + 1);
        store.set(`wig${context.widgetId}-lastClickedAt`, nowIso);
      }
    }

    if (action === 'toggle-variable' && target) {
      if (store) store.toggle(target);
    } else if (action === 'set-variable' && target) {
      if (store) store.set(target, value);
    } else if (action === 'increment-variable' && target) {
      if (store) store.increment(target, Number(value) || 1);
    } else if (action === 'command') {
      canvasBus.publish(`command:${target || 'default'}`, { target, value, widgetId: context.widgetId });
    } else if (action === 'url' && target) {
      try {
        window.open(target, '_blank');
      } catch {}
    }
  };

  btn.addEventListener('click', onClick);
  return () => {
    btn.removeEventListener('click', onClick);
  };
}

/**
 * Dual Ping-Pong Buffer Slideshow Engine ported from PiDashboard.
 * Uses 2 buffer elements (solid/active state switching), preloads subsequent slides,
 * supports crossfade/slide/zoom effects, pause on hover, shuffle, and indicators.
 * Returns a cleanup function to tear down timers and event listeners.
 */
export function initSlideshow(tile, config = {}) {
  const container = tile.querySelector('.ss-wrap');
  if (!container) return undefined;

  const raw = config.images ?? '';
  let urls = [];
  if (Array.isArray(raw)) {
    urls = raw.map(s => String(s || '').trim()).filter(Boolean);
  } else if (typeof raw === 'string') {
    urls = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  if (urls.length === 0) return undefined;

  // Shuffle order if requested (Fisher-Yates)
  if (config.shuffle) {
    urls = [...urls];
    for (let i = urls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = urls[i]; urls[i] = urls[j]; urls[j] = t;
    }
  }

  const interval = (Number(config.interval) || 6) * 1000;
  const speed = config.transitionSpeed !== undefined ? Number(config.transitionSpeed) : 800;
  const effect = config.transition || 'crossfade';
  const fit = config.fit || 'cover';
  const fitSize = fit === 'fill' ? '100% 100%' : fit;
  const pauseOnHover = Boolean(config.pauseOnHover);

  container.className = 'ss-wrap ss-' + (effect === 'slide' ? 'slide-fx' : effect);
  container.style.setProperty('--ss-speed', `${speed}ms`);
  container.style.setProperty('--ss-fit', fit);
  container.style.setProperty('--ss-fit-size', fitSize);

  let bufA = container.querySelector('[data-buf="0"]');
  let bufB = container.querySelector('[data-buf="1"]');
  if (!bufA || !bufB) {
    bufA = document.createElement('div');
    bufB = document.createElement('div');
    bufA.className = 'ss-buf solid';
    bufA.dataset.buf = '0';
    bufB.className = 'ss-buf';
    bufB.dataset.buf = '1';
    container.append(bufA, bufB);
  }

  const buffers = [bufA, bufB];

  function normalizeUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//.test(url) || url.startsWith('/') || url.startsWith('data:')) return url;
    return '/uploads/' + url.replace(/^\/+/, '');
  }

  function setBufferImage(buffer, url) {
    buffer.style.backgroundImage = url ? `url("${normalizeUrl(url).replace(/"/g, '\\"')}")` : 'none';
  }

  const dots = Array.from(container.querySelectorAll('.ss-dot'));

  let currentIdx = 0;
  let activeBuf = 0;
  let timer = null;
  let paused = false;

  // Initialize frame 0 and preload frame 1
  setBufferImage(buffers[0], urls[0]);
  if (urls.length > 1) {
    setBufferImage(buffers[1], urls[1]);
  }
  updateDots(0);

  function updateDots(idx) {
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
  }

  function advanceTo(targetIdx) {
    if (urls.length <= 1) return;
    const nextBuf = 1 - activeBuf;
    setBufferImage(buffers[nextBuf], urls[targetIdx]);

    // Force reflow before transition
    void buffers[nextBuf].offsetWidth;

    // Start transition
    buffers[nextBuf].classList.add('active');

    let completed = false;
    const onFadeComplete = () => {
      if (completed) return;
      completed = true;
      buffers[nextBuf].removeEventListener('transitionend', onFadeComplete);

      // Swap roles: outgoing drops solid (snaps to opacity 0), incoming gains solid
      buffers[activeBuf].classList.remove('solid');
      buffers[nextBuf].classList.remove('active');
      buffers[nextBuf].classList.add('solid');

      activeBuf = nextBuf;
      currentIdx = targetIdx;
      updateDots(currentIdx);

      // Preload the next-next image in the background buffer
      const preloadIdx = (currentIdx + 1) % urls.length;
      setBufferImage(buffers[1 - activeBuf], urls[preloadIdx]);
    };

    if (speed > 0) {
      buffers[nextBuf].addEventListener('transitionend', onFadeComplete);
      setTimeout(() => {
        if (buffers[nextBuf].classList.contains('active')) {
          onFadeComplete();
        }
      }, speed + 50);
    } else {
      onFadeComplete();
    }
  }

  function advance() {
    if (paused) return;
    advanceTo((currentIdx + 1) % urls.length);
  }

  // Clickable indicator dots
  const dotClickHandlers = [];
  dots.forEach((dot, idx) => {
    const handler = (e) => {
      e.stopPropagation();
      if (idx !== currentIdx) {
        advanceTo(idx);
        if (timer) {
          clearInterval(timer);
          timer = setInterval(advance, interval);
        }
      }
    };
    dot.addEventListener('click', handler);
    dotClickHandlers.push({ dot, handler });
  });

  if (urls.length > 1) {
    timer = setInterval(advance, interval);
  }

  const onEnter = () => { paused = true; };
  const onLeave = () => { paused = false; };
  if (pauseOnHover) {
    container.addEventListener('mouseenter', onEnter);
    container.addEventListener('mouseleave', onLeave);
  }

  return () => {
    if (timer) clearInterval(timer);
    if (pauseOnHover) {
      container.removeEventListener('mouseenter', onEnter);
      container.removeEventListener('mouseleave', onLeave);
    }
    for (const { dot, handler } of dotClickHandlers) {
      dot.removeEventListener('click', handler);
    }
  };
}

/**
 * Interactive Music Player Engine.
 * Supports track switching, spinning vinyl disk, play/pause timer, seeking scrubber rail,
 * volume drag & mute toggle, and an ambient Web Audio synthesizer when audio is playing.
 */
export function initMusicPlayer(tile, config = {}, context = {}) {
  const container = tile.querySelector('.music-player');
  if (!container) return undefined;

  let tracks = [];
  try {
    tracks = JSON.parse(container.dataset.tracks || '[]');
  } catch {}
  if (!Array.isArray(tracks) || tracks.length === 0) {
    tracks = [
      {
        title: "Midnight Reverie",
        artist: "Aura & The Machines",
        album: "Synthwave Echoes",
        duration: 215,
        cover: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80"
      },
      {
        title: "Cyber Horizon",
        artist: "Kavinsky Drift",
        album: "Neon Grid EP",
        duration: 184,
        cover: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&q=80"
      },
      {
        title: "Obsidian Pulse",
        artist: "Neural Sync",
        album: "Dark Matter",
        duration: 242,
        cover: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&q=80"
      }
    ];
  }

  let currentIdx = Math.max(0, Math.min(tracks.length - 1, Number(container.dataset.current) || 0));
  let isPlaying = container.classList.contains('is-playing');
  let duration = tracks[currentIdx]?.duration || Number(container.dataset.duration) || 215;
  let currentTime = Math.min(duration, Number(container.dataset.time) || 0);
  let volume = Math.max(0, Math.min(100, Number(container.dataset.volume) || 80));
  let isMuted = false;
  let prevVolume = volume;
  let isRepeating = false;
  let isShuffled = false;
  let timer = null;

  const stateBridge = bindInteractiveState({
    key: `${context.canvasId || 'default'}:${context.instanceId || 'music-player'}`,
    mode: config.stateMode || 'global',
    defaultState: {
      isPlaying: Boolean(config.autoPlay),
      currentIdx,
      currentTime,
      volume,
      isMuted,
      isShuffled,
      isRepeating,
    },
    onUpdate(state) {
      if (!state) return;
      if (typeof state.currentIdx === 'number' && state.currentIdx !== currentIdx && state.currentIdx >= 0 && state.currentIdx < tracks.length) {
        currentIdx = state.currentIdx;
        updateTrackDisplay();
      }
      if (typeof state.currentTime === 'number' && Math.abs(state.currentTime - currentTime) > 2) {
        currentTime = Math.min(duration, state.currentTime);
        updateProgress();
      }
      if (typeof state.volume === 'number' && state.volume !== volume) {
        updateVolume(state.volume, false);
      }
      if (typeof state.isPlaying === 'boolean' && state.isPlaying !== isPlaying) {
        setPlayingState(state.isPlaying, false);
      }
      if (typeof state.isShuffled === 'boolean' && state.isShuffled !== isShuffled) {
        isShuffled = state.isShuffled;
        shuffleBtn?.classList.toggle('active', isShuffled);
      }
      if (typeof state.isRepeating === 'boolean' && state.isRepeating !== isRepeating) {
        isRepeating = state.isRepeating;
        repeatBtn?.classList.toggle('active', isRepeating);
      }
    }
  });

  function syncState(immediate = false) {
    stateBridge.setState({
      isPlaying,
      currentIdx,
      currentTime,
      volume,
      isMuted,
      isShuffled,
      isRepeating,
    }, immediate);
  }

  // DOM Elements
  const vinylDisc = container.querySelector('.mp-vinyl-disc');
  const vinylLabel = container.querySelector('.mp-vinyl-label');
  const titleEl = container.querySelector('.mp-track-title');
  const artistEl = container.querySelector('.mp-track-artist');
  const currentTimeEl = container.querySelector('.mp-current-time');
  const totalTimeEl = container.querySelector('.mp-total-time');
  const scrubberRail = container.querySelector('.mp-scrubber-rail');
  const scrubberFill = container.querySelector('.mp-scrubber-fill');
  const scrubberHandle = container.querySelector('.mp-scrubber-handle');
  const playPauseBtn = container.querySelector('.mp-btn-play-pause');
  const playIcon = container.querySelector('.mp-icon-play');
  const pauseIcon = container.querySelector('.mp-icon-pause');
  const prevBtn = container.querySelector('.mp-btn-prev');
  const nextBtn = container.querySelector('.mp-btn-next');
  const shuffleBtn = container.querySelector('.mp-btn-shuffle');
  const repeatBtn = container.querySelector('.mp-btn-repeat');
  const volBtn = container.querySelector('.mp-vol-btn');
  const volRail = container.querySelector('.mp-vol-rail');
  const volFill = container.querySelector('.mp-vol-fill');
  const volLabel = container.querySelector('.mp-vol-label');

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Optional Web Audio Synth for ambient feedback
  let audioCtx = null;
  let synthGain = null;
  let synthOscs = [];

  function stopSynth() {
    synthOscs.forEach(o => {
      try { o.stop(); o.disconnect(); } catch {}
    });
    synthOscs = [];
  }

  function playSynthChord() {
    stopSynth();
    if (typeof window === 'undefined') return;
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtxClass) return;
    try {
      if (!audioCtx) audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      synthGain = audioCtx.createGain();
      const currentVol = isMuted ? 0 : (volume / 100) * 0.08;
      synthGain.gain.setValueAtTime(currentVol, audioCtx.currentTime);

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, audioCtx.currentTime);

      synthGain.connect(filter);
      filter.connect(audioCtx.destination);

      const chordRoots = [
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [196.00, 246.94, 293.66, 369.99]  // Gmaj7
      ];
      const freqs = chordRoots[currentIdx % chordRoots.length];
      synthOscs = freqs.map(f => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        osc.connect(synthGain);
        osc.start();
        return osc;
      });
    } catch {}
  }

  function updateTrackDisplay() {
    const tr = tracks[currentIdx];
    if (!tr) return;
    duration = tr.duration || 215;
    if (titleEl) titleEl.textContent = tr.title;
    if (artistEl) {
      artistEl.innerHTML = `${tr.artist || ''} <span class="mp-album-sep">·</span> ${tr.album || ''}`;
    }
    if (vinylLabel && tr.cover) {
      vinylLabel.style.backgroundImage = `url("${tr.cover}")`;
    }
    if (totalTimeEl) totalTimeEl.textContent = fmt(duration);
    updateProgress();
    if (isPlaying) {
      playSynthChord();
    }
  }

  function updateProgress() {
    if (currentTimeEl) currentTimeEl.textContent = fmt(currentTime);
    const pct = Math.max(0, Math.min(100, (currentTime / duration) * 100));
    if (scrubberFill) scrubberFill.style.width = `${pct}%`;
    if (scrubberHandle) scrubberHandle.style.left = `${pct}%`;
    if (scrubberRail) scrubberRail.setAttribute('aria-valuenow', String(Math.round(currentTime)));
  }

  function setPlayingState(play, broadcast = true) {
    isPlaying = play;
    container.classList.toggle('is-playing', isPlaying);
    container.classList.toggle('is-paused', !isPlaying);
    if (vinylDisc) vinylDisc.classList.toggle('is-spinning', isPlaying);
    if (playIcon) playIcon.style.display = isPlaying ? 'none' : '';
    if (pauseIcon) pauseIcon.style.display = isPlaying ? '' : 'none';
    if (playPauseBtn) {
      const label = isPlaying ? 'Pause' : 'Play';
      playPauseBtn.setAttribute('title', label);
      playPauseBtn.setAttribute('aria-label', label);
    }

    if (isPlaying) {
      playSynthChord();
      if (!timer) {
        timer = setInterval(() => {
          currentTime += 1;
          if (currentTime >= duration) {
            if (isRepeating) {
              currentTime = 0;
            } else {
              stepTrack(1);
            }
          }
          updateProgress();
        }, 1000);
      }
    } else {
      stopSynth();
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    if (broadcast) syncState(true);
  }

  function stepTrack(delta, broadcast = true) {
    if (isShuffled && tracks.length > 1) {
      let next;
      do {
        next = Math.floor(Math.random() * tracks.length);
      } while (next === currentIdx);
      currentIdx = next;
    } else {
      currentIdx = (currentIdx + delta + tracks.length) % tracks.length;
    }
    currentTime = 0;
    updateTrackDisplay();
    if (broadcast) syncState(true);
  }

  const onPlayPause = (e) => {
    e.stopPropagation();
    setPlayingState(!isPlaying);
  };
  playPauseBtn?.addEventListener('click', onPlayPause);

  const onPrev = (e) => {
    e.stopPropagation();
    if (currentTime > 3) {
      currentTime = 0;
      updateProgress();
      syncState(true);
    } else {
      stepTrack(-1);
    }
  };
  prevBtn?.addEventListener('click', onPrev);

  const onNext = (e) => {
    e.stopPropagation();
    stepTrack(1);
  };
  nextBtn?.addEventListener('click', onNext);

  const onShuffle = (e) => {
    e.stopPropagation();
    isShuffled = !isShuffled;
    shuffleBtn?.classList.toggle('active', isShuffled);
    syncState(true);
  };
  shuffleBtn?.addEventListener('click', onShuffle);

  const onRepeat = (e) => {
    e.stopPropagation();
    isRepeating = !isRepeating;
    repeatBtn?.classList.toggle('active', isRepeating);
    syncState(true);
  };
  repeatBtn?.addEventListener('click', onRepeat);

  const onScrubberClick = (e) => {
    e.stopPropagation();
    if (!scrubberRail || !scrubberRail.getBoundingClientRect) return;
    const rect = scrubberRail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
    currentTime = Math.round(ratio * duration);
    updateProgress();
    syncState(false);
  };
  scrubberRail?.addEventListener('click', onScrubberClick);

  const updateVolume = (newVol, broadcast = true) => {
    volume = Math.max(0, Math.min(100, newVol));
    isMuted = volume === 0;
    if (volFill) volFill.style.width = `${volume}%`;
    if (volLabel) volLabel.textContent = `${volume}%`;
    if (synthGain && audioCtx) {
      try {
        synthGain.gain.setValueAtTime((volume / 100) * 0.08, audioCtx.currentTime);
      } catch {}
    }
    if (broadcast) syncState(false);
  };

  const onVolRailClick = (e) => {
    e.stopPropagation();
    if (!volRail || !volRail.getBoundingClientRect) return;
    const rect = volRail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / (rect.width || 1)));
    updateVolume(Math.round(ratio * 100));
  };
  volRail?.addEventListener('click', onVolRailClick);

  const onMuteClick = (e) => {
    e.stopPropagation();
    if (isMuted) {
      updateVolume(prevVolume || 80);
    } else {
      prevVolume = volume;
      updateVolume(0);
    }
  };
  volBtn?.addEventListener('click', onMuteClick);

  if (isPlaying) {
    setPlayingState(true, false);
  }

  return () => {
    if (timer) clearInterval(timer);
    stopSynth();
    if (audioCtx) {
      try { audioCtx.close(); } catch {}
    }
    playPauseBtn?.removeEventListener('click', onPlayPause);
    prevBtn?.removeEventListener('click', onPrev);
    nextBtn?.removeEventListener('click', onNext);
    shuffleBtn?.removeEventListener('click', onShuffle);
    repeatBtn?.removeEventListener('click', onRepeat);
    scrubberRail?.removeEventListener('click', onScrubberClick);
    volRail?.removeEventListener('click', onVolRailClick);
    volBtn?.removeEventListener('click', onMuteClick);
    stateBridge.destroy();
  };
}

/**
 * Smart Device Switchboard Engine.
 * Controls individual device power relays, brightness dimmer sliders, HVAC multi-stage fan speed,
 * and quick-scene presets while dynamically recalculating total active power consumption.
 */
export function initDeviceSwitchboard(tile, config = {}, context = {}) {
  const container = tile.querySelector('.device-switchboard');
  if (!container) return undefined;

  let devices = [];
  try {
    devices = JSON.parse(container.dataset.devices || '[]');
  } catch {}
  if (!Array.isArray(devices) || devices.length === 0) {
    devices = [
      { id: "light-main", name: "Living Room Lighting", type: "light", state: true, level: 85, watts: 45 },
      { id: "hvac-unit", name: "Climate HVAC Unit", type: "climate", state: true, mode: "cool", fanSpeed: 2, watts: 580 },
      { id: "desk-power", name: "Workstation Desk Relay", type: "power", state: true, surge: false, watts: 180 },
      { id: "security-gate", name: "Perimeter Security Gate", type: "security", state: false, alert: false, watts: 25 },
    ];
  }

  const stateBridge = bindInteractiveState({
    key: `${context.canvasId || 'default'}:${context.instanceId || 'device-switchboard'}`,
    mode: config.stateMode || 'global',
    defaultState: { devices },
    onUpdate(state) {
      if (Array.isArray(state?.devices)) {
        for (const inc of state.devices) {
          const d = devices.find(x => x.id === inc.id);
          if (d) {
            d.state = inc.state;
            if (inc.level !== undefined) d.level = inc.level;
            if (inc.fanSpeed !== undefined) d.fanSpeed = inc.fanSpeed;
            syncCard(d);
          }
        }
        updateHeaderStats();
      }
    }
  });

  function syncDevices(immediate = false) {
    stateBridge.setState({ devices }, immediate);
  }

  const maxWatts = 1200;
  const wattsValEl = container.querySelector('.sw-watts-val b');
  const gaugeFillEl = container.querySelector('.sw-gauge-fill');

  function calculateWatts() {
    let total = 0;
    for (const d of devices) {
      if (d.state) {
        if (d.type === 'light') {
          total += Math.round((d.watts || 45) * ((d.level || 85) / 100));
        } else if (d.type === 'climate') {
          const spd = d.fanSpeed || 2;
          total += spd === 1 ? 240 : spd === 2 ? 480 : 720;
        } else {
          total += Number(d.watts || 0);
        }
      }
    }
    return total;
  }

  function updateHeaderStats() {
    const total = calculateWatts();
    if (wattsValEl) wattsValEl.textContent = String(total);
    const loadPct = Math.min(100, Math.round((total / maxWatts) * 100));
    if (gaugeFillEl) gaugeFillEl.style.width = `${loadPct}%`;
  }

  function syncCard(d) {
    const card = container.querySelector(`.sw-card[data-id="${d.id}"]`);
    if (!card) return;

    card.classList.toggle('is-active', Boolean(d.state));
    card.classList.toggle('is-disabled', !d.state);

    const toggleBtn = card.querySelector('.sw-toggle-btn');
    if (toggleBtn) toggleBtn.classList.toggle('checked', Boolean(d.state));

    const icon = card.querySelector('.sw-icon');
    if (icon) icon.classList.toggle('is-on', Boolean(d.state));

    const subEl = card.querySelector('.sw-state-sub');
    if (subEl) {
      if (d.type === 'security') {
        subEl.textContent = d.state ? 'ARMED · SECURED' : 'DISARMED';
      } else if (d.type === 'light') {
        subEl.textContent = d.state ? `${d.level || 85}% DIMMER` : 'STANDBY';
      } else if (d.type === 'climate') {
        subEl.textContent = d.state ? `COOLING · FAN ${d.fanSpeed || 2}` : 'STANDBY';
      } else {
        subEl.textContent = d.state ? 'RELAY ON' : 'STANDBY';
      }
    }

    const slider = card.querySelector('input.sw-slider');
    if (slider) {
      slider.disabled = !d.state;
      if (d.level !== undefined) slider.value = String(d.level);
    }
    const dimmerVal = card.querySelector('.sw-dimmer-val');
    if (dimmerVal && d.level !== undefined) dimmerVal.textContent = `${d.level}%`;

    const fanButtons = card.querySelectorAll('.sw-fan-opt');
    fanButtons.forEach(btn => {
      btn.disabled = !d.state;
      const spd = Number(btn.dataset.speed);
      btn.classList.toggle('active', spd === d.fanSpeed);
    });

    const powerVal = card.querySelector('.sw-power-meta b');
    if (powerVal) powerVal.textContent = `${d.state ? d.watts : 0} W`;
  }

  const onToggleClick = (e) => {
    const btn = e.target.closest('.sw-toggle-btn');
    if (!btn) return;
    e.stopPropagation();
    const id = btn.dataset.id;
    const device = devices.find(d => d.id === id);
    if (!device) return;
    device.state = !device.state;
    syncCard(device);
    updateHeaderStats();
    syncDevices(true);
  };
  container.addEventListener('click', onToggleClick);

  const onSliderInput = (e) => {
    const slider = e.target.closest('input.sw-slider');
    if (!slider) return;
    const id = slider.dataset.id;
    const device = devices.find(d => d.id === id);
    if (!device) return;
    device.level = Number(slider.value);
    const card = container.querySelector(`.sw-card[data-id="${id}"]`);
    if (card) {
      const dimmerVal = card.querySelector('.sw-dimmer-val');
      if (dimmerVal) dimmerVal.textContent = `${device.level}%`;
      const subEl = card.querySelector('.sw-state-sub');
      if (subEl && device.state) subEl.textContent = `${device.level}% DIMMER`;
    }
    updateHeaderStats();
    syncDevices(false);
  };
  container.addEventListener('input', onSliderInput);

  const onFanClick = (e) => {
    const btn = e.target.closest('.sw-fan-opt');
    if (!btn || btn.disabled) return;
    e.stopPropagation();
    const id = btn.dataset.id;
    const spd = Number(btn.dataset.speed);
    const device = devices.find(d => d.id === id);
    if (!device) return;
    device.fanSpeed = spd;
    syncCard(device);
    updateHeaderStats();
    syncDevices(true);
  };
  container.addEventListener('click', onFanClick);

  const onSceneClick = (e) => {
    const pill = e.target.closest('.sw-scene-pill');
    if (!pill) return;
    e.stopPropagation();
    const scene = pill.dataset.scene;
    if (scene === 'all-off') {
      devices.forEach(d => { d.state = false; });
    } else if (scene === 'eco') {
      devices.forEach(d => {
        d.state = true;
        if (d.type === 'light') d.level = 35;
        if (d.type === 'climate') d.fanSpeed = 1;
      });
    } else if (scene === 'full-power') {
      devices.forEach(d => {
        d.state = true;
        if (d.type === 'light') d.level = 100;
        if (d.type === 'climate') d.fanSpeed = 3;
      });
    }
    devices.forEach(syncCard);
    updateHeaderStats();
    syncDevices(true);
  };
  container.addEventListener('click', onSceneClick);

  return () => {
    container.removeEventListener('click', onToggleClick);
    container.removeEventListener('input', onSliderInput);
    container.removeEventListener('click', onFanClick);
    container.removeEventListener('click', onSceneClick);
    stateBridge.destroy();
  };
}

/**
 * Task & Operations Matrix Engine.
 * Supports task completion toggling, SVG circular gauge calculation, priority cycling,
 * task filtering (all/active/done), and inline task creation/deletion.
 */
export function initTaskMatrix(tile, config = {}, context = {}) {
  const container = tile.querySelector('.task-matrix');
  if (!container) return undefined;

  let tasks = [];
  try {
    tasks = JSON.parse(container.dataset.tasks || '[]');
  } catch {}
  if (!Array.isArray(tasks) || tasks.length === 0) {
    tasks = [
      { id: "t1", text: "Deploy edge telemetry sync", done: true, priority: "high" },
      { id: "t2", text: "Calibrate thermal dissipation sensors", done: true, priority: "normal" },
      { id: "t3", text: "Review perimeter incident alert log", done: false, priority: "urgent" },
      { id: "t4", text: "Verify dual ping-pong kiosk buffer", done: false, priority: "normal" },
    ];
  }

  let filter = container.dataset.filter || 'all';
  const listEl = container.querySelector('.tm-list');
  const ringBar = container.querySelector('.tm-ring-bar');
  const ringText = container.querySelector('.tm-ring-text');
  const doneCountEl = container.querySelector('.tm-done-count');
  const addInput = container.querySelector('.tm-add-input');
  const addBtn = container.querySelector('.tm-add-btn');

  const stateBridge = bindInteractiveState({
    key: `${context.canvasId || 'default'}:${context.instanceId || 'task-matrix'}`,
    mode: config.stateMode || 'global',
    defaultState: { tasks, filter },
    onUpdate(state) {
      if (!state) return;
      if (Array.isArray(state.tasks)) {
        tasks = state.tasks;
        if (listEl) {
          listEl.innerHTML = '';
          tasks.forEach(t => listEl.appendChild(renderItem(t)));
        }
        updateMetrics();
        applyFilter();
      }
      if (typeof state.filter === 'string' && state.filter !== filter) {
        filter = state.filter;
        container.querySelectorAll('.tm-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === filter));
        applyFilter();
      }
    }
  });

  function syncTasks(immediate = true) {
    stateBridge.setState({ tasks, filter }, immediate);
  }

  function updateMetrics() {
    const completed = tasks.filter(t => t.done).length;
    const total = tasks.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    if (doneCountEl) doneCountEl.textContent = String(completed);
    if (ringText) ringText.textContent = `${pct}%`;
    if (ringBar) {
      const circum = 88;
      const offset = (circum * (1 - pct / 100)).toFixed(1);
      ringBar.style.strokeDashoffset = offset;
    }
  }

  function applyFilter() {
    const items = container.querySelectorAll('.tm-item');
    items.forEach(item => {
      const id = item.dataset.id;
      const t = tasks.find(x => x.id === id);
      if (!t) return;
      if (filter === 'all') {
        item.style.display = '';
      } else if (filter === 'active') {
        item.style.display = t.done ? 'none' : '';
      } else if (filter === 'done') {
        item.style.display = t.done ? '' : 'none';
      }
    });
  }

  function renderItem(t) {
    const li = document.createElement('li');
    const prioClass = t.priority === 'urgent' ? 'tm-prio-urgent' : t.priority === 'high' ? 'tm-prio-high' : 'tm-prio-normal';
    li.className = `tm-item ${t.done ? 'is-done' : ''}`;
    li.dataset.id = t.id;
    li.dataset.priority = t.priority || 'normal';
    li.innerHTML = `
      <button type="button" class="tm-checkbox ${t.done ? 'checked' : ''}" data-action="toggle" data-id="${t.id}" aria-label="Toggle task">
        <svg class="tm-check-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <span class="tm-item-text">${t.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
      <button type="button" class="tm-badge ${prioClass}" data-action="priority" data-id="${t.id}" title="Click to cycle priority">
        ${(t.priority || 'NORMAL').toUpperCase()}
      </button>
      <button type="button" class="tm-del-btn" data-action="delete" data-id="${t.id}" title="Delete objective" aria-label="Delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;
    return li;
  }

  const onClick = (e) => {
    const chk = e.target.closest('[data-action="toggle"]');
    if (chk) {
      e.stopPropagation();
      const id = chk.dataset.id;
      const t = tasks.find(x => x.id === id);
      if (!t) return;
      t.done = !t.done;
      const item = container.querySelector(`.tm-item[data-id="${id}"]`);
      if (item) {
        item.classList.toggle('is-done', t.done);
        chk.classList.toggle('checked', t.done);
      }
      updateMetrics();
      applyFilter();
      syncTasks(true);
      return;
    }

    const badge = e.target.closest('[data-action="priority"]');
    if (badge) {
      e.stopPropagation();
      const id = badge.dataset.id;
      const t = tasks.find(x => x.id === id);
      if (!t) return;
      const nextPrio = t.priority === 'normal' ? 'high' : t.priority === 'high' ? 'urgent' : 'normal';
      t.priority = nextPrio;
      badge.className = `tm-badge tm-prio-${nextPrio}`;
      badge.textContent = nextPrio.toUpperCase();
      const item = container.querySelector(`.tm-item[data-id="${id}"]`);
      if (item) item.dataset.priority = nextPrio;
      syncTasks(true);
      return;
    }

    const del = e.target.closest('[data-action="delete"]');
    if (del) {
      e.stopPropagation();
      const id = del.dataset.id;
      const idx = tasks.findIndex(x => x.id === id);
      if (idx !== -1) {
        tasks.splice(idx, 1);
        const item = container.querySelector(`.tm-item[data-id="${id}"]`);
        if (item) item.remove();
        updateMetrics();
        syncTasks(true);
      }
      return;
    }

    const tab = e.target.closest('.tm-tab');
    if (tab) {
      e.stopPropagation();
      filter = tab.dataset.filter || 'all';
      container.querySelectorAll('.tm-tab').forEach(t => t.classList.toggle('active', t === tab));
      applyFilter();
      syncTasks(true);
      return;
    }
  };
  container.addEventListener('click', onClick);

  const addNewTask = () => {
    if (!addInput) return;
    const text = addInput.value.trim();
    if (!text) return;
    const newId = 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const newTask = { id: newId, text, done: false, priority: 'normal' };
    tasks.push(newTask);
    if (listEl) {
      const li = renderItem(newTask);
      listEl.appendChild(li);
    }
    addInput.value = '';
    updateMetrics();
    applyFilter();
    syncTasks(true);
  };

  const onAddBtn = (e) => {
    e.stopPropagation();
    addNewTask();
  };
  addBtn?.addEventListener('click', onAddBtn);

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewTask();
    }
  };
  addInput?.addEventListener('keydown', onKeyDown);

  return () => {
    container.removeEventListener('click', onClick);
    addBtn?.removeEventListener('click', onAddBtn);
    addInput?.removeEventListener('keydown', onKeyDown);
    stateBridge.destroy();
  };
}

/**
 * Quick Notes & Sticky Board Engine.
 * Supports dual state modes:
 * - 'cookie': Personal notes stored on server identified by user cookie (ld_client_id).
 * - 'global': Shared bulletin board synced live across all screens and windows.
 * - 'stateless': Temporary local scratchpad.
 */
export function initQuickNotes(tile, config = {}, context = {}) {
  const container = tile.querySelector('.quick-notes');
  if (!container) return undefined;

  const textarea = container.querySelector('.qn-textarea');
  const charsEl = container.querySelector('.qn-chars');
  const statusEl = container.querySelector('.qn-status');
  const statusTextEl = container.querySelector('.qn-status-text');
  const clearBtn = container.querySelector('.qn-clear-btn');

  const stateMode = config.stateMode === 'global' ? 'global' : config.stateMode === 'stateless' ? 'stateless' : 'cookie';
  let saveDebounceTimer = null;

  const stateBridge = bindInteractiveState({
    key: `${context.canvasId || 'default'}:${context.instanceId || 'quick-notes'}`,
    mode: stateMode,
    defaultState: { text: typeof config.text === 'string' ? config.text : '', updatedAt: Date.now() },
    debounceMs: 200,
    onUpdate(state, isInitial) {
      if (state && typeof state.text === 'string') {
        if (document.activeElement !== textarea || isInitial) {
          if (textarea) textarea.value = state.text;
          if (charsEl) charsEl.textContent = String(state.text.length);
        }
        if (statusEl) {
          statusEl.classList.remove('is-saving');
          if (statusTextEl) statusTextEl.textContent = 'Saved';
        }
      }
    },
  });

  const onInput = () => {
    if (!textarea) return;
    const text = textarea.value;
    if (charsEl) charsEl.textContent = String(text.length);
    if (statusEl) {
      statusEl.classList.add('is-saving');
      if (statusTextEl) statusTextEl.textContent = 'Saving...';
    }
    stateBridge.setState({ text, updatedAt: Date.now() });

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      if (statusEl) {
        statusEl.classList.remove('is-saving');
        if (statusTextEl) statusTextEl.textContent = 'Saved';
      }
    }, 250);
  };
  textarea?.addEventListener('input', onInput);

  const onClear = (e) => {
    e.stopPropagation();
    if (!textarea) return;
    textarea.value = '';
    if (charsEl) charsEl.textContent = '0';
    stateBridge.setState({ text: '', updatedAt: Date.now() }, true);
    if (statusEl) {
      statusEl.classList.remove('is-saving');
      if (statusTextEl) statusTextEl.textContent = 'Saved';
    }
  };
  clearBtn?.addEventListener('click', onClear);

  return () => {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    textarea?.removeEventListener('input', onInput);
    clearBtn?.removeEventListener('click', onClear);
    stateBridge.destroy();
  };
}

/**
 * Consolidated Universal App Emitter SSE Stream.
 * Connects directly to backend state relay via single SSE (/api/v1/emitters/events)
 * and fans out events to active widget tiles.
 */
let sharedEmitterEventSource = null;
const emitterListeners = new Set();

function getSharedEmitterEventSource() {
  if (typeof EventSource === 'undefined') return null;
  if (!sharedEmitterEventSource) {
    try {
      sharedEmitterEventSource = new EventSource('/api/v1/emitters/events');
      sharedEmitterEventSource.addEventListener('emitter_update', (e) => {
        try {
          const data = JSON.parse(e.data);
          emitterListeners.forEach((fn) => fn('emitter_update', data));
        } catch {}
      });
      sharedEmitterEventSource.addEventListener('emitter_status', (e) => {
        try {
          const data = JSON.parse(e.data);
          emitterListeners.forEach((fn) => fn('emitter_status', data));
        } catch {}
      });
      sharedEmitterEventSource.addEventListener('emitter_pruned', (e) => {
        try {
          const data = JSON.parse(e.data);
          emitterListeners.forEach((fn) => fn('emitter_pruned', data));
        } catch {}
      });
      sharedEmitterEventSource.onerror = () => {
        // Auto-reconnect managed by browser EventSource
      };
    } catch {}
  }
  return sharedEmitterEventSource;
}

function subscribeEmitterEvents(callback) {
  emitterListeners.add(callback);
  getSharedEmitterEventSource();
  return () => {
    emitterListeners.delete(callback);
    if (emitterListeners.size === 0 && sharedEmitterEventSource) {
      try { sharedEmitterEventSource.close(); } catch {}
      sharedEmitterEventSource = null;
    }
  };
}

export function initEmitterWidget(tile, config = {}, context = {}) {
  const container = tile.querySelector('.emitter-widget');
  if (!container) return undefined;

  const emitterId = config.emitterId || container.dataset.emitterId || 'default-emitter';
  const isMedia = container.classList.contains('emitter-media');

  // Command button handler
  const onCommandClick = async (e) => {
    const btn = e.target.closest('[data-action="command"]');
    if (!btn) return;
    e.stopPropagation();

    const command = btn.dataset.command;
    if (!command) return;

    btn.style.transform = 'scale(0.92)';
    setTimeout(() => { btn.style.transform = ''; }, 120);

    try {
      await fetch(`/api/v1/emitters/${encodeURIComponent(emitterId)}/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command }),
      });
    } catch (err) {
      console.warn(`[EmitterWidget] command '${command}' failed:`, err);
    }
  };
  container.addEventListener('click', onCommandClick);

  // Time format helper (seconds -> mm:ss)
  const formatTime = (s) => {
    const secNum = Math.max(0, Math.floor(Number(s) || 0));
    const m = Math.floor(secNum / 60);
    const sec = Math.floor(secNum % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // Interactive scrubber / seek bar handler
  const progressBar = container.querySelector('.em-progress-bar');
  const onProgressClick = async (e) => {
    if (!progressBar) return;
    e.stopPropagation();
    const rect = progressBar.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const timeSpans = container.querySelectorAll('.em-time-labels span');
    let dur = 0;
    if (timeSpans.length >= 2) {
      const parts = timeSpans[1].textContent.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        dur = parts[0] * 60 + parts[1];
      }
    }
    if (dur <= 0) dur = 180;
    const seekSec = Math.round(ratio * dur);

    const fillEl = container.querySelector('.em-progress-fill');
    if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;
    if (timeSpans.length >= 2) timeSpans[0].textContent = formatTime(seekSec);

    try {
      await fetch(`/api/v1/emitters/${encodeURIComponent(emitterId)}/command`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: 'seek', payload: { position: seekSec } }),
      });
    } catch (err) {
      console.warn(`[EmitterWidget] seek failed:`, err);
    }
  };
  if (progressBar) progressBar.addEventListener('click', onProgressClick);

  // Subscribe to consolidated EventSource
  const unsubscribe = subscribeEmitterEvents((type, data) => {
    if (type === 'emitter_status') {
      if (data.id === emitterId) {
        const dot = container.querySelector('.em-pulse-dot');
        container.classList.remove('is-online', 'is-stale', 'is-offline');

        if (data.status === 'online') {
          container.classList.add('is-online');
          if (dot) dot.className = 'em-pulse-dot online';
        } else if (data.status === 'stale') {
          container.classList.add('is-stale');
          if (dot) dot.className = 'em-pulse-dot stale';
        } else if (data.status === 'offline' || data.status === 'terminated') {
          container.classList.add('is-offline');
          if (dot) dot.className = 'em-pulse-dot offline';
        }
      }
      return;
    }

    if (type === 'emitter_pruned') {
      if (data.id === emitterId) {
        tile.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        tile.style.opacity = '0';
        tile.style.transform = 'scale(0.92)';
        setTimeout(() => {
          tile.remove();
        }, 300);
      }
      return;
    }

    if (type === 'emitter_update') {
      const updatedId = data.manifest?.id || data.id;
      if (updatedId === emitterId) {
        const state = data.state || {};
        const dot = container.querySelector('.em-pulse-dot');
        if (dot) {
          dot.className = 'em-pulse-dot online';
        }
        container.classList.remove('is-stale', 'is-offline');
        container.classList.add('is-online');

        if (isMedia) {
          const isPlaying = Boolean(state.playing);
          container.classList.toggle('is-playing', isPlaying);

          const eqBars = container.querySelector('.em-eq-bars');
          if (eqBars) eqBars.classList.toggle('active', isPlaying);

          const playPauseBtn = container.querySelector('.em-play-pause');
          if (playPauseBtn) {
            playPauseBtn.classList.toggle('playing', isPlaying);
            playPauseBtn.title = isPlaying ? 'Pause' : 'Play';
            playPauseBtn.innerHTML = isPlaying
              ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
              : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
          }

          if (state.title || state.track) {
            const titleEl = container.querySelector('.em-track-title');
            if (titleEl) titleEl.textContent = state.title || state.track;
          }
          if (state.artist || state.channel) {
            const artistEl = container.querySelector('.em-track-artist');
            if (artistEl) artistEl.textContent = state.artist || state.channel;
          }
          if (state.album) {
            const albumEl = container.querySelector('.em-track-album');
            if (albumEl) albumEl.textContent = state.album;
          }
          if (state.coverUrl || state.cover || state.thumbnail) {
            const coverImg = container.querySelector('.em-cover');
            const coverWrap = container.querySelector('.em-cover-wrap');
            const src = state.coverUrl || state.cover || state.thumbnail;
            if (coverImg) {
              coverImg.src = src;
            } else if (coverWrap) {
              const img = document.createElement('img');
              img.className = 'em-cover';
              img.src = src;
              img.alt = 'Album cover';
              coverWrap.prepend(img);
              coverWrap.querySelector('.em-cover-fallback')?.remove();
            }
          }

          const currentTime = Number(state.currentTime ?? state.position);
          const duration = Number(state.duration);
          if (Number.isFinite(currentTime) && Number.isFinite(duration) && duration > 0) {
            const pct = Math.min(100, Math.max(0, Math.round((currentTime / duration) * 100)));
            const fillEl = container.querySelector('.em-progress-fill');
            if (fillEl) fillEl.style.width = `${pct}%`;

            const timeSpans = container.querySelectorAll('.em-time-labels span');
            if (timeSpans.length >= 2) {
              timeSpans[0].textContent = formatTime(currentTime);
              timeSpans[1].textContent = formatTime(duration);
            }
          }
        } else {
          const grid = container.querySelector('.em-grid');
          if (grid && typeof state === 'object') {
            const cards = grid.querySelectorAll('.em-metric-card');
            for (const card of cards) {
              const label = card.querySelector('.em-m-label')?.textContent?.toLowerCase();
              if (label && state[label] !== undefined) {
                const valEl = card.querySelector('.em-m-val');
                if (valEl) valEl.textContent = String(state[label]);
              }
            }
          }
        }
      }
    }
  });

  return () => {
    container.removeEventListener('click', onCommandClick);
    if (progressBar) progressBar.removeEventListener('click', onProgressClick);
    unsubscribe();
  };
}

export { clearWidgetFrames } from './widget-host.js';
export { CanvasVariableStore, setActiveVariableStore, getActiveVariableStore } from './canvas-variables.js';

