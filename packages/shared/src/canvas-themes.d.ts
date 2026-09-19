export interface ThemeTokenDef {
  key: string;
  label: string;
  category: "accent" | "surface" | "text" | "border" | "status";
  hint: string;
}
export const CANVAS_THEME_PRESETS: Record<string, Record<string, string>>;
export const CANVAS_THEME_PRESET_IDS: string[];
export const CANVAS_THEME_TOKEN_DEFS: ThemeTokenDef[];
export const VALID_CANVAS_THEME_KEYS: Set<string>;
export function resolvedTheme(theme: unknown, background?: string): Record<string, string>;
export function validateThemeImport(raw: string | unknown): { ok: true; theme: { id?: string; name: string; base: string; tokens: Record<string, string> } } | { ok: false; error: string };
export function exportTheme(doc: unknown, customName?: string): { $type: "glansk.canvas-theme"; version: 1; name: string; base: string; tokens: Record<string, string> };
