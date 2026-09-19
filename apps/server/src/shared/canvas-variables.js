// Reactive In-Memory Global Variable Store for Glansk Canvas & Widgets.
// Provides sub-millisecond local reactivity for conditional visibility, widget bindings,
// action triggers (e.g. buttons), and cross-widget synchronization.

import { canvasBus, localSessionId } from './widget-event-bus.js';

const FORBIDDEN_VAR_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * @typedef {'string' | 'number' | 'boolean' | 'json'} VariableType
 * 
 * @typedef {Object} VariableDefinition
 * @property {string} name
 * @property {VariableType} type
 * @property {any} defaultValue
 * @property {string} [description]
 * @property {boolean} [persist]
 */

export class CanvasVariableStore {
  /**
   * @param {Record<string, VariableDefinition>} [initialDefs={}]
   * @param {string} [canvasId='default']
   */
  constructor(initialDefs = {}, canvasId = 'default') {
    this.canvasId = canvasId;
    /** @type {Map<string, any>} */
    this.values = new Map();
    /** @type {Map<string, VariableDefinition>} */
    this.definitions = new Map();
    /** @type {Map<string, Set<Function>>} */
    this.watchers = new Map();
    /** @type {Set<Function>} */
    this.globalWatchers = new Set();
    this.isDestroyed = false;
    this.bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ld_canvas_variables') : null;

    // Initialize definitions and initial values
    if (initialDefs && typeof initialDefs === 'object') {
      for (const [key, def] of Object.entries(initialDefs)) {
        if (!def || typeof def !== 'object') continue;
        const name = String(def.name || key);
        if (FORBIDDEN_VAR_NAMES.has(name)) continue;
        const normalized = {
          name,
          type: def.type || 'string',
          defaultValue: def.defaultValue !== undefined ? def.defaultValue : '',
          description: def.description || '',
          persist: Boolean(def.persist),
        };
        this.definitions.set(normalized.name, normalized);
        this.values.set(normalized.name, structuredClone(normalized.defaultValue));
      }
    }

    // Cross-window / cross-tab broadcast sync
    this._onBcMessage = (e) => {
      if (this.isDestroyed || !e?.data) return;
      const { canvasId: msgCanvasId, name, value, senderId } = e.data;
      if (senderId === localSessionId) return;
      if (msgCanvasId && msgCanvasId !== this.canvasId) return;
      this._applyLocal(name, value, false);
    };

    if (this.bc) {
      this.bc.addEventListener('message', this._onBcMessage);
    }
  }

  /**
   * Casts value to match declared variable type.
   */
  _cast(name, value) {
    const def = this.definitions.get(name);
    if (!def) return value;
    switch (def.type) {
      case 'boolean':
        return typeof value === 'boolean' ? value : String(value) === 'true' || value === 1 || value === '1';
      case 'number': {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      }
      case 'json':
        if (typeof value === 'object' && value !== null) return value;
        try { return JSON.parse(value); } catch { return value; }
      case 'string':
      default:
        return value !== undefined && value !== null ? String(value) : '';
    }
  }

  get(name) {
    if (this.values.has(name)) {
      return this.values.get(name);
    }
    const def = this.definitions.get(name);
    return def ? def.defaultValue : undefined;
  }

  getAll() {
    const res = {};
    // Include all defined variables with fallback
    for (const [name, def] of this.definitions) {
      res[name] = def.defaultValue;
    }
    // Overlay current runtime values
    for (const [name, val] of this.values) {
      res[name] = val;
    }
    return res;
  }

  getDefinitions() {
    const res = {};
    for (const [name, def] of this.definitions) {
      res[name] = { ...def };
    }
    return res;
  }

  define(def) {
    if (!def || !def.name) return;
    const name = String(def.name);
    if (FORBIDDEN_VAR_NAMES.has(name)) return;
    const normalized = {
      name,
      type: def.type || 'string',
      defaultValue: def.defaultValue !== undefined ? def.defaultValue : '',
      description: def.description || '',
      persist: Boolean(def.persist),
      isOutput: Boolean(def.isOutput),
      sourceInstanceId: def.sourceInstanceId || undefined,
      sourceWidgetId: def.sourceWidgetId || undefined,
    };
    this.definitions.set(normalized.name, normalized);
    if (!this.values.has(normalized.name)) {
      this.values.set(normalized.name, structuredClone(normalized.defaultValue));
    }
  }

  registerOutputVariables(instanceId, widgetId, outputDefs) {
    if (!outputDefs || typeof outputDefs !== 'object') return;
    for (const [key, def] of Object.entries(outputDefs)) {
      if (!def || typeof def !== 'object') continue;
      const baseName = def.name || key;
      const varName = `wig${instanceId}-${baseName}`;
      const normalized = {
        name: varName,
        type: def.type || 'string',
        defaultValue: def.defaultValue !== undefined ? def.defaultValue : '',
        description: def.description || `Output variable from ${widgetId}`,
        persist: false,
        isOutput: true,
        sourceInstanceId: instanceId,
        sourceWidgetId: widgetId,
      };
      this.define(normalized);

      // Also register alias under widgetId for convenience
      if (widgetId && instanceId !== widgetId) {
        const aliasName = `wig${widgetId}-${baseName}`;
        if (!this.definitions.has(aliasName)) {
          this.define({
            ...normalized,
            name: aliasName,
          });
        }
      }
    }
  }

