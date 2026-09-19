import type { PublishDelta, PublishSnapshot, StateSnapshot, SubscriptionEvent, SubscriptionOptions } from "../../domain/state";

export interface StateTransition<TState, TDelta> {
  cloneState(state: TState): TState;
  cloneDelta(delta: TDelta): TDelta;
  validateState(schema: string, state: TState): void;
  applyDelta(schema: string, current: Readonly<TState>, delta: Readonly<TDelta>): TState;
  measureState(state: TState): number;
  measureDelta(delta: TDelta): number;
}

export interface StateSubscription<TState, TDelta> {
  next(): Promise<SubscriptionEvent<TState, TDelta>>;
  close(reason?: string): void;
}

export interface StateBroker<TState, TDelta> {
  publishSnapshot(request: PublishSnapshot<TState>): StateSnapshot<TState>;
  publishDelta(request: PublishDelta<TDelta>): StateSnapshot<TState>;
  getSnapshot(channel: string): StateSnapshot<TState> | undefined;
  subscribe(channel: string, options?: Partial<SubscriptionOptions>): StateSubscription<TState, TDelta>;
}

export interface StateBrokerLimits {
  readonly maxStateBytes: number;
  readonly maxDeltaBytes: number;
  readonly defaultSubscriptionCapacity: number;
  readonly maxSubscriptionCapacity: number;
}
