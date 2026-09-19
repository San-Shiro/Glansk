import type { CanvasDocument, WidgetInstance } from "../../admin-ui/src/lib/types";

export interface CanvasHandle {
  canvasEl: HTMLElement;
  tiles: Map<string, { el: HTMLElement; widget: WidgetInstance }>;
  groups?: Map<string, { el: HTMLElement; group: any }>;
  scale: number;
  offset: { x: number; y: number };
  variableStore?: any;
  destroy(): void;
}

export function renderCanvas(
  host: HTMLElement,
  doc: CanvasDocument,
  options?: {
    fit?: boolean;
    scale?: number;
    interactive?: boolean;
    mountWidgets?: boolean;
    renderContext?: unknown;
  }
): CanvasHandle;

export function applyTileAppearance(
  tile: HTMLElement,
  widget: WidgetInstance,
  theme?: Record<string, string>
): void;

export function clearWidgetFrames(reason?: string): void;
export function initButtonWidget(tile: HTMLElement, config?: Record<string, unknown>, context?: Record<string, unknown>): (() => void) | undefined;
export function initSlideshow(tile: HTMLElement, config?: Record<string, unknown>): (() => void) | undefined;
export function initMusicPlayer(tile: HTMLElement, config?: Record<string, unknown>): (() => void) | undefined;
export function initDeviceSwitchboard(tile: HTMLElement, config?: Record<string, unknown>): (() => void) | undefined;
export function initTaskMatrix(tile: HTMLElement, config?: Record<string, unknown>, context?: Record<string, unknown>): (() => void) | undefined;
export function initQuickNotes(tile: HTMLElement, config?: Record<string, unknown>, context?: Record<string, unknown>): (() => void) | undefined;
export function initEmitterWidget(tile: HTMLElement, config?: Record<string, unknown>, context?: Record<string, unknown>): (() => void) | undefined;
export function normalizeWidget(w: any): any;
export function normalizeGroup(g: any): any;
export function evaluateVisibility(visibility?: any, state?: any, options?: any): boolean;
export function resolveStatePath(state: any, path: string): any;
export { CanvasVariableStore, setActiveVariableStore, getActiveVariableStore } from './canvas-variables.js';


