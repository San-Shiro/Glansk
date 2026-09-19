import { describe, it, expect } from "bun:test";
import {
  CORE_PRIMITIVE_IDS,
  CORE_WIDGET_DEFINITIONS,
  LEGACY_WIDGET_DEFINITIONS,
  getWidgetDefinition,
} from "../src/shared/widget-definitions.js";
import { widgetMarkup } from "../src/shared/widget-markup.js";
import {
  isLegacyWidget,
  getWidgetAlias,
  resolveWidgetTarget,
  LEGACY_WIDGET_ALIASES,
} from "../src/shared/widget-aliases.js";

describe("Glansk Core Universal Primitives", () => {
  it("defines exactly the 8 universal primitives in CORE_PRIMITIVE_IDS", () => {
    expect(CORE_PRIMITIVE_IDS).toEqual([
      "image",
      "shape",
      "icon",
      "video",
      "audio",
      "slideshow",
      "button",
      "label",
    ]);
  });

  it("provides comprehensive schemas and color slots for each core primitive", () => {
    for (const id of CORE_PRIMITIVE_IDS) {
      const def = getWidgetDefinition(id);
      expect(def).toBeDefined();
      expect(def.title).toBeTruthy();
      expect(def.minWidth).toBeGreaterThan(0);
      expect(def.minHeight).toBeGreaterThan(0);
      expect(Array.isArray(def.colorSlots)).toBe(true);
      expect(def.colorSlots.length).toBeGreaterThanOrEqual(3);
      expect(Array.isArray(def.configSchema)).toBe(true);
    }
  });

  it("renders image primitive markup with custom url, fit, and radius", () => {
    const markup = widgetMarkup({
      widgetId: "image",
      config: {
        url: "https://example.com/satellite.jpg",
        alt: "Orbit view",
        fit: "contain",
        radius: 14,
        opacity: 90,
      },
    });

    expect(markup).toContain('class="primitive-image-wrap"');
    expect(markup).toContain('src="https://example.com/satellite.jpg"');
    expect(markup).toContain('alt="Orbit view"');
    expect(markup).toContain('object-fit: contain');
    expect(markup).toContain('border-radius: 14px');
  });

  it("renders shape primitive markup with type, border, and blur", () => {
    const markup = widgetMarkup({
      widgetId: "shape",
      config: {
        shapeType: "circle",
        borderWidth: 2,
        blur: 16,
      },
    });

    expect(markup).toContain('class="primitive-shape primitive-shape-circle"');
    expect(markup).toContain('border-radius: 50%');
    expect(markup).toContain('border-width: 2px');
    expect(markup).toContain('backdrop-filter: blur(16px)');
  });

  it("renders icon primitive markup with glyph and badge", () => {
    const markup = widgetMarkup({
      widgetId: "icon",
      config: {
        icon: "zap",
        size: 48,
        shape: "rounded",
        badge: "ALERT",
      },
    });

    expect(markup).toContain('class="primitive-icon-container primitive-icon-rounded"');
    expect(markup).toContain('width: 48px');
    expect(markup).toContain('class="primitive-icon-badge">ALERT</span>');
  });

  it("renders video primitive markup with streaming attributes", () => {
    const markup = widgetMarkup({
      widgetId: "video",
      config: {
        url: "https://stream.example.com/camera.mp4",
        autoplay: true,
        loop: true,
        muted: true,
        fit: "cover",
      },
    });

    expect(markup).toContain('class="primitive-video-wrap"');
    expect(markup).toContain('src="https://stream.example.com/camera.mp4"');
    expect(markup).toContain('autoplay');
    expect(markup).toContain('loop');
    expect(markup).toContain('muted');
  });

  it("renders audio primitive markup with title and artist", () => {
    const markup = widgetMarkup({
      widgetId: "audio",
      config: {
        title: "Telemetry Audio Beacon",
        artist: "Radio Astronomy",
        playing: true,
      },
    });

    expect(markup).toContain('class="primitive-audio-wrap"');
    expect(markup).toContain('class="primitive-audio-disc is-playing"');
    expect(markup).toContain("Telemetry Audio Beacon");
    expect(markup).toContain("Radio Astronomy");
  });

  it("renders action button primitive markup with command dispatch target", () => {
    const markup = widgetMarkup({
      widgetId: "button",
      config: {
        label: "Activate Reactor",
        variant: "solid",
        actionType: "command",
        target: "power.grid.activate",
        icon: "zap",
      },
    });

    expect(markup).toContain('class="primitive-btn primitive-btn-solid"');
    expect(markup).toContain('data-action="command"');
    expect(markup).toContain('data-target="power.grid.activate"');
    expect(markup).toContain("Activate Reactor");
  });

  it("renders label typography primitive with font sizing and weight", () => {
    const markup = widgetMarkup({
      widgetId: "label",
      config: {
        text: "Quantum Flux: Nominal",
        subtitle: "Sector 7 Telemetry",
        fontSize: "xl",
        fontWeight: "bold",
        align: "center",
      },
    });

    expect(markup).toContain('class="primitive-label primitive-label-xl primitive-label-bold primitive-align-center"');
    expect(markup).toContain("Quantum Flux: Nominal");
    expect(markup).toContain("Sector 7 Telemetry");
  });
});

describe("Legacy Widget Alias and Migration Compatibility", () => {
  it("identifies all domain widgets as legacy aliases", () => {
    const expectedLegacy = [
      "env-hub",
      "net-sentinel",
      "energy-matrix",
      "device-switchboard",
      "task-matrix",
      "quick-notes",
      "music-player",
      "emitter-widget",
    ];

    for (const id of expectedLegacy) {
      expect(isLegacyWidget(id)).toBe(true);
      const alias = getWidgetAlias(id);
      expect(alias).toBeDefined();
      expect(alias?.targetPackageId).toContain("com.glansk.");
    }
  });

  it("resolves legacy IDs into packaged destination suites", () => {
    expect(resolveWidgetTarget("env-hub")).toEqual({
      packageId: "com.glansk.infrastructure",
      widgetId: "env-hub",
    });

    expect(resolveWidgetTarget("energy-matrix")).toEqual({
      packageId: "com.glansk.energy",
      widgetId: "energy-matrix",
    });

    expect(resolveWidgetTarget("task-matrix")).toEqual({
      packageId: "com.glansk.productivity",
      widgetId: "task-matrix",
    });
  });

  it("preserves explicit external package identifiers without rewriting", () => {
    expect(resolveWidgetTarget("custom-widget", "org.external.suite")).toEqual({
      packageId: "org.external.suite",
      widgetId: "custom-widget",
    });
  });
});
