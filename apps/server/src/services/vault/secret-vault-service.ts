import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface VaultSecretMeta {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly allowedDomains: string[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface VaultSecretEntry extends VaultSecretMeta {
  readonly value: string;
}

export interface SaveSecretInput {
  id: string;
  name: string;
  value: string;
  description?: string;
  allowedDomains?: string[];
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export class SecretVaultService {
  readonly #root: string;
  readonly #keyFile: string;
  readonly #vaultFile: string;
  #key: Buffer | null = null;
  readonly #secrets = new Map<string, VaultSecretEntry>();
  #initialized = false;

  constructor(dataDirectory: string) {
    this.#root = resolve(dataDirectory);
    this.#keyFile = join(this.#root, "vault.key");
    this.#vaultFile = join(this.#root, "vault.enc");
  }

  async initialize(): Promise<void> {
    if (this.#initialized) return;
    await mkdir(this.#root, { recursive: true });

    // 1. Obtain master key
    if (process.env.GLANSK_MASTER_KEY) {
      const rawEnv = process.env.GLANSK_MASTER_KEY.trim();
      if (/^[0-9a-fA-F]{64}$/.test(rawEnv)) {
        this.#key = Buffer.from(rawEnv, "hex");
      } else {
        this.#key = pbkdf2Sync(rawEnv, "glansk_vault_salt", 100_000, 32, "sha256");
      }
    } else {
      try {
        this.#key = await readFile(this.#keyFile);
        if (this.#key.length !== 32) {
          throw new Error("Invalid key file length");
        }
      } catch {
        this.#key = randomBytes(32);
        await writeFile(this.#keyFile, this.#key, { mode: 0o600 });
      }
    }

    // 2. Load encrypted secrets
    try {
      const raw = await readFile(this.#vaultFile);
      if (raw.length > IV_LENGTH + 16) {
        const iv = raw.subarray(0, IV_LENGTH);
        const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
        const ciphertext = raw.subarray(IV_LENGTH + 16);

        const decipher = createDecipheriv(ALGORITHM, this.#key, iv);
        decipher.setAuthTag(tag);
        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        const list = JSON.parse(decrypted.toString("utf8")) as VaultSecretEntry[];
        for (const item of list) {
          if (item?.id) this.#secrets.set(item.id, item);
        }
      }
    } catch (err: any) {
      if (err && err.code === "ENOENT") {
        // Vault file doesn't exist yet on first boot: clean slate is expected
      } else {
        // Decryption or parsing failed => wrong key or corrupted ciphertext.
        // Refuse to proceed with empty map to prevent silent wipe of ciphertext!
        throw new Error(`Vault present but failed to decrypt (key mismatch or corruption): ${err?.message || err}`);
      }
    }

    this.#initialized = true;
  }

  listSecrets(): VaultSecretMeta[] {
    return Array.from(this.#secrets.values()).map((s) => ({
      id: s.id,
      name: s.name,
      ...(s.description !== undefined ? { description: s.description } : {}),
      allowedDomains: s.allowedDomains,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }

  getSecret(id: string): VaultSecretEntry | undefined {
    return this.#secrets.get(id);
  }

  async saveSecret(input: SaveSecretInput): Promise<VaultSecretMeta> {
    if (!input.id || typeof input.id !== "string" || !/^[a-zA-Z0-9_\-:]{2,64}$/.test(input.id)) {
      throw new Error("Invalid secret ID (2-64 alphanumeric chars)");
    }
    if (!input.name || typeof input.name !== "string") {
      throw new Error("Secret name is required");
    }

    const now = Date.now();
    const prev = this.#secrets.get(input.id);
    const hasNewValue = typeof input.value === "string" && input.value.length > 0;
    if (!hasNewValue && !prev) {
      throw new Error("Secret value is required");
    }

    const desc = input.description?.trim();
    const entry: VaultSecretEntry = {
      id: input.id,
      name: input.name.trim(),
      ...(desc ? { description: desc } : {}),
      value: hasNewValue ? input.value : prev!.value,
      allowedDomains: Array.isArray(input.allowedDomains)
        ? input.allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean)
        : [],
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };

    this.#secrets.set(entry.id, entry);
    await this.#persist();

    return {
      id: entry.id,
      name: entry.name,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      allowedDomains: entry.allowedDomains,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async deleteSecret(id: string): Promise<boolean> {
    if (!this.#secrets.has(id)) return false;
    this.#secrets.delete(id);
    await this.#persist();
    return true;
  }

  async #persist(): Promise<void> {
    if (!this.#key) throw new Error("Vault not initialized");
    const plaintext = Buffer.from(JSON.stringify(Array.from(this.#secrets.values())), "utf8");
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.#key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    const output = Buffer.concat([iv, tag, ciphertext]);
    await writeFile(this.#vaultFile, output);
  }
}
