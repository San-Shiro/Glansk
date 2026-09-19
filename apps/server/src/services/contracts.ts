import type { CanvasDocument, PublishedCanvas } from "../domain/types";
import type { CanvasDraft, CanvasSummary, CanvasWorkspace, CreateCanvasInput, SaveCanvasDraftInput } from "../domain/canvas";
export interface UpdateCanvasMetadataInput {
  readonly name?: string;
  readonly newId?: string;
  readonly logicalSize?: CanvasDocument["logicalSize"];
}

export interface CanvasService {
  create(input: CreateCanvasInput): Promise<CanvasDraft>;
  list(): Promise<readonly CanvasSummary[]>;
  open(canvasId: string): Promise<CanvasWorkspace | undefined>;
  save(input: SaveCanvasDraftInput): Promise<CanvasDraft>;
  saveDraft(document: CanvasDocument): Promise<void>;
  getDraft(canvasId: string): Promise<CanvasDocument | undefined>;
  publish(canvasId: string): Promise<PublishedCanvas>;
  getPublished(canvasId: string): Promise<PublishedCanvas | undefined>;
  delete(canvasId: string): Promise<boolean>;
  updateMetadata(canvasId: string, input: UpdateCanvasMetadataInput): Promise<CanvasSummary>;
}
export interface AtomicDocumentStore { read<T>(key: string): Promise<T | undefined>; write<T>(key: string, value: T): Promise<void>; }