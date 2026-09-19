import { useState } from "react";
import {
  Type, RotateCcw, ChevronDown, ChevronUp,
  AlignLeft, AlignCenter, AlignRight, AlignJustify
} from "lucide-react";
import type { TypographyValue, TextAlign, TextTransform } from "@/lib/types";
import { NumberField } from "./primitives";

const FONT_FAMILIES = [
  { label: "Default / Inherit", value: "inherit" },
  { label: "Inter (Modern Sans)", value: "Inter, sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, sans-serif" },
  { label: "Roboto Mono", value: "'Roboto Mono', monospace" },
  { label: "Fira Code", value: "'Fira Code', monospace" },
  { label: "Outfit / Display", value: "'Outfit', sans-serif" },
  { label: "Serif / Editorial", value: "Georgia, serif" },
];

const FONT_WEIGHTS = [
  { label: "Regular (400)", value: 400 },
  { label: "Medium (500)", value: 500 },
  { label: "SemiBold (600)", value: 600 },
  { label: "Bold (700)", value: 700 },
  { label: "Black (900)", value: 900 },
];

export default function TypographyControl({
  label = "Typography",
  value,
  onChange,
  onReset,
}: {
  label?: string;
  value?: TypographyValue;
  onChange: (val: TypographyValue) => void;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const typo = value || {};

  const setField = <K extends keyof TypographyValue>(key: K, val: TypographyValue[K]) => {
    onChange({ ...typo, [key]: val });
  };

  const isCustomized = value && Object.keys(value).length > 0;

  // Build summary line
  const famLabel = FONT_FAMILIES.find((f) => f.value === typo.family)?.label.split(" ")[0] || "Default";
  const sizeLabel = typo.size ? `${typo.size}${typo.sizeUnit || "px"}` : "Auto";
  const summary = `${famLabel} · ${sizeLabel}${typo.weight ? ` · ${typo.weight}` : ""}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {isCustomized && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title="Custom typography active" />
          )}
        </div>
        {onReset && isCustomized && (
          <button
            type="button"
            onClick={onReset}
            className="hover:opacity-100 opacity-60 flex items-center gap-1 text-[10px] text-[var(--ink-3)] hover:text-[var(--accent)] transition-all"
            title="Reset typography"
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
          <Type size={13} className="text-[var(--accent)] shrink-0" />
          <span className="text-[11px] font-medium truncate text-[var(--ink)]">
            {summary}
          </span>
        </div>
        <div className="text-[var(--ink-3)]">
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </div>

      {/* Expandable Typography Drawer */}
      {open && (
        <div
          className="p-3 rounded border bg-[var(--panel)] space-y-3 animate-fade-in shadow-sm"
          style={{ borderColor: "var(--line)" }}
        >
          {/* Font Family */}
          <div className="space-y-1">
            <span className="text-[10px] text-[var(--ink-3)] font-semibold">Font Family</span>
            <select
              value={typo.family || "inherit"}
              onChange={(e) => setField("family", e.target.value)}
              className="w-full h-7 px-2 rounded text-[11px] border text-[var(--ink)] focus:border-[var(--accent)] cursor-pointer shadow-sm"
              style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          {/* Size & Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--ink-3)] font-semibold">Size (px)</span>
              <NumberField
                value={typo.size || 0}
                onChange={(v) => setField("size", v)}
                min={0}
                max={120}
                placeholder="Auto"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[var(--ink-3)] font-semibold">Weight</span>
              <select
                value={typo.weight || 400}
                onChange={(e) => setField("weight", parseInt(e.target.value, 10))}
                className="w-full h-7 px-1.5 rounded text-[11px] border text-[var(--ink)] focus:border-[var(--accent)] cursor-pointer shadow-sm"
                style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
              >
                {FONT_WEIGHTS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Text Alignment */}
          <div className="space-y-1">
            <span className="text-[10px] text-[var(--ink-3)] font-semibold">Alignment</span>
            <div className="flex rounded border p-0.5 bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
              {[
                { id: "left", icon: AlignLeft, title: "Left" },
                { id: "center", icon: AlignCenter, title: "Center" },
                { id: "right", icon: AlignRight, title: "Right" },
                { id: "justify", icon: AlignJustify, title: "Justify" },
              ].map((al) => {
                const active = (typo.align || "left") === al.id;
                const Icon = al.icon;
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => setField("align", al.id as TextAlign)}
                    className={`flex-1 py-1 flex items-center justify-center rounded transition-all ${
                      active
                        ? "bg-[var(--panel)] text-[var(--accent)] shadow-sm"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                    title={al.title}
                  >
                    <Icon size={12} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Transform */}
          <div className="space-y-1">
            <span className="text-[10px] text-[var(--ink-3)] font-semibold">Transform</span>
            <div className="flex rounded border p-0.5 bg-[var(--panel-2)] text-[10px] font-mono" style={{ borderColor: "var(--line)" }}>
              {[
                { id: "none", label: "None" },
                { id: "uppercase", label: "UPPER" },
                { id: "lowercase", label: "lower" },
                { id: "capitalize", label: "Cap" },
              ].map((tr) => {
                const active = (typo.transform || "none") === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setField("transform", tr.id as TextTransform)}
                    className={`flex-1 py-0.5 text-center rounded transition-all ${
                      active
                        ? "bg-[var(--panel)] text-[var(--accent)] font-bold shadow-sm"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {tr.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
