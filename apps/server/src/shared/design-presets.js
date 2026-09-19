// Design Preset Schema and Built-in Aesthetic Palettes.
// Self-contained ES module for kiosk display & admin studio.

export const BUILTIN_DESIGN_PRESETS = {
  "gulf-racing": {
    presetVersion: 1,
    id: "gulf-racing",
    name: "Gulf GT Racing",
    description: "Iconic Gulf motorsport heritage: Deep slate navy, Gulf racing orange, and ice blue accents.",
    tags: ["dark", "automotive", "high-contrast"],
    palette: {
      background: "#1A2730",
      surface: "#22313D",
      surfaceRaised: "#2B3D4C",
      border: "#314454",
      borderSubtle: "#263644",
      primaryText: "#FFFFFF",
      secondaryText: "#B0CEE2",
      accent: "#E95D2C",
      accentSecondary: "#B0CEE2",
      success: "#34D399",
      warning: "#E95D2C",
      danger: "#F43F5E",
    },
    typography: {
      fontFamily: "sans",
      fontScale: "standard",
    },
    geometry: {
      radius: "md",
      borderWidth: 1,
      density: "normal",
    },
  },

  "slate-minimal": {
    presetVersion: 1,
    id: "slate-minimal",
    name: "Slate Minimal (Light)",
    description: "Clean architectural light mode: Crisp white surface, soft slate elevation, and deep navy ink.",
    tags: ["light", "editorial", "clean"],
    palette: {
      background: "#FFFFFF",
      surface: "#F8FAFC",
      surfaceRaised: "#F1F5F9",
      border: "#E2E8F0",
      borderSubtle: "#EEF2F6",
      primaryText: "#0F172A",
      secondaryText: "#475569",
      accent: "#E95D2C",
      accentSecondary: "#0284C7",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
    },
    typography: {
      fontFamily: "sans",
      fontScale: "standard",
    },
    geometry: {
      radius: "md",
      borderWidth: 1,
      density: "normal",
    },
  },

  "cyber-amber": {
    presetVersion: 1,
    id: "cyber-amber",
    name: "Cyber Amber",
    description: "Tactical industrial avionics: Charcoal obsidian background with warm amber phosphor instruments.",
    tags: ["dark", "avionics", "tactical"],
    palette: {
      background: "#121316",
      surface: "#1C1D22",
      surfaceRaised: "#26272E",
      border: "#33353F",
      borderSubtle: "#22232A",
      primaryText: "#FAFAF9",
      secondaryText: "#A8A29E",
      accent: "#F59E0B",
      accentSecondary: "#D97706",
      success: "#10B981",
      warning: "#F59E0B",
      danger: "#EF4444",
    },
    typography: {
      fontFamily: "mono",
      fontScale: "compact",
    },
    geometry: {
      radius: "sm",
      borderWidth: 1,
      density: "compact",
    },
  },

  "nordic-frost": {
    presetVersion: 1,
    id: "nordic-frost",
    name: "Nordic Frost",
    description: "Arctic instrumentation: Deep polar night slate with cold ice cyan and glacier steel tones.",
    tags: ["dark", "minimal", "cool"],
    palette: {
      background: "#1E242B",
      surface: "#28303A",
      surfaceRaised: "#333D4A",
      border: "#404C5C",
      borderSubtle: "#2E3743",
      primaryText: "#ECEFF4",
      secondaryText: "#94A3B8",
      accent: "#38BDF8",
      accentSecondary: "#818CF8",
      success: "#34D399",
      warning: "#FBBF24",
      danger: "#FB7185",
    },
    typography: {
      fontFamily: "sans",
      fontScale: "standard",
    },
    geometry: {
      radius: "lg",
      borderWidth: 1,
      density: "normal",
    },
  },

  "monochrome-instrument": {
    presetVersion: 1,
    id: "monochrome-instrument",
    name: "Monochrome Precision",
    description: "Pure studio instrument: Absolute grayscale precision with stark contrast and zero chroma noise.",
    tags: ["dark", "monochrome", "studio"],
    palette: {
      background: "#0A0A0B",
      surface: "#141416",
      surfaceRaised: "#1F1F23",
      border: "#2E2E34",
      borderSubtle: "#1C1C20",
      primaryText: "#FFFFFF",
      secondaryText: "#A1A1AA",
      accent: "#FFFFFF",
      accentSecondary: "#71717A",
      success: "#D4D4D8",
      warning: "#A1A1AA",
      danger: "#FAFAFA",
    },
    typography: {
      fontFamily: "mono",
      fontScale: "compact",
    },
    geometry: {
      radius: "none",
      borderWidth: 1,
      density: "compact",
    },
  },
};

