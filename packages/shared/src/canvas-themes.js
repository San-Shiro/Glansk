// Canvas theme presets — the single source of truth shared by the kiosk display
// and the admin editor so a canvas is tinted identically in both surfaces.
// Themes strictly define color palettes (accents, surfaces, text, borders, status).

export const CANVAS_THEME_PRESETS = {
  midnight: {
    name: "Midnight Navy",
    "--canvas-bg": "#07111f",
    "--canvas-gradient": "linear-gradient(135deg,#07111f 0%,#121735 55%,#081f2b 100%)",
    "--canvas-surface": "rgba(15, 35, 55, 0.88)",
    "--canvas-surface-2": "rgba(9, 23, 38, 0.92)",
    "--canvas-surface-raised": "rgba(25, 52, 80, 0.95)",
    "--canvas-text": "#e8f4ff",
    "--canvas-text-muted": "#8ca6bf",
    "--canvas-text-subtle": "#5b7692",
    "--canvas-muted": "#8ca6bf", // backwards-compat alias
    "--canvas-accent": "#44d7ff", // Primary: Cyan
    "--canvas-accent-2": "#8b7cff", // Secondary: Electric Purple
    "--canvas-accent-3": "#ff61d2", // Tertiary: Neon Pink
    "--canvas-border": "#294865",
    "--canvas-border-subtle": "#1b334a",
    "--canvas-positive": "#4ee1b4",
    "--canvas-warning": "#f59e0b",
    "--canvas-danger": "#ef4444",
    "--canvas-glow": "rgba(68, 215, 255, 0.24)",
  },
  aurora: {
    name: "Northern Aurora",
    "--canvas-bg": "#061419",
    "--canvas-gradient": "linear-gradient(135deg,#061419 0%,#102b32 48%,#25163b 100%)",
    "--canvas-surface": "rgba(10, 37, 42, 0.85)",
    "--canvas-surface-2": "rgba(7, 26, 30, 0.92)",
    "--canvas-surface-raised": "rgba(18, 56, 62, 0.95)",
    "--canvas-text": "#edfff9",
    "--canvas-text-muted": "#91bdb4",
    "--canvas-text-subtle": "#5c877e",
    "--canvas-muted": "#91bdb4",
    "--canvas-accent": "#53e0bc", // Primary: Mint Green
    "--canvas-accent-2": "#38bdf8", // Secondary: Sky Blue
    "--canvas-accent-3": "#a3e635", // Tertiary: Lime
    "--canvas-border": "#2d685f",
    "--canvas-border-subtle": "#1a4740",
    "--canvas-positive": "#53e0bc",
    "--canvas-warning": "#fbbf24",
    "--canvas-danger": "#f87171",
    "--canvas-glow": "rgba(83, 224, 188, 0.28)",
  },
  violet: {
    name: "Cyber Violet",
    "--canvas-bg": "#0d0b1d",
    "--canvas-gradient": "linear-gradient(135deg,#0d0b1d 0%,#241848 55%,#10162e 100%)",
    "--canvas-surface": "rgba(30, 24, 62, 0.86)",
    "--canvas-surface-2": "rgba(19, 15, 42, 0.92)",
    "--canvas-surface-raised": "rgba(48, 38, 96, 0.95)",
    "--canvas-text": "#f4efff",
    "--canvas-text-muted": "#aaa0c8",
    "--canvas-text-subtle": "#726792",
    "--canvas-muted": "#aaa0c8",
    "--canvas-accent": "#a78bfa", // Primary: Cyber Violet
    "--canvas-accent-2": "#f472b6", // Secondary: Hot Pink
    "--canvas-accent-3": "#38bdf8", // Tertiary: Cyan
    "--canvas-border": "#544384",
    "--canvas-border-subtle": "#362958",
    "--canvas-positive": "#34d399",
    "--canvas-warning": "#fbbf24",
    "--canvas-danger": "#f43f5e",
    "--canvas-glow": "rgba(167, 139, 250, 0.3)",
  },
  ember: {
    name: "Obsidian Ember",
    "--canvas-bg": "#120c0e",
    "--canvas-gradient": "linear-gradient(135deg,#120c0e 0%,#291417 52%,#180f1e 100%)",
    "--canvas-surface": "rgba(38, 20, 24, 0.88)",
    "--canvas-surface-2": "rgba(24, 12, 15, 0.92)",
    "--canvas-surface-raised": "rgba(60, 30, 36, 0.95)",
    "--canvas-text": "#fff1ee",
    "--canvas-text-muted": "#cca49c",
    "--canvas-text-subtle": "#8a6660",
    "--canvas-muted": "#cca49c",
    "--canvas-accent": "#f59e0b", // Primary: Warm Amber
    "--canvas-accent-2": "#f97316", // Secondary: Sunset Orange
    "--canvas-accent-3": "#ef4444", // Tertiary: Crimson Red
    "--canvas-border": "#6e353c",
    "--canvas-border-subtle": "#421d23",
    "--canvas-positive": "#10b981",
    "--canvas-warning": "#f59e0b",
    "--canvas-danger": "#ef4444",
    "--canvas-glow": "rgba(245, 158, 11, 0.28)",
  },
  ocean: {
    name: "Deep Ocean",
    "--canvas-bg": "#030e22",
    "--canvas-gradient": "linear-gradient(135deg,#030e22 0%,#0c254e 55%,#051530 100%)",
    "--canvas-surface": "rgba(12, 34, 68, 0.86)",
    "--canvas-surface-2": "rgba(6, 20, 42, 0.92)",
    "--canvas-surface-raised": "rgba(22, 54, 102, 0.95)",
    "--canvas-text": "#e0f2fe",
    "--canvas-text-muted": "#7dd3fc",
    "--canvas-text-subtle": "#38bdf8",
    "--canvas-muted": "#7dd3fc",
    "--canvas-accent": "#38bdf8", // Primary: Marine Blue
    "--canvas-accent-2": "#2dd4bf", // Secondary: Aqua Teal
    "--canvas-accent-3": "#818cf8", // Tertiary: Indigo
    "--canvas-border": "#1e4976",
    "--canvas-border-subtle": "#122e4d",
    "--canvas-positive": "#34d399",
    "--canvas-warning": "#facc15",
    "--canvas-danger": "#f87171",
    "--canvas-glow": "rgba(56, 189, 248, 0.28)",
  },
  graphite: {
    name: "Monochrome Slate",
    "--canvas-bg": "#0f1115",
    "--canvas-gradient": "linear-gradient(135deg,#0f1115 0%,#1a1d24 55%,#0a0c0f 100%)",
    "--canvas-surface": "rgba(26, 29, 36, 0.88)",
    "--canvas-surface-2": "rgba(18, 20, 26, 0.92)",
    "--canvas-surface-raised": "rgba(40, 44, 55, 0.95)",
    "--canvas-text": "#f1f5f9",
    "--canvas-text-muted": "#94a3b8",
    "--canvas-text-subtle": "#64748b",
    "--canvas-muted": "#94a3b8",
    "--canvas-accent": "#e2e8f0", // Primary: Silver White
    "--canvas-accent-2": "#38bdf8", // Secondary: Sky Blue
    "--canvas-accent-3": "#a855f7", // Tertiary: Purple
    "--canvas-border": "#334155",
    "--canvas-border-subtle": "#1e293b",
    "--canvas-positive": "#10b981",
    "--canvas-warning": "#f59e0b",
    "--canvas-danger": "#ef4444",
    "--canvas-glow": "rgba(226, 232, 240, 0.16)",
  },
  cyberpunk: {
    name: "Cyber Neon",
    "--canvas-bg": "#08070d",
    "--canvas-gradient": "linear-gradient(135deg,#08070d 0%,#180d24 55%,#07151a 100%)",
    "--canvas-surface": "rgba(24, 16, 38, 0.90)",
    "--canvas-surface-2": "rgba(14, 9, 24, 0.94)",
    "--canvas-surface-raised": "rgba(42, 28, 66, 0.96)",
    "--canvas-text": "#fdf4ff",
    "--canvas-text-muted": "#d8b4fe",
    "--canvas-text-subtle": "#9333ea",
    "--canvas-muted": "#d8b4fe",
    "--canvas-accent": "#facc15", // Primary: High-Voltage Yellow
    "--canvas-accent-2": "#ec4899", // Secondary: Neon Hot Pink
    "--canvas-accent-3": "#06b6d4", // Tertiary: Electric Cyan
    "--canvas-border": "#701a75",
    "--canvas-border-subtle": "#4a044e",
    "--canvas-positive": "#4ade80",
    "--canvas-warning": "#facc15",
    "--canvas-danger": "#f43f5e",
    "--canvas-glow": "rgba(250, 204, 21, 0.32)",
  },
  paper: {
    name: "Crisp Light",
    "--canvas-bg": "#f8fafc",
    "--canvas-gradient": "linear-gradient(135deg,#f8fafc 0%,#f1f5f9 55%,#e2e8f0 100%)",
    "--canvas-surface": "rgba(255, 255, 255, 0.94)",
    "--canvas-surface-2": "rgba(241, 245, 249, 0.96)",
    "--canvas-surface-raised": "rgba(255, 255, 255, 1)",
    "--canvas-text": "#0f172a",
    "--canvas-text-muted": "#475569",
    "--canvas-text-subtle": "#64748b",
    "--canvas-muted": "#475569",
    "--canvas-accent": "#4f46e5", // Primary: Deep Indigo
    "--canvas-accent-2": "#0284c7", // Secondary: Vibrant Sky
    "--canvas-accent-3": "#059669", // Tertiary: Emerald
    "--canvas-border": "#cbd5e1",
    "--canvas-border-subtle": "#e2e8f0",
    "--canvas-positive": "#16a34a",
    "--canvas-warning": "#d97706",
    "--canvas-danger": "#dc2626",
    "--canvas-glow": "rgba(79, 70, 229, 0.12)",
  },
};

