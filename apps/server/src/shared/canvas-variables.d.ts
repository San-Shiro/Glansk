import type { CanvasVariableDefinition } from "../domain/types";

export declare class CanvasVariableStore {
  readonly canvasId: string;
  constructor(initialDefs?: Record<string, CanvasVariableDefinition>, canvasId?: string);
  get(name: string): unknown;
  getAll(): Record<string, unknown>;
  getDefinitions(): Record<string, CanvasVariableDefinition>;
  define(def: CanvasVariableDefinition): void;
  registerOutputVariables(instanceId: string, widgetId: string, outputDefs: Record<string, any>): void;
  remove(name: string): void;
  set(name: string, value: unknown): void;
  toggle(name: string): void;
  increment(name: string, step?: number): void;
  watch<T = unknown>(name: string, handler: (value: T, prev: T) => void): () => void;
  watchAll(handler: (name: string, value: unknown, prev: unknown) => void): () => void;
  destroy(): void;
}

export declare function getActiveVariableStore(): CanvasVariableStore | null;
export declare function setActiveVariableStore(store: CanvasVariableStore | null): void;
export declare function evaluateExpression(expr: string, variables?: Record<string, unknown>, fallback?: any): any;
export declare function resolveDynamicValue<T = unknown>(value: any, variableStore?: CanvasVariableStore | null, fallback?: T, expectedType?: "string" | "number" | "boolean" | "json"): T;
export declare function resolveDynamicConfig<T = any>(config: unknown, variableStore?: CanvasVariableStore | null): T;
