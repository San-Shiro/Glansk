export declare const WIDGET_PROTOCOL = "glansk.widget.v1";

export interface WidgetMessageEvent {
  readonly origin: string;
  readonly source: MessageEventSource | null;
  readonly data: unknown;
}

export declare function acceptsWidgetEvent(
  event: WidgetMessageEvent | MessageEvent,
  source: MessageEventSource | null,
  instanceId?: string,
  nonce?: string
): boolean;
