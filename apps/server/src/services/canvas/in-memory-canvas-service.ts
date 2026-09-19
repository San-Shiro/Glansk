import type { CanvasDocument, PublishedCanvas } from "../../domain/types";
import type { CanvasDraft, CanvasSummary, CanvasWorkspace, CreateCanvasInput, SaveCanvasDraftInput } from "../../domain/canvas";
import { DomainError } from "../../domain/errors";
import type { CanvasService, UpdateCanvasMetadataInput } from "../contracts";
import { validateCanvas } from "./validation";
export class InMemoryCanvasService implements CanvasService {
readonly #drafts = new Map<string, CanvasDraft>();
readonly #published = new Map<string, PublishedCanvas>();
async create(input: CreateCanvasInput): Promise<CanvasDraft> {
if (this.#drafts.has(input.id)) throw new DomainError("revision_conflict", "Canvas already exists");
const document: CanvasDocument = { schemaVersion: 1, id: input.id, name: input.name.trim(), logicalSize: input.logicalSize ?? { width: 1280, height: 720 }, background: "#0b1020", widgets: [] };
if (!document.name) throw new DomainError("schema_invalid", "Canvas name is required");
const draft = this.#newDraft(validateCanvas(document), 1); this.#drafts.set(document.id, draft); return structuredClone(draft);
}
async list(): Promise<readonly CanvasSummary[]> { return [...this.#drafts.values()].map(d => { const p=this.#published.get(d.document.id); return { id:d.document.id,name:d.document.name,logicalSize:structuredClone(d.document.logicalSize),widgetCount:d.document.widgets.length,draftRevision:d.draftRevision,...(p?{publishedRevision:p.revision}:{}),updatedAt:d.updatedAt }; }).sort((a,b)=>b.updatedAt-a.updatedAt||a.name.localeCompare(b.name)); }
async open(id: string): Promise<CanvasWorkspace | undefined> { const draft=this.#drafts.get(id); if(!draft)return undefined; const publication=this.#published.get(id); return structuredClone({draft,...(publication?{publication}:{})}); }
async save(input: SaveCanvasDraftInput): Promise<CanvasDraft> { const current=this.#drafts.get(input.document.id); if(!current)throw new DomainError("not_found","Canvas draft not found"); if(current.draftRevision!==input.expectedDraftRevision)throw new DomainError("revision_conflict","Draft changed since it was opened",{expected:input.expectedDraftRevision,actual:current.draftRevision}); const next=this.#newDraft(validateCanvas(input.document),current.draftRevision+1); this.#drafts.set(input.document.id,next); return structuredClone(next); }
async saveDraft(document: CanvasDocument): Promise<void> { const valid=validateCanvas(document), current=this.#drafts.get(valid.id); this.#drafts.set(valid.id,this.#newDraft(valid,(current?.draftRevision??0)+1)); }
async getDraft(id:string): Promise<CanvasDocument|undefined> { return (await this.open(id))?.draft.document; }
async publish(id:string): Promise<PublishedCanvas> { const draft=this.#drafts.get(id); if(!draft)throw new DomainError("not_found","Canvas draft not found"); const previous=this.#published.get(id); const published:PublishedCanvas={canvasId:id,revision:(previous?.revision??0)+1,publishedAt:Date.now(),document:structuredClone(draft.document)}; this.#published.set(id,published); return structuredClone(published); }
async getPublished(id:string): Promise<PublishedCanvas|undefined> { const value=this.#published.get(id); return value&&structuredClone(value); }
async delete(id: string): Promise<boolean> {
  const had = this.#drafts.delete(id);
  this.#published.delete(id);
  return had;
}
async updateMetadata(id: string, input: UpdateCanvasMetadataInput): Promise<CanvasSummary> {
  const current = this.#drafts.get(id);
  if (!current) throw new DomainError("not_found", "Canvas draft not found");
  const newId = input.newId?.trim();
  if (newId && newId !== id) {
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(newId)) throw new DomainError("schema_invalid", "Invalid canvas id");
    if (this.#drafts.has(newId)) throw new DomainError("revision_conflict", "Canvas already exists with target id");
  }
  const targetId = newId || id;
  const newName = input.name !== undefined ? input.name.trim() : current.document.name;
  if (!newName) throw new DomainError("schema_invalid", "Canvas name is required");
  const doc: CanvasDocument = {
    ...current.document,
    id: targetId,
    name: newName,
    logicalSize: input.logicalSize ? structuredClone(input.logicalSize) : current.document.logicalSize,
  };
  const updatedDraft = this.#newDraft(validateCanvas(doc), current.draftRevision + 1);
  if (targetId !== id) {
    this.#drafts.delete(id);
    const pub = this.#published.get(id);
    if (pub) {
      this.#published.delete(id);
      this.#published.set(targetId, { ...pub, canvasId: targetId, document: { ...pub.document, id: targetId, name: newName } });
    }
  }
  this.#drafts.set(targetId, updatedDraft);
  const pub = this.#published.get(targetId);
  return {
    id: targetId,
    name: updatedDraft.document.name,
    logicalSize: structuredClone(updatedDraft.document.logicalSize),
    widgetCount: updatedDraft.document.widgets.length,
    draftRevision: updatedDraft.draftRevision,
    ...(pub ? { publishedRevision: pub.revision } : {}),
    updatedAt: updatedDraft.updatedAt,
  };
}
#newDraft(document:CanvasDocument,draftRevision:number):CanvasDraft{return{document:structuredClone(document),draftRevision,updatedAt:Date.now()};}
}