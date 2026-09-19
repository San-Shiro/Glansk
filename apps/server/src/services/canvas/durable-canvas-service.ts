import type { CanvasDocument, PublishedCanvas } from "../../domain/types";
import type { CanvasDraft, CanvasSummary, CanvasWorkspace, CreateCanvasInput, SaveCanvasDraftInput } from "../../domain/canvas";
import { DomainError } from "../../domain/errors";
import type { CanvasService, UpdateCanvasMetadataInput } from "../contracts";
import { validateCanvas } from "./validation";
import { FileCanvasRepository, type CanvasRepositoryState } from "../../adapters/persistence/file-canvas-repository";

export class DurableCanvasService implements CanvasService {
  constructor(readonly repository: FileCanvasRepository) {}
  async initialize(): Promise<void> { await this.repository.load(); }
  async create(input:CreateCanvasInput):Promise<CanvasDraft>{const state=await this.repository.load();if(state.drafts[input.id])throw new DomainError("revision_conflict","Canvas already exists");const document=validateCanvas({schemaVersion:1,id:input.id,name:input.name.trim(),logicalSize:input.logicalSize??{width:1280,height:720},background:"#0b1020",widgets:[]});if(!document.name)throw new DomainError("schema_invalid","Canvas name is required");const draft=this.#draft(document,1);await this.#commit(state,{...state,drafts:{...state.drafts,[document.id]:draft}});return structuredClone(draft)}
  async list():Promise<readonly CanvasSummary[]>{const state=await this.repository.load();return Object.values(state.drafts).map(d=>{const p=state.publications[d.document.id];return{id:d.document.id,name:d.document.name,logicalSize:structuredClone(d.document.logicalSize),widgetCount:d.document.widgets.length,draftRevision:d.draftRevision,...(p?{publishedRevision:p.revision}:{}),updatedAt:d.updatedAt}}).sort((a,b)=>b.updatedAt-a.updatedAt||a.name.localeCompare(b.name))}
  async open(id:string):Promise<CanvasWorkspace|undefined>{const state=await this.repository.load(),draft=state.drafts[id];if(!draft)return undefined;const publication=state.publications[id];return structuredClone({draft,...(publication?{publication}:{})})}
  async save(input:SaveCanvasDraftInput):Promise<CanvasDraft>{const state=await this.repository.load(),current=state.drafts[input.document.id];if(!current)throw new DomainError("not_found","Canvas draft not found");if(current.draftRevision!==input.expectedDraftRevision)throw new DomainError("revision_conflict","Draft changed since it was opened",{expected:input.expectedDraftRevision,actual:current.draftRevision});const draft=this.#draft(validateCanvas(input.document),current.draftRevision+1);await this.#commit(state,{...state,drafts:{...state.drafts,[input.document.id]:draft}});return structuredClone(draft)}
  async saveDraft(document:CanvasDocument):Promise<void>{const state=await this.repository.load(),current=state.drafts[document.id];const draft=this.#draft(validateCanvas(document),(current?.draftRevision??0)+1);await this.#commit(state,{...state,drafts:{...state.drafts,[document.id]:draft}})}
  async getDraft(id:string):Promise<CanvasDocument|undefined>{return (await this.open(id))?.draft.document}
  async publish(id:string):Promise<PublishedCanvas>{const state=await this.repository.load(),draft=state.drafts[id];if(!draft)throw new DomainError("not_found","Canvas draft not found");const publication:PublishedCanvas={canvasId:id,revision:(state.publications[id]?.revision??0)+1,publishedAt:Date.now(),document:structuredClone(draft.document)};await this.#commit(state,{...state,publications:{...state.publications,[id]:publication}});return structuredClone(publication)}
  async getPublished(id:string):Promise<PublishedCanvas|undefined>{const value=(await this.repository.load()).publications[id];return value&&structuredClone(value)}
  async delete(id: string): Promise<boolean> {
    const state = await this.repository.load();
    if (!state.drafts[id] && !state.publications[id]) return false;
    const nextDrafts = { ...state.drafts };
    delete nextDrafts[id];
    const nextPubs = { ...state.publications };
    delete nextPubs[id];
    await this.#commit(state, { ...state, drafts: nextDrafts, publications: nextPubs });
    return true;
  }
  async updateMetadata(id: string, input: UpdateCanvasMetadataInput): Promise<CanvasSummary> {
    const state = await this.repository.load();
    const current = state.drafts[id];
    if (!current) throw new DomainError("not_found", "Canvas draft not found");
    const newId = input.newId?.trim();
    if (newId && newId !== id) {
      if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(newId)) throw new DomainError("schema_invalid", "Invalid canvas id");
      if (state.drafts[newId]) throw new DomainError("revision_conflict", "Canvas already exists with target id");
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
    const updatedDraft = this.#draft(validateCanvas(doc), current.draftRevision + 1);
    const nextDrafts = { ...state.drafts };
    const nextPubs = { ...state.publications };
    if (targetId !== id) {
      delete nextDrafts[id];
      const pub = nextPubs[id];
      if (pub) {
        delete nextPubs[id];
        nextPubs[targetId] = {
          ...pub,
          canvasId: targetId,
          document: { ...pub.document, id: targetId, name: newName },
        };
      }
    }
    nextDrafts[targetId] = updatedDraft;
    await this.#commit(state, { ...state, drafts: nextDrafts, publications: nextPubs });
    const pub = nextPubs[targetId];
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
  #draft(document:CanvasDocument,draftRevision:number):CanvasDraft{return{document:structuredClone(document),draftRevision,updatedAt:Date.now()}}
  async #commit(current:CanvasRepositoryState,next:CanvasRepositoryState):Promise<void>{const {storeRevision:_,...content}=next;await this.repository.commit(current.storeRevision,content)}
}
