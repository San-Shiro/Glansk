import { describe, expect, it } from "bun:test";
import {
  CANVAS_THEME_PRESETS,
  CANVAS_THEME_PRESET_IDS,
  resolvedTheme,
  validateThemeImport,
  exportTheme,
} from "../src/shared/canvas-themes.js";
import {
  getWidgetDefinition,
  WIDGET_DEFINITIONS,
} from "../src/shared/widget-definitions.js";
import { widgetMarkup } from "../src/shared/widget-markup.js";
import {
  initMusicPlayer,
  initDeviceSwitchboard,
  initTaskMatrix,
  initQuickNotes,
  initEmitterWidget,
} from "../src/shared/canvas-render.js";

describe("Canvas Theme System", () => {
  it("includes all 8 presets with multi-level accents and color levels", () => {
    expect(CANVAS_THEME_PRESET_IDS).toEqual([
      "midnight",
      "aurora",
      "violet",
      "ember",
      "ocean",
      "graphite",
      "cyberpunk",
      "paper",
    ]);

    for (const id of CANVAS_THEME_PRESET_IDS) {
      const p = CANVAS_THEME_PRESETS[id]!;
      expect(p["--canvas-bg"]).toBeDefined();
      expect(p["--canvas-surface"]).toBeDefined();
      expect(p["--canvas-surface-2"]).toBeDefined();
      expect(p["--canvas-surface-raised"]).toBeDefined();
      expect(p["--canvas-text"]).toBeDefined();
      expect(p["--canvas-text-muted"]).toBeDefined();
      expect(p["--canvas-text-subtle"]).toBeDefined();
      expect(p["--canvas-accent"]).toBeDefined(); // Primary
      expect(p["--canvas-accent-2"]).toBeDefined(); // Secondary
      expect(p["--canvas-accent-3"]).toBeDefined(); // Tertiary
      expect(p["--canvas-border"]).toBeDefined();
      expect(p["--canvas-positive"]).toBeDefined();
      expect(p["--canvas-warning"]).toBeDefined();
      expect(p["--canvas-danger"]).toBeDefined();
      // No radius, shadow or font metrics in theme tokens
      expect((p as Record<string, string>)["--canvas-radius"]).toBeUndefined();
    }
  });

  it("resolves theme with overrides and background", () => {
    const theme = resolvedTheme(
      {
        preset: "aurora",
        variables: {
          "--canvas-accent": "#ff00ff",
          "--canvas-accent-2": "#00ffff",
        },
      },
      "#123456"
    );

    expect(theme["--canvas-bg"]).toBe("#123456");
    expect(theme["--canvas-accent"]).toBe("#ff00ff");
    expect(theme["--canvas-accent-2"]).toBe("#00ffff");
    expect(theme["--canvas-surface"]).toBe(CANVAS_THEME_PRESETS.aurora!["--canvas-surface"]);
  });

  it("safely falls back to midnight when unknown preset is requested", () => {
    const theme = resolvedTheme({ preset: "non-existent" });
    expect(theme["--canvas-accent"]).toBe(CANVAS_THEME_PRESETS.midnight!["--canvas-accent"]);
  });

  it("validates theme import schema and rejects malicious or invalid tokens", () => {
    // Valid import
    const valid = validateThemeImport({
      $type: "glansk.canvas-theme",
      version: 1,
      name: "Custom High-Contrast",
      base: "cyberpunk",
      tokens: {
        "--canvas-accent": "#ffff00",
        "--canvas-accent-2": "#ff007f",
      },
    });
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.theme.name).toBe("Custom High-Contrast");
      expect(valid.theme.tokens["--canvas-accent"]).toBe("#ffff00");
    }

    // Reject wrong $type
    expect(validateThemeImport({ $type: "other", version: 1 }).ok).toBe(false);

    // Reject wrong version
    expect(validateThemeImport({ $type: "glansk.canvas-theme", version: 2 }).ok).toBe(false);

    // Reject malicious CSS injection
    expect(
      validateThemeImport({
        $type: "glansk.canvas-theme",
        version: 1,
        tokens: {
          "--canvas-accent": "red; background: url('http://evil.com')",
        },
      }).ok
    ).toBe(false);
  });

  it("exports clean theme JSON", () => {
    const doc = {
      name: "Ops Display",
      theme: {
        preset: "ocean",
        variables: {
          "--canvas-accent": "#00eeff",
        },
      },
    };
    const exported = exportTheme(doc);
    expect(exported.$type).toBe("glansk.canvas-theme");
    expect(exported.version).toBe(1);
    expect(exported.base).toBe("ocean");
    expect(exported.tokens["--canvas-accent"]).toBe("#00eeff");
  });
});

