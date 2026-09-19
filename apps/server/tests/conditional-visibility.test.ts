import { describe, expect, it } from "bun:test";
import { evaluateVisibility, resolveStatePath } from "../src/shared/canvas-render.js";
import type { WidgetVisibilityConfig } from "../src/domain/types.js";

describe("Conditional Visibility & Reactive Evaluation", () => {
  describe("Time Schedule Rules", () => {
    it("evaluates true when current time is within standard daylight window", () => {
      const visibility: WidgetVisibilityConfig = {
        defaultVisible: true,
        timeRule: {
          enabled: true,
          type: "schedule",
          startTime: "09:00",
          endTime: "17:00",
        },
      };

      // 14:30 (2:30 PM) -> should be visible
      const testDate = new Date(2026, 8, 11, 14, 30); // 14:30
      expect(evaluateVisibility(visibility, {}, { now: testDate })).toBe(true);

      // 08:45 (Before start) -> should be hidden
      const earlyDate = new Date(2026, 8, 11, 8, 45);
      expect(evaluateVisibility(visibility, {}, { now: earlyDate })).toBe(false);

      // 17:15 (After end) -> should be hidden
      const lateDate = new Date(2026, 8, 11, 17, 15);
      expect(evaluateVisibility(visibility, {}, { now: lateDate })).toBe(false);
    });

    it("evaluates overnight schedule crossing midnight properly", () => {
      const visibility: WidgetVisibilityConfig = {
        defaultVisible: true,
        timeRule: {
          enabled: true,
          type: "schedule",
          startTime: "22:00",
          endTime: "06:00",
        },
      };

      // 23:30 (Before midnight) -> visible
      const nightDate = new Date(2026, 8, 11, 23, 30);
      expect(evaluateVisibility(visibility, {}, { now: nightDate })).toBe(true);

      // 03:00 (After midnight, before 6 AM) -> visible
      const morningNight = new Date(2026, 8, 12, 3, 0);
      expect(evaluateVisibility(visibility, {}, { now: morningNight })).toBe(true);

      // 12:00 (Noon) -> hidden
      const dayDate = new Date(2026, 8, 12, 12, 0);
      expect(evaluateVisibility(visibility, {}, { now: dayDate })).toBe(false);
    });

    it("filters visibility based on active days of week", () => {
      const visibility: WidgetVisibilityConfig = {
        defaultVisible: true,
        timeRule: {
          enabled: true,
          type: "days-of-week",
          // Monday through Friday (1 to 5)
          daysOfWeek: [1, 2, 3, 4, 5],
        },
      };

      // 2026-09-11 is Friday (Day 5) -> visible
      const friday = new Date(2026, 8, 11, 12, 0);
      expect(evaluateVisibility(visibility, {}, { now: friday })).toBe(true);

      // 2026-09-12 is Saturday (Day 6) -> hidden
      const saturday = new Date(2026, 8, 12, 12, 0);
      expect(evaluateVisibility(visibility, {}, { now: saturday })).toBe(false);

      // 2026-09-13 is Sunday (Day 7) -> hidden
      const sunday = new Date(2026, 8, 13, 12, 0);
      expect(evaluateVisibility(visibility, {}, { now: sunday })).toBe(false);
    });
  });

  describe("Reactive State Variable Rules", () => {
    it("resolves deeply nested object paths accurately", () => {
      const state = {
        runtime: {
          music: {
            playing: true,
            volume: 80,
            track: { title: "Solar Echoes", artist: "Nigel Stanford" },
          },
        },
        system: {
          temp_c: 42.5,
        },
      };

      expect(resolveStatePath(state, "runtime.music.playing")).toBe(true);
      expect(resolveStatePath(state, "runtime.music.volume")).toBe(80);
      expect(resolveStatePath(state, "runtime.music.track.title")).toBe("Solar Echoes");
      expect(resolveStatePath(state, "system.temp_c")).toBe(42.5);
      expect(resolveStatePath(state, "nonexistent.path")).toBeUndefined();
    });

    it("evaluates equality and numerical comparison operators", () => {
      const state = {
        sensor: { temperature: 28, mode: "cooling" },
      };

      const eqRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "sensor.mode",
          operator: "eq",
          value: "cooling",
        },
      };
      expect(evaluateVisibility(eqRule, state)).toBe(true);

      const gtRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "sensor.temperature",
          operator: "gt",
          value: 25,
        },
      };
      expect(evaluateVisibility(gtRule, state)).toBe(true);

      const ltRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "sensor.temperature",
          operator: "lt",
          value: 20,
        },
      };
      expect(evaluateVisibility(ltRule, state)).toBe(false);
    });

    it("evaluates truthy/falsy and contains operators", () => {
      const state = {
        network: { online: true, ssid: "HomeNet-5G" },
        errors: [],
      };

      const truthyRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "network.online",
          operator: "truthy",
        },
      };
      expect(evaluateVisibility(truthyRule, state)).toBe(true);

      const containsRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "network.ssid",
          operator: "contains",
          value: "HomeNet",
        },
      };
      expect(evaluateVisibility(containsRule, state)).toBe(true);

      const falsyRule: WidgetVisibilityConfig = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "network.offline",
          operator: "falsy",
        },
      };
      expect(evaluateVisibility(falsyRule, state)).toBe(true);
    });
  });

  describe("Editor Preview Override", () => {
    it("respects showInUiBuilder flag for designer preview mode", () => {
      const visibility: WidgetVisibilityConfig = {
        defaultVisible: false,
        showInUiBuilder: true, // editor should show as ghost instead of hiding
      };

      // In production/kiosk, hidden:
      expect(evaluateVisibility(visibility)).toBe(false);
      expect(visibility.showInUiBuilder).toBe(true);
    });
  });
});
