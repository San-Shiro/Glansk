import { useState, useEffect } from "react";
import type { BoxSides, PaddingValue, SpacingUnit } from "@/lib/types";
import { normalizeBox } from "@shared/appearance-normalize.js";
import FourWayControl from "./FourWayControl";

export default function SpacingControl({
  label = "Padding",
  value,
  onChange,
  onCommit,
  onReset,
  fallback = 12,
}: {
  label?: string;
  value?: PaddingValue;
  onChange: (val: BoxSides) => void;
  onCommit?: (val: BoxSides) => void;
  onReset?: () => void;
  fallback?: number;
  boxed?: boolean;
}) {
  const current = normalizeBox(value, fallback);
  const [box, setBox] = useState<BoxSides>(current);

  useEffect(() => {
    setBox(normalizeBox(value, fallback));
  }, [value, fallback]);

  const handleChange = (
    values: { top: number; right: number; bottom: number; left: number },
    linked: boolean,
    unit: SpacingUnit
  ) => {
    const next: BoxSides = { ...values, linked, unit };
    setBox(next);
    onChange(next);
  };

  const handleCommit = (
    values: { top: number; right: number; bottom: number; left: number },
    linked: boolean,
    unit: SpacingUnit
  ) => {
    const next: BoxSides = { ...values, linked, unit };
    setBox(next);
    onCommit?.(next);
  };

  const isCustomized = value !== undefined && value !== null;

  return (
    <FourWayControl
      label={label}
      values={{ top: box.top, right: box.right, bottom: box.bottom, left: box.left }}
      subLabels={["Top", "Right", "Bottom", "Left"]}
      unit={box.unit || "px"}
      linked={box.linked !== false}
      onChange={handleChange}
      onCommit={handleCommit}
      onReset={onReset}
      isCustomized={isCustomized}
    />
  );
}