export const CANVAS_THEME_PRESET_IDS = Object.keys(CANVAS_THEME_PRESETS);

// Token definitions for Inspector UI rendering and documentation
export const CANVAS_THEME_TOKEN_DEFS = [
  { key: "--canvas-accent", label: "Primary Accent", category: "accent", hint: "Main accent, primary charts, KPI trend highlights" },
  { key: "--canvas-accent-2", label: "Secondary Accent", category: "accent", hint: "Chart gradients, secondary indicators" },
  { key: "--canvas-accent-3", label: "Tertiary Accent", category: "accent", hint: "Badges, multi-metric highlights" },
  { key: "--canvas-bg", label: "Canvas Root Background", category: "surface", hint: "Base canvas background color" },
  { key: "--canvas-surface", label: "Tile Surface", category: "surface", hint: "Default background for tiles/cards" },
  { key: "--canvas-surface-2", label: "Nested Surface / Track", category: "surface", hint: "Progress tracks, ring tracks, stat blocks" },
  { key: "--canvas-surface-raised", label: "Raised Surface", category: "surface", hint: "Buttons, elevated cards, interactive elements" },
  { key: "--canvas-text", label: "Primary Text", category: "text", hint: "Headlines, big KPI numbers, main values" },
  { key: "--canvas-text-muted", label: "Muted Text", category: "text", hint: "Labels, subtitles, column headers" },
  { key: "--canvas-text-subtle", label: "Subtle Text", category: "text", hint: "Captions, secondary details" },
  { key: "--canvas-border", label: "Card Border", category: "border", hint: "Tile borders and active outlines" },
  { key: "--canvas-border-subtle", label: "Subtle Border", category: "border", hint: "Table row dividers, subtle split lines" },
  { key: "--canvas-positive", label: "Status: Positive", category: "status", hint: "Healthy, online, success status" },
  { key: "--canvas-warning", label: "Status: Warning", category: "status", hint: "Elevated, warning status" },
  { key: "--canvas-danger", label: "Status: Danger", category: "status", hint: "Critical alerts, errors, degraded status" },
];

