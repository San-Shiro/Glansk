export interface EncodedFrame {
  readonly codec: string;
  readonly payload: Uint8Array;
}

export interface Codec<T> {
  readonly id: string;
  encode(value: T): EncodedFrame;
  decode(frame: EncodedFrame): T;
}

export type SyncAdapterStatus =
  | { readonly kind: "ready" }
  | { readonly kind: "backpressure"; readonly queuedBytes: number; readonly retryAfterMs?: number }
  | { readonly kind: "error"; readonly retryable: boolean; readonly code: string }
  | { readonly kind: "closed"; readonly reason?: string };

export interface SyncAdapter {
  readonly id: string;
  start(onFrame: (frame: EncodedFrame) => Promise<void> | void, onStatus: (status: SyncAdapterStatus) => void): Promise<void>;
  send(frame: EncodedFrame): Promise<void>;
  close(reason?: string): Promise<void>;
}
