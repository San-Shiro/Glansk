export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface WidgetGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface TimeVisibilityRule {
  enabled: boolean;
  type: "time-range" | "days-of-week" | "schedule";
  startTime?: string;
  endTime?: string;
  daysOfWeek?: number[];
  timezone?: string;
}

export interface StateVisibilityRule {
  enabled: boolean;
  variablePath: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "truthy" | "falsy" | "contains";
  value?: JsonValue;
}

export interface WidgetVisibilityConfig {
  defaultVisible: boolean;
  showInUiBuilder?: boolean;
  timeRule?: TimeVisibilityRule;
  stateRule?: StateVisibilityRule;
  responsive?: {
    desktop?: boolean;
    tablet?: boolean;
    mobileLandscape?: boolean;
    mobilePortrait?: boolean;
  };
}

export interface CanvasGroup {
  id: string;
  name: string;
  collapsed?: boolean;
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  };
  visibility?: WidgetVisibilityConfig;
  disabled?: boolean;
}

export interface WidgetInstance {
  id: string;
  packageId: string;
  widgetId: string;
  groupId?: string;
  geometry: WidgetGeometry;
  config: Record<string, JsonValue>;
  visibility?: WidgetVisibilityConfig;
  disabled?: boolean;
}

export interface WidgetColorSlotConfig {
  mode: "theme" | "custom";
  value: string;
  resolvedColor?: string;
}

export interface WidgetAppearance {
  frame?: "none" | "card";
  showBoundingBox?: boolean;
  followCanvasTheme?: boolean;
  transparentBg?: boolean;
  opacity?: number;
  fontScale?: number;
  padding?: number;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  borderRadius?: number;
  slots?: Record<string, WidgetColorSlotConfig>;
}

export interface CanvasPresentation {
  preset?: string;
  variables?: Record<string, string>;
}

export type CanvasVariableType = "string" | "number" | "boolean" | "json";

export interface CanvasVariableDefinition {
  name: string;
  type: CanvasVariableType;
  defaultValue: JsonValue;
  description?: string;
  persist?: boolean;
  isOutput?: boolean;
  sourceWidgetId?: string;
  sourceInstanceId?: string;
}

export interface WidgetOutputVariableDef {
  name: string;
  type: CanvasVariableType;
  defaultValue: JsonValue;
  description?: string;
}

export interface WidgetCustomTab {
  id: string;
  label: string;
  icon?: string;
}

export interface DynamicBinding<T = JsonValue> {
  mode: "variable" | "expression";
  variable?: string;
  expression?: string;
  fallback: T;
}

export type BoundValue<T> = T | { $bind: DynamicBinding<T> };

export interface CanvasDocument {
  schemaVersion: 1;
  id: string;
  name: string;
  logicalSize: { width: number; height: number };
  background?: string;
  theme?: CanvasPresentation;
  groups?: CanvasGroup[];
  widgets: WidgetInstance[];
  variables?: Record<string, CanvasVariableDefinition>;
}

export interface PublishedCanvas {
  canvasId: string;
  revision: number;
  publishedAt: number;
  document: Readonly<CanvasDocument>;
}

export type { CanvasWorkspace } from "./canvas";

