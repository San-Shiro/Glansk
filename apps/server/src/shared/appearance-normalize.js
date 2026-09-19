// Pure, zero-dependency appearance normalization and CSS serialization
// Shared across Vite Admin Studio and runtime Kiosk renderer.

/**
 * Normalizes scalar number or BoxSides into a consistent 4-way object:
 * { top: number, right: number, bottom: number, left: number, unit: "px" | "%" }
 */
export function normalizeBox(val, fallback = 0) {
  if (val == null) {
    return { top: fallback, right: fallback, bottom: fallback, left: fallback, unit: "px", linked: true };
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    return { top: val, right: val, bottom: val, left: val, unit: "px", linked: true };
  }
  if (typeof val === "object") {
    const unit = val.unit === "%" ? "%" : "px";
    const top = typeof val.top === "number" && Number.isFinite(val.top) ? val.top : fallback;
    const right = typeof val.right === "number" && Number.isFinite(val.right) ? val.right : fallback;
    const bottom = typeof val.bottom === "number" && Number.isFinite(val.bottom) ? val.bottom : fallback;
    const left = typeof val.left === "number" && Number.isFinite(val.left) ? val.left : fallback;
    const linked = val.linked !== false && top === right && right === bottom && bottom === left;
    return { top, right, bottom, left, unit, linked };
  }
  return { top: fallback, right: fallback, bottom: fallback, left: fallback, unit: "px", linked: true };
}

/**
 * Serializes a BoxSides object into standard CSS shorthand:
 * "top right bottom left" with appropriate units.
 */
export function boxToCss(box) {
  if (!box) return "0px";
  const b = normalizeBox(box, 0);
  const u = b.unit === "%" ? "%" : "px";
  if (b.top === b.right && b.right === b.bottom && b.bottom === b.left) {
    return `${b.top}${u}`;
  }
  if (b.top === b.bottom && b.right === b.left) {
    return `${b.top}${u} ${b.right}${u}`;
  }
  return `${b.top}${u} ${b.right}${u} ${b.bottom}${u} ${b.left}${u}`;
}

/**
 * Normalizes scalar number or CornerRadius into 4-corner object:
 * { tl: number, tr: number, br: number, bl: number, unit: "px" | "%" }
 */
export function normalizeRadius(val, fallback = 0) {
  if (val == null) {
    return { tl: fallback, tr: fallback, br: fallback, bl: fallback, unit: "px", linked: true };
  }
  if (typeof val === "number" && Number.isFinite(val)) {
    return { tl: val, tr: val, br: val, bl: val, unit: "px", linked: true };
  }
  if (typeof val === "object") {
    const unit = val.unit === "%" ? "%" : "px";
    const tl = typeof val.tl === "number" && Number.isFinite(val.tl) ? val.tl : fallback;
    const tr = typeof val.tr === "number" && Number.isFinite(val.tr) ? val.tr : fallback;
    const br = typeof val.br === "number" && Number.isFinite(val.br) ? val.br : fallback;
    const bl = typeof val.bl === "number" && Number.isFinite(val.bl) ? val.bl : fallback;
    const linked = val.linked !== false && tl === tr && tr === br && br === bl;
    return { tl, tr, br, bl, unit, linked };
  }
  return { tl: fallback, tr: fallback, br: fallback, bl: fallback, unit: "px", linked: true };
}

/**
 * Serializes a CornerRadius object into standard CSS border-radius order:
 * "top-left top-right bottom-right bottom-left"
 */
export function radiusToCss(radius) {
  if (!radius) return "0px";
  const r = normalizeRadius(radius, 0);
  const u = r.unit === "%" ? "%" : "px";
  if (r.tl === r.tr && r.tr === r.br && r.br === r.bl) {
    return `${r.tl}${u}`;
  }
  return `${r.tl}${u} ${r.tr}${u} ${r.br}${u} ${r.bl}${u}`;
}

/**
 * Resolves color reference or literal:
 * - In "cssVar" mode: returns `var(--canvas-...)` for live theme binding in DOM.
 * - In "resolved" mode: resolves to a concrete color literal using the theme map (safe for iframes).
 */
export function colorToCss(color, mode = "cssVar", theme = {}) {
  if (!color) return undefined;
  if (typeof color === "string") {
    const trimmed = color.trim();
    if (trimmed.startsWith("--canvas-")) {
      return mode === "resolved" ? (theme[trimmed] || "#ffffff") : `var(${trimmed})`;
    }
    return trimmed;
  }
  if (typeof color === "object") {
    if (color.kind === "token" && color.token) {
      const token = color.token.startsWith("--") ? color.token : `--canvas-${color.token}`;
      return mode === "resolved" ? (theme[token] || color.fallback || "#ffffff") : `var(${token}${color.fallback ? `, ${color.fallback}` : ""})`;
    }
    if (color.kind === "literal" && typeof color.value === "string") {
      return color.value.trim();
    }
    if (typeof color.value === "string") {
      const val = color.value.trim();
      if (color.mode === "theme" || val.startsWith("--canvas-")) {
        const token = val.startsWith("--") ? val : `--canvas-${val}`;
        return mode === "resolved" ? (theme[token] || "#ffffff") : `var(${token})`;
      }
      return val;
    }
  }
  return undefined;
}
