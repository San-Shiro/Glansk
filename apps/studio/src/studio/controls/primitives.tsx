import React, { useRef, useState, useCallback, useEffect } from "react";
import { Link, Unlink } from "lucide-react";
import type { SpacingUnit } from "@/lib/types";

/**
 * Compact numeric input with drag-to-scrub pointer handling,
 * keyboard arrow increment/decrement (Shift = ×10), and min/max clamping.
 */
export function NumberField({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 9999,
  step = 1,
  label,
  placeholder = "0",
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  placeholder?: string;
  className?: string;
}) {
  const [localStr, setLocalStr] = useState(String(value ?? 0));
  const isDraggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startValRef = useRef(value ?? 0);

  useEffect(() => {
    setLocalStr(String(value ?? 0));
  }, [value]);

  const clamp = useCallback(
    (n: number) => Math.max(min, Math.min(max, n)),
    [min, max]
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    // Scrub trigger on label/handle drag
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    startPosRef.current = e.clientX;
    startValRef.current = value ?? 0;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - startPosRef.current;
    const multiplier = e.shiftKey ? 10 : 1;
    const nextVal = clamp(Math.round(startValRef.current + delta * step * multiplier));
    setLocalStr(String(nextVal));
    onChange(nextVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    const finalVal = clamp(parseInt(localStr, 10) || 0);
    onCommit?.(finalVal);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : 1;
      const next = clamp((value ?? 0) + step * mult);
      setLocalStr(String(next));
      onChange(next);
      onCommit?.(next);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const mult = e.shiftKey ? 10 : 1;
      const next = clamp((value ?? 0) - step * mult);
      setLocalStr(String(next));
      onChange(next);
      onCommit?.(next);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = e.target.value;
    setLocalStr(s);
    const n = parseInt(s, 10);
    if (Number.isFinite(n)) {
      onChange(clamp(n));
    }
  };

  const handleBlur = () => {
    const n = parseInt(localStr, 10);
    const valid = Number.isFinite(n) ? clamp(n) : min;
    setLocalStr(String(valid));
    onChange(valid);
    onCommit?.(valid);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {label && (
        <span
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="absolute left-1.5 text-[9px] font-bold tracking-wider select-none cursor-ew-resize opacity-60 hover:opacity-100 hover:text-[var(--accent)] transition-colors uppercase"
          title={`Drag to scrub ${label}`}
        >
          {label}
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={localStr}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full h-7 rounded text-[11px] text-center font-mono font-medium border text-[var(--ink)] focus:border-[var(--accent)] shadow-sm transition-all ${
          label ? "pl-5 pr-1.5" : "px-1.5"
        }`}
        style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
      />
    </div>
  );
}

/**
 * Compact unit dropdown (px vs %)
 */
export function UnitSelect({
  value = "px",
  onChange,
}: {
  value?: SpacingUnit;
  onChange: (u: SpacingUnit) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SpacingUnit)}
      className="h-7 px-1.5 rounded text-[10px] font-mono font-bold border text-[var(--ink)] hover:text-[var(--ink)] cursor-pointer focus:border-[var(--accent)] shadow-sm"
      style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
      title="Select unit"
    >
      <option value="px">px</option>
      <option value="%">%</option>
    </select>
  );
}

/**
 * Elementor-style chain link toggle button
 */
export function LinkToggle({
  linked,
  onChange,
  title = "Link / Unlink values",
}: {
  linked: boolean;
  onChange: (linked: boolean) => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!linked)}
      className={`w-7 h-7 shrink-0 rounded flex items-center justify-center border transition-all shadow-sm ${
        linked
          ? "bg-[var(--accent)] text-white border-[var(--accent)]"
          : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--line-2)]"
      }`}
      style={!linked ? { borderColor: "var(--line-2)", background: "var(--panel)" } : undefined}
      title={title}
    >
      {linked ? <Link size={12} /> : <Unlink size={12} />}
    </button>
  );
}

/**
 * Segmented control button group
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex p-0.5 rounded border bg-[var(--panel-2)]"
      style={{ borderColor: "var(--line)" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${
              active
                ? "bg-[var(--panel)] text-[var(--accent)] shadow-sm font-bold"
                : "text-[var(--ink-2)] hover:text-[var(--ink)]"
            }`}
            title={opt.title}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Clean control row layout with label and action
 */
export function ControlRow({
  label,
  children,
  action,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>
        <span title={hint}>{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
