export type Revision = number;

export interface Causality {
  readonly expectedRevision: Revision;
  readonly operationId: string;
  readonly producerId?: string;
}

export interface StateSnapshot<TState> {
  readonly kind: "snapshot";
  readonly channel: string;
  readonly schema: string;
  readonly revision: Revision;
  readonly payload: TState;
}

export interface StateDelta<TDelta> {
  readonly kind: "delta";
  readonly channel: string;
  readonly schema: string;
  readonly fromRevision: Revision;
  readonly toRevision: Revision;
  readonly payload: TDelta;
}

export type StateUpdate<TState, TDelta> = StateSnapshot<TState> | StateDelta<TDelta>;

export type SubscriptionEvent<TState, TDelta> =
  | { readonly kind: "update"; readonly update: StateUpdate<TState, TDelta> }
  | { readonly kind: "resync_required"; readonly channel: string; readonly latestRevision: Revision; readonly reason: "subscriber_overrun" | "revision_gap" }
  | { readonly kind: "closed"; readonly reason: string };

export interface PublishSnapshot<TState> {
  readonly channel: string;
  readonly schema: string;
  readonly causality: Causality;
  readonly payload: TState;
}

export interface PublishDelta<TDelta> {
  readonly channel: string;
  readonly schema: string;
  readonly causality: Causality;
  readonly payload: TDelta;
}

export interface SubscriptionOptions {
  readonly capacity: number;
  readonly fromRevision?: Revision;
}
