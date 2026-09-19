export interface ColorSlotDef {
  key: string;
  label: string;
  defaultThemeToken: string;
  property: string;
}

export interface WidgetConfigFieldDef {
  key: string;
  type: string;
  label?: string;
  default?: any;
  options?: Array<{ label: string; value: any }>;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface WidgetDef {
  title: string;
  aspectRatio: number | null;
  minWidth: number;
  minHeight: number;
  colorSlots: ColorSlotDef[];
  configSchema?: WidgetConfigFieldDef[];
}

export const DEFAULT_COLOR_SLOTS: ColorSlotDef[];
export const CORE_PRIMITIVE_IDS: string[];
export const CORE_WIDGET_DEFINITIONS: Record<string, WidgetDef>;
export const LEGACY_WIDGET_DEFINITIONS: Record<string, WidgetDef>;
export const WIDGET_DEFINITIONS: Record<string, WidgetDef>;
export function getWidgetDefinition(widgetId: string): WidgetDef;
