import type { CanvasDraft } from "../../domain/canvas";
import type { PublishedCanvas } from "../../domain/types";
import { DomainError } from "../../domain/errors";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface CanvasRepositoryState {
  schemaVersion: 2;
  storeRevision: number;
  drafts: Record<string, CanvasDraft>;
  publications: Record<string, PublishedCanvas>;
}
type LegacyState = { schemaVersion: 1; drafts?: Record<string, CanvasDraft>; publications?: Record<string, PublishedCanvas> };
const empty = (): CanvasRepositoryState => ({ schemaVersion: 2, storeRevision: 0, drafts: {}, publications: {} });

export class FileCanvasRepository {
  readonly #root: string; readonly #file: string; readonly #backup: string; readonly #lock: string;
  constructor(root: string) { this.#root=resolve(root); this.#file=join(this.#root,"canvases.json"); this.#backup=join(this.#root,"canvases.backup.json"); this.#lock=join(this.#root,".canvases.lock"); }
  async load(): Promise<CanvasRepositoryState> {
    await mkdir(this.#root,{recursive:true});
    try { return await this.#read(this.#file); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") { try { const recovered=await this.#read(this.#backup); await this.#write(recovered,false); return recovered; } catch (backup) { if ((backup as NodeJS.ErrnoException).code === "ENOENT") return empty(); throw new DomainError("malformed","Canvas repository backup is unreadable"); } }
      try { const recovered=await this.#read(this.#backup); await rename(this.#file,`${this.#file}.corrupt-${Date.now()}`).catch(()=>undefined); await this.#write(recovered,false); return recovered; } catch { throw new DomainError("malformed","Canvas repository and backup are unreadable",{cause:String(error)}); }
    }
  }
  async commit(expected:number,next:Omit<CanvasRepositoryState,"storeRevision">):Promise<CanvasRepositoryState>{const release=await this.#acquire();try{const current=await this.load();if(current.storeRevision!==expected)throw new DomainError("revision_conflict","Repository changed during operation",{expected,actual:current.storeRevision});const value:CanvasRepositoryState={...structuredClone(next),storeRevision:expected+1};await this.#write(value,true);return value}finally{await release()}}
  async #read(path:string):Promise<CanvasRepositoryState>{const value=JSON.parse(await readFile(path,"utf8")) as CanvasRepositoryState|LegacyState;if(value.schemaVersion===1)return{schemaVersion:2,storeRevision:0,drafts:value.drafts??{},publications:value.publications??{}};if(value.schemaVersion!==2||!Number.isSafeInteger(value.storeRevision)||!value.drafts||!value.publications)throw Error("Unsupported canvas repository schema");return structuredClone(value)}
  async #write(value:CanvasRepositoryState,backup:boolean):Promise<void>{const temporary=`${this.#file}.${crypto.randomUUID()}.tmp`;const handle=await open(temporary,"wx");try{await handle.writeFile(`${JSON.stringify(value,null,2)}\n`);await handle.sync()}finally{await handle.close()}if(backup){await rm(this.#backup,{force:true});await rename(this.#file,this.#backup).catch(error=>{if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error})}await rename(temporary,this.#file)}
  async #acquire():Promise<()=>Promise<void>>{for(let attempt=0;attempt<50;attempt++){try{await mkdir(this.#lock);return()=>rm(this.#lock,{recursive:true,force:true})}catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;await Bun.sleep(10)}}throw new DomainError("revision_conflict","Canvas repository is busy")}
}
