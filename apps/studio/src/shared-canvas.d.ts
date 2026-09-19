// Ambient types for the framework-agnostic shared renderer (plain JS in
// ../src/shared, imported via the @shared alias). Kept in sync by hand.
declare module "@shared/canvas-render.js" {
  /**
   * Optional surface-specific context forwarded to widget iframes.
   * When renderContext.display.id is set the host will include a display
   * identity object in each widget's 'connected' handshake.
   * The admin editor never supplies renderContext — editor previews therefore
   * receive no display identity, by design.
   */
  export interface RenderContext {
    display?: {
      /** Opaque display identifier derived from the kiosk path /kiosk/<displayId>. */
      id: string;
    };
  }
  export interface RenderOptions {
    fit?: boolean;
    scale?: number;
    mountWidgets?: boolean;
    interactive?: boolean;
    /** See RenderContext. Omit for admin editor previews. */
    renderContext?: RenderContext;
  }
  export interface CanvasHandle {
    canvasEl: HTMLDivElement;
    tiles: Map<string, { el: HTMLElement; widget: unknown }>;
    groups?: Map<string, { el: HTMLElement; group: any }>;
    scale: number;
    offset: { x: number; y: number };
    destroy(): void;
  }
  export function renderCanvas(host: HTMLElement, doc: unknown, options?: RenderOptions): CanvasHandle;
  export function applyTileAppearance(tile: HTMLElement, widget: unknown, theme?: Record<string, string>): void;
  export function initSlideshow(tile: HTMLElement, config?: unknown): (() => void) | undefined;
  export function initMusicPlayer(tile: HTMLElement, config?: unknown): (() => void) | undefined;
  export function initDeviceSwitchboard(tile: HTMLElement, config?: unknown): (() => void) | undefined;
  export function initTaskMatrix(tile: HTMLElement, config?: unknown, context?: unknown): (() => void) | undefined;
  export function initQuickNotes(tile: HTMLElement, config?: unknown, context?: unknown): (() => void) | undefined;
  export function clearWidgetFrames(reason?: string): void;
}
declare module "@shared/canvas.css";
declare module "@shared/canvas-themes.js" {
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
}
declare module "@shared/widget-definitions.js" {
  export interface ColorSlotDef {
    key: string;
    label: string;
    defaultThemeToken: string;
    property: string;
  }
  export interface WidgetDef {
    title: string;
    aspectRatio: number | null;
    minWidth: number;
    minHeight: number;
    colorSlots: ColorSlotDef[];
    configSchema?: import("@/lib/types").WidgetConfigField[];
  }
  export const DEFAULT_COLOR_SLOTS: ColorSlotDef[];
  export const WIDGET_DEFINITIONS: Record<string, WidgetDef>;
  export function getWidgetDefinition(widgetId: string): WidgetDef;
}
declare module "@shared/packaged-widget-registry.js" {
  export function isPackagedWidget(packageId: string, widgetId: string): boolean;
  export function packagedWidgetPath(packageId: string, widgetId: string): string | undefined;
}
declare module "@shared/design-presets.js" {
  export interface PresetPalette {
    background: string;
    surface: string;
    surfaceRaised?: string;
    border: string;
    borderSubtle?: string;
    primaryText: string;
    secondaryText: string;
    accent: string;
    accentSecondary?: string;
    success?: string;
    warning?: string;
    danger?: string;
  }
  export interface PresetGeometry {
    radius?: string;
    borderWidth?: number;
    density?: string;
  }
  export interface WidgetDesignPreset {
    presetVersion: number;
    id: string;
    name: string;
    description: string;
    tags?: string[];
    palette: PresetPalette;
    geometry?: PresetGeometry;
  }
  export const BUILTIN_DESIGN_PRESETS: Record<string, WidgetDesignPreset>;
  export function resolvePresetCssVariables(
    preset?: WidgetDesignPreset | null,
    colorOverrides?: Record<string, string>
  ): Record<string, string>;
}
