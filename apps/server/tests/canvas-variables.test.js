"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var canvas_variables_js_1 = require("../src/shared/canvas-variables.js");
var canvas_render_js_1 = require("../src/shared/canvas-render.js");
var widget_protocol_js_1 = require("../src/shared/widget-protocol.js");
var widget_event_bus_js_1 = require("../src/shared/widget-event-bus.js");
(0, bun_test_1.describe)("Canvas Global Variables System", function () {
    var store;
    (0, bun_test_1.beforeEach)(function () {
        var initialDefs = {
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
        store = new canvas_variables_js_1.CanvasVariableStore(initialDefs, "canvas-test-1");
        (0, canvas_variables_js_1.setActiveVariableStore)(store);
    });
    (0, bun_test_1.describe)("Store Initialization & Type Casting", function () {
        (0, bun_test_1.it)("initializes with default values mapped by name", function () {
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            (0, bun_test_1.expect)(store.get("counter")).toBe(10);
            (0, bun_test_1.expect)(store.get("welcomeText")).toBe("Hello World");
            (0, bun_test_1.expect)(store.get("settings")).toEqual({ volume: 75, mute: false });
        });
        (0, bun_test_1.it)("getAll returns a combined snapshot of current values", function () {
            var all = store.getAll();
            (0, bun_test_1.expect)(all).toEqual({
                isNightMode: false,
                counter: 10,
                welcomeText: "Hello World",
                settings: { volume: 75, mute: false },
            });
        });
        (0, bun_test_1.it)("coerces boolean types properly on set()", function () {
            store.set("isNightMode", "true");
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(true);
            store.set("isNightMode", 0);
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            store.set("isNightMode", true);
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(true);
            store.set("isNightMode", "false");
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
        });
        (0, bun_test_1.it)("coerces number types properly on set()", function () {
            store.set("counter", "42");
            (0, bun_test_1.expect)(store.get("counter")).toBe(42);
            store.set("counter", "invalid");
            (0, bun_test_1.expect)(store.get("counter")).toBe(0);
        });
        (0, bun_test_1.it)("coerces json types properly on set()", function () {
            store.set("settings", '{"volume": 90, "mute": true}');
            (0, bun_test_1.expect)(store.get("settings")).toEqual({ volume: 90, mute: true });
            store.set("settings", { volume: 50 });
            (0, bun_test_1.expect)(store.get("settings")).toEqual({ volume: 50 });
        });
    });
    (0, bun_test_1.describe)("Variable Mutations: toggle & increment", function () {
        (0, bun_test_1.it)("toggles boolean variables back and forth", function () {
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            store.toggle("isNightMode");
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(true);
            store.toggle("isNightMode");
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
        });
        (0, bun_test_1.it)("increments numeric variables with default or custom step", function () {
            (0, bun_test_1.expect)(store.get("counter")).toBe(10);
            store.increment("counter");
            (0, bun_test_1.expect)(store.get("counter")).toBe(11);
            store.increment("counter", 5);
            (0, bun_test_1.expect)(store.get("counter")).toBe(16);
            store.increment("counter", -3);
            (0, bun_test_1.expect)(store.get("counter")).toBe(13);
        });
    });
    (0, bun_test_1.describe)("Watchers & Live Notifications", function () {
        (0, bun_test_1.it)("notifies variable-specific watchers with next and previous values", function () {
            var capturedNext = null;
            var capturedPrev = null;
            var unwatch = store.watch("counter", function (next, prev) {
                capturedNext = next;
                capturedPrev = prev;
            });
            store.set("counter", 25);
            (0, bun_test_1.expect)(capturedNext).toBe(25);
            (0, bun_test_1.expect)(capturedPrev).toBe(10);
            // Unwatch
            unwatch();
            store.set("counter", 30);
            (0, bun_test_1.expect)(capturedNext).toBe(25); // Unchanged
        });
        (0, bun_test_1.it)("notifies global watchers on any variable mutation", function () {
            var changes = [];
            var unwatch = store.watchAll(function (name, value) {
                changes.push({ name: name, value: value });
            });
            store.set("welcomeText", "Greetings");
            store.toggle("isNightMode");
            (0, bun_test_1.expect)(changes.length).toBe(2);
            (0, bun_test_1.expect)(changes[0]).toEqual({ name: "welcomeText", value: "Greetings" });
            (0, bun_test_1.expect)(changes[1]).toEqual({ name: "isNightMode", value: true });
            unwatch();
        });
        (0, bun_test_1.it)("publishes events on canvasBus for widget integration", function () {
            var busEvent = null;
            var unsub = widget_event_bus_js_1.canvasBus.subscribe("variable:isNightMode", function (data) {
                busEvent = data;
            });
            store.toggle("isNightMode");
            (0, bun_test_1.expect)(busEvent).not.toBeNull();
            (0, bun_test_1.expect)(busEvent.name).toBe("isNightMode");
            (0, bun_test_1.expect)(busEvent.value).toBe(true);
            unsub();
        });
    });
    (0, bun_test_1.describe)("Conditional Visibility Variable Integration", function () {
        (0, bun_test_1.it)("evaluates visibility reacting to store variables directly or with prefix", function () {
            var visibilityRule = {
                defaultVisible: true,
                stateRule: {
                    enabled: true,
                    variablePath: "isNightMode",
                    operator: "eq",
                    value: "true",
                },
            };
            // Initially isNightMode is false -> hidden
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(visibilityRule, store.getAll())).toBe(false);
            // Mutate variable
            store.set("isNightMode", true);
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(visibilityRule, store.getAll())).toBe(true);
            // Test with 'variables.' prefix
            var prefixedRule = {
                defaultVisible: true,
                stateRule: {
                    enabled: true,
                    variablePath: "variables.isNightMode",
                    operator: "eq",
                    value: "true",
                },
            };
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(prefixedRule, store.getAll())).toBe(true);
        });
        (0, bun_test_1.it)("evaluates JSON nested variable paths", function () {
            var nestedRule = {
                defaultVisible: true,
                stateRule: {
                    enabled: true,
                    variablePath: "settings.volume",
                    operator: "gt",
                    value: 70,
                },
            };
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(nestedRule, store.getAll())).toBe(true);
            store.set("settings", { volume: 60, mute: false });
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(nestedRule, store.getAll())).toBe(false);
        });
    });
    (0, bun_test_1.describe)("Button Action Execution Engine", function () {
        (0, bun_test_1.it)("triggers variable toggle when button with toggle-variable action is clicked", function () {
            var listeners = {};
            var btnMock = {
                dataset: {
                    action: "toggle-variable",
                    target: "isNightMode",
                },
                addEventListener: function (type, fn) {
                    listeners[type] = fn;
                },
                removeEventListener: function (type, fn) {
                    delete listeners[type];
                },
                click: function () {
                    var _a;
                    (_a = listeners["click"]) === null || _a === void 0 ? void 0 : _a.call(listeners, { stopPropagation: function () { } });
                },
            };
            var tileMock = {
                querySelector: function (sel) { return (sel.includes("primitive-btn") ? btnMock : null); },
            };
            var cleanup = (0, canvas_render_js_1.initButtonWidget)(tileMock, {
                actionType: "toggle-variable",
                target: "isNightMode",
            });
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            btnMock.click();
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(true);
            btnMock.click();
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            if (cleanup)
                cleanup();
        });
        (0, bun_test_1.it)("triggers variable set when button with set-variable action is clicked", function () {
            var listeners = {};
            var btnMock = {
                dataset: {
                    action: "set-variable",
                    target: "welcomeText",
                    value: "Updated Text",
                },
                addEventListener: function (type, fn) {
                    listeners[type] = fn;
                },
                removeEventListener: function (type, fn) {
                    delete listeners[type];
                },
                click: function () {
                    var _a;
                    (_a = listeners["click"]) === null || _a === void 0 ? void 0 : _a.call(listeners, { stopPropagation: function () { } });
                },
            };
            var tileMock = {
                querySelector: function (sel) { return (sel.includes("primitive-btn") ? btnMock : null); },
            };
            var cleanup = (0, canvas_render_js_1.initButtonWidget)(tileMock, {
                actionType: "set-variable",
                target: "welcomeText",
                variableValue: "Updated Text",
            });
            btnMock.click();
            (0, bun_test_1.expect)(store.get("welcomeText")).toBe("Updated Text");
            if (cleanup)
                cleanup();
        });
        (0, bun_test_1.it)("triggers variable increment when button with increment-variable is clicked", function () {
            var listeners = {};
            var btnMock = {
                dataset: {
                    action: "increment-variable",
                    target: "counter",
                    value: "5",
                },
                addEventListener: function (type, fn) {
                    listeners[type] = fn;
                },
                removeEventListener: function (type, fn) {
                    delete listeners[type];
                },
                click: function () {
                    var _a;
                    (_a = listeners["click"]) === null || _a === void 0 ? void 0 : _a.call(listeners, { stopPropagation: function () { } });
                },
            };
            var tileMock = {
                querySelector: function (sel) { return (sel.includes("primitive-btn") ? btnMock : null); },
            };
            var cleanup = (0, canvas_render_js_1.initButtonWidget)(tileMock, {
                actionType: "increment-variable",
                target: "counter",
                variableValue: "5",
            });
            (0, bun_test_1.expect)(store.get("counter")).toBe(10);
            btnMock.click();
            (0, bun_test_1.expect)(store.get("counter")).toBe(15);
            if (cleanup)
                cleanup();
        });
    });
    (0, bun_test_1.describe)("Sandboxed Iframe Wire Protocol Security", function () {
        var source = {};
        var validData = {
            protocol: "glansk.widget.v1",
            instanceId: "inst-123",
            nonce: "n-456",
            type: "variable-set",
            name: "isNightMode",
            value: true,
        };
        (0, bun_test_1.it)("accepts authentic variable-set messages from sandboxed widget iframe", function () {
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: validData }, source, "inst-123", "n-456")).toBe(true);
        });
        (0, bun_test_1.it)("rejects variable-set messages with mismatched session nonce", function () {
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: validData }, source, "inst-123", "wrong-nonce")).toBe(false);
        });
        (0, bun_test_1.it)("rejects variable-set messages with oversized variable names", function () {
            var oversized = __assign(__assign({}, validData), { name: "a".repeat(200) });
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: oversized }, source, "inst-123", "n-456")).toBe(false);
        });
        (0, bun_test_1.it)("rejects forbidden variable names (__proto__, constructor, prototype)", function () {
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: __assign(__assign({}, validData), { name: "__proto__" }) }, source, "inst-123", "n-456")).toBe(false);
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: __assign(__assign({}, validData), { name: "constructor" }) }, source, "inst-123", "n-456")).toBe(false);
            (0, bun_test_1.expect)((0, widget_protocol_js_1.acceptsWidgetEvent)({ origin: "null", source: source, data: __assign(__assign({}, validData), { name: "prototype" }) }, source, "inst-123", "n-456")).toBe(false);
        });
    });
    (0, bun_test_1.describe)("Security & Prototype Pollution Invariants", function () {
        (0, bun_test_1.it)("refuses to define or set forbidden property names in CanvasVariableStore", function () {
            store.define({ name: "__proto__", type: "string", defaultValue: "bad" });
            store.define({ name: "constructor", type: "string", defaultValue: "bad" });
            store.set("__proto__", "polluted");
            store.set("constructor", "polluted");
            (0, bun_test_1.expect)(store.get("__proto__")).toBeUndefined();
            (0, bun_test_1.expect)(store.get("constructor")).toBeUndefined();
            (0, bun_test_1.expect)(Object.prototype.hasOwnProperty.call(store.getAll(), "__proto__")).toBe(false);
            (0, bun_test_1.expect)(Object.prototype.hasOwnProperty.call(store.getAll(), "constructor")).toBe(false);
            (0, bun_test_1.expect)({}.polluted).toBeUndefined();
        });
        (0, bun_test_1.it)("resolveStatePath ignores Object.prototype methods and properties", function () {
            var state = { myVar: "active" };
            (0, bun_test_1.expect)((0, canvas_render_js_1.resolveStatePath)(state, "toString")).toBeUndefined();
            (0, bun_test_1.expect)((0, canvas_render_js_1.resolveStatePath)(state, "valueOf")).toBeUndefined();
            (0, bun_test_1.expect)((0, canvas_render_js_1.resolveStatePath)(state, "constructor")).toBeUndefined();
            (0, bun_test_1.expect)((0, canvas_render_js_1.resolveStatePath)(state, "__proto__")).toBeUndefined();
            (0, bun_test_1.expect)((0, canvas_render_js_1.resolveStatePath)(state, "myVar")).toBe("active");
        });
        (0, bun_test_1.it)("evaluates numeric comparisons safely without null coercion anomalies", function () {
            var gtRule = {
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
            (0, bun_test_1.expect)((0, canvas_render_js_1.evaluateVisibility)(gtRule, store.getAll())).toBe(false);
        });
        (0, bun_test_1.it)("trims whitespace from button target variable names", function () {
            var clicked = false;
            var btnMock = {
                dataset: {
                    action: "toggle-variable",
                    target: "  isNightMode  ",
                },
                addEventListener: function (type, fn) {
                    if (type === "click") {
                        btnMock.click = function () { return fn({ stopPropagation: function () { } }); };
                    }
                },
                removeEventListener: function () { },
                click: function () { },
            };
            var tileMock = {
                querySelector: function () { return btnMock; },
            };
            (0, canvas_render_js_1.initButtonWidget)(tileMock, {});
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(false);
            btnMock.click();
            (0, bun_test_1.expect)(store.get("isNightMode")).toBe(true);
        });
    });
    (0, bun_test_1.describe)("Universal Dynamic Binding & Expression Engine Invariants", function () {
        (0, bun_test_1.it)("safely handles division by zero by falling back instead of returning zero", function () {
            var result = (0, canvas_variables_js_1.evaluateExpression)("{val} / 0", { val: 10 }, "FAIL_SAFE");
            (0, bun_test_1.expect)(result).toBe("FAIL_SAFE");
            var moduloResult = (0, canvas_variables_js_1.evaluateExpression)("{val} % 0", { val: 10 }, "FAIL_SAFE");
            (0, bun_test_1.expect)(moduloResult).toBe("FAIL_SAFE");
        });
        (0, bun_test_1.it)("evaluates valid zero-eval mathematical expressions accurately", function () {
            var result = (0, canvas_variables_js_1.evaluateExpression)("{val} * 2 + 5", { val: 10 }, 0);
            (0, bun_test_1.expect)(result).toBe(25);
        });
        (0, bun_test_1.it)("coerces dynamic bound values to expected types in resolveDynamicValue", function () {
            store.set("welcomeText", "false");
            var boolRes = (0, canvas_variables_js_1.resolveDynamicValue)({ $bind: { mode: "variable", variable: "welcomeText", fallback: true } }, store, true, "boolean");
            (0, bun_test_1.expect)(boolRes).toBe(false);
            store.set("welcomeText", "123.45");
            var numRes = (0, canvas_variables_js_1.resolveDynamicValue)({ $bind: { mode: "variable", variable: "welcomeText", fallback: 0 } }, store, 0, "number");
            (0, bun_test_1.expect)(numRes).toBe(123.45);
        });
        (0, bun_test_1.it)("mirrors output variable mutations from instanceId to widgetId alias", function () {
            store.registerOutputVariables("inst_101", "sensor_gauge", {
                temperature: { name: "temperature", type: "number", defaultValue: 20 },
            });
            (0, bun_test_1.expect)(store.get("wiginst_101-temperature")).toBe(20);
            (0, bun_test_1.expect)(store.get("wigsensor_gauge-temperature")).toBe(20);
            // Mutate the instance-scoped output variable
            store.set("wiginst_101-temperature", 36.6);
            // Verify both instance key and widgetId alias are updated in sync
            (0, bun_test_1.expect)(store.get("wiginst_101-temperature")).toBe(36.6);
            (0, bun_test_1.expect)(store.get("wigsensor_gauge-temperature")).toBe(36.6);
        });
        (0, bun_test_1.it)("recursively resolves $bind structures in config with resolveDynamicConfig", function () {
            store.set("counter", 42);
            var rawConfig = {
                title: "Metrics",
                threshold: { $bind: { mode: "variable", variable: "counter", fallback: 0 } },
                nested: {
                    banner: { $bind: { mode: "expression", expression: "Count is {counter}!", fallback: "" } },
                },
            };
            var resolved = (0, canvas_variables_js_1.resolveDynamicConfig)(rawConfig, store);
            (0, bun_test_1.expect)(resolved).toEqual({
                title: "Metrics",
                threshold: 42,
                nested: {
                    banner: "Count is 42!",
                },
            });
        });
    });
});
