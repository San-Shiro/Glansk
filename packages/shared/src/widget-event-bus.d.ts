export interface EventMeta {
  from?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export type EventCallback<T = any> = (payload: T, meta: EventMeta) => void;

export interface WidgetEventBus {
  publish(topic: string, payload: any, meta?: EventMeta): void;
  subscribe<T = any>(topic: string, handler: EventCallback<T>): () => void;
  hasSubscribers(topic: string): boolean;
  clear(): void;
}

export declare function createWidgetEventBus(): WidgetEventBus;

export declare const canvasBus: WidgetEventBus;

export declare const localSessionId: string;