  remove(name) {
    this.definitions.delete(name);
    this.values.delete(name);
    this.watchers.delete(name);
  }

  set(name, rawValue) {
    if (!name || FORBIDDEN_VAR_NAMES.has(String(name))) return;
    const nextVal = this._cast(name, rawValue);
    this._applyLocal(name, nextVal, true);

    // If an instance output variable (e.g. wigInst1-count) is set, also mirror to its alias (e.g. wigBtn-count)
    const def = this.definitions.get(name);
    if (def?.isOutput && def.sourceInstanceId && def.sourceWidgetId && def.sourceInstanceId !== def.sourceWidgetId) {
      const match = name.match(/^wig.+?-(.+)$/);
      if (match) {
        const baseName = match[1];
        const aliasName = `wig${def.sourceWidgetId}-${baseName}`;
        if (this.definitions.has(aliasName) && aliasName !== name) {
          this._applyLocal(aliasName, nextVal, true);
        }
      }
    }
  }

  toggle(name) {
    const current = Boolean(this.get(name));
    this.set(name, !current);
  }

  increment(name, step = 1) {
    const current = Number(this.get(name)) || 0;
    this.set(name, current + (Number(step) || 1));
  }

  _applyLocal(name, nextVal, broadcast = true) {
    if (!name || FORBIDDEN_VAR_NAMES.has(String(name))) return;
    const prevVal = this.values.get(name);
    if (prevVal === nextVal && this.values.has(name)) return;

    this.values.set(name, nextVal);

    // Notify variable-specific watchers
    const set = this.watchers.get(name);
    if (set) {
      for (const cb of set) {
        try { cb(nextVal, prevVal); } catch (err) { console.error(err); }
      }
    }

    // Notify global watchers
    for (const cb of this.globalWatchers) {
      try { cb(name, nextVal, prevVal); } catch (err) { console.error(err); }
    }

    // Emit on local canvas event bus
    canvasBus.publish(`variable:${name}`, { name, value: nextVal, prev: prevVal });
    canvasBus.publish('canvas:variables_changed', { name, value: nextVal, all: this.getAll() });

    // Cross-tab broadcast
    if (broadcast && this.bc) {
      try {
        this.bc.postMessage({
          canvasId: this.canvasId,
          name,
          value: nextVal,
          senderId: localSessionId,
        });
      } catch {}
    }
  }

