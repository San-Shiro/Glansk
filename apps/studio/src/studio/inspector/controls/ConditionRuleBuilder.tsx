import React from "react";
import { Eye, EyeOff, Monitor, Tablet, Smartphone, Sparkles } from "lucide-react";
import type {
  WidgetVisibilityConfig,
  CanvasVariableDefinition,
  StateVisibilityRule,
  TimeVisibilityRule,
} from "@/lib/types";

interface Props {
  visibility?: WidgetVisibilityConfig;
  onChange: (val: WidgetVisibilityConfig) => void;
  variables?: Record<string, CanvasVariableDefinition>;
}

export default function ConditionRuleBuilder({
  visibility,
  onChange,
  variables = {},
}: Props) {
  const vis = visibility || { defaultVisible: true };
  const isEnabled = Boolean(vis.timeRule?.enabled || vis.stateRule?.enabled);
  const showInUiBuilder = vis.showInUiBuilder !== false;

  const setTimeRule = (patch: Partial<TimeVisibilityRule>) => {
    const current = vis.timeRule || { enabled: false, type: "schedule" };
    onChange({
      ...vis,
      timeRule: { ...current, ...patch },
    });
  };

  const setStateRule = (patch: Partial<StateVisibilityRule>) => {
    const current = vis.stateRule || {
      enabled: false,
      variablePath: "",
      operator: "eq",
      value: "",
    };
    onChange({
      ...vis,
      stateRule: { ...current, ...patch },
    });
  };

  const setResponsive = (patch: Partial<NonNullable<WidgetVisibilityConfig["responsive"]>>) => {
    onChange({
      ...vis,
      responsive: { ...vis.responsive, ...patch },
    });
  };

  const r = vis.responsive || {};
  const isDesktop = r.desktop !== false;
  const isTablet = r.tablet !== false;
  const isLandscape = r.mobileLandscape !== false;
  const isPortrait = r.mobilePortrait !== false;

  const varNames = Object.keys(variables);

  return (
    <div className="space-y-4">
      {/* 1. Mode Switcher: Always Visible vs Conditional */}
      <div className="flex items-center justify-between p-2.5 rounded-lg border bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-[var(--ink)]">Conditional Visibility</div>
          <div className="text-[11px] text-[var(--ink-3)]">
            {isEnabled ? "Element rules evaluated at runtime" : "Element is always visible"}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isEnabled) {
              onChange({
                ...vis,
                stateRule: { enabled: false, variablePath: "", operator: "eq", value: "" },
                timeRule: { enabled: false, type: "schedule" },
              });
            } else {
              setStateRule({
                enabled: true,
                variablePath: varNames[0] || "",
                operator: "eq",
                value: "true",
              });
            }
          }}
          className={`w-10 h-5 flex items-center rounded-full p-0.5 transition-colors ${
            isEnabled ? "bg-[var(--accent)]" : "bg-[var(--line-2)]"
          }`}
          title="Toggle conditional visibility"
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform ${
              isEnabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* 2. Responsive Device Targets */}
      <div className="p-2.5 rounded-lg border bg-[var(--panel-2)] space-y-2" style={{ borderColor: "var(--line)" }}>
        <span className="text-[11px] font-semibold text-[var(--ink-3)] block">Target Displays & Devices</span>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setResponsive({ desktop: !isDesktop })}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition-all text-xs ${
              isDesktop
                ? "bg-[var(--panel)] border-[var(--accent)] text-[var(--accent)] font-medium shadow-xs"
                : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink-3)] opacity-40 hover:opacity-80"
            }`}
            title="Desktop / FHD display"
          >
            <Monitor size={14} />
            <span className="text-[10px]">Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => setResponsive({ tablet: !isTablet })}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition-all text-xs ${
              isTablet
                ? "bg-[var(--panel)] border-[var(--accent)] text-[var(--accent)] font-medium shadow-xs"
                : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink-3)] opacity-40 hover:opacity-80"
            }`}
            title="Tablet / Touch display"
          >
            <Tablet size={14} />
            <span className="text-[10px]">Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => setResponsive({ mobileLandscape: !isLandscape })}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition-all text-xs ${
              isLandscape
                ? "bg-[var(--panel)] border-[var(--accent)] text-[var(--accent)] font-medium shadow-xs"
                : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink-3)] opacity-40 hover:opacity-80"
            }`}
            title="Landscape Handheld"
          >
            <Smartphone size={14} className="rotate-90" />
            <span className="text-[10px]">Landscape</span>
          </button>

          <button
            type="button"
            onClick={() => setResponsive({ mobilePortrait: !isPortrait })}
            className={`flex flex-col items-center gap-1 py-2 px-1 rounded border transition-all text-xs ${
              isPortrait
                ? "bg-[var(--panel)] border-[var(--accent)] text-[var(--accent)] font-medium shadow-xs"
                : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink-3)] opacity-40 hover:opacity-80"
            }`}
            title="Portrait Display"
          >
            <Smartphone size={14} />
            <span className="text-[10px]">Portrait</span>
          </button>
        </div>
      </div>

      {/* 3. If/Then/Else Statement (Matching image copy 7.png) */}
      {isEnabled && (
        <div
          className="p-3 rounded-lg border space-y-3 animate-fade-in bg-[var(--panel-2)]"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
              <Sparkles size={12} className="text-[var(--accent)]" />
              Logic Condition
            </span>
            <label className="flex items-center gap-1.5 text-[11px] text-[var(--ink-3)] cursor-pointer">
              <input
                type="checkbox"
                checked={showInUiBuilder}
                onChange={(e) => onChange({ ...vis, showInUiBuilder: e.target.checked })}
                className="rounded border-[var(--line)] text-[var(--accent)] focus:ring-0"
              />
              <span>Show in editor</span>
            </label>
          </div>

          {/* IF THIS Block */}
          <div className="space-y-2 p-2.5 rounded bg-[var(--panel)] border" style={{ borderColor: "var(--line)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">IF THIS</div>

            {/* Variable Selector */}
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Variable / Signal</label>
              {varNames.length > 0 ? (
                <select
                  value={vis.stateRule?.variablePath || ""}
                  onChange={(e) => setStateRule({ variablePath: e.target.value })}
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <option value="">Select variable...</option>
                  {varNames.map((vn) => (
                    <option key={vn} value={vn}>
                      @{vn} ({variables[vn]?.type || "any"})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={vis.stateRule?.variablePath || ""}
                  onChange={(e) => setStateRule({ variablePath: e.target.value })}
                  placeholder="variableName"
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                  style={{ borderColor: "var(--line)" }}
                />
              )}
            </div>

            {/* Operator and Target Value */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Operator</label>
                <select
                  value={vis.stateRule?.operator || "eq"}
                  onChange={(e) => setStateRule({ operator: e.target.value as any })}
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <option value="eq">== Equals</option>
                  <option value="neq">!= Not Equals</option>
                  <option value="gt">&gt; Greater Than</option>
                  <option value="gte">&gt;= Greater/Equal</option>
                  <option value="lt">&lt; Less Than</option>
                  <option value="lte">&lt;= Less/Equal</option>
                  <option value="truthy">Truthy (exists)</option>
                  <option value="falsy">Falsy (empty/false)</option>
                  <option value="contains">Contains</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Target Value</label>
                <input
                  type="text"
                  value={String(vis.stateRule?.value ?? "")}
                  onChange={(e) => setStateRule({ value: e.target.value })}
                  placeholder="true / 42 / text"
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                  style={{ borderColor: "var(--line)" }}
                />
              </div>
            </div>
          </div>

          {/* THEN / ELSE Outcome Block */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-[var(--ok-soft)] border border-[var(--ok)]/20 flex items-center justify-between">
              <span className="font-semibold text-[var(--ok)]">THEN</span>
              <span className="flex items-center gap-1 text-[var(--ok)] text-[11px]">
                <Eye size={12} /> Show
              </span>
            </div>
            <div className="p-2 rounded bg-[var(--danger-soft)] border border-[var(--danger)]/20 flex items-center justify-between">
              <span className="font-semibold text-[var(--danger)]">ELSE</span>
              <span className="flex items-center gap-1 text-[var(--danger)] text-[11px]">
                <EyeOff size={12} /> Hide
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