describe("Widget Sizing and Color Slot Definitions", () => {
  it("falls back to default color slots for unknown or unconfigured widgets", () => {
    const unknown = getWidgetDefinition("custom-sensor");
    expect(unknown.aspectRatio).toBeNull();
    expect(unknown.colorSlots.length).toBeGreaterThan(3);
  });

  it("defines env-hub complex widget with 11 declared color slots and bounds", () => {
    const env = getWidgetDefinition("env-hub");
    expect(env.title).toBe("Environment Control Hub");
    expect(env.aspectRatio).toBeNull();
    expect(env.minWidth).toBe(280);
    expect(env.minHeight).toBe(220);
    expect(env.colorSlots.length).toBe(11);

    const keys = env.colorSlots.map(s => s.key);
    expect(keys).toContain("tempAccent");
    expect(keys).toContain("humidityAccent");
    expect(keys).toContain("aqiAccent");
    expect(keys).toContain("onlineStatus");
    expect(keys).toContain("controlBg");
    expect(keys).toContain("controlActive");
  });

  it("renders env-hub complex widget markup with responsive metrics and sparkline", () => {
    const markup = widgetMarkup({
      widgetId: "env-hub",
      config: {
        location: "Master Suite",
        temperature: 24.1,
        targetTemperature: 22.5,
        humidity: 52,
        airQuality: 28,
        mode: "cool",
        power: true,
        fanSpeed: 3,
        history: [20, 21, 22, 23, 24.1],
      },
    });

    expect(markup).toContain('class="env-hub is-on"');
    expect(markup).toContain("Master Suite");
    expect(markup).toContain("24.1");
    expect(markup).toContain("Target: 22.5°C");
    expect(markup).toContain("52");
    expect(markup).toContain("28");
    expect(markup).toContain('class="env-pill active">COOL</button>');
    expect(markup).toContain('class="env-fan-btn active">3</button>');
    expect(markup).toContain('class="env-sparkline"');
  });

  it("defines energy-matrix widget with 9 color slots and valid sizing bounds", () => {
    const energy = getWidgetDefinition("energy-matrix");
    expect(energy.title).toBe("Smart Energy & Grid Matrix");
    expect(energy.minWidth).toBe(320);
    expect(energy.minHeight).toBe(240);
    expect(energy.colorSlots.length).toBe(9);

    const keys = energy.colorSlots.map(s => s.key);
    expect(keys).toContain("solarAccent");
    expect(keys).toContain("batteryAccent");
    expect(keys).toContain("gridAccent");
    expect(keys).toContain("homeAccent");
    expect(keys).toContain("flowTrack");
  });

  it("renders energy-matrix markup with animated SVG streams, battery ring, and power split", () => {
    const markup = widgetMarkup({
      widgetId: "energy-matrix",
      config: {
        solarKw: 6.45,
        homeKw: 3.10,
        batteryKw: 2.20,
        batterySoc: 92,
        gridKw: -1.15,
        selfPowered: 96,
        dailySolarKwh: 34.2,
      },
    });

    expect(markup).toContain('class="energy-matrix"');
    expect(markup).toContain('class="em-svg"');
    expect(markup).toContain('class="em-stream em-stream-solar"');
    expect(markup).toContain('class="em-soc-bar"');
    expect(markup).toContain("6.45");
    expect(markup).toContain("3.10");
    expect(markup).toContain("92%");
    expect(markup).toContain("96% SELF-POWERED");
  });

  it("defines net-sentinel widget with 9 color slots and valid sizing bounds", () => {
    const sentinel = getWidgetDefinition("net-sentinel");
    expect(sentinel.title).toBe("Cyber Sentinel & Radar");
    expect(sentinel.minWidth).toBe(300);
    expect(sentinel.minHeight).toBe(220);
    expect(sentinel.colorSlots.length).toBe(9);

    const keys = sentinel.colorSlots.map(s => s.key);
    expect(keys).toContain("radarBeam");
    expect(keys).toContain("nodeActive");
    expect(keys).toContain("threatAlert");
    expect(keys).toContain("warningGlow");
    expect(keys).toContain("radarGrid");
  });

  it("renders net-sentinel markup with animated radar sweep, node blips, and spectrum", () => {
    const markup = widgetMarkup({
      widgetId: "net-sentinel",
      config: {
        threatLevel: "DEFCON 5: NOMINAL",
        ping: 11,
        jitter: 0.5,
        throughput: 920,
        packetLoss: 0.00,
        onlineNodes: 32,
        totalNodes: 32,
      },
    });

    expect(markup).toContain('class="net-sentinel"');
    expect(markup).toContain('class="ns-sweep-beam"');
    expect(markup).toContain('class="ns-radar-svg"');
    expect(markup).toContain('class="ns-spectrum-bars"');
    expect(markup).toContain("DEFCON 5: NOMINAL");
    expect(markup).toContain("920");
    expect(markup).toContain("32/32");
  });

  it("provides clean fallback markup for generic widgets without visual title bloat", () => {
    const genericMarkup = widgetMarkup({
      widgetId: "custom-metric",
      config: { label: "Demo Metric", value: "84.2K", trend: "up 12%" },
    });
    expect(genericMarkup).not.toContain('class="label"');
    expect(genericMarkup).toContain("84.2K");
    expect(genericMarkup).toContain("up 12%");
  });

  it("defines image-slideshow widget with 4 color slots and freeform bounds", () => {
    const slideshow = getWidgetDefinition("image-slideshow");
    expect(slideshow.title).toBe("Image Slideshow");
    expect(slideshow.minWidth).toBe(200);
    expect(slideshow.minHeight).toBe(120);
    expect(slideshow.aspectRatio).toBeNull();
    expect(slideshow.colorSlots.length).toBe(4);

    const keys = slideshow.colorSlots.map(s => s.key);
    expect(keys).toContain("bg");
    expect(keys).toContain("border");
    expect(keys).toContain("indicatorDot");
    expect(keys).toContain("indicatorActive");
  });

  it("renders image-slideshow empty state when no images configured", () => {
    const markup = widgetMarkup({
      widgetId: "image-slideshow",
      config: { images: "" },
    });

    expect(markup).toContain('class="ss-wrap ss-crossfade"');
    expect(markup).toContain('class="ss-empty"');
    expect(markup).toContain("No images configured");
    expect(markup).not.toContain('class="ss-indicators"');
  });

  it("renders image-slideshow markup with dual ping-pong buffers and indicators", () => {
    const markup = widgetMarkup({
      widgetId: "image-slideshow",
      config: {
        images: ["/uploads/photo1.webp", "/uploads/photo2.webp", "/uploads/photo3.webp"],
        interval: 8,
        transitionSpeed: 1000,
        transition: "slide",
        fit: "contain",
        showIndicators: true,
      },
    });

    expect(markup).toContain('class="ss-wrap ss-slide-fx"');
    expect(markup).toContain('--ss-speed: 1000ms');
    expect(markup).toContain('--ss-fit-size: contain');
    expect(markup).toContain('data-interval="8"');
    expect(markup).toContain('data-effect="slide"');
    expect(markup).toContain('class="ss-buf solid" data-buf="0" style="background-image: url(\'/uploads/photo1.webp\');"');
    expect(markup).toContain('class="ss-buf" data-buf="1" style="background-image: url(\'/uploads/photo2.webp\');"');
    expect(markup).toContain('class="ss-indicators"');
    expect(markup).toContain('class="ss-dot active" data-idx="0"');
    expect(markup).toContain('data-idx="1"');
    expect(markup).toContain('data-idx="2"');
  });

  it("handles comma-separated string format for images in image-slideshow", () => {
    const markup = widgetMarkup({
      widgetId: "image-slideshow",
      config: {
        images: "https://example.com/a.jpg, https://example.com/b.jpg",
        transition: "zoom",
        fit: "fill",
      },
    });

    expect(markup).toContain('class="ss-wrap ss-zoom"');
    expect(markup).toContain('--ss-fit-size: 100% 100%');
    expect(markup).toContain('data-effect="zoom"');
    expect(markup).toContain('url(\'https://example.com/a.jpg\')');
    expect(markup).toContain('url(\'https://example.com/b.jpg\')');
  });

  it("defines music-player widget with 7 color slots and responsive bounds", () => {
    const player = getWidgetDefinition("music-player");
    expect(player.title).toBe("Interactive Music Player");
    expect(player.minWidth).toBe(320);
    expect(player.minHeight).toBe(220);
    expect(player.aspectRatio).toBeNull();
    expect(player.colorSlots.length).toBe(7);

    const keys = player.colorSlots.map(s => s.key);
    expect(keys).toContain("bg");
    expect(keys).toContain("border");
    expect(keys).toContain("playerAccent");
    expect(keys).toContain("playerSecondary");
    expect(keys).toContain("discSurface");
  });

  it("renders music-player markup with tracks, vinyl disc, scrubber, and volume controls", () => {
    const markup = widgetMarkup({
      widgetId: "music-player",
      config: {
        title: "Synth Resonance",
        artist: "Nova Prime",
        album: "Starlight Drift",
        duration: 240,
        currentTime: 120,
        volume: 75,
        playing: true,
      },
    });

    expect(markup).toContain('class="music-player is-playing"');
    expect(markup).toContain('class="mp-vinyl-disc is-spinning"');
    expect(markup).toContain('Synth Resonance');
    expect(markup).toContain('Nova Prime');
    expect(markup).toContain('Starlight Drift');
    expect(markup).toContain('2:00');
    expect(markup).toContain('4:00');
    expect(markup).toContain('class="mp-scrubber-fill" style="width: 50%"');
    expect(markup).toContain('class="mp-vol-fill" style="width: 75%"');
  });

  it("defines device-switchboard widget with 7 color slots and responsive bounds", () => {
    const sw = getWidgetDefinition("device-switchboard");
    expect(sw.title).toBe("Smart Device Switchboard");
    expect(sw.minWidth).toBe(340);
    expect(sw.minHeight).toBe(240);
    expect(sw.aspectRatio).toBeNull();
    expect(sw.colorSlots.length).toBe(7);

    const keys = sw.colorSlots.map(s => s.key);
    expect(keys).toContain("bg");
    expect(keys).toContain("border");
    expect(keys).toContain("switchActive");
    expect(keys).toContain("statusNominal");
    expect(keys).toContain("controlTrack");
  });

  it("renders device-switchboard markup with devices, dimmer sliders, fan pills, and quick scenes", () => {
    const markup = widgetMarkup({
      widgetId: "device-switchboard",
      config: {
        label: "Master Switchboard",
        devices: [
          { id: "lamp-1", name: "Desk Spotlight", type: "light", state: true, level: 70, watts: 30 },
          { id: "ac-1", name: "Studio AC", type: "climate", state: false, mode: "cool", fanSpeed: 1, watts: 400 },
        ],
      },
    });

    expect(markup).toContain('class="device-switchboard"');
    expect(markup).toContain('Master Switchboard');
    expect(markup).toContain('Desk Spotlight');
    expect(markup).toContain('Studio AC');
    expect(markup).toContain('value="70"');
    expect(markup).toContain('sw-scene-pill');
    expect(markup).toContain('data-scene="all-off"');
    expect(markup).toContain('data-scene="eco"');
    expect(markup).toContain('data-scene="full-power"');
  });

  it("defines task-matrix widget with 7 color slots and responsive bounds", () => {
    const tm = getWidgetDefinition("task-matrix");
    expect(tm.title).toBe("Task & Action Matrix");
    expect(tm.minWidth).toBe(300);
    expect(tm.minHeight).toBe(220);
    expect(tm.aspectRatio).toBeNull();
    expect(tm.colorSlots.length).toBe(7);

    const keys = tm.colorSlots.map(s => s.key);
    expect(keys).toContain("bg");
    expect(keys).toContain("border");
    expect(keys).toContain("checkAccent");
    expect(keys).toContain("taskComplete");
    expect(keys).toContain("taskUrgent");
  });

  it("renders task-matrix markup with SVG progress ring, filter tabs, and items", () => {
    const markup = widgetMarkup({
      widgetId: "task-matrix",
      config: {
        label: "Mission Objectives",
        filter: "all",
        tasks: [
          { id: "t1", text: "Calibrate gyroscopes", done: true, priority: "high" },
          { id: "t2", text: "Sync radar feed", done: false, priority: "urgent" },
        ],
      },
    });

    expect(markup).toContain('class="task-matrix"');
    expect(markup).toContain('Mission Objectives');
    expect(markup).toContain('class="tm-ring-text">50%</span>');
    expect(markup).toContain('1</b> of 2 Objectives Complete');
    expect(markup).toContain('Calibrate gyroscopes');
    expect(markup).toContain('Sync radar feed');
    expect(markup).toContain('tm-prio-urgent');
    expect(markup).toContain('class="tm-add-input"');
  });

  it("defines quick-notes widget with 7 color slots and responsive bounds", () => {
    const qn = getWidgetDefinition("quick-notes");
    expect(qn.title).toBe("Quick Notes / Sticky Board");
    expect(qn.minWidth).toBe(260);
    expect(qn.minHeight).toBe(180);
    expect(qn.aspectRatio).toBeNull();
    expect(qn.colorSlots.length).toBe(7);

    const keys = qn.colorSlots.map(s => s.key);
    expect(keys).toContain("bg");
    expect(keys).toContain("border");
    expect(keys).toContain("primaryText");
    expect(keys).toContain("noteAccent");
    expect(keys).toContain("noteSurface");
    expect(keys).toContain("badgeBg");
  });

  it("renders quick-notes markup with dual mode badges and textarea", () => {
    const cookieMarkup = widgetMarkup({
      widgetId: "quick-notes",
      config: {
        title: "Operator Note",
        text: "Checked voltage levels on relay 4",
        stateMode: "cookie",
        colorTag: "amber",
      },
    });

    expect(cookieMarkup).toContain('class="quick-notes qn-tag-amber"');
    expect(cookieMarkup).toContain('data-state-mode="cookie"');
    expect(cookieMarkup).toContain('Operator Note');
    expect(cookieMarkup).toContain('COOKIE</span>');
    expect(cookieMarkup).toContain('Checked voltage levels on relay 4');
    expect(cookieMarkup).toContain('class="qn-textarea"');
    expect(cookieMarkup).toContain('class="qn-clear-btn"');

    const globalMarkup = widgetMarkup({
      widgetId: "quick-notes",
      config: {
        title: "Shift Bulletin",
        text: "Night team briefing at 22:00",
        stateMode: "global",
        colorTag: "cyan",
      },
    });

    expect(globalMarkup).toContain('class="quick-notes qn-tag-cyan"');
    expect(globalMarkup).toContain('data-state-mode="global"');
    expect(globalMarkup).toContain('Shift Bulletin');
    expect(globalMarkup).toContain('GLOBAL</span>');
    expect(globalMarkup).toContain('Night team briefing at 22:00');
  });

  it("defines emitter-widget with 7 color slots and valid sizing bounds", () => {
    const def = getWidgetDefinition("emitter-widget");
    expect(def.title).toBe("Universal App Emitter");
    expect(def.minWidth).toBe(280);
    expect(def.minHeight).toBe(180);
    expect(def.colorSlots.length).toBe(7);
    const keys = def.colorSlots.map(s => s.key);
    expect(keys).toContain("primaryText");
    expect(keys).toContain("accent");
    expect(keys).toContain("statusActive");
  });

  it("renders emitter-widget in media mode with playback info, cover, and controls", () => {
    const markup = widgetMarkup({
      widgetId: "emitter-widget",
      config: {
        emitterId: "ytmusic-desktop",
        label: "YouTube Music",
        category: "media",
        state: {
          title: "Blinding Lights",
          artist: "The Weeknd",
          album: "After Hours",
          playing: true,
          currentTime: 85,
          duration: 200,
          coverUrl: "https://example.com/cover.jpg",
        },
      },
    });

    expect(markup).toContain('class="emitter-widget emitter-media is-playing"');
    expect(markup).toContain('data-emitter-id="ytmusic-desktop"');
    expect(markup).toContain('YouTube Music');
    expect(markup).toContain('Blinding Lights');
    expect(markup).toContain('The Weeknd');
    expect(markup).toContain('After Hours');
    expect(markup).toContain('class="em-cover" src="https://example.com/cover.jpg"');
    expect(markup).toContain('class="em-progress-fill" style="width: 43%"');
    expect(markup).toContain('data-command="play_pause"');
    expect(markup).toContain('data-command="previous"');
    expect(markup).toContain('data-command="next"');
  });

  it("renders emitter-widget in sensor mode with metric cards and pulse dot", () => {
    const markup = widgetMarkup({
      widgetId: "emitter-widget",
      config: {
        emitterId: "pi-sensors",
        label: "Pi 5 Telemetry",
        category: "sensor",
        state: {
          cpuTemp: "47.2°C",
          fanRpm: "1850",
          throttle: "None",
        },
      },
    });

    expect(markup).toContain('class="emitter-widget emitter-sensor"');
    expect(markup).toContain('data-emitter-id="pi-sensors"');
    expect(markup).toContain('Pi 5 Telemetry');
    expect(markup).toContain('SYSTEM EMITTER');
    expect(markup).toContain('CPUTEMP');
    expect(markup).toContain('47.2°C');
    expect(markup).toContain('FANRPM');
    expect(markup).toContain('1850');
  });

  it("handles interactive initializers safely and returns teardown functions", () => {
    const emptyTile = { querySelector: () => null } as unknown as HTMLElement;
    expect(initMusicPlayer(emptyTile)).toBeUndefined();
    expect(initDeviceSwitchboard(emptyTile)).toBeUndefined();
    expect(initTaskMatrix(emptyTile)).toBeUndefined();
    expect(initQuickNotes(emptyTile)).toBeUndefined();
    expect(initEmitterWidget(emptyTile)).toBeUndefined();
  });
});