export const VALID_CANVAS_THEME_KEYS = new Set(CANVAS_THEME_TOKEN_DEFS.map(t => t.key).concat(["--canvas-gradient", "--canvas-glow", "--canvas-muted"]));

export function resolvedTheme(theme, background) {
  const presetKey = theme?.preset && CANVAS_THEME_PRESETS[theme.preset] ? theme.preset : "midnight";
  const preset = CANVAS_THEME_PRESETS[presetKey];
  const resolved = { ...preset };
  delete resolved.name;

  if (background) {
    resolved["--canvas-bg"] = background;
  }

  if (theme?.variables && typeof theme.variables === "object") {
    for (const [k, v] of Object.entries(theme.variables)) {
      if (VALID_CANVAS_THEME_KEYS.has(k) && typeof v === "string" && v.trim().length > 0 && v.length < 120) {
        resolved[k] = v.trim();
      }
    }
  }

  // Ensure aliases remain synchronized
  if (resolved["--canvas-text-muted"]) {
    resolved["--canvas-muted"] = resolved["--canvas-text-muted"];
  }

  return resolved;
}

/**
 * Validates an imported JSON string or object for canvas themes.
 * Enforces schema: { $type: "glansk.canvas-theme", version: 1, base?: string, tokens: Record<string, string> }
 * Rejects any script/url injection or invalid keys.
 */
