import { describe, it, expect } from "bun:test";
import { normalizeManifestToV2 } from "../src/platform/package-manifest-v2";
import { validateDesignPreset, resolvePresetCssVariables, BUILTIN_DESIGN_PRESETS } from "../src/platform/design-preset-schema";
import { validatePackage } from "../src/platform/package-validator";

describe("Package Manifest v2 & Multi-Widget Specifications", () => {
  it("normalizes a v1 manifest into an internal v2 manifest structure", () => {
    const v1 = {
      schemaVersion: 1,
      id: "com.test.clock",
      version: "1.0.0",
      name: "Digital Clock",
      entry: "index.html",
      files: { "index.html": "abc" },
      capabilities: ["clock:tick"],
    };

    const v2 = normalizeManifestToV2(v1);
    expect(v2.manifestVersion).toBe(2);
    expect(v2.id).toBe("com.test.clock");
    expect(v2.widgets.length).toBe(1);
    expect(v2.widgets[0]?.id).toBe("com.test.clock");
    expect(v2.widgets[0]?.entry).toBe("index.html");
    expect(v2.capabilities?.publishTopics).toEqual(["clock:tick"]);
  });

  it("normalizes a multi-widget v2 manifest with presets and limits", () => {
    const rawV2 = {
      manifestVersion: 2,
      id: "com.glansk.smart-home",
      version: "2.1.0",
      name: "Smart Home Suite",
      kind: "composite",
      author: { name: "Glansk Team", email: "team@glansk.io" },
      widgets: [
        {
          id: "env-hub",
          name: "Environment Hub",
          entry: "widgets/env-hub/index.html",
          category: "sensor",
          dimensions: {
            default: { w: 320, h: 240 },
            minimum: { w: 280, h: 200 },
          },
        },
        {
          id: "device-switchboard",
          name: "Device Switchboard",
          entry: "widgets/switchboard/index.html",
          category: "control",
          dimensions: {
            default: { w: 340, h: 260 },
            minimum: { w: 300, h: 220 },
          },
        },
      ],
      aliases: [
        { legacyWidgetId: "env-hub", widgetId: "env-hub" },
      ],
      limits: {
        messagesPerSecond: 100,
        maxMessageBytes: 32768,
      },
      files: {
        "widgets/env-hub/index.html": "hash1",
        "widgets/switchboard/index.html": "hash2",
      },
    };

    const v2 = normalizeManifestToV2(rawV2);
    expect(v2.manifestVersion).toBe(2);
    expect(v2.id).toBe("com.glansk.smart-home");
    expect(v2.widgets.length).toBe(2);
    expect(v2.widgets[0]?.id).toBe("env-hub");
    expect(v2.widgets[1]?.id).toBe("device-switchboard");
    expect(v2.aliases?.length).toBe(1);
    expect(v2.aliases?.[0]?.legacyWidgetId).toBe("env-hub");
    expect(v2.limits?.messagesPerSecond).toBe(100);
  });

  it("validates built-in curated design presets", () => {
    for (const [id, preset] of Object.entries(BUILTIN_DESIGN_PRESETS)) {
      const res = validateDesignPreset(preset);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
      expect(preset.palette.background).toBeDefined();
      expect(preset.palette.primaryText).toBeDefined();
      expect(preset.palette.accent).toBeDefined();
    }
  });

  it("resolves CSS variables correctly for Gulf Racing and custom overrides", () => {
    const gulf = BUILTIN_DESIGN_PRESETS["gulf-racing"];
    const vars = resolvePresetCssVariables(gulf);
    expect(vars["--tile-bg"]).toBe("#1A2730");
    expect(vars["--tile-accent"]).toBe("#E95D2C");
    expect(vars["--tile-value"]).toBe("#FFFFFF");

    // With user override
    const customized = resolvePresetCssVariables(gulf, { accent: "#38BDF8" });
    expect(customized["--tile-bg"]).toBe("#1A2730");
    expect(customized["--tile-accent"]).toBe("#38BDF8");
  });

  it("package validator accepts manifestVersion 2", async () => {
    const manifest = {
      manifestVersion: 2 as const,
      id: "com.test.v2package",
      version: "1.0.0",
      files: {},
      widgets: [{ id: "test-widget", entry: "index.html" }],
    };
    const files = new Map<string, Uint8Array>();

    const res = await validatePackage(manifest, files, new Map(), true);
    expect(res.trusted).toBe(false);
    expect(res.boundary).toBe("development-only unsigned package");
  });
});
