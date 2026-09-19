import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AtomicDocumentStore } from "../../services/contracts";
import { DomainError } from "../../domain/errors";

const KEY = /^[a-z0-9][a-z0-9._/-]{0,190}$/;

export class FileDocumentStore implements AtomicDocumentStore {
  readonly #root: string;
  constructor(root: string) { this.#root = resolve(root); }

  async read<T>(key: string): Promise<T | undefined> {
    const path = this.#path(key);
    try { return JSON.parse(await readFile(path, "utf8")) as T; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  async write<T>(key: string, value: T): Promise<void> {
    const path = this.#path(key);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${crypto.randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, path);
  }

  #path(key: string): string {
    if (!KEY.test(key) || key.includes("..")) throw new DomainError("malformed", "Invalid document key");
    const path = resolve(join(this.#root, `${key}.json`));
    if (!path.startsWith(`${this.#root}\\`) && !path.startsWith(`${this.#root}/`)) throw new DomainError("forbidden", "Document path escaped store root");
    return path;
  }
}
