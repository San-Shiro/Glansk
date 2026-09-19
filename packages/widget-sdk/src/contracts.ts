export const WIDGET_PROTOCOL = "glansk.widget.v1" as const;

export interface WidgetIdentity {
  readonly instanceId: string;
  readonly packageId: string;
  readonly widgetId: string;
}

export interface DisplayIdentity {
  readonly id: string;
  readonly storageNamespace: string;
}

export interface WidgetPresetTokens {
  readonly id: string;
  readonly name: string;
  readonly palette: {
    readonly background: string;
    readonly surface: string;
    readonly border: string;
    readonly primaryText: string;
    readonly secondaryText: string;
    readonly accent: string;
    readonly accentSecondary?: string | undefined;
  };
}

export interface ConnectedPayload<C = unknown> {
  readonly instanceId: string;
  readonly nonce: string;
  readonly identity: WidgetIdentity;
  readonly config: C;
  readonly display?: DisplayIdentity | undefined;
  readonly preset?: WidgetPresetTokens | undefined;
  readonly variables?: Record<string, unknown> | undefined;
}

export interface WidgetCustomTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: string | undefined;
}

export interface WidgetOutputVariableDef {
  readonly name: string;
  readonly type: "string" | "number" | "boolean" | "json";
  readonly defaultValue: unknown;
  readonly description?: string | undefined;
}

export type Unsubscribe = () => void;
export const FORBIDDEN_VAR_NAMES = new Set(["__proto__", "constructor", "prototype"]);

export interface WidgetFetchInit {
  readonly method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined;
  readonly headers?: Record<string, string> | undefined;
  readonly body?: string | unknown | undefined;
  readonly timeoutMs?: number | undefined;
}

export interface WidgetResponseHeaders {
  get(name: string): string | null;
  has(name: string): boolean;
  entries(): [string, string][];
}

export interface WidgetResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: WidgetResponseHeaders;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
}