  watch(name, handler) {
    let set = this.watchers.get(name);
    if (!set) {
      set = new Set();
      this.watchers.set(name, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this.watchers.delete(name);
    };
  }

  watchAll(handler) {
    this.globalWatchers.add(handler);
    return () => {
      this.globalWatchers.delete(handler);
    };
  }

  destroy() {
    this.isDestroyed = true;
    if (this.bc) {
      try {
        this.bc.removeEventListener('message', this._onBcMessage);
        this.bc.close();
      } catch {}
      this.bc = null;
    }
    this.watchers.clear();
    this.globalWatchers.clear();
    this.values.clear();
    this.definitions.clear();
  }
}

// Global active store instance holder (for current active canvas)
let activeCanvasVariableStore = null;

export function getActiveVariableStore() {
  return activeCanvasVariableStore;
}

export function setActiveVariableStore(store) {
  activeCanvasVariableStore = store;
  if (typeof window !== 'undefined') {
    window.__GlanskVariables = store;
  }
}

/**
 * Safe Recursive Descent / Shunting-Yard Arithmetic Parser (Zero eval / Zero Function)
 */
function safeMathEval(expr) {
  const tokens = expr.match(/\d+(\.\d+)?|[+\-*/%()]/g);
  if (!tokens) return NaN;

  let parens = 0;
  for (const t of tokens) {
    if (t === '(') parens++;
    else if (t === ')') parens--;
    if (parens < 0) return NaN;
  }
  if (parens !== 0) return NaN;

  let pos = 0;

  function parseExpression() {
    let value = parseTerm();
    while (pos < tokens.length) {
      const op = tokens[pos];
      if (op === '+' || op === '-') {
        pos++;
        const next = parseTerm();
        value = op === '+' ? value + next : value - next;
      } else {
        break;
      }
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (pos < tokens.length) {
      const op = tokens[pos];
      if (op === '*' || op === '/' || op === '%') {
        pos++;
        const next = parseFactor();
        if (op === '*') value = value * next;
        else if (op === '/') value = next !== 0 ? value / next : NaN;
        else if (op === '%') value = next !== 0 ? value % next : NaN;
      } else {
        break;
      }
    }
    return value;
  }

  function parseFactor() {
    if (pos >= tokens.length) return 0;
    const token = tokens[pos++];
    if (token === '(') {
      const val = parseExpression();
      if (tokens[pos] === ')') pos++;
      return val;
    }
    if (token === '-') {
      return -parseFactor();
    }
    if (token === '+') {
      return parseFactor();
    }
    const num = parseFloat(token);
    return Number.isFinite(num) ? num : 0;
  }

  const result = parseExpression();
  if (pos < tokens.length) return NaN;
  return result;
}

/**
 * Safe Zero-eval Expression Evaluator.
 * Supports:
 * - Variable interpolation: "{wig1-temp}°C ({wig1-status})"
 * - Safe Math arithmetic: "{val1} + 10", "{w} * {h} / 2"
 * - String functions: join(',', '{var1}', '{var2}')
 */
export function evaluateExpression(expr, variables = {}, fallback = '') {
  if (typeof expr !== 'string' || !expr) return fallback;

  // 1. Check for join('delim', arg1, arg2...)
  const joinMatch = expr.match(/^join\s*\(\s*(['"])(.*?)\1\s*,\s*(.+)\)$/i);
  if (joinMatch) {
    const delim = joinMatch[2];
    const argsRaw = joinMatch[3];
    const items = argsRaw.split(',').map(s => {
      s = s.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
      }
      if (s.startsWith('{') && s.endsWith('}')) {
        const v = s.slice(1, -1);
        return variables[v] !== undefined ? String(variables[v]) : '';
      }
      return variables[s] !== undefined ? String(variables[s]) : s;
    });
    return items.join(delim);
  }

  // 2. Interpolate variable placeholders: {variableName}
  let missingVarCount = 0;
  const interpolated = expr.replace(/\{([a-zA-Z0-9_\-.:]+)\}/g, (_, varName) => {
    const val = variables[varName];
    if (val === undefined || val === null) {
      missingVarCount++;
      return '';
    }
    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }
    if (typeof val === 'object') {
      try { return JSON.stringify(val); } catch { return ''; }
    }
    return String(val);
  });

  // If a mathematical formula references an undefined/missing variable, fail safe to fallback
  if (missingVarCount > 0 && /^[+\-*/%()\s\d.]+$/.test(interpolated)) {
    return fallback;
  }

  // 3. If the entire expression is a pure mathematical string (e.g. "12 + 5 * 2" or "24.5 - 4"), evaluate safely with parser
  const mathPattern = /^[\d\s.+\-*/%()]+$/;
  if (mathPattern.test(interpolated) && /[\d]/.test(interpolated) && /[+\-*/%]/.test(interpolated)) {
    try {
      const mathResult = safeMathEval(interpolated);
      if (Number.isFinite(mathResult)) {
        return mathResult;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }

  // 4. Return interpolated string or fallback if empty
  return interpolated !== '' ? interpolated : fallback;
}

/**
 * Resolves a potentially dynamic bound value from a variable store.
 * Accepts a literal value or a `{ $bind: { mode, variable, expression, fallback } }` object.
 * Optionally casts to expectedType ('boolean' | 'number' | 'string' | 'json').
 */
export function resolveDynamicValue(value, variableStore, fallback, expectedType) {
  let resolved;
  if (value && typeof value === 'object' && value.$bind && typeof value.$bind === 'object') {
    const bind = value.$bind;
    const fb = bind.fallback !== undefined ? bind.fallback : fallback;
    if (bind.mode === 'expression' && typeof bind.expression === 'string') {
      const vars = variableStore ? variableStore.getAll() : {};
      resolved = evaluateExpression(bind.expression, vars, fb);
    } else if (bind.mode === 'variable' && typeof bind.variable === 'string') {
      if (!variableStore) {
        resolved = fb;
      } else {
        const v = variableStore.get(bind.variable);
        resolved = v !== undefined && v !== null ? v : fb;
      }
    } else {
      resolved = fb;
    }
  } else {
    resolved = value !== undefined && value !== null ? value : fallback;
  }

  if (expectedType && resolved !== undefined && resolved !== null) {
    switch (expectedType) {
      case 'boolean':
        return typeof resolved === 'boolean' ? resolved : String(resolved) === 'true' || resolved === 1 || resolved === '1';
      case 'number': {
        const num = Number(resolved);
        return Number.isFinite(num) ? num : (Number(fallback) || 0);
      }
      case 'string':
        return String(resolved);
      case 'json':
        if (typeof resolved === 'object') return resolved;
        try { return JSON.parse(resolved); } catch { return resolved; }
      default:
        return resolved;
    }
  }

  return resolved;
}

/**
 * Recursively resolves all `$bind` structures inside an arbitrary config object.
 */
export function resolveDynamicConfig(config, variableStore) {
  if (!config || typeof config !== 'object') return config;
  if (Array.isArray(config)) {
    return config.map(item => resolveDynamicConfig(item, variableStore));
  }
  if (config.$bind && typeof config.$bind === 'object') {
    return resolveDynamicValue(config, variableStore, config.$bind.fallback);
  }
  const result = {};
  for (const [key, val] of Object.entries(config)) {
    result[key] = resolveDynamicConfig(val, variableStore);
  }
  return result;
}
