import { describe, expect, it, afterEach } from "bun:test";
import { EmitterService } from "../src/services/emitter/emitter-service";
import { TmpfsEmitterWatcher } from "../src/services/emitter/tmpfs-emitter-watcher";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("EmitterService", () => {
  it("registers an emitter manifest with initial state", () => {
    const service = new EmitterService();
    const reg = service.register(
      {
        id: "yt-music",
        name: "YouTube Music Desktop",
        category: "media",
        controls: [{ id: "play_pause", type: "toggle", label: "Play/Pause" }],
      },
      { title: "Starboy", playing: true },
      "http"
    );

    expect(reg.manifest.id).toBe("yt-music");
    expect(reg.manifest.category).toBe("media");
    expect(reg.state.title).toBe("Starboy");
    expect(reg.state.playing).toBe(true);
    expect(service.getEmitter("yt-music")).toBeDefined();
  });

  it("publishes state and merges incremental updates", () => {
    const service = new EmitterService();
    service.register({ id: "sensors", name: "Pi Sensors", category: "sensor" }, { temp: 42 });

    const updated = service.publishState("sensors", { humidity: 65 });
    expect(updated.state.temp).toBe(42);
    expect(updated.state.humidity).toBe(65);
  });

  it("auto-registers unknown emitters on first state publish", () => {
    const service = new EmitterService();
    const reg = service.publishState("custom_daemon", { load: 1.25 });
    expect(reg.manifest.id).toBe("custom_daemon");
    expect(reg.state.load).toBe(1.25);
    expect(service.listEmitters().length).toBe(1);
  });

  it("dispatches commands and correlates results", async () => {
    const service = new EmitterService();
    service.register({ id: "spotify", name: "Spotify", category: "media" });

    service.bindCommandHandler("spotify", async (cmd) => {
      expect(cmd.controlId).toBe("next_track");
      return { ok: true, correlationId: cmd.correlationId, state: { track: "New Track" } };
    });

    const res = await service.sendCommand({
      emitterId: "spotify",
      controlId: "next_track",
      correlationId: "corr-123",
    });

    expect(res.ok).toBe(true);
    expect(res.correlationId).toBe("corr-123");
    expect(res.state?.track).toBe("New Track");
  });

  it("returns error if command dispatched to emitter without handler", async () => {
    const service = new EmitterService();
    const res = await service.sendCommand({
      emitterId: "nonexistent",
      controlId: "action",
      correlationId: "corr-456",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("No active command receiver");
  });
});

describe("TmpfsEmitterWatcher", () => {
  let tempDir: string;
  let watcher: TmpfsEmitterWatcher;

  afterEach(() => {
    watcher?.stop();
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("watches directory, ingests dropped JSON, and bridges commands via .cmd.json", async () => {
    tempDir = mkdtempSync(join(tmpdir(), "glansk-test-emitters-"));
    const service = new EmitterService();
    watcher = new TmpfsEmitterWatcher(service, { directory: tempDir, debounceMs: 10 });
    watcher.start();

    // 1. External script drops state file
    const sensorPayload = {
      manifest: {
        id: "pi-thermal",
        name: "Pi Thermal Zone",
        category: "sensor",
      },
      state: {
        tempC: 49.5,
        fanSpeed: "medium",
      },
    };

    writeFileSync(join(tempDir, "pi-thermal.json"), JSON.stringify(sensorPayload), "utf8");

    // Wait for debounce and file read
    await Bun.sleep(50);

    const emitter = service.getEmitter("pi-thermal");
    expect(emitter).toBeDefined();
    expect(emitter?.state.tempC).toBe(49.5);

    // 2. UI dispatches command -> should create .cmd.json
    const cmdResult = await service.sendCommand({
      emitterId: "pi-thermal",
      controlId: "fan_boost",
      correlationId: "c-999",
      value: "high",
    });

    expect(cmdResult.ok).toBe(true);

    const cmdFilePath = join(tempDir, "pi-thermal.cmd.json");
    expect(existsSync(cmdFilePath)).toBe(true);
    const cmdFileContent = JSON.parse(readFileSync(cmdFilePath, "utf8"));
    expect(cmdFileContent.controlId).toBe("fan_boost");
    expect(cmdFileContent.value).toBe("high");
  });
});
