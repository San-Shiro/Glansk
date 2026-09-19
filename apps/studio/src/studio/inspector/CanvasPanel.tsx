import React, { useState } from "react";
import { LayoutGrid, Sliders, Palette, Check, Copy, Upload, Download } from "lucide-react";
import type { CanvasDocument } from "@/lib/types";
import {
  CANVAS_THEME_PRESETS,
  resolvedTheme,
  validateThemeImport,
  exportTheme,
} from "@shared/canvas-themes.js";
import { AccordionSection } from "@/studio/controls";
import { HexColorPicker } from "react-colorful";

const SIZE_PRESETS = [
  { label: "1920 × 1080 (16:9 FHD)", w: 1920, h: 1080 },
  { label: "1280 × 720 (16:9 HD)", w: 1280, h: 720 },
  { label: "1024 × 600 (7\" Pi)", w: 1024, h: 600 },
  { label: "800 × 480 (5\" Pi)", w: 800, h: 480 },
  { label: "1080 × 1920 (Portrait)", w: 1080, h: 1920 },
];

interface Props {
  doc: CanvasDocument;
  onUpdateCanvas: (p: Partial<CanvasDocument>) => void;
}

export default function CanvasPanel({ doc, onUpdateCanvas }: Props) {
  const activePreset =
    doc.theme?.preset && CANVAS_THEME_PRESETS[doc.theme.preset] ? doc.theme.preset : "midnight";
  const resolved = resolvedTheme(doc.theme, doc.background);

  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importErr, setImportErr] = useState("");
  const [copied, setCopied] = useState(false);

  const setSize = (w: number, h: number) => {
    onUpdateCanvas({
      logicalSize: { width: w, height: h },
    });
  };

  const handleApplyImport = () => {
    const res = validateThemeImport(importJson);
    if (!res.ok) {
      setImportErr(res.error || "Invalid theme JSON format");
      return;
    }
    onUpdateCanvas({
      theme: {
        preset: res.theme.base,
        variables: res.theme.tokens,
      },
    });
    setImportModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--panel)]">
      {/* Canvas Header */}
      <div
        className="p-3.5 border-b shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 grid place-items-center rounded bg-[var(--accent-soft)] text-[var(--accent)]"
          >
            <LayoutGrid size={15} />
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--ink)]">Canvas Settings</div>
            <div className="text-[11px] text-[var(--ink-3)] font-mono">{doc.id}</div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* 1. Resolution Presets */}
        <AccordionSection title="Resolution & Canvas Size" defaultOpen>
          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Preset Dimension</label>
              <select
                value={`${doc.logicalSize.width}x${doc.logicalSize.height}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split("x").map(Number);
                  if (w && h) setSize(w, h);
                }}
                className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                style={{ borderColor: "var(--line)" }}
              >
                {SIZE_PRESETS.map((p) => (
                  <option key={`${p.w}x${p.h}`} value={`${p.w}x${p.h}`}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom Dimensions</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Width (px)</label>
                <input
                  type="number"
                  min={320}
                  max={7680}
                  value={doc.logicalSize.width}
                  onChange={(e) => setSize(parseInt(e.target.value, 10) || 1920, doc.logicalSize.height)}
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                  style={{ borderColor: "var(--line)" }}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Height (px)</label>
                <input
                  type="number"
                  min={240}
                  max={4320}
                  value={doc.logicalSize.height}
                  onChange={(e) => setSize(doc.logicalSize.width, parseInt(e.target.value, 10) || 1080)}
                  className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                  style={{ borderColor: "var(--line)" }}
                />
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 2. Background Fill */}
        <AccordionSection title="Background & Surface" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Canvas Background</label>
              <div className="relative">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBgPickerOpen(!bgPickerOpen)}
                    className="w-7 h-7 rounded border shrink-0 shadow-inner"
                    style={{ background: doc.background || resolved.bg || "#0f172a", borderColor: "var(--line-2)" }}
                    title="Click to pick background color"
                  />
                  <input
                    type="text"
                    value={doc.background || ""}
                    onChange={(e) => onUpdateCanvas({ background: e.target.value })}
                    placeholder="e.g. #0f172a or var(--bg)"
                    className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                    style={{ borderColor: "var(--line)" }}
                  />
                </div>
                {bgPickerOpen && (
                  <div
                    className="absolute right-0 top-full mt-1.5 p-2 rounded-lg border shadow-xl z-50 bg-[var(--panel)]"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <HexColorPicker
                      color={doc.background || resolved.bg || "#0f172a"}
                      onChange={(c) => onUpdateCanvas({ background: c })}
                      style={{ width: 140, height: 100 }}
                    />
                    <button
                      type="button"
                      onClick={() => setBgPickerOpen(false)}
                      className="mt-2 w-full text-center text-xs py-1 rounded bg-[var(--panel-2)] hover:bg-[var(--panel-3)]"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </AccordionSection>

        {/* 3. Global Color Theme */}
        <AccordionSection
          title="Global Theme Palette"
          defaultOpen
          actions={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
                title="Import Theme JSON"
              >
                <Upload size={12} />
              </button>
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
                title="Export Theme JSON"
              >
                <Download size={12} />
              </button>
            </div>
          }
        >
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {Object.keys(CANVAS_THEME_PRESETS).map((tk) => {
                const themeDef = CANVAS_THEME_PRESETS[tk]!;
                const isSelected = activePreset === tk;
                return (
                  <button
                    key={tk}
                    type="button"
                    onClick={() => onUpdateCanvas({ theme: { ...doc.theme, preset: tk } })}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)] shadow-xs"
                        : "border-[var(--line)] bg-[var(--panel)] hover:bg-[var(--panel-2)]"
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ background: themeDef.accent || "#38bdf8" }}
                    />
                    <span className="text-[11px] font-semibold text-[var(--ink)] capitalize truncate">
                      {themeDef.name || tk}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </AccordionSection>
      </div>

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 animate-fade-in">
          <div
            className="w-full max-w-md p-4 rounded-xl border bg-[var(--panel)] shadow-2xl space-y-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="text-sm font-bold text-[var(--ink)]">Import Canvas Theme</div>
            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                setImportErr("");
              }}
              placeholder={`{\n  "$type": "glansk.canvas-theme",\n  "base": "midnight",\n  "tokens": {}\n}`}
              rows={8}
              className="w-full text-xs font-mono p-2 rounded border bg-[var(--panel-2)] text-[var(--ink)]"
              style={{ borderColor: "var(--line)" }}
            />
            {importErr && <div className="text-xs text-[var(--danger)]">{importErr}</div>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded border hover:bg-[var(--panel-2)]"
                style={{ borderColor: "var(--line)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyImport}
                className="px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white font-medium hover:brightness-105"
              >
                Apply Theme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 animate-fade-in">
          <div
            className="w-full max-w-md p-4 rounded-xl border bg-[var(--panel)] shadow-2xl space-y-3"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="text-sm font-bold text-[var(--ink)]">Export Canvas Theme</div>
            <textarea
              readOnly
              value={JSON.stringify(exportTheme(doc, `${doc.name} Theme`), null, 2)}
              rows={8}
              className="w-full text-xs font-mono p-2 rounded border bg-[var(--panel-2)] text-[var(--ink)] select-all"
              style={{ borderColor: "var(--line)" }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-3 py-1.5 text-xs rounded border hover:bg-[var(--panel-2)]"
                style={{ borderColor: "var(--line)" }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(exportTheme(doc, `${doc.name} Theme`), null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="px-3 py-1.5 text-xs rounded bg-[var(--accent)] text-white font-medium flex items-center gap-1.5 hover:brightness-105"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                <span>{copied ? "Copied" : "Copy JSON"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
