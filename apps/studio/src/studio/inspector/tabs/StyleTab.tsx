import React, { useState } from "react";
import {
  Sparkles,
  Maximize2,
  Box,
  Palette,
  Sliders,
  RotateCcw,
  AlignCenterHorizontal,
  AlignCenterVertical,
} from "lucide-react";
import type {
  WidgetInstance,
  WidgetGeometry,
  WidgetAppearance,
  CanvasDocument,
  JsonValue,
  PaddingValue,
} from "@/lib/types";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import { BUILTIN_DESIGN_PRESETS } from "@shared/design-presets.js";
import { AccordionSection, CornerRadiusControl, MediaPickerControl } from "@/studio/controls";
import LinkedBoxModel from "../controls/LinkedBoxModel";
import { HexColorPicker } from "react-colorful";

interface Props {
  widget: WidgetInstance;
  doc: CanvasDocument;
  onUpdateGeometry: (id: string, g: WidgetGeometry) => void;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
}

export default function StyleTab({
  widget,
  doc,
  onUpdateGeometry,
  onUpdateConfig,
}: Props) {
  const g = widget.geometry;
  const cfg = widget.config || {};
  const def = getWidgetDefinition(widget.widgetId);

  const rawApp =
    typeof cfg.appearance === "object" && cfg.appearance !== null && !Array.isArray(cfg.appearance)
      ? (cfg.appearance as unknown as WidgetAppearance)
      : undefined;

  const app: WidgetAppearance = {
    ...rawApp,
    frame: rawApp?.frame ?? "none",
    padding: rawApp?.padding,
    opacity: rawApp?.opacity ?? 1,
    borderRadius: rawApp?.borderRadius ?? 0,
    borderWidth: rawApp?.borderWidth ?? 0,
    transparentBg: rawApp?.transparentBg ?? true,
    background: rawApp?.background,
    borderColor: rawApp?.borderColor,
    borderStyle: rawApp?.borderStyle ?? "solid",
  };

  const updateApp = (patch: Partial<WidgetAppearance>) => {
    onUpdateConfig(widget.id, {
      ...cfg,
      appearance: {
        ...app,
        ...patch,
      } as unknown as JsonValue,
    });
  };

  const updateGeometry = (patch: Partial<WidgetGeometry>) => {
    onUpdateGeometry(widget.id, {
      ...g,
      ...patch,
    });
  };

  // Center alignment helpers (group-aware)
  const centerH = () => {
    const parentGroup = widget.groupId ? doc.groups?.find(grp => grp.id === widget.groupId) : null;
    const containerW = parentGroup ? parentGroup.geometry.width : doc.logicalSize.width;
    const newX = Math.round((containerW - g.width) / 2);
    updateGeometry({ x: Math.max(0, newX) });
  };
  const centerV = () => {
    const parentGroup = widget.groupId ? doc.groups?.find(grp => grp.id === widget.groupId) : null;
    const containerH = parentGroup ? parentGroup.geometry.height : doc.logicalSize.height;
    const newY = Math.round((containerH - g.height) / 2);
    updateGeometry({ y: Math.max(0, newY) });
  };

  // Presets list
  const presetKeys = Object.keys(BUILTIN_DESIGN_PRESETS);

  const applyPreset = (presetKey: string) => {
    const preset = BUILTIN_DESIGN_PRESETS[presetKey];
    if (!preset) return;
    const radiusMap: Record<string, number> = {
      none: 0,
      sm: 4,
      md: 8,
      lg: 16,
      full: 9999,
    };
    const rVal = preset.geometry?.radius ? radiusMap[preset.geometry.radius] ?? 8 : 8;
    updateApp({
      presetId: presetKey,
      borderColor: preset.palette.border,
      borderWidth: preset.geometry?.borderWidth ?? 1,
      borderStyle: "solid",
      borderRadius: rVal,
      transparentBg: false,
    });
  };

  const [borderPickerOpen, setBorderPickerOpen] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Design Presets Carousel */}
      <AccordionSection
        title="Visual Presets"
        defaultOpen
        actions={
          <span className="text-[10px] text-[var(--accent)] font-medium flex items-center gap-1">
            <Sparkles size={11} /> 1-Click
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-1.5">
          {presetKeys.map((pk) => {
            const p = BUILTIN_DESIGN_PRESETS[pk]!;
            return (
              <button
                key={pk}
                type="button"
                onClick={() => applyPreset(pk)}
                className="flex items-center gap-2 p-2 rounded-lg border text-left hover:border-[var(--accent)] hover:bg-[var(--panel-2)] transition-all group"
                style={{ borderColor: "var(--line)" }}
              >
                <div
                  className="w-4 h-4 rounded-full shrink-0 border border-white/20 shadow-xs"
                  style={{ background: p.palette.background || "var(--accent)" }}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-[var(--ink)] truncate capitalize group-hover:text-[var(--accent)]">
                    {p.name || pk.replace("-", " ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </AccordionSection>

      {/* 2. Geometry & Canvas Alignment */}
      <AccordionSection title="Geometry & Position" defaultOpen>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">X Position</label>
              <input
                type="number"
                value={g.x}
                onChange={(e) => updateGeometry({ x: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Y Position</label>
              <input
                type="number"
                value={g.y}
                onChange={(e) => updateGeometry({ y: parseInt(e.target.value, 10) || 0 })}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Width</label>
              <input
                type="number"
                min={20}
                value={g.width}
                onChange={(e) => updateGeometry({ width: Math.max(20, parseInt(e.target.value, 10) || 20) })}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Height</label>
              <input
                type="number"
                min={20}
                value={g.height}
                onChange={(e) => updateGeometry({ height: Math.max(20, parseInt(e.target.value, 10) || 20) })}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
          </div>

          {/* Alignment buttons & Z-Index */}
          <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={centerH}
                className="p-1.5 rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
                style={{ borderColor: "var(--line)" }}
                title="Center Horizontally on Canvas"
              >
                <AlignCenterHorizontal size={13} />
              </button>
              <button
                type="button"
                onClick={centerV}
                className="p-1.5 rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
                style={{ borderColor: "var(--line)" }}
                title="Center Vertically on Canvas"
              >
                <AlignCenterVertical size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-[var(--ink-3)]">Z-Index:</span>
              <input
                type="number"
                value={g.zIndex}
                onChange={(e) => updateGeometry({ zIndex: parseInt(e.target.value, 10) || 0 })}
                className="w-14 text-center text-xs py-1 px-1.5 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* 3. Spacing & Box Model */}
      <AccordionSection title="Spacing & Padding" defaultOpen>
        <LinkedBoxModel
          label="Content Padding"
          value={app.padding}
          onChange={(val: PaddingValue) => updateApp({ padding: val })}
        />
      </AccordionSection>

      {/* 4. Corners & Borders */}
      <AccordionSection title="Corners & Borders" defaultOpen>
        <div className="space-y-3">
          <CornerRadiusControl
            value={app.borderRadius ?? 0}
            onChange={(val: any) => updateApp({ borderRadius: val })}
          />

          <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Border Width</label>
              <input
                type="number"
                min={0}
                max={16}
                value={app.borderWidth ?? 0}
                onChange={(e) => updateApp({ borderWidth: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Border Color</label>
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBorderPickerOpen(!borderPickerOpen)}
                    className="w-7 h-7 rounded border shrink-0 shadow-inner"
                    style={{ background: app.borderColor || "var(--line)", borderColor: "var(--line-2)" }}
                    title="Pick border color"
                  />
                  <input
                    type="text"
                    value={app.borderColor || ""}
                    onChange={(e) => updateApp({ borderColor: e.target.value })}
                    placeholder="transparent"
                    className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                    style={{ borderColor: "var(--line)" }}
                  />
                </div>
                {borderPickerOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 p-2 rounded-lg border shadow-xl z-50 bg-[var(--panel)]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <HexColorPicker
                      color={app.borderColor || "#38bdf8"}
                      onChange={(c) => updateApp({ borderColor: c })}
                      style={{ width: 140, height: 100 }}
                    />
                    <button
                      type="button"
                      onClick={() => setBorderPickerOpen(false)}
                      className="mt-2 w-full text-center text-xs py-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)]"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </AccordionSection>

      {/* 5. Background Surface & Opacity */}
      <AccordionSection title="Background & Opacity">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--ink)]">Transparent Background</span>
            <input
              type="checkbox"
              checked={app.transparentBg !== false}
              onChange={(e) => updateApp({ transparentBg: e.target.checked })}
              className="rounded border-[var(--line)] text-[var(--accent)] focus:ring-0"
            />
          </div>

          {app.transparentBg === false && (
            <MediaPickerControl
              label="Background Image / Fill"
              value={app.background}
              onChange={(m) => updateApp({ background: m })}
            />
          )}

          {/* Opacity slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-[var(--ink-3)]">Opacity</span>
              <span className="font-mono text-xs text-[var(--ink)]">
                {Math.round((app.opacity ?? 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={app.opacity ?? 1}
              onChange={(e) => updateApp({ opacity: parseFloat(e.target.value) })}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      </AccordionSection>
    </div>
  );
}
