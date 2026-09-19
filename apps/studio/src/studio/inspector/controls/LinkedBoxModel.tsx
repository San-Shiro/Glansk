import React from "react";
import { Lock, Unlock } from "lucide-react";
import type { BoxSides, PaddingValue } from "@/lib/types";

interface Props {
  label?: string;
  value?: PaddingValue;
  onChange: (val: PaddingValue) => void;
  min?: number;
  max?: number;
}

export default function LinkedBoxModel({
  label = "Padding",
  value,
  onChange,
  min = 0,
  max = 128,
}: Props) {
  const sides: BoxSides =
    typeof value === "number"
      ? { top: value, right: value, bottom: value, left: value, linked: true }
      : typeof value === "object" && value !== null
      ? {
          top: value.top ?? 0,
          right: value.right ?? 0,
          bottom: value.bottom ?? 0,
          left: value.left ?? 0,
          linked: value.linked !== false,
        }
      : { top: 0, right: 0, bottom: 0, left: 0, linked: true };

  const isLinked = sides.linked !== false;

  const updateSide = (side: keyof Omit<BoxSides, "linked">, raw: string) => {
    const num = Math.max(min, Math.min(max, parseInt(raw, 10) || 0));
    if (isLinked) {
      onChange({ top: num, right: num, bottom: num, left: num, linked: true });
    } else {
      onChange({ ...sides, [side]: num, linked: false });
    }
  };

  const toggleLink = () => {
    onChange({ ...sides, linked: !isLinked });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-3)]">
        <span>{label}</span>
        <button
          type="button"
          onClick={toggleLink}
          className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all ${
            isLinked
              ? "text-[var(--accent)] bg-[var(--accent-soft)] font-medium"
              : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
          }`}
          title={isLinked ? "All sides linked (click to unlink)" : "Sides independent (click to link)"}
        >
          {isLinked ? <Lock size={10} /> : <Unlock size={10} />}
          <span>{isLinked ? "Linked" : "Custom"}</span>
        </button>
      </div>

      {/* Visual Box Model Diagram */}
      <div
        className="relative p-3 rounded-lg border flex flex-col items-center justify-center transition-colors"
        style={{
          background: "var(--panel-2)",
          borderColor: "var(--line)",
        }}
      >
        {/* Top Input */}
        <div className="flex justify-center mb-1">
          <input
            type="number"
            min={min}
            max={max}
            value={sides.top}
            onChange={(e) => updateSide("top", e.target.value)}
            className="w-12 h-6 text-center text-[11px] font-mono rounded border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
            title="Top"
          />
        </div>

        {/* Middle Row: Left, Lock Toggle, Right */}
        <div className="w-full flex items-center justify-between px-2">
          <input
            type="number"
            min={min}
            max={max}
            value={sides.left}
            onChange={(e) => updateSide("left", e.target.value)}
            className="w-12 h-6 text-center text-[11px] font-mono rounded border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
            title="Left"
          />

          <button
            type="button"
            onClick={toggleLink}
            className={`w-7 h-7 grid place-items-center rounded border transition-all ${
              isLinked
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] shadow-xs"
                : "bg-[var(--panel)] border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]"
            }`}
            title={isLinked ? "Click to unlink side values" : "Click to link all 4 sides"}
          >
            {isLinked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>

          <input
            type="number"
            min={min}
            max={max}
            value={sides.right}
            onChange={(e) => updateSide("right", e.target.value)}
            className="w-12 h-6 text-center text-[11px] font-mono rounded border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
            title="Right"
          />
        </div>

        {/* Bottom Input */}
        <div className="flex justify-center mt-1">
          <input
            type="number"
            min={min}
            max={max}
            value={sides.bottom}
            onChange={(e) => updateSide("bottom", e.target.value)}
            className="w-12 h-6 text-center text-[11px] font-mono rounded border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            style={{ borderColor: "var(--line)" }}
            title="Bottom"
          />
        </div>
      </div>
    </div>
  );
}
