import type { CanvasDocument, PublishedCanvas } from "./types";

export interface CanvasDraft { readonly document: CanvasDocument; readonly draftRevision: number; readonly updatedAt: number; }
export interface CanvasSummary { readonly id: string; readonly name: string; readonly logicalSize: CanvasDocument["logicalSize"]; readonly widgetCount: number; readonly draftRevision: number; readonly publishedRevision?: number; readonly updatedAt: number; }
export interface CreateCanvasInput { readonly id: string; readonly name: string; readonly logicalSize?: CanvasDocument["logicalSize"]; }
export interface SaveCanvasDraftInput { readonly document: CanvasDocument; readonly expectedDraftRevision: number; }
export interface CanvasWorkspace { readonly draft: CanvasDraft; readonly publication?: PublishedCanvas; }