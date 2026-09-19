// Mirrors of the Glansk backend domain types (src/domain/types.ts and
// src/domain/canvas.ts). Kept intentionally small and hand-synced.
export type JsonValue =
  | string | number | boolean | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface WidgetGeometry { x: number; y: number; width: number; height: number; zIndex: number; }

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
export type SpacingUnit = "px" | "%";

export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit?: SpacingUnit;
  linked?: boolean;
}

export interface CornerRadius {
  tl: number;
  tr: number;
  br: number;
  bl: number;
  unit?: SpacingUnit;
  linked?: boolean;
}

export type PaddingValue = number | BoxSides;
export type RadiusValue = number | CornerRadius;

export type TextAlign = "left" | "center" | "right" | "justify";
export type TextTransform = "none" | "uppercase" | "lowercase" | "capitalize";

export interface TypographyValue {
  family?: string;
  size?: number;
  sizeUnit?: SpacingUnit;
  weight?: number | string;
  lineHeight?: number;
  letterSpacing?: number;
  align?: TextAlign;
  transform?: TextTransform;
}

export type MediaSource = "url" | "library" | "upload";
export type ObjectFit = "cover" | "contain" | "fill" | "none" | "scale-down";

export interface MediaValue {
  source: MediaSource;
  url?: string;
  objectFit?: ObjectFit;
  objectPosition?: string;
  opacity?: number;
}

export type ColorRef =
  | { kind: "literal"; value: string }
  | { kind: "token"; token: string; fallback?: string }
  | { mode?: "theme" | "custom"; value: string; resolvedColor?: string };

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
  padding?: PaddingValue;
  borderWidth?: number;
  borderStyle?: "solid" | "dashed" | "dotted" | "none";
  borderColor?: string;
  borderRadius?: RadiusValue;
  background?: MediaValue;
  typography?: Record<string, TypographyValue>;
  slots?: Record<string, WidgetColorSlotConfig>;
  presetId?: string;
}

export interface CanvasPresentation { preset?: string; variables?: Record<string, string>; }
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
  background: string;
  theme?: CanvasPresentation;
  groups?: CanvasGroup[];
  widgets: WidgetInstance[];
  variables?: Record<string, CanvasVariableDefinition>;
}
export interface PublishedCanvas { canvasId: string; revision: number; publishedAt: number; document: CanvasDocument; }
export interface CanvasDraft { document: CanvasDocument; draftRevision: number; updatedAt: number; }
export interface CanvasSummary {
  id: string;
  name: string;
  logicalSize: { width: number; height: number };
  widgetCount: number;
  draftRevision: number;
  publishedRevision?: number;
  updatedAt: number;
}
export interface CanvasWorkspace { draft: CanvasDraft; publication?: PublishedCanvas; }

export type RuntimePhase = "inactive" | "starting" | "ready" | "degraded" | "failed";
export interface RuntimeStatus {
  canvasId: string;
  phase: RuntimePhase;
  activeRevision?: number;
  lastKnownGoodRevision?: number;
  candidateRevision?: number;
  generation: number;
  restartCount: number;
  updatedAt: number;
  diagnostic?: string;
}

// ---- privileged / operations domain (secure-app.ts) ----
export interface DeviceStatus { provider: string; status: string; allowedPins: number[]; }
export interface PinState { pin: number; value: 0 | 1; }

export interface AuditEvent {
  id: string;
  at: string; // ISO timestamp
  actor: string;
  action: string;
  outcome: "allowed" | "denied" | "failed";
  detail?: Record<string, unknown>;
}

export interface BackupResult { name: string; path: string; }

export type ResetKind = "editor" | "runtime" | "factory";
export interface ResetChallenge { token: string; phrase: string; expiresAt: number; }
export interface TxRecord {
  id: string;
  kind: string;
  state: "in-progress" | "committed" | "rolled-back";
  startedAt: string;
  backup?: string;
  error?: string;
}

export interface Pairing { id: string; code: string; expiresAt: number; }

export interface WidgetConfigField {
  key: string;
  type: "string" | "number" | "boolean" | "select" | "color" | "textarea" | "secret-ref" | "string[]" | "radius" | "range" | "media" | "toggle";
  label: string;
  hint?: string;
  default?: JsonValue;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  step?: number;
  tab?: string;
  allowBinding?: boolean;
}

export interface VaultSecretMeta {
  id: string;
  name: string;
  description?: string;
  allowedDomains: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SaveSecretInput {
  id: string;
  name: string;
  value: string;
  description?: string;
  allowedDomains?: string[];
}

export type EmitterCategory = "media" | "metrics" | "sensor" | "switchboard" | "custom";
export type EmitterStatus = "online" | "stale" | "offline" | "terminated";

export interface EmitterControl {
  id: string;
  type: "toggle" | "action" | "range" | "select";
  label: string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string | number }>;
  icon?: string;
}

export interface EmitterManifest {
  id: string;
  name: string;
  category: EmitterCategory;
  description?: string;
  icon?: string;
  controls?: EmitterControl[];
  autoMount?: {
    enabled: boolean;
    canvasId?: string;
    position?: "auto" | { x: number; y: number };
    updateExisting?: boolean;
  };
}

export interface EmitterRegistration {
  manifest: EmitterManifest;
  state: Record<string, JsonValue>;
  lastSeen: number;
  transport: "http" | "ws" | "tmpfs";
  status: EmitterStatus;
  instanceId?: string;
}

export type PackageKind = "widget" | "emitter" | "composite";

export interface PackageWidgetDescriptor {
  id: string;
  name?: string;
  entry: string;
  description?: string;
  defaultGeometry?: { w: number; h: number };
  configSchema?: Record<string, any>;
  capabilities?: string[];
}

export interface PackageEmitterDescriptor {
  id: string;
  name?: string;
  category?: "sensor" | "media" | "system" | "custom";
  runtime?: "declarative" | "python" | "node" | "system";
  entry?: string;
  configSchema?: Record<string, any>;
  polling?: { intervalMs: number; url?: string };
  controls?: Array<{ name: string; label: string; type?: string }>;
}

export interface PackageRecord {
  id: string;
  version: string;
  name: string;
  kind: PackageKind;
  description: string;
  author: string;
  entry?: string;
  files: Record<string, string>;
  capabilities: string[];
  signature?: string;
  keyId?: string;
  trusted: boolean;
  installedAt: string;
  updatedAt: string;
  widgets?: PackageWidgetDescriptor[];
  emitters?: PackageEmitterDescriptor[];
}

export interface RepositoryFeed {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastSyncedAt?: string;
  packageCount?: number;
}

export interface CatalogItem {
  id: string;
  version: string;
  name: string;
  kind: PackageKind;
  description: string;
  author: string;
  downloadUrl: string;
  sha256?: string;
  capabilities: string[];
  repositoryName: string;
  repositoryUrl: string;
  widgets?: PackageWidgetDescriptor[];
  emitters?: PackageEmitterDescriptor[];
}

export interface StarterTemplate {
  id: string;
  name: string;
  kind: PackageKind;
  description: string;
  files: Record<string, string>;
}
