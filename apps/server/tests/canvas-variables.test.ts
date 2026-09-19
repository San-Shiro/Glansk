import { describe, expect, it, beforeEach } from "bun:test";
import {
  CanvasVariableStore,
  setActiveVariableStore,
  getActiveVariableStore,
  evaluateExpression,
  resolveDynamicValue,
  resolveDynamicConfig,
} from "../src/shared/canvas-variables.js";
import { evaluateVisibility, resolveStatePath, initButtonWidget } from "../src/shared/canvas-render.js";
import { acceptsWidgetEvent } from "../src/shared/widget-protocol.js";
import { canvasBus } from "../src/shared/widget-event-bus.js";
import type { CanvasVariableDefinition } from "../src/domain/types.js";

describe("Canvas Global Variables System", () => {
  let store: CanvasVariableStore;

  beforeEach(() => {
    const initialDefs: Record<string, CanvasVariableDefinition> = {
      isNightMode: {
        name: "isNightMode",
        type: "boolean",
        defaultValue: false,
        description: "Controls dark/light mode toggle",
      },
      counter: {
        name: "counter",
        type: "number",
        defaultValue: 10,
        description: "Display counter",
      },
      welcomeText: {
        name: "welcomeText",
        type: "string",
        defaultValue: "Hello World",
      },
      settings: {
        name: "settings",
        type: "json",
        defaultValue: { volume: 75, mute: false },
      },
    };

    store = new CanvasVariableStore(initialDefs, "canvas-test-1");
    setActiveVariableStore(store);
  });

  describe("Store Initialization & Type Casting", () => {
    it("initializes with default values mapped by name", () => {
      expect(store.get("isNightMode")).toBe(false);
      expect(store.get("counter")).toBe(10);
      expect(store.get("welcomeText")).toBe("Hello World");
      expect(store.get("settings")).toEqual({ volume: 75, mute: false });
    });

    it("getAll returns a combined snapshot of current values", () => {
      const all = store.getAll();
      expect(all).toEqual({
        isNightMode: false,
        counter: 10,
        welcomeText: "Hello World",
        settings: { volume: 75, mute: false },
      });
    });

    it("coerces boolean types properly on set()", () => {
      store.set("isNightMode", "true");
      expect(store.get("isNightMode")).toBe(true);

      store.set("isNightMode", 0);
      expect(store.get("isNightMode")).toBe(false);

      store.set("isNightMode", true);
      expect(store.get("isNightMode")).toBe(true);

      store.set("isNightMode", "false");
      expect(store.get("isNightMode")).toBe(false);
    });

    it("coerces number types properly on set()", () => {
      store.set("counter", "42");
      expect(store.get("counter")).toBe(42);

      store.set("counter", "invalid");
      expect(store.get("counter")).toBe(0);
    });

    it("coerces json types properly on set()", () => {
      store.set("settings", '{"volume": 90, "mute": true}');
      expect(store.get("settings")).toEqual({ volume: 90, mute: true });

      store.set("settings", { volume: 50 });
      expect(store.get("settings")).toEqual({ volume: 50 });
    });
  });

  describe("Variable Mutations: toggle & increment", () => {
    it("toggles boolean variables back and forth", () => {
      expect(store.get("isNightMode")).toBe(false);
      store.toggle("isNightMode");
      expect(store.get("isNightMode")).toBe(true);
      store.toggle("isNightMode");
      expect(store.get("isNightMode")).toBe(false);
    });

    it("increments numeric variables with default or custom step", () => {
      expect(store.get("counter")).toBe(10);
      store.increment("counter");
      expect(store.get("counter")).toBe(11);
      store.increment("counter", 5);
      expect(store.get("counter")).toBe(16);
      store.increment("counter", -3);
      expect(store.get("counter")).toBe(13);
    });
  });

  describe("Watchers & Live Notifications", () => {
    it("notifies variable-specific watchers with next and previous values", () => {
      let capturedNext: any = null;
      let capturedPrev: any = null;
      const unwatch = store.watch<number>("counter", (next: number, prev: number) => {
        capturedNext = next;
        capturedPrev = prev;
      });

      store.set("counter", 25);
      expect(capturedNext).toBe(25);
      expect(capturedPrev).toBe(10);

      // Unwatch
      unwatch();
      store.set("counter", 30);
      expect(capturedNext).toBe(25); // Unchanged
    });

    it("notifies global watchers on any variable mutation", () => {
      const changes: Array<{ name: string; value: any }> = [];
      const unwatch = store.watchAll((name: string, value: any) => {
        changes.push({ name, value });
      });

      store.set("welcomeText", "Greetings");
      store.toggle("isNightMode");

      expect(changes.length).toBe(2);
      expect(changes[0]).toEqual({ name: "welcomeText", value: "Greetings" });
      expect(changes[1]).toEqual({ name: "isNightMode", value: true });

      unwatch();
    });

    it("publishes events on canvasBus for widget integration", () => {
      let busEvent: any = null;
      const unsub = canvasBus.subscribe("variable:isNightMode", (data: any) => {
        busEvent = data;
      });

      store.toggle("isNightMode");
      expect(busEvent).not.toBeNull();
      expect(busEvent.name).toBe("isNightMode");
      expect(busEvent.value).toBe(true);

      unsub();
    });
  });

  describe("Conditional Visibility Variable Integration", () => {
    it("evaluates visibility reacting to store variables directly or with prefix", () => {
      const visibilityRule = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "isNightMode",
          operator: "eq",
          value: "true",
        },
      };

      // Initially isNightMode is false -> hidden
      expect(evaluateVisibility(visibilityRule, store.getAll())).toBe(false);

      // Mutate variable
      store.set("isNightMode", true);
      expect(evaluateVisibility(visibilityRule, store.getAll())).toBe(true);

      // Test with 'variables.' prefix
      const prefixedRule = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "variables.isNightMode",
          operator: "eq",
          value: "true",
        },
      };
      expect(evaluateVisibility(prefixedRule, store.getAll())).toBe(true);
    });

    it("evaluates JSON nested variable paths", () => {
      const nestedRule = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "settings.volume",
          operator: "gt",
          value: 70,
        },
      };

      expect(evaluateVisibility(nestedRule, store.getAll())).toBe(true);

      store.set("settings", { volume: 60, mute: false });
      expect(evaluateVisibility(nestedRule, store.getAll())).toBe(false);
    });
  });

  describe("Button Action Execution Engine", () => {
    it("triggers variable toggle when button with toggle-variable action is clicked", () => {
      const listeners: Record<string, Function> = {};
      const btnMock = {
        dataset: {
          action: "toggle-variable",
          target: "isNightMode",
        },
        addEventListener: (type: string, fn: Function) => {
          listeners[type] = fn;
        },
        removeEventListener: (type: string, fn: Function) => {
          delete listeners[type];
        },
        click: () => {
          listeners["click"]?.({ stopPropagation: () => {} });
        },
      };
      const tileMock = {
        querySelector: (sel: string) => (sel.includes("primitive-btn") ? btnMock : null),
      } as any;

      const cleanup = initButtonWidget(tileMock, {
        actionType: "toggle-variable",
        target: "isNightMode",
      });

      expect(store.get("isNightMode")).toBe(false);

      btnMock.click();
      expect(store.get("isNightMode")).toBe(true);

      btnMock.click();
      expect(store.get("isNightMode")).toBe(false);

      if (cleanup) cleanup();
    });

    it("triggers variable set when button with set-variable action is clicked", () => {
      const listeners: Record<string, Function> = {};
      const btnMock = {
        dataset: {
          action: "set-variable",
          target: "welcomeText",
          value: "Updated Text",
        },
        addEventListener: (type: string, fn: Function) => {
          listeners[type] = fn;
        },
        removeEventListener: (type: string, fn: Function) => {
          delete listeners[type];
        },
        click: () => {
          listeners["click"]?.({ stopPropagation: () => {} });
        },
      };
      const tileMock = {
        querySelector: (sel: string) => (sel.includes("primitive-btn") ? btnMock : null),
      } as any;

      const cleanup = initButtonWidget(tileMock, {
        actionType: "set-variable",
        target: "welcomeText",
        variableValue: "Updated Text",
      });

      btnMock.click();
      expect(store.get("welcomeText")).toBe("Updated Text");

      if (cleanup) cleanup();
    });

    it("triggers variable increment when button with increment-variable is clicked", () => {
      const listeners: Record<string, Function> = {};
      const btnMock = {
        dataset: {
          action: "increment-variable",
          target: "counter",
          value: "5",
        },
        addEventListener: (type: string, fn: Function) => {
          listeners[type] = fn;
        },
        removeEventListener: (type: string, fn: Function) => {
          delete listeners[type];
        },
        click: () => {
          listeners["click"]?.({ stopPropagation: () => {} });
        },
      };
      const tileMock = {
        querySelector: (sel: string) => (sel.includes("primitive-btn") ? btnMock : null),
      } as any;

      const cleanup = initButtonWidget(tileMock, {
        actionType: "increment-variable",
        target: "counter",
        variableValue: "5",
      });

      expect(store.get("counter")).toBe(10);
      btnMock.click();
      expect(store.get("counter")).toBe(15);

      if (cleanup) cleanup();
    });
  });

  describe("Sandboxed Iframe Wire Protocol Security", () => {
    const source = {} as any;
    const validData = {
      protocol: "glansk.widget.v1",
      instanceId: "inst-123",
      nonce: "n-456",
      type: "variable-set",
      name: "isNightMode",
      value: true,
    };

    it("accepts authentic variable-set messages from sandboxed widget iframe", () => {
      expect(acceptsWidgetEvent({ origin: "null", source, data: validData }, source, "inst-123", "n-456")).toBe(true);
    });

    it("rejects variable-set messages with mismatched session nonce", () => {
      expect(acceptsWidgetEvent({ origin: "null", source, data: validData }, source, "inst-123", "wrong-nonce")).toBe(false);
    });

    it("rejects variable-set messages with oversized variable names", () => {
      const oversized = { ...validData, name: "a".repeat(200) };
      expect(acceptsWidgetEvent({ origin: "null", source, data: oversized }, source, "inst-123", "n-456")).toBe(false);
    });

    it("rejects forbidden variable names (__proto__, constructor, prototype)", () => {
      expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validData, name: "__proto__" } }, source, "inst-123", "n-456")).toBe(false);
      expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validData, name: "constructor" } }, source, "inst-123", "n-456")).toBe(false);
      expect(acceptsWidgetEvent({ origin: "null", source, data: { ...validData, name: "prototype" } }, source, "inst-123", "n-456")).toBe(false);
    });
  });

  describe("Security & Prototype Pollution Invariants", () => {
    it("refuses to define or set forbidden property names in CanvasVariableStore", () => {
      store.define({ name: "__proto__", type: "string", defaultValue: "bad" });
      store.define({ name: "constructor", type: "string", defaultValue: "bad" });
      store.set("__proto__", "polluted");
      store.set("constructor", "polluted");

      expect(store.get("__proto__")).toBeUndefined();
      expect(store.get("constructor")).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(store.getAll(), "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(store.getAll(), "constructor")).toBe(false);
      expect(({} as any).polluted).toBeUndefined();
    });

    it("resolveStatePath ignores Object.prototype methods and properties", () => {
      const state = { myVar: "active" };
      expect(resolveStatePath(state, "toString")).toBeUndefined();
      expect(resolveStatePath(state, "valueOf")).toBeUndefined();
      expect(resolveStatePath(state, "constructor")).toBeUndefined();
      expect(resolveStatePath(state, "__proto__")).toBeUndefined();
      expect(resolveStatePath(state, "myVar")).toBe("active");
    });

    it("evaluates numeric comparisons safely without null coercion anomalies", () => {
      const gtRule = {
        defaultVisible: true,
        stateRule: {
          enabled: true,
          variablePath: "nonExistentVar",
          operator: "gt",
          value: -1,
        },
      };
      // In JS, Number(null) is 0, which would be > -1 without our fix!
      // With our fix, nonExistentVar is undefined / null, so gt comparison safely returns false.
      expect(evaluateVisibility(gtRule, store.getAll())).toBe(false);
    });

    it("trims whitespace from button target variable names", () => {
      let clicked = false;
      const btnMock = {
        dataset: {
          action: "toggle-variable",
          target: "  isNightMode  ",
        },
        addEventListener: (type: string, fn: Function) => {
          if (type === "click") {
            btnMock.click = () => fn({ stopPropagation: () => {} });
          }
        },
        removeEventListener: () => {},
        click: () => {},
      };
      const tileMock = {
        querySelector: () => btnMock,
      } as any;

      initButtonWidget(tileMock, {});
      expect(store.get("isNightMode")).toBe(false);
      btnMock.click();
      expect(store.get("isNightMode")).toBe(true);
    });
  });

  describe("Universal Dynamic Binding & Expression Engine Invariants", () => {
    it("safely handles division by zero by falling back instead of returning zero", () => {
      const result = evaluateExpression("{val} / 0", { val: 10 }, "FAIL_SAFE");
      expect(result).toBe("FAIL_SAFE");

      const moduloResult = evaluateExpression("{val} % 0", { val: 10 }, "FAIL_SAFE");
      expect(moduloResult).toBe("FAIL_SAFE");
    });

    it("evaluates valid zero-eval mathematical expressions accurately", () => {
      const result = evaluateExpression("{val} * 2 + 5", { val: 10 }, 0);
      expect(result).toBe(25);
    });

    it("coerces dynamic bound values to expected types in resolveDynamicValue", () => {
      store.set("welcomeText", "false");
      const boolRes = resolveDynamicValue(
        { $bind: { mode: "variable", variable: "welcomeText", fallback: true } },
        store,
        true,
        "boolean"
      );
      expect(boolRes).toBe(false);

      store.set("welcomeText", "123.45");
      const numRes = resolveDynamicValue(
        { $bind: { mode: "variable", variable: "welcomeText", fallback: 0 } },
        store,
        0,
        "number"
      );
      expect(numRes).toBe(123.45);
    });

    it("mirrors output variable mutations from instanceId to widgetId alias", () => {
      store.registerOutputVariables("inst_101", "sensor_gauge", {
        temperature: { name: "temperature", type: "number", defaultValue: 20 },
      });

      expect(store.get("wiginst_101-temperature")).toBe(20);
      expect(store.get("wigsensor_gauge-temperature")).toBe(20);

      // Mutate the instance-scoped output variable
      store.set("wiginst_101-temperature", 36.6);

      // Verify both instance key and widgetId alias are updated in sync
      expect(store.get("wiginst_101-temperature")).toBe(36.6);
      expect(store.get("wigsensor_gauge-temperature")).toBe(36.6);
    });

    it("recursively resolves $bind structures in config with resolveDynamicConfig", () => {
      store.set("counter", 42);
      const rawConfig = {
        title: "Metrics",
        threshold: { $bind: { mode: "variable", variable: "counter", fallback: 0 } },
        nested: {
          banner: { $bind: { mode: "expression", expression: "Count is {counter}!", fallback: "" } },
        },
      };

      const resolved = resolveDynamicConfig(rawConfig, store);
      expect(resolved).toEqual({
        title: "Metrics",
        threshold: 42,
        nested: {
          banner: "Count is 42!",
        },
      });
    });
  });
});
