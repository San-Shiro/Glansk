import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Globe, Palette, RotateCcw, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { WidgetColorSlotConfig } from "@/lib/types";

const THEME_SWATCHES = [
  { token: "--canvas-accent", label: "Primary Accent" },
  { token: "--canvas-accent-2", label: "Secondary Accent" },
  { token: "--canvas-accent-3", label: "Tertiary Accent" },
  { token: "--canvas-text", label: "Primary Text" },
  { token: "--canvas-text-muted", label: "Muted Text" },
  { token: "--canvas-text-subtle", label: "Subtle Text" },
  { token: "--canvas-surface", label: "Tile Surface" },
  { token: "--canvas-surface-2", label: "Surface Track" },
  { token: "--canvas-border", label: "Card Border" },
  { token: "--canvas-positive", label: "Positive / Green" },
  { token: "--canvas-warning", label: "Warning / Amber" },
  { token: "--canvas-danger", label: "Danger / Red" },
];

export default function ThemeColorPickerControl({
  label,
  value,
  onChange,
  onReset,
  defaultToken = "--canvas-accent",
}: {
  label: string;
  value?: WidgetColorSlotConfig | string;
  onChange: (cfg: WidgetColorSlotConfig) => void;
  onReset?: () => void;
  defaultToken?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<"theme" | "custom">("theme");

  // Parse current value
  let mode: "theme" | "custom" = "theme";
  let tokenVal = defaultToken;
  let customVal = "#53e0bc";

  if (typeof value === "string") {
    if (value.startsWith("--canvas-")) {
      mode = "theme";
      tokenVal = value;
    } else {
      mode = "custom";
      customVal = value;
    }
  } else if (value && typeof value === "object") {
    mode = value.mode === "custom" ? "custom" : "theme";
    if (value.mode === "custom") {
      customVal = value.value || "#53e0bc";
    } else {
      tokenVal = value.value || defaultToken;
    }
  }

  const effectiveBg = mode === "theme" ? `var(${tokenVal})` : customVal;

  const selectToken = (t: string) => {
    onChange({ mode: "theme", value: t });
  };

  const selectCustom = (hex: string) => {
    onChange({ mode: "custom", value: hex });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase ${
              mode === "theme" ? "bg-[var(--panel-2)] text-[var(--accent)]" : "bg-[var(--panel-2)] text-[var(--ink-2)]"
            }`}
          >
            {mode === "theme" ? "Theme" : "Custom"}
          </span>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="hover:opacity-100 opacity-60 flex items-center gap-1 text-[10px] text-[var(--ink-3)] hover:text-[var(--accent)] transition-all"
            title="Reset to default"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>

      {/* Trigger Bar */}
      <div
        className="flex items-center justify-between p-1.5 rounded border hover:border-[var(--accent)] transition-all cursor-pointer shadow-sm"
        style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-5 h-5 rounded border shadow-inner shrink-0"
            style={{ background: effectiveBg, borderColor: "var(--line-2)" }}
          />
          <span className="text-[11px] font-mono truncate text-[var(--ink)]">
            {mode === "theme" ? tokenVal.replace("--canvas-", "") : customVal}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[var(--ink-3)]">
          {mode === "theme" ? <Globe size={13} className="text-[var(--accent)]" /> : <Palette size={13} />}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {/* Expandable Drawer */}
      {open && (
        <div
          className="p-2.5 rounded border bg-[var(--panel)] space-y-2.5 animate-fade-in shadow-sm"
          style={{ borderColor: "var(--line)" }}
        >
          {/* Tab Bar: Theme Tokens vs Custom Color */}
          <div className="grid grid-cols-2 gap-1 p-0.5 rounded border bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              onClick={() => {
                setPickerTab("theme");
                if (mode !== "theme") selectToken(tokenVal);
              }}
              className={`flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded transition-all ${
                pickerTab === "theme"
                  ? "bg-[var(--panel)] text-[var(--accent)] shadow-sm font-bold"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Globe size={11} /> Theme Variable
            </button>
            <button
              type="button"
              onClick={() => {
                setPickerTab("custom");
                if (mode !== "custom") selectCustom(customVal);
              }}
              className={`flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold rounded transition-all ${
                pickerTab === "custom"
                  ? "bg-[var(--panel)] text-[var(--accent)] shadow-sm font-bold"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Palette size={11} /> Custom Color
            </button>
          </div>

          {pickerTab === "theme" ? (
            /* Theme Variable Swatches Grid */
            <div className="space-y-1.5">
              <div className="text-[10px] text-[var(--ink-3)] font-medium">
                Canvas Palette Tokens (auto-updates with canvas theme)
              </div>
              <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto pr-0.5">
                {THEME_SWATCHES.map((t) => {
                  const sel = mode === "theme" && tokenVal === t.token;
                  return (
                    <button
                      key={t.token}
                      type="button"
                      onClick={() => selectToken(t.token)}
                      className={`flex items-center gap-1.5 p-1.5 rounded border text-left text-[10px] transition-all ${
                        sel
                          ? "bg-[var(--panel-2)] border-[var(--accent)] font-bold text-[var(--accent)] shadow-sm"
                          : "border-[var(--line)] hover:border-[var(--line-2)] text-[var(--ink-2)]"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border shrink-0"
                        style={{ background: `var(${t.token})`, borderColor: "var(--line-2)" }}
                      />
                      <span className="truncate flex-1">{t.label}</span>
                      {sel && <Check size={11} className="shrink-0 text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Custom Hex Color Picker */
            <div className="space-y-2">
              <div className="flex justify-center py-1">
                <HexColorPicker
                  color={customVal}
                  onChange={(hex) => selectCustom(hex)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase text-[var(--ink-3)] font-bold">HEX</span>
                <input
                  type="text"
                  value={customVal}
                  onChange={(e) => selectCustom(e.target.value)}
                  className="flex-1 h-7 px-2 rounded text-[11px] font-mono border bg-[var(--panel-2)] text-[var(--ink)] focus:border-[var(--accent)]"
                  style={{ borderColor: "var(--line)" }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
