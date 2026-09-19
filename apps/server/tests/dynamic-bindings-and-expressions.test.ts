import { describe, expect, it, beforeEach } from "bun:test";
import {
  CanvasVariableStore,
  setActiveVariableStore,
  getActiveVariableStore,
  evaluateExpression,
  resolveDynamicValue
} from "../src/shared/canvas-variables.js";
import { WidgetRuntime } from "../../../packages/widget-sdk/src/runtime.js";
import { WIDGET_PROTOCOL, FORBIDDEN_VAR_NAMES } from "../../../packages/widget-sdk/src/contracts.js";
import type { CanvasVariableDefinition } from "../src/domain/types.js";

describe("Dynamic Bindings, Output Variables & Safe Expressions", () => {
  let store: CanvasVariableStore;

  beforeEach(() => {
    const initialDefs: Record<string, CanvasVariableDefinition> = {
      user_name: {
        name: "user_name",
        type: "string",
        defaultValue: "Ketan",
      },
      base_speed: {
        name: "base_speed",
        type: "number",
        defaultValue: 60,
      },
      multiplier: {
        name: "multiplier",
        type: "number",
        defaultValue: 2,
      },
    };

    store = new CanvasVariableStore(initialDefs, "test-canvas-expr");
    setActiveVariableStore(store);
  });

  describe("Widget Output Variables Registration & Scoping ('wig' prefix)", () => {
    it("registers output variables with instance ID and widget ID aliases", () => {
      store.registerOutputVariables("inst_btn_123", "button", {
        clickCount: { name: "clickCount", type: "number", defaultValue: 0, description: "Click counter" },
        lastClickedAt: { name: "lastClickedAt", type: "string", defaultValue: "2026-01-01T00:00:00Z" },
      });

      // Checks instance-scoped key
      expect(store.get("wiginst_btn_123-clickCount")).toBe(0);
      expect(store.get("wiginst_btn_123-lastClickedAt")).toBe("2026-01-01T00:00:00Z");

      // Checks widget-type alias
      expect(store.get("wigbutton-clickCount")).toBe(0);
      expect(store.get("wigbutton-lastClickedAt")).toBe("2026-01-01T00:00:00Z");

      // Checks definition metadata
      const defs = store.getDefinitions();
      const def = defs["wiginst_btn_123-clickCount"];
      expect(def).toBeDefined();
      expect(def?.isOutput).toBe(true);
      expect(def?.sourceInstanceId).toBe("inst_btn_123");
      expect(def?.sourceWidgetId).toBe("button");
    });

    it("updates output variables reactively", () => {
      store.registerOutputVariables("slider_1", "range-slider", {
        val: { name: "val", type: "number", defaultValue: 50 },
      });

      let observed: unknown = null;
      store.watch("wigslider_1-val", (v) => {
        observed = v;
      });

      store.set("wigslider_1-val", 75);
      expect(store.get("wigslider_1-val")).toBe(75);
      expect(observed).toBe(75);
    });
  });

  describe("Zero-eval Safe Expression Engine", () => {
    it("interpolates single and multi-variable strings", () => {
      const vars = { user_name: "Alex", city: "London" };
      const res = evaluateExpression("Hello {user_name} from {city}!", vars, "");
      expect(res).toBe("Hello Alex from London!");
    });

    it("evaluates basic arithmetic expressions safely without eval()", () => {
      const vars = { base_speed: 60, multiplier: 2 };
      expect(evaluateExpression("{base_speed} + 15", vars, 0)).toBe(75);
      expect(evaluateExpression("{base_speed} * {multiplier}", vars, 0)).toBe(120);
      expect(evaluateExpression("{base_speed} / {multiplier}", vars, 0)).toBe(30);
      expect(evaluateExpression("{base_speed} - 10", vars, 0)).toBe(50);
      expect(evaluateExpression("10 % 3", vars, 0)).toBe(1);
    });

    it("respects standard mathematical operator precedence (* and / over + and -)", () => {
      const vars = { a: 10, b: 5, c: 2 };
      // 10 + 5 * 2 = 20 (NOT (10 + 5) * 2 = 30)
      expect(evaluateExpression("{a} + {b} * {c}", vars, 0)).toBe(20);
      // (10 + 5) * 2 = 30
      expect(evaluateExpression("({a} + {b}) * {c}", vars, 0)).toBe(30);
    });

    it("evaluates decimals and nested parentheses", () => {
      const vars = { radius: 12.5 };
      expect(evaluateExpression("({radius} * 2) + 0.5", vars, 0)).toBe(25.5);
    });

    it("evaluates string join combinators", () => {
      const vars = { first: "Alpha", second: "Beta", third: "Gamma" };
      const joined = evaluateExpression("join(' :: ', {first}, {second}, {third})", vars, "");
      expect(joined).toBe("Alpha :: Beta :: Gamma");
    });

    it("gracefully returns fallback on missing variables or syntax errors without crashing", () => {
      expect(evaluateExpression("((( 10 + 20", {}, 42)).toBe(42);
      expect(evaluateExpression("10 / / 2", {}, 42)).toBe(42);
    });
  });

  describe("Dynamic Binding Resolver (resolveDynamicValue)", () => {
    it("returns raw literal values unchanged when not bound", () => {
      expect(resolveDynamicValue(16, store, 0)).toBe(16);
      expect(resolveDynamicValue("Card Title", store, "")).toBe("Card Title");
      expect(resolveDynamicValue(true, store, false)).toBe(true);
    });

    it("resolves $bind in 'variable' mode using CanvasVariableStore", () => {
      store.set("base_speed", 85);
      const binding = {
        $bind: {
          mode: "variable" as const,
          variable: "base_speed",
          fallback: 0,
        },
      };

      expect(resolveDynamicValue(binding, store, 0)).toBe(85);
    });

    it("resolves $bind in 'expression' mode using arithmetic formulas", () => {
      store.set("base_speed", 50);
      store.set("multiplier", 3);
      const binding = {
        $bind: {
          mode: "expression" as const,
          expression: "{base_speed} * {multiplier} + 10",
          fallback: 0,
        },
      };

      // 50 * 3 + 10 = 160
      expect(resolveDynamicValue(binding, store, 0)).toBe(160);
    });

    it("uses binding.fallback when the variable is undefined", () => {
      const binding = {
        $bind: {
          mode: "variable" as const,
          variable: "wigUnknown-metric",
          fallback: 99,
        },
      };

      expect(resolveDynamicValue(binding, store, 10)).toBe(99);
    });
  });

  describe("Widget SDK Context Output API", () => {
    it("constructs correct scoped variable names with wig prefix and emits variable-set", () => {
      const sent: any[] = [];
      let capturedContext: any = null;
      let messageCallback: any = null;

      const mockBus = {
        postMessage: (msg: any) => sent.push(msg),
        addEventListener: (_type: string, listener: any) => { messageCallback = listener; },
        removeEventListener: () => {},
      };

      const runtime = new WidgetRuntime(
        {
          mount(ctx) {
            capturedContext = ctx;
          },
        },
        {} as HTMLElement,
        mockBus
      );
      runtime.init();

      // Send host connection acknowledgement
      messageCallback({
        origin: "null",
        data: {
          protocol: WIDGET_PROTOCOL,
          type: "connected",
          instanceId: "btn_42",
          nonce: "test_nonce",
          identity: { instanceId: "btn_42", packageId: "core", widgetId: "button" },
          config: {},
        },
      });

      expect(capturedContext).not.toBeNull();
      expect(capturedContext.output.getVariableName("clickCount")).toBe("wigbtn_42-clickCount");

      // Set output variable via SDK context
      capturedContext.output.set("clickCount", 7);
      expect(capturedContext.output.get("clickCount")).toBe(7);

      // Verify protocol message sent to host
      const varSetMsg = sent.find(m => m.type === "variable-set" && m.name === "wigbtn_42-clickCount");
      expect(varSetMsg).toBeDefined();
      expect(varSetMsg.value).toBe(7);
    });

    it("forbids dangerous prototype pollution variable names", () => {
      expect(FORBIDDEN_VAR_NAMES.has("__proto__")).toBe(true);
      expect(FORBIDDEN_VAR_NAMES.has("constructor")).toBe(true);
      expect(FORBIDDEN_VAR_NAMES.has("prototype")).toBe(true);
    });
  });
});
