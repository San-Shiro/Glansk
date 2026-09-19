import { describe, expect, test } from "bun:test";
import { SecretVaultService } from "../src/services/vault/secret-vault-service";
import { createApp } from "../src/app";
import { InMemoryCanvasService } from "../src/services/canvas/in-memory-canvas-service";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("SecretVaultService & API Routes", () => {
  test("persists, encrypts, and recovers secrets without leaking plaintext in list", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-vault-test-"));
    try {
      const vault = new SecretVaultService(dir);
      await vault.initialize();

      expect(vault.listSecrets()).toHaveLength(0);

      const meta = await vault.saveSecret({
        id: "openweather_key",
        name: "OpenWeather API Key",
        value: "super-secret-token-12345",
        allowedDomains: ["api.openweathermap.org"],
        description: "Primary key for weather forecasts",
      });

      expect(meta.id).toBe("openweather_key");
      expect(meta.name).toBe("OpenWeather API Key");
      expect(meta.allowedDomains).toEqual(["api.openweathermap.org"]);
      expect((meta as any).value).toBeUndefined(); // value is omitted from meta

      // Internal getSecret retrieves value
      const stored = vault.getSecret("openweather_key");
      expect(stored?.value).toBe("super-secret-token-12345");

      // List returns meta only
      const list = vault.listSecrets();
      expect(list).toHaveLength(1);
      expect((list[0] as any).value).toBeUndefined();

      // Recover in new instance
      const vault2 = new SecretVaultService(dir);
      await vault2.initialize();
      expect(vault2.listSecrets()).toHaveLength(1);
      expect(vault2.getSecret("openweather_key")?.value).toBe("super-secret-token-12345");

      // Delete
      expect(await vault2.deleteSecret("openweather_key")).toBe(true);
      expect(vault2.listSecrets()).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("HTTP API endpoints handle CRUD operations safely", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-vault-http-"));
    try {
      const vault = new SecretVaultService(dir);
      await vault.initialize();

      const app = createApp({ canvases: new InMemoryCanvasService(), vault });

      // 1. List initially empty
      const res1 = await app(new Request("http://localhost/api/v1/vault/secrets"));
      expect(res1.status).toBe(200);
      expect(await res1.json()).toEqual([]);

      // 2. Create secret via POST
      const resPost = await app(new Request("http://localhost/api/v1/vault/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "spotify_token",
          name: "Spotify Client Secret",
          value: "sp-sec-9999",
          allowedDomains: ["api.spotify.com"],
        }),
      }));
      expect(resPost.status).toBe(201);
      const postBody = await resPost.json() as any;
      expect(postBody.ok).toBe(true);
      expect(postBody.secret.id).toBe("spotify_token");
      expect(postBody.secret.value).toBeUndefined();

      // 3. List contains newly created secret without plaintext
      const resList = await app(new Request("http://localhost/api/v1/vault/secrets"));
      const list = await resList.json() as any[];
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe("spotify_token");
      expect(list[0].value).toBeUndefined();

      // 4. Update secret without changing value preserves previous value
      const resUpdate = await app(new Request("http://localhost/api/v1/vault/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "spotify_token",
          name: "Spotify Client Secret Renamed",
          value: "", // empty value on edit preserves previous
          allowedDomains: ["api.spotify.com", "accounts.spotify.com"],
        }),
      }));
      expect(resUpdate.status).toBe(201);
      const stored = vault.getSecret("spotify_token");
      expect(stored?.name).toBe("Spotify Client Secret Renamed");
      expect(stored?.value).toBe("sp-sec-9999"); // preserved!
      expect(stored?.allowedDomains).toEqual(["api.spotify.com", "accounts.spotify.com"]);

      // 5. Delete secret
      const resDel = await app(new Request("http://localhost/api/v1/vault/secrets/spotify_token", {
        method: "DELETE",
      }));
      expect(resDel.status).toBe(200);
      expect(await resDel.json()).toEqual({ ok: true, deleted: true });

      // 6. Delete non-existent secret returns 404
      const resDel404 = await app(new Request("http://localhost/api/v1/vault/secrets/spotify_token", {
        method: "DELETE",
      }));
      expect(resDel404.status).toBe(404);

      // 7. Validation error on bad input
      const resBad = await app(new Request("http://localhost/api/v1/vault/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "!", name: "Invalid" }),
      }));
      expect(resBad.status).toBe(400);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test("corrupted ciphertext causes initialize() to throw to prevent data wipe", async () => {
    const dir = await mkdtemp(join(tmpdir(), "ld-vault-corrupt-"));
    try {
      const vault = new SecretVaultService(dir);
      await vault.initialize();
      await vault.saveSecret({ id: "test_key", name: "Test Key", value: "secret123" });

      // Corrupt the encrypted vault file
      const vaultFile = join(dir, "vault.enc");
      const { writeFile } = await import("node:fs/promises");
      await writeFile(vaultFile, Buffer.from("corrupted-junk-data-that-cannot-decrypt-01234567890123456789"));

      const vault2 = new SecretVaultService(dir);
      expect(vault2.initialize()).rejects.toThrow(/Vault present but failed to decrypt/);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