export function validateDesignPreset(preset) {
  const errors = [];
  if (!preset || typeof preset !== "object") {
    return { valid: false, errors: ["Preset must be a non-null object"] };
  }

  const p = preset;
  if (p.presetVersion !== 1) errors.push("unsupported presetVersion, expected 1");
  if (!p.id || typeof p.id !== "string") errors.push("id must be a non-empty string");
  if (!p.name || typeof p.name !== "string") errors.push("name must be a non-empty string");

  if (!p.palette || typeof p.palette !== "object") {
    errors.push("palette must be an object with color values");
  } else {
    const pal = p.palette;
    const requiredColors = ["background", "surface", "border", "primaryText", "secondaryText", "accent"];
    for (const key of requiredColors) {
      if (!pal[key] || typeof pal[key] !== "string" || !/^#(?:[0-9a-fA-F]{3,8})$|^rgba?\(/.test(pal[key].trim())) {
        errors.push(`palette.${key} must be a valid hex or rgb color`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolvePresetCssVariables(preset, colorOverrides) {
  const active = preset || BUILTIN_DESIGN_PRESETS["gulf-racing"];
  const vars = {
    "--tile-bg": active.palette.background,
    "--tile-surface": active.palette.surface,
    "--tile-surface-raised": active.palette.surfaceRaised || active.palette.surface,
    "--tile-border": active.palette.border,
    "--tile-border-subtle": active.palette.borderSubtle || active.palette.border,
    "--tile-value": active.palette.primaryText,
    "--tile-detail": active.palette.secondaryText,
    "--tile-accent": active.palette.accent,
    "--tile-accent-2": active.palette.accentSecondary || active.palette.accent,
    "--tile-positive": active.palette.success || "#34D399",
    "--tile-warning": active.palette.warning || "#F59E0B",
    "--tile-danger": active.palette.danger || "#EF4444",
  };

  if (active.geometry?.radius) {
    const radiusMap = { none: "0px", sm: "4px", md: "8px", lg: "16px", full: "9999px" };
    vars["--tile-radius"] = radiusMap[active.geometry.radius] || "8px";
  }

  if (colorOverrides) {
    for (const [k, v] of Object.entries(colorOverrides)) {
      if (v) {
        if (k === "bg") vars["--tile-bg"] = v;
        else if (k === "border") vars["--tile-border"] = v;
        else if (k === "value" || k === "primaryText") vars["--tile-value"] = v;
        else if (k === "accent") vars["--tile-accent"] = v;
        else if (k === "accent2" || k === "accentSecondary") vars["--tile-accent-2"] = v;
        else vars[`--tile-${k}`] = v;
      }
    }
  }

  return vars;
}

export function applyPresetToWidget(widget, presetId, customOverrides) {
  const preset = BUILTIN_DESIGN_PRESETS[presetId];
  if (!preset) return undefined;
  const config = widget.config || (widget.config = {});
  const app = config.appearance || (config.appearance = {});
  app.presetId = presetId;
  app.followCanvasTheme = false;
  return resolvePresetCssVariables(preset, customOverrides);
}
