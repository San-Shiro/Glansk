import React, { useRef, useState, useCallback, useEffect } from "react";
import { Link, Unlink, RotateCcw, Monitor } from "lucide-react";
import type { SpacingUnit } from "@/lib/types";

interface FourWayValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface FourWayControlProps {
  label: string;
  values: FourWayValues;
  subLabels?: [string, string, string, string];
  unit?: SpacingUnit;
  linked?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (values: FourWayValues, linked: boolean, unit: SpacingUnit) => void;
  onCommit?: (values: FourWayValues, linked: boolean, unit: SpacingUnit) => void;
  onReset?: () => void;
  isCustomized?: boolean;
  showDeviceIcon?: boolean;
}

/**
 * Authentic Elementor-style 4-Way Linked Control (Margin, Padding, Corner Radius).
 *
 * Structure matching Elementor reference:
 * Top Row:    [Label] [🖥]                               [px ▾]
 * Middle Row: [ Top | Right | Bottom | Left ]           [ 🔗 ]
 * Bottom Row:   Top    Right    Bottom    Left
 */
export default function FourWayControl({
  label,
  values,
  subLabels = ["Top", "Right", "Bottom", "Left"],
  unit = "px",
  linked = true,
  min = 0,
  max = 9999,
  step = 1,
  onChange,
  onCommit,
  onReset,
  isCustomized = false,
  showDeviceIcon = true,
}: FourWayControlProps) {
  const [localValues, setLocalValues] = useState<FourWayValues>(values);
  const [isLinked, setIsLinked] = useState<boolean>(linked);
  const [currentUnit, setCurrentUnit] = useState<SpacingUnit>(unit);

  useEffect(() => {
    setLocalValues(values);
  }, [values]);

  useEffect(() => {
    setIsLinked(linked);
  }, [linked]);

  useEffect(() => {
    setCurrentUnit(unit);
  }, [unit]);

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max]
  );

  const updateSide = (side: keyof FourWayValues, val: number, commit = false) => {
    const clamped = clamp(val);
    let next: FourWayValues;
    if (isLinked) {
      next = { top: clamped, right: clamped, bottom: clamped, left: clamped };
    } else {
      next = { ...localValues, [side]: clamped };
    }
    setLocalValues(next);
    onChange(next, isLinked, currentUnit);
    if (commit) {
      onCommit?.(next, isLinked, currentUnit);
    }
  };

  const toggleLinked = () => {
    const nextLinked = !isLinked;
    setIsLinked(nextLinked);
    onChange(localValues, nextLinked, currentUnit);
    onCommit?.(localValues, nextLinked, currentUnit);
  };

  const changeUnit = (newUnit: SpacingUnit) => {
    setCurrentUnit(newUnit);
    onChange(localValues, isLinked, newUnit);
    onCommit?.(localValues, isLinked, newUnit);
  };

  const keys: (keyof FourWayValues)[] = ["top", "right", "bottom", "left"];

  return (
    <div className="space-y-1.5 select-none">
      {/* 1. Header Row: Label [🖥] on left, Reset + [px ▾] on right */}
      <div className="flex items-center justify-between text-[12px] font-medium text-[var(--ink)]">
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {showDeviceIcon && (
            <span title="Desktop" className="inline-flex items-center text-[var(--ink-3)] opacity-70">
              <Monitor size={11} />
            </span>
          )}
          {isCustomized && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title="Custom override active" />
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReset && isCustomized && (
            <button
              type="button"
              onClick={onReset}
              className="hover:opacity-100 opacity-60 flex items-center gap-1 text-[10px] text-[var(--ink-3)] hover:text-[var(--accent)] transition-all"
              title="Reset to default"
            >
              <RotateCcw size={10} /> Reset
            </button>
          )}
          <select
            value={currentUnit}
            onChange={(e) => changeUnit(e.target.value as SpacingUnit)}
            className="h-6 px-1.5 rounded text-[11px] font-sans font-medium border text-[var(--ink-2)] hover:text-[var(--ink)] cursor-pointer focus:border-[var(--accent)] bg-[var(--panel)] shadow-sm"
            style={{ borderColor: "var(--line-2)" }}
            title="Unit"
          >
            <option value="px">px</option>
            <option value="%">%</option>
          </select>
        </div>
      </div>

      {/* 2. Middle Row: Connected 4-Cell Segmented Inputs + [ 🔗 ] */}
      <div className="flex items-center gap-2">
        {/* The 4 Connected Inputs */}
        <div
          className="flex-1 flex items-stretch rounded border bg-[var(--panel)] shadow-sm overflow-hidden"
          style={{ borderColor: "var(--line-2)" }}
        >
          {keys.map((key, idx) => (
            <SingleCellInput
              key={key}
              value={localValues[key]}
              isLast={idx === keys.length - 1}
              onChange={(v) => updateSide(key, v, false)}
              onCommit={(v) => updateSide(key, v, true)}
              clamp={clamp}
            />
          ))}
        </div>

        {/* The Link Toggle Button */}
        <button
          type="button"
          onClick={toggleLinked}
          className={`w-7 h-7 shrink-0 rounded flex items-center justify-center border transition-all shadow-sm ${
            isLinked
              ? "bg-[var(--accent)] text-white border-[var(--accent)]"
              : "bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink)] border-[var(--line-2)]"
          }`}
          title={isLinked ? "Unlink values" : "Link values simultaneously"}
        >
          {isLinked ? <Link size={12} /> : <Unlink size={12} />}
        </button>
      </div>

      {/* 3. Bottom Row: Sub-labels centered under each input */}
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 text-center">
          {subLabels.map((sl) => (
            <span
              key={sl}
              className="text-[10px] text-[var(--ink-3)] font-medium capitalize"
            >
              {sl}
            </span>
          ))}
        </div>
        <div className="w-7 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

function SingleCellInput({
  value,
  isLast,
  onChange,
  onCommit,
  clamp,
}: {
  value: number;
  isLast: boolean;
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
  clamp: (n: number) => number;
}) {
  const [str, setStr] = useState(String(value ?? 0));
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startValRef = useRef(value ?? 0);

  useEffect(() => {
    setStr(String(value ?? 0));
  }, [value]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startValRef.current = value ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - startXRef.current;
    const mult = e.shiftKey ? 10 : 1;
    const next = clamp(Math.round(startValRef.current + delta * mult));
    setStr(String(next));
    onChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const finalVal = clamp(parseInt(str, 10) || 0);
    onCommit(finalVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : 1;
      const next = clamp((value ?? 0) + mult);
      setStr(String(next));
      onChange(next);
      onCommit(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : 1;
      const next = clamp((value ?? 0) - mult);
      setStr(String(next));
      onChange(next);
      onCommit(next);
    }
  };

  return (
    <div
      className={`relative flex-1 flex items-center justify-center min-w-0 ${
        !isLast ? "border-r" : ""
      }`}
      style={{ borderColor: "var(--line-2)" }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={str}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onChange={(e) => {
          const s = e.target.value;
          setStr(s);
          const n = parseInt(s, 10);
          if (Number.isFinite(n)) {
            onChange(clamp(n));
          }
        }}
        onBlur={() => {
          const n = parseInt(str, 10);
          const v = Number.isFinite(n) ? clamp(n) : 0;
          setStr(String(v));
          onChange(v);
          onCommit(v);
        }}
        onKeyDown={handleKeyDown}
        className="w-full h-7 text-center text-[12px] font-sans font-medium text-[var(--ink)] bg-transparent border-0 focus:outline-none focus:bg-[var(--panel-2)] transition-colors"
      />
    </div>
  );
}
