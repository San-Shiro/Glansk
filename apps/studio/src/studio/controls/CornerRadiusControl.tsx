import { useState, useEffect } from "react";
import type { CornerRadius, RadiusValue, SpacingUnit } from "@/lib/types";
import { normalizeRadius } from "@shared/appearance-normalize.js";
import FourWayControl from "./FourWayControl";

export default function CornerRadiusControl({
  label = "Border Radius",
  value,
  onChange,
  onCommit,
  onReset,
  fallback = 16,
}: {
  label?: string;
  value?: RadiusValue;
  onChange: (val: CornerRadius) => void;
  onCommit?: (val: CornerRadius) => void;
  onReset?: () => void;
  fallback?: number;
}) {
  const current = normalizeRadius(value, fallback);
  const [rad, setRad] = useState<CornerRadius>(current);

  useEffect(() => {
    setRad(normalizeRadius(value, fallback));
  }, [value, fallback]);

  const handleChange = (
    values: { top: number; right: number; bottom: number; left: number },
    linked: boolean,
    unit: SpacingUnit
  ) => {
    const next: CornerRadius = {
      tl: values.top,
      tr: values.right,
      br: values.bottom,
      bl: values.left,
      linked,
      unit,
    };
    setRad(next);
    onChange(next);
  };

  const handleCommit = (
    values: { top: number; right: number; bottom: number; left: number },
    linked: boolean,
    unit: SpacingUnit
  ) => {
    const next: CornerRadius = {
      tl: values.top,
      tr: values.right,
      br: values.bottom,
      bl: values.left,
      linked,
      unit,
    };
    setRad(next);
    onCommit?.(next);
  };

  const isCustomized = value !== undefined && value !== null;

  return (
    <FourWayControl
      label={label}
      values={{ top: rad.tl, right: rad.tr, bottom: rad.br, left: rad.bl }}
      subLabels={["TL", "TR", "BR", "BL"]}
      unit={rad.unit || "px"}
      linked={rad.linked !== false}
      onChange={handleChange}
      onCommit={handleCommit}
      onReset={onReset}
      isCustomized={isCustomized}
    />
  );
}