export function validateThemeImport(raw) {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: "Invalid JSON format." };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Theme must be a JSON object." };
  }

  if (parsed.$type !== "glansk.canvas-theme") {
    return { ok: false, error: "Invalid theme type: $type must be 'glansk.canvas-theme'." };
  }

  if (parsed.version !== 1) {
    return { ok: false, error: "Unsupported theme version. Only version: 1 is supported." };
  }

  const base = parsed.base && CANVAS_THEME_PRESETS[parsed.base] ? parsed.base : "midnight";
  const tokens = {};

  if (parsed.tokens && typeof parsed.tokens === "object" && !Array.isArray(parsed.tokens)) {
    for (const [k, v] of Object.entries(parsed.tokens)) {
      if (!VALID_CANVAS_THEME_KEYS.has(k)) {
        continue; // skip unknown tokens
      }
      if (typeof v !== "string") continue;
      const clean = v.trim();
      // Security check: reject url(), expression(), javascript:, semicolons, braces
      if (/url\(|javascript:|expression\(|[;{}]/i.test(clean)) {
        return { ok: false, error: `Invalid or unsafe value for token '${k}'.` };
      }
      if (clean.length > 0 && clean.length < 120) {
        tokens[k] = clean;
      }
    }
  }

  return {
    ok: true,
    theme: {
      id: typeof parsed.id === "string" ? parsed.id.slice(0, 40) : undefined,
      name: typeof parsed.name === "string" ? parsed.name.slice(0, 60) : "Custom Imported Theme",
      base,
      tokens,
    },
  };
}

/**
 * Exports the current canvas theme configuration to portable JSON.
 */
export function exportTheme(doc, customName) {
  const base = doc.theme?.preset && CANVAS_THEME_PRESETS[doc.theme.preset] ? doc.theme.preset : "midnight";
  const tokens = {};
  if (doc.theme?.variables) {
    for (const [k, v] of Object.entries(doc.theme.variables)) {
      if (VALID_CANVAS_THEME_KEYS.has(k) && typeof v === "string") {
        tokens[k] = v;
      }
    }
  }

  return {
    $type: "glansk.canvas-theme",
    version: 1,
    name: customName || `${CANVAS_THEME_PRESETS[base].name} (Customized)`,
    base,
    tokens,
  };
}
