import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import {
  Copy, Trash2, BringToFront, SendToBack,
  Upload, Download, RotateCcw, Palette,
  FileText, Check, ChevronDown, ChevronRight,
  Maximize2, Sparkles, Layers, X, Box, Code,
  AlignCenterHorizontal, AlignCenterVertical, Sliders, Type, Image,
  Folder, FolderMinus, Monitor, Tablet, Smartphone, Link, Unlink,
  Clock, SlidersHorizontal, Eye, EyeOff, Info, HelpCircle, Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type {
  CanvasDocument, CanvasGroup, JsonValue, WidgetGeometry, WidgetInstance,
  WidgetAppearance, WidgetColorSlotConfig, WidgetVisibilityConfig,
  BoxSides, PaddingValue, TimeVisibilityRule, StateVisibilityRule,
  CanvasVariableDefinition, WidgetCustomTab
} from "@/lib/types";
import { api, CANVAS_LIMITS } from "@/lib/api";
import { Button, Field, TextInput, Select, Pill, Modal } from "@/components/ui";
import {
  CANVAS_THEME_PRESETS, CANVAS_THEME_TOKEN_DEFS,
  resolvedTheme, validateThemeImport, exportTheme
} from "@shared/canvas-themes.js";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import { applyTileAppearance } from "@shared/canvas-render.js";
import { getActiveVariableStore } from "@shared/canvas-variables.js";
import { BUILTIN_DESIGN_PRESETS } from "@shared/design-presets.js";
import {
  ThemeColorPickerControl,
  AccordionSection,
  SchemaFields,
  DynamicBindingControl,
  CornerRadiusControl,
  SpacingControl,
  MediaPickerControl,
  TypographyControl
} from "../controls";
import { serializePadding, serializeRadius } from "../appearance-adapters";

function PropertyRow({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[28px] select-none">
      <span className="text-[12px] font-medium text-[var(--ink)]" title={hint}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  );
}

const SIZE_PRESETS = [
  { label: "1920 × 1080 (16:9 FHD)", w: 1920, h: 1080 },
  { label: "1280 × 720 (16:9 HD)", w: 1280, h: 720 },
  { label: "1024 × 600 (7\" Pi)", w: 1024, h: 600 },
  { label: "800 × 480 (5\" Pi)", w: 800, h: 480 },
  { label: "1080 × 1920 (Portrait)", w: 1080, h: 1920 },
];

interface Props {
  doc: CanvasDocument;
  selectedId: string | null;
  selectedGroupId?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectGroup?: (id: string | null) => void;
  onUpdateCanvas: (patch: Partial<CanvasDocument>) => void;
  onUpdateGeometry: (id: string, g: WidgetGeometry) => void;
  onUpdateGroupGeometry?: (id: string, g: CanvasGroup["geometry"]) => void;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
  onUpdateWidgetVisibility?: (id: string, visibility: WidgetVisibilityConfig) => void;
  onUpdateGroup?: (id: string, patch: Partial<CanvasGroup>) => void;
  onUngroup?: (groupId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, dir: "front" | "back") => void;
}

function num(v: string, fallback: number) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export default function Inspector(p: Props) {
  const widget = p.selectedId ? p.doc.widgets.find(w => w.id === p.selectedId) ?? null : null;
  const group = (!widget && p.selectedGroupId) ? p.doc.groups?.find(g => g.id === p.selectedGroupId) ?? null : null;

  return (
    <aside
      className="h-full flex flex-col border-l select-none shrink-0"
      style={{ background: "var(--panel)", borderColor: "var(--line)", width: 350 }}
    >
      {widget ? (
        <WidgetPanel key={widget.id} widget={widget} {...p} />
      ) : group ? (
        <GroupPanel key={group.id} group={group} {...p} />
      ) : (
        <CanvasPanel doc={p.doc} onUpdateCanvas={p.onUpdateCanvas} />
      )}
    </aside>
  );
}

// Compact Color input with clickable swatch popover
function ColorPickerInput({
  label,
  value,
  onChange,
  onReset,
  hint,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onReset?: () => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: "var(--ink-3)" }}>
        <span>{label}</span>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="hover:opacity-100 opacity-60 flex items-center gap-1 text-[10px]"
            title="Reset to default"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="shrink-0 w-7 h-7 rounded border shadow-inner transition-transform active:scale-95"
          style={{ background: value || "transparent", borderColor: "var(--line-2)" }}
          title="Click to toggle color picker"
        />
        <TextInput
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#rrggbb"
          className="font-mono text-xs"
        />
      </div>
      {hint && <span className="block text-[10px]" style={{ color: "var(--ink-3)" }}>{hint}</span>}
      {open && (
        <div className="p-2.5 border rounded-lg shadow-xl animate-fade-in mt-1 z-30" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
          <HexColorPicker color={value.startsWith("#") ? value : "#3b82f6"} onChange={onChange} style={{ width: "100%", height: 120 }} />
          <div className="flex justify-end mt-2">
            <Button variant="ghost" className="text-xs py-0.5 px-2" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// CANVAS PANEL (When no widget is selected)
// =========================================================================
function CanvasPanel({ doc, onUpdateCanvas }: { doc: CanvasDocument; onUpdateCanvas: (p: Partial<CanvasDocument>) => void }) {
  const presetIdx = SIZE_PRESETS.findIndex(s => s.w === doc.logicalSize.width && s.h === doc.logicalSize.height);
  const activePreset = doc.theme?.preset && CANVAS_THEME_PRESETS[doc.theme.preset] ? doc.theme.preset : "midnight";
  const resolved = resolvedTheme(doc.theme, doc.background);

  const [showCustomTokens, setShowCustomTokens] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importErr, setImportErr] = useState("");
  const [copied, setCopied] = useState(false);

  const customVars = doc.theme?.variables || {};
  const overrideCount = Object.keys(customVars).length;

  const updateToken = (tokenKey: string, value: string) => {
    onUpdateCanvas({
      theme: {
        ...doc.theme,
        preset: activePreset,
        variables: { ...customVars, [tokenKey]: value },
      },
    });
  };

  const resetToken = (tokenKey: string) => {
    const next = { ...customVars };
    delete next[tokenKey];
    onUpdateCanvas({
      theme: {
        ...doc.theme,
        preset: activePreset,
        variables: next,
      },
    });
  };

  const resetAllTokens = () => {
    onUpdateCanvas({
      theme: {
        ...doc.theme,
        preset: activePreset,
        variables: {},
      },
    });
  };

  const handleApplyImport = () => {
    const res = validateThemeImport(importJson);
    if (!res.ok) {
      setImportErr(res.error);
      return;
    }
    onUpdateCanvas({
      theme: {
        preset: res.theme.base,
        variables: res.theme.tokens,
      },
    });
    setImportModalOpen(false);
    setImportJson("");
    setImportErr("");
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-3.5 py-3 border-b flex items-center justify-between sticky top-0 z-10" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <Palette size={14} className="text-[var(--accent)]" />
          <span className="font-bold text-xs" style={{ color: "var(--ink)" }}>Canvas Settings</span>
        </div>
        <Pill tone="neutral">{doc.widgets.length} {doc.widgets.length === 1 ? "widget" : "widgets"}</Pill>
      </div>

      <div className="p-3.5 space-y-4">
        {/* Name & Canvas Sizing */}
        <div className="space-y-2.5">
          <Field label="Canvas Name">
            <TextInput value={doc.name} onChange={e => onUpdateCanvas({ name: e.target.value })} placeholder="Dashboard Name" />
          </Field>
          <Field label="Display Size Preset">
            <Select
              value={presetIdx}
              onChange={e => {
                const s = SIZE_PRESETS[num(e.target.value, -1)];
                if (s) onUpdateCanvas({ logicalSize: { width: s.w, height: s.h } });
              }}
            >
              <option value={-1}>Custom Resolution</option>
              {SIZE_PRESETS.map((s, i) => <option key={i} value={i}>{s.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Width (px)">
              <TextInput
                type="number"
                min={CANVAS_LIMITS.width.min}
                max={CANVAS_LIMITS.width.max}
                value={doc.logicalSize.width}
                onChange={e => onUpdateCanvas({ logicalSize: { ...doc.logicalSize, width: num(e.target.value, doc.logicalSize.width) } })}
              />
            </Field>
            <Field label="Height (px)">
              <TextInput
                type="number"
                min={CANVAS_LIMITS.height.min}
                max={CANVAS_LIMITS.height.max}
                value={doc.logicalSize.height}
                onChange={e => onUpdateCanvas({ logicalSize: { ...doc.logicalSize, height: num(e.target.value, doc.logicalSize.height) } })}
              />
            </Field>
          </div>
        </div>

        {/* Theme Palette */}
        <div className="border-t pt-3.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
              Theme Palette
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" className="text-xs px-2 py-0.5" onClick={() => { setImportErr(""); setImportJson(""); setImportModalOpen(true); }} title="Import Theme JSON">
                <Upload size={12} /> Import
              </Button>
              <Button variant="ghost" className="text-xs px-2 py-0.5" onClick={() => { setCopied(false); setExportModalOpen(true); }} title="Export Theme JSON">
                <Download size={12} /> Export
              </Button>
            </div>
          </div>

          {/* Palette Preset Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {Object.entries(CANVAS_THEME_PRESETS).map(([id, p]) => {
              const sel = id === activePreset;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onUpdateCanvas({
                      theme: { preset: id },
                      background: p["--canvas-bg"],
                    });
                  }}
                  className={`p-2.5 text-left rounded-lg border transition-all ${sel ? "ring-2 ring-[var(--accent)] shadow-md" : "hover:border-[var(--line-2)] hover:bg-[var(--panel-2)]"}`}
                  style={{ background: p["--canvas-bg"], borderColor: sel ? "var(--accent)" : "var(--line)" }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold truncate" style={{ color: p["--canvas-text"] }}>
                      {p.name}
                    </span>
                    {sel && <Check size={12} className="text-[var(--accent)] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shadow" style={{ background: p["--canvas-accent"] }} title="Primary Accent" />
                    <span className="w-3 h-3 rounded-full shadow" style={{ background: p["--canvas-accent-2"] }} title="Secondary Accent" />
                    <span className="w-3 h-3 rounded-full shadow" style={{ background: p["--canvas-accent-3"] }} title="Tertiary Accent" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Background Color Picker */}
          <ColorPickerInput
            label="Canvas Wallpaper"
            value={doc.background}
            onChange={c => onUpdateCanvas({ background: c })}
            hint="Background behind all widgets on the canvas"
          />
        </div>

        {/* Collapsible Palette Color Customizer */}
        <div className="border-t pt-3.5" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            onClick={() => setShowCustomTokens(!showCustomTokens)}
            className="w-full flex items-center justify-between text-[11px] font-bold uppercase tracking-wide py-1 text-left"
            style={{ color: "var(--ink-3)" }}
          >
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-[var(--accent)]" /> Customize Palette Colors
              {overrideCount > 0 && <Pill tone="accent">{overrideCount} modified</Pill>}
            </span>
            {showCustomTokens ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {showCustomTokens && (
            <div className="space-y-3 pt-2.5 animate-fade-in">
              {overrideCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetAllTokens}
                    className="text-[11px] text-[var(--accent)] flex items-center gap-1 hover:underline font-semibold"
                  >
                    <RotateCcw size={11} /> Reset All Overrides
                  </button>
                </div>
              )}

              {/* Group by category */}
              {(["accent", "surface", "text", "border", "status"] as const).map(cat => {
                const tokens = CANVAS_THEME_TOKEN_DEFS.filter(t => t.category === cat);
                return (
                  <div key={cat} className="p-2.5 rounded-lg border space-y-2.5" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                      {cat === "accent" ? "Accents (Multi-Level)" : cat === "surface" ? "Surfaces & Tracks" : cat === "text" ? "Typography Levels" : cat === "border" ? "Borders & Outlines" : "Status & Semantics"}
                    </div>
                    {tokens.map(token => {
                      const val = customVars[token.key] || resolved[token.key] || "#000000";
                      const isOverridden = token.key in customVars;
                      return (
                        <ColorPickerInput
                          key={token.key}
                          label={token.label}
                          value={val}
                          onChange={c => updateToken(token.key, c)}
                          onReset={isOverridden ? () => resetToken(token.key) : undefined}
                          hint={token.hint}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Theme Import Modal */}
      {importModalOpen && (
        <Modal
          title="Import Canvas Theme (JSON)"
          onClose={() => setImportModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setImportModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleApplyImport}>Apply Theme</Button>
            </>
          }
        >
          <p className="text-xs text-[var(--ink-2)]">
            Paste theme JSON exported from Glansk. Includes theme preset name and color variable overrides.
          </p>
          <textarea
            value={importJson}
            onChange={e => { setImportJson(e.target.value); setImportErr(""); }}
            placeholder={`{\n  "$type": "glansk.canvas-theme",\n  "base": "midnight",\n  "tokens": {}\n}`}
            spellCheck={false}
            rows={8}
            className="w-full px-2.5 py-2 font-mono text-[11px] border rounded select-all"
            style={{ background: "var(--panel-2)", borderColor: importErr ? "var(--danger)" : "var(--line)" }}
          />
          {importErr && <p className="text-[11px] text-[var(--danger)] font-medium">{importErr}</p>}
        </Modal>
      )}

      {/* Theme Export Modal */}
      {exportModalOpen && (
        <Modal
          title="Export Canvas Theme (JSON)"
          onClose={() => setExportModalOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setExportModalOpen(false)}>Close</Button>
              <Button
                variant="primary"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(exportTheme(doc, `${doc.name} Theme`), null, 2));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy JSON</>}
              </Button>
            </>
          }
        >
          <p className="text-xs text-[var(--ink-2)]">
            Share or backup your theme palette. Contains base preset and all color overrides.
          </p>
          <textarea
            readOnly
            value={JSON.stringify(exportTheme(doc, `${doc.name} Theme`), null, 2)}
            rows={10}
            className="w-full px-2.5 py-2 font-mono text-[11px] border rounded select-all"
            style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
          />
        </Modal>
      )}
    </div>
  );
}

// =========================================================================
// WIDGET APPEARANCE NORMALIZER
// =========================================================================
function ensureWidgetAppearance(
  widgetId: string,
  currentApp: WidgetAppearance | undefined,
  canvasTheme: Record<string, string>
): WidgetAppearance {
  const def = getWidgetDefinition(widgetId);
  const slots: Record<string, WidgetColorSlotConfig> = {};

  for (const slot of def.colorSlots) {
    const existing = currentApp?.slots?.[slot.key];
    const mode = existing?.mode || "theme";
    const value = existing?.value || slot.defaultThemeToken;
    const resolvedColor = mode === "custom" && value
      ? value
      : (canvasTheme?.[value] || canvasTheme?.[slot.defaultThemeToken] || "#ffffff");

    slots[slot.key] = {
      mode,
      value,
      resolvedColor,
    };
  }

  return {
    showBoundingBox: currentApp?.showBoundingBox ?? true,
    followCanvasTheme: currentApp?.followCanvasTheme !== false,
    fontScale: currentApp?.fontScale ?? 1,
    padding: currentApp?.padding,
    opacity: currentApp?.opacity ?? 1,
    borderRadius: currentApp?.borderRadius ?? 16,
    borderWidth: currentApp?.borderWidth ?? 1,
    transparentBg: currentApp?.transparentBg ?? false,
    slots,
  };
}

// =========================================================================
// GROUP PANEL (When a group container is selected)
// =========================================================================
function GroupPanel({
  group,
  doc,
  onSelectGroup,
  onUpdateGroupGeometry,
  onUpdateGroup,
  onUngroup,
  onDelete,
  onReorder,
}: Props & { group: CanvasGroup }) {
  const g = group.geometry;
  const childWidgets = doc.widgets.filter(w => w.groupId === group.id);

  const gset = (patch: Partial<CanvasGroup["geometry"]>) => {
    onUpdateGroupGeometry?.(group.id, { ...g, ...patch });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* HEADER */}
      <div
        className="px-3.5 py-2.5 border-b sticky top-0 z-20 flex items-center justify-between shrink-0"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: "color-mix(in srgb, var(--accent, #38bdf8) 15%, transparent)", color: "var(--accent, #38bdf8)" }}
          >
            <Folder size={14} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate text-[var(--ink)]">
              {group.name}
            </div>
            <div className="text-[10px] text-[var(--ink-3)] truncate font-mono">
              {group.id} • {childWidgets.length} items
            </div>
          </div>
        </div>
        {onSelectGroup && (
          <button
            type="button"
            onClick={() => onSelectGroup(null)}
            title="Deselect group"
            className="p-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors ml-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[var(--panel)]">
        {/* SECTION 1: GROUP INFO & NAME */}
        <AccordionSection title="Group Properties" defaultOpen>
          <Field label="Group Name">
            <TextInput
              value={group.name}
              onChange={e => onUpdateGroup?.(group.id, { name: e.target.value })}
              placeholder="e.g. Header Bar"
            />
          </Field>
          <PropertyRow label="Disabled / Locked" hint="Prevents dragging child widgets directly on canvas">
            <input
              type="checkbox"
              checked={!!group.disabled}
              onChange={e => onUpdateGroup?.(group.id, { disabled: e.target.checked })}
              className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
            />
          </PropertyRow>
        </AccordionSection>

        {/* SECTION 2: LAYOUT & POSITIONING */}
        <AccordionSection title="Layout & Dimensions" defaultOpen>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">X Position</label>
              <TextInput
                type="number"
                value={g.x}
                onChange={e => gset({ x: num(e.target.value, g.x) })}
                className="text-xs font-mono shadow-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Y Position</label>
              <TextInput
                type="number"
                value={g.y}
                onChange={e => gset({ y: num(e.target.value, g.y) })}
                className="text-xs font-mono shadow-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Width (W)</label>
              <TextInput
                type="number"
                value={g.width}
                onChange={e => gset({ width: Math.max(40, num(e.target.value, g.width)) })}
                className="text-xs font-mono shadow-sm"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Height (H)</label>
              <TextInput
                type="number"
                value={g.height}
                onChange={e => gset({ height: Math.max(40, num(e.target.value, g.height)) })}
                className="text-xs font-mono shadow-sm"
              />
            </div>
          </div>
          <div className="pt-2">
            <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Stacking Z-Index</label>
            <TextInput
              type="number"
              value={g.zIndex || 0}
              onChange={e => gset({ zIndex: num(e.target.value, g.zIndex || 0) })}
              className="text-xs font-mono shadow-sm"
            />
          </div>
        </AccordionSection>

        {/* CONDITIONAL VISIBILITY */}
        <ConditionalVisibilitySection
          visibility={group.visibility}
          onChange={v => onUpdateGroup?.(group.id, { visibility: v })}
          variables={doc.variables}
        />

        {/* SECTION 3: GROUP MEMBERS */}
        <AccordionSection title={`Contained Widgets (${childWidgets.length})`} defaultOpen>
          <div className="space-y-1">
            {childWidgets.length === 0 ? (
              <p className="text-[11px] text-[var(--ink-3)] italic py-1">Empty group container</p>
            ) : (
              childWidgets.map(child => (
                <div
                  key={child.id}
                  className="flex items-center justify-between p-2 rounded border text-xs bg-[var(--panel-2)]"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span className="font-medium text-[var(--ink)] truncate">{child.config?.label as string || child.widgetId}</span>
                  <span className="text-[10px] font-mono text-[var(--ink-3)]">
                    {child.geometry.x},{child.geometry.y} ({child.geometry.width}×{child.geometry.height})
                  </span>
                </div>
              ))
            )}
          </div>
        </AccordionSection>
      </div>

      {/* FOOTER */}
      <div
        className="p-2.5 border-t shrink-0 flex items-center justify-between gap-1.5"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-1">
          <Button
            variant="subtle"
            className="text-xs py-1 px-2.5 flex items-center gap-1.5"
            onClick={() => onUngroup?.(group.id)}
            title="Dissolve group container, keeping children on canvas"
          >
            <FolderMinus size={13} /> Ungroup
          </Button>
          <Button variant="ghost" className="p-1 px-2 text-xs" onClick={() => onReorder(group.id, "front")} title="Bring Group to Front">
            <BringToFront size={13} />
          </Button>
          <Button variant="ghost" className="p-1 px-2 text-xs" onClick={() => onReorder(group.id, "back")} title="Send Group to Back">
            <SendToBack size={13} />
          </Button>
        </div>
        <Button
          variant="danger"
          className="text-xs py-1 px-2.5 ml-auto"
          onClick={() => onDelete(group.id)}
          title="Delete group"
        >
          <Trash2 size={13} /> Delete
        </Button>
      </div>
    </div>
  );
}

// =========================================================================
// LINKED PADDING BOX MODEL CONTROL (Matching FlutterFlow / image copy 5.png)
// =========================================================================
function LinkedPaddingControl({
  value,
  onChange,
}: {
  value?: PaddingValue;
  onChange: (val: PaddingValue) => void;
}) {
  const sides: BoxSides = typeof value === "number"
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

  const updateSide = (side: keyof Omit<BoxSides, "linked">, val: number) => {
    if (isLinked) {
      onChange({ top: val, right: val, bottom: val, left: val, linked: true });
    } else {
      onChange({ ...sides, [side]: val, linked: false });
    }
  };

  const toggleLink = () => {
    onChange({ ...sides, linked: !isLinked });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-3)]">
        <span>Padding</span>
        <button
          type="button"
          onClick={toggleLink}
          className={`p-1 rounded transition-colors ${
            isLinked
              ? "text-[var(--accent)] bg-[var(--accent-soft)]"
              : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
          }`}
          title={isLinked ? "Unlink side paddings" : "Link all 4 side paddings"}
        >
          {isLinked ? <Link size={12} /> : <Unlink size={12} />}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <div>
          <span className="block text-[9px] uppercase font-bold text-center text-[var(--ink-3)] mb-0.5">Top</span>
          <TextInput
            type="number"
            value={sides.top}
            onChange={e => updateSide("top", num(e.target.value, sides.top))}
            className="text-xs text-center font-mono py-1 px-1 shadow-sm"
          />
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-center text-[var(--ink-3)] mb-0.5">Right</span>
          <TextInput
            type="number"
            value={sides.right}
            onChange={e => updateSide("right", num(e.target.value, sides.right))}
            className="text-xs text-center font-mono py-1 px-1 shadow-sm"
          />
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-center text-[var(--ink-3)] mb-0.5">Bottom</span>
          <TextInput
            type="number"
            value={sides.bottom}
            onChange={e => updateSide("bottom", num(e.target.value, sides.bottom))}
            className="text-xs text-center font-mono py-1 px-1 shadow-sm"
          />
        </div>
        <div>
          <span className="block text-[9px] uppercase font-bold text-center text-[var(--ink-3)] mb-0.5">Left</span>
          <TextInput
            type="number"
            value={sides.left}
            onChange={e => updateSide("left", num(e.target.value, sides.left))}
            className="text-xs text-center font-mono py-1 px-1 shadow-sm"
          />
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// RESPONSIVE DEVICE VISIBILITY BAR (Matching image copy 5.png)
// =========================================================================
function ResponsiveVisibilityBar({
  responsive,
  onChange,
}: {
  responsive?: { desktop?: boolean; tablet?: boolean; mobileLandscape?: boolean; mobilePortrait?: boolean };
  onChange: (patch: { desktop?: boolean; tablet?: boolean; mobileLandscape?: boolean; mobilePortrait?: boolean }) => void;
}) {
  const r = responsive || {};
  const isDesktop = r.desktop !== false;
  const isTablet = r.tablet !== false;
  const isLandscape = r.mobileLandscape !== false;
  const isPortrait = r.mobilePortrait !== false;

  const toggle = (device: "desktop" | "tablet" | "mobileLandscape" | "mobilePortrait", current: boolean) => {
    onChange({ ...r, [device]: !current });
  };

  return (
    <div className="flex items-center justify-between px-3.5 py-2 border-b bg-[var(--panel-2)]/60" style={{ borderColor: "var(--line)" }}>
      <span className="text-[11px] font-semibold text-[var(--ink-3)] flex items-center gap-1">
        Responsive Devices
      </span>
      <div className="flex items-center gap-1 bg-[var(--panel)] p-0.5 rounded border" style={{ borderColor: "var(--line)" }}>
        <button
          type="button"
          onClick={() => toggle("desktop", isDesktop)}
          className={`p-1.5 rounded transition-all ${
            isDesktop
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "text-[var(--ink-3)] opacity-40 hover:opacity-75 hover:bg-[var(--panel-2)]"
          }`}
          title={isDesktop ? "Desktop: Visible (click to hide)" : "Desktop: Hidden (click to show)"}
        >
          <Monitor size={13} />
        </button>
        <button
          type="button"
          onClick={() => toggle("tablet", isTablet)}
          className={`p-1.5 rounded transition-all ${
            isTablet
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "text-[var(--ink-3)] opacity-40 hover:opacity-75 hover:bg-[var(--panel-2)]"
          }`}
          title={isTablet ? "Tablet: Visible (click to hide)" : "Tablet: Hidden (click to show)"}
        >
          <Tablet size={13} />
        </button>
        <button
          type="button"
          onClick={() => toggle("mobileLandscape", isLandscape)}
          className={`p-1.5 rounded transition-all ${
            isLandscape
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "text-[var(--ink-3)] opacity-40 hover:opacity-75 hover:bg-[var(--panel-2)]"
          }`}
          title={isLandscape ? "Mobile Landscape: Visible (click to hide)" : "Mobile Landscape: Hidden (click to show)"}
        >
          <Smartphone size={13} className="rotate-90" />
        </button>
        <button
          type="button"
          onClick={() => toggle("mobilePortrait", isPortrait)}
          className={`p-1.5 rounded transition-all ${
            isPortrait
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "text-[var(--ink-3)] opacity-40 hover:opacity-75 hover:bg-[var(--panel-2)]"
          }`}
          title={isPortrait ? "Mobile Portrait: Visible (click to hide)" : "Mobile Portrait: Hidden (click to show)"}
        >
          <Smartphone size={13} />
        </button>
      </div>
    </div>
  );
}

// =========================================================================
// CONDITIONAL VISIBILITY SECTION (Matching FlutterFlow / image copy 5.png)
// =========================================================================
function ConditionalVisibilitySection({
  visibility,
  onChange,
  variables = {},
}: {
  visibility?: WidgetVisibilityConfig;
  onChange: (val: WidgetVisibilityConfig) => void;
  variables?: Record<string, CanvasVariableDefinition>;
}) {
  const vis = visibility || { defaultVisible: true };
  const isEnabled = vis.timeRule?.enabled || vis.stateRule?.enabled;
  const showInUiBuilder = vis.showInUiBuilder !== false;

  const setTimeRule = (patch: Partial<TimeVisibilityRule>) => {
    const current = vis.timeRule || { enabled: false, type: "schedule" };
    onChange({
      ...vis,
      timeRule: { ...current, ...patch },
    });
  };

  const setStateRule = (patch: Partial<StateVisibilityRule>) => {
    const current = vis.stateRule || { enabled: false, variablePath: "", operator: "eq", value: "" };
    onChange({
      ...vis,
      stateRule: { ...current, ...patch },
    });
  };

  const toggleDay = (dayIdx: number) => {
    const days = vis.timeRule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    const nextDays = days.includes(dayIdx) ? days.filter(d => d !== dayIdx) : [...days, dayIdx].sort();
    setTimeRule({ daysOfWeek: nextDays });
  };

  const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
  const varNames = Object.keys(variables);

  return (
    <AccordionSection
      title="Conditional Visibility"
      defaultOpen={!!isEnabled}
      actions={
        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={!!isEnabled}
              onChange={e => {
                const turnOn = e.target.checked;
                onChange({
                  ...vis,
                  timeRule: {
                    ...(vis.timeRule || { type: "schedule" }),
                    enabled: turnOn,
                  },
                });
              }}
              className="sr-only peer"
            />
            <div className="w-7 h-4 bg-[var(--line-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]"></div>
          </label>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        {/* Builder Ghost Preview Toggle (Matching image copy 5.png) */}
        <div className="p-2.5 rounded-lg border bg-[var(--panel-2)] space-y-1.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Eye size={13} className="text-[var(--accent)]" />
              <span className="text-[11px] font-semibold text-[var(--ink)]">Show in UI Builder</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showInUiBuilder}
                onChange={e => onChange({ ...vis, showInUiBuilder: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-7 h-4 bg-[var(--line-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>
          <p className="text-[10px] text-[var(--ink-3)] leading-relaxed">
            When enabled, hidden widgets render as semi-transparent ghost outlines in the editor so you can still click and reposition them.
          </p>
        </div>

        {/* RULE 1: TIME SCHEDULE */}
        <div className="p-2.5 rounded-lg border bg-[var(--panel-2)]/60 space-y-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-[var(--ink-2)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)]">Time Schedule</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!vis.timeRule?.enabled}
                onChange={e => setTimeRule({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-6 h-3.5 bg-[var(--line-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          {vis.timeRule?.enabled && (
            <div className="space-y-2.5 animate-fade-in pt-1 border-t" style={{ borderColor: "var(--line)" }}>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Start Time</label>
                  <TextInput
                    type="time"
                    value={vis.timeRule.startTime || "09:00"}
                    onChange={e => setTimeRule({ startTime: e.target.value })}
                    className="text-xs py-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">End Time</label>
                  <TextInput
                    type="time"
                    value={vis.timeRule.endTime || "17:00"}
                    onChange={e => setTimeRule({ endTime: e.target.value })}
                    className="text-xs py-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1.5">Active Days</label>
                <div className="flex items-center justify-between gap-1">
                  {DAY_LABELS.map((dayName, idx) => {
                    const days = vis.timeRule?.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
                    const active = days.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDay(idx)}
                        className={`h-7 w-7 rounded-md text-[11px] font-bold transition-all ${
                          active
                            ? "bg-[var(--accent)] text-white shadow-xs"
                            : "bg-[var(--panel)] text-[var(--ink-3)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
                        }`}
                        title={`Toggle ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][idx]}`}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RULE 2: STATE VARIABLE */}
        <div className="p-2.5 rounded-lg border bg-[var(--panel-2)]/60 space-y-2.5" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-[var(--ink-2)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink-2)]">State Variable</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!vis.stateRule?.enabled}
                onChange={e => setStateRule({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-6 h-3.5 bg-[var(--line-2)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1.5px] after:left-[1.5px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[var(--accent)]"></div>
            </label>
          </div>

          {vis.stateRule?.enabled && (
            <div className="space-y-2 animate-fade-in pt-1 border-t" style={{ borderColor: "var(--line)" }}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-[var(--ink-3)]">Variable Path</label>
                  {varNames.length > 0 && (
                    <span className="text-[9px] text-[var(--accent)] font-medium">
                      {varNames.length} Canvas Variables
                    </span>
                  )}
                </div>
                {varNames.length > 0 ? (
                  <div className="space-y-1.5">
                    <Select
                      value={varNames.includes(vis.stateRule.variablePath || "") ? vis.stateRule.variablePath : "__custom__"}
                      onChange={e => {
                        if (e.target.value !== "__custom__") {
                          const vDef = variables[e.target.value];
                          setStateRule({
                            variablePath: e.target.value,
                            operator: vDef?.type === "boolean" ? "truthy" : (vis.stateRule?.operator || "eq"),
                          });
                        }
                      }}
                      className="font-mono text-xs py-1"
                    >
                      <option value="__custom__">Custom path / state...</option>
                      {Object.entries(variables).map(([vName, vDef]) => (
                        <option key={vName} value={vName}>
                          ⚡ {vName} ({vDef.type})
                        </option>
                      ))}
                    </Select>
                    {(!varNames.includes(vis.stateRule.variablePath || "") || !vis.stateRule.variablePath) && (
                      <TextInput
                        value={vis.stateRule.variablePath || ""}
                        onChange={e => setStateRule({ variablePath: e.target.value })}
                        placeholder="e.g. isNightMode or runtime.music.playing"
                        className="font-mono text-xs py-1"
                      />
                    )}
                  </div>
                ) : (
                  <TextInput
                    value={vis.stateRule.variablePath || ""}
                    onChange={e => setStateRule({ variablePath: e.target.value })}
                    placeholder="e.g. isNightMode or runtime.music.playing"
                    className="font-mono text-xs py-1"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Operator</label>
                  <Select
                    value={vis.stateRule.operator || "eq"}
                    onChange={e => setStateRule({ operator: e.target.value as any })}
                    className="text-xs py-1"
                  >
                    <option value="eq">== Equals</option>
                    <option value="neq">!= Not Equals</option>
                    <option value="gt">&gt; Greater Than</option>
                    <option value="gte">&gt;= Greater/Equal</option>
                    <option value="lt">&lt; Less Than</option>
                    <option value="lte">&lt;= Less/Equal</option>
                    <option value="truthy">Truthy (exists & non-empty)</option>
                    <option value="falsy">Falsy (empty or false)</option>
                    <option value="contains">Contains</option>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Target Value</label>
                  <TextInput
                    value={String(vis.stateRule.value ?? "")}
                    onChange={e => setStateRule({ value: e.target.value })}
                    placeholder="true / 42 / text"
                    className="font-mono text-xs py-1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AccordionSection>
  );
}

// =========================================================================
// WIDGET PANEL (When a widget is selected)
// =========================================================================
function WidgetPanel({
  widget,
  doc,
  onSelect,
  onUpdateGeometry,
  onUpdateConfig,
  onUpdateWidgetVisibility,
  onDelete,
  onDuplicate,
  onReorder,
}: Props & { widget: WidgetInstance }) {
  const g = widget.geometry;
  const packaged = widget.packageId === "glansk.media" || ["aurora-metric", "telemetry-chart", "status-grid", "command-control", "sdk-status"].includes(widget.widgetId);
  const cfg = widget.config;
  const setCfg = (patch: Record<string, JsonValue>) => onUpdateConfig(widget.id, { ...cfg, ...patch });
  const def = getWidgetDefinition(widget.widgetId);
  const canvasTheme = resolvedTheme(doc.theme, doc.background);
  const secretsQ = useQuery({ queryKey: ["vault-secrets"], queryFn: api.listSecrets });
  const vaultKeys = (secretsQ.data ?? []).map(s => s.id);

  const [activeTab, setActiveTab] = useState<"content" | "layout" | "appearance" | "json">("content");
  const [jsonScope, setJsonScope] = useState<"config" | "widget">("config");
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const [isEditingJson, setIsEditingJson] = useState(false);

  const rawApp = (typeof cfg.appearance === "object" && cfg.appearance !== null && !Array.isArray(cfg.appearance))
    ? (cfg.appearance as unknown as WidgetAppearance)
    : undefined;
  const app = ensureWidgetAppearance(widget.widgetId, rawApp, canvasTheme);

  // Sync JSON text automatically
  useEffect(() => {
    if (isEditingJson) return;
    const fullConfig = { ...cfg, appearance: app };
    const dataToDisplay = jsonScope === "config"
      ? fullConfig
      : { id: widget.id, widgetId: widget.widgetId, packageId: widget.packageId, geometry: g, config: fullConfig };
    setJson(JSON.stringify(dataToDisplay, null, 2));
    setJsonErr("");
  }, [widget.id, activeTab, jsonScope, cfg, app, isEditingJson, g]);

  const handleApplyJson = (newText: string) => {
    try {
      const parsed = JSON.parse(newText);
      setJsonErr("");
      if (jsonScope === "config") {
        onUpdateConfig(widget.id, parsed);
      } else {
        if (parsed.geometry && typeof parsed.geometry === "object") {
          onUpdateGeometry(widget.id, { ...g, ...parsed.geometry });
        }
        if (parsed.config && typeof parsed.config === "object") {
          onUpdateConfig(widget.id, parsed.config);
        }
      }
    } catch (err: unknown) {
      setJsonErr(err instanceof Error ? err.message : "Invalid JSON syntax");
    }
  };

  const gset = (patch: Partial<WidgetGeometry>) => onUpdateGeometry(widget.id, { ...g, ...patch });
  const strVal = (k: string) => (typeof cfg[k] === "string" || typeof cfg[k] === "number" ? String(cfg[k]) : "");

  const isPackaged = widget.packageId !== "glansk.demo" || [
    "image-carousel", "sdk-status", "telemetry-chart", "command-control", "status-grid", "aurora-metric"
  ].includes(widget.widgetId);

  const followCanvasTheme = app.followCanvasTheme !== false;
  const setApp = (patch: Partial<WidgetAppearance>, commit = true) => {
    const nextApp = { ...app, ...patch };
    for (const key of Object.keys(nextApp) as Array<keyof WidgetAppearance>) {
      if (nextApp[key] === undefined) {
        delete nextApp[key];
      }
    }
    // 60fps live-patch to existing DOM tile
    const tileEl = document.querySelector(`.glansk-tile[data-instance-id="${widget.id}"]`) as HTMLElement | null;
    if (tileEl) {
      applyTileAppearance(
        tileEl,
        { ...widget, config: { ...cfg, appearance: nextApp as unknown as JsonValue } },
        resolvedTheme(doc.theme, doc.background)
      );
    }
    if (commit) {
      setCfg({ appearance: nextApp as unknown as JsonValue });
    }
  };

  const referenceTitle = String(cfg.label || cfg.title || def.title || widget.widgetId);

  // Quick centering helpers
  const centerHorizontally = () => {
    const nextX = Math.max(0, Math.round((doc.logicalSize.width - g.width) / 2));
    gset({ x: nextX });
  };
  const centerVertically = () => {
    const nextY = Math.max(0, Math.round((doc.logicalSize.height - g.height) / 2));
    gset({ y: nextY });
  };

  // Quick core theme swatches for 1-click binding in custom mode
  const coreThemeTokens = [
    { key: "--canvas-accent", label: "Accent 1" },
    { key: "--canvas-accent-2", label: "Accent 2" },
    { key: "--canvas-accent-3", label: "Accent 3" },
    { key: "--canvas-text", label: "Text" },
    { key: "--canvas-surface", label: "Surface" },
    { key: "--canvas-positive", label: "Positive" },
    { key: "--canvas-warning", label: "Warning" },
    { key: "--canvas-danger", label: "Danger" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ================= HEADER ================= */}
      <div className="px-3.5 py-2.5 border-b sticky top-0 z-20 flex items-center justify-between" style={{ background: "var(--panel)", borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: "var(--panel-2)", color: "var(--accent)" }}>
            <Box size={13} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-xs truncate" style={{ color: "var(--ink)" }} title={referenceTitle}>
              {referenceTitle}
            </div>
            <div className="text-[10px] text-[var(--ink-3)] truncate">
              {def.title || widget.widgetId}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {def.aspectRatio && <Pill tone="warn">1:1</Pill>}
          {app.showBoundingBox === false && <Pill tone="neutral">Frameless</Pill>}
          {onSelect && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              title="Deselect widget"
              className="p-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors ml-1"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ================= SEGMENTED TABS ================= */}
      <div className="grid grid-cols-4 border-b text-[11px] font-semibold shrink-0" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>
        {[
          { id: "content", label: "Content", icon: FileText },
          { id: "layout", label: "Layout", icon: Maximize2 },
          { id: "appearance", label: "Style", icon: Palette },
          { id: "json", label: "JSON", icon: Code },
        ].map(t => {
          const sel = t.id === activeTab;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center justify-center gap-1.5 py-2 transition-all border-b-2 ${
                sel
                  ? "border-[var(--accent)] text-[var(--accent)] bg-[var(--panel)] font-bold"
                  : "border-transparent text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              <Icon size={12} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB BODY ================= */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 min-h-0">
        {/* ================= TAB 1: CONTENT ================= */}
        {activeTab === "content" && (
          <div className="space-y-3.5">
            <Field label="Widget Reference Title" hint="Used for editor identification only — not rendered on widget">
              <TextInput
                value={strVal("label") || strVal("title")}
                onChange={e => setCfg({ label: e.target.value })}
                placeholder={def.title || widget.widgetId}
              />
            </Field>

            {def.configSchema && def.configSchema.length > 0 ? (
              <SchemaFields
                schema={def.configSchema}
                config={cfg}
                onChange={patch => setCfg(patch)}
                vaultKeys={vaultKeys}
              />
            ) : (
              <>
                {/* Interactive Widget State Storage Mode */}
                {["quick-notes", "music-player", "device-switchboard", "task-matrix"].includes(widget.widgetId) && (
                  <Field
                label="State Storage Mode"
                hint={
                  (strVal("stateMode") || (widget.widgetId === "quick-notes" ? "cookie" : "global")) === "global"
                    ? "Global: Shared in real-time across all kiosk screens and separate browser windows."
                    : (strVal("stateMode") || (widget.widgetId === "quick-notes" ? "cookie" : "global")) === "cookie"
                    ? "Cookie-based: Stored on the server, indexed by user cookie (unique and private per visitor)."
                    : "Stateless: Ephemeral in-memory state that resets on refresh."
                }
              >
                <Select
                  value={strVal("stateMode") || (widget.widgetId === "quick-notes" ? "cookie" : "global")}
                  onChange={e => setCfg({ stateMode: e.target.value })}
                >
                  <option value="global">🌐 Global (Synced Across All Screens)</option>
                  <option value="cookie">🍪 Cookie-based (Server-Saved Personal)</option>
                  <option value="stateless">⚡ Stateless (Ephemeral Session)</option>
                </Select>
              </Field>
            )}

            {/* Specialized: Quick Notes */}
            {widget.widgetId === "quick-notes" && (
              <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
                <Field label="Note Title">
                  <TextInput
                    value={strVal("title") || "Quick Notes"}
                    onChange={e => setCfg({ title: e.target.value })}
                    placeholder="Quick Notes"
                  />
                </Field>
                <Field label="Note Tag Color">
                  <Select
                    value={strVal("colorTag") || "amber"}
                    onChange={e => setCfg({ colorTag: e.target.value })}
                  >
                    <option value="amber">Amber / Warm Glow</option>
                    <option value="cyan">Cyan / Neon Blue</option>
                    <option value="emerald">Emerald / Mint Green</option>
                    <option value="purple">Purple / Cyber Violet</option>
                    <option value="rose">Rose / Sunset Crimson</option>
                  </Select>
                </Field>
                <Field label="Default / Initial Note Text">
                  <textarea
                    rows={4}
                    value={strVal("text")}
                    onChange={e => setCfg({ text: e.target.value })}
                    placeholder="Type initial note..."
                    className="w-full text-xs p-2 rounded border resize-none"
                    style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink)" }}
                  />
                </Field>
              </div>
            )}

            {"value" in cfg && (
              <Field label="Primary Value">
                <TextInput value={strVal("value")} onChange={e => setCfg({ value: e.target.value })} placeholder="e.g. 84.2K" />
              </Field>
            )}

            {"detail" in cfg && (
              <Field label="Subtitle / Detail">
                <TextInput value={strVal("detail")} onChange={e => setCfg({ detail: e.target.value })} placeholder="e.g. Healthy trajectory" />
              </Field>
            )}

            {"trend" in cfg && (
              <Field label="Trend Indicator">
                <TextInput value={strVal("trend")} onChange={e => setCfg({ trend: e.target.value })} placeholder="e.g. +12.4%" />
              </Field>
            )}

            {"text" in cfg && (
              <Field label="Text Content">
                <TextInput value={strVal("text")} onChange={e => setCfg({ text: e.target.value })} />
              </Field>
            )}

            {/* Specialized: Activity Feed */}
            {widget.widgetId === "activity" && Array.isArray(cfg.items) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase" style={{ color: "var(--ink-3)" }}>Feed Items</span>
                  <button
                    type="button"
                    onClick={() => setCfg({ items: [...(cfg.items as string[]), "New notification"] })}
                    className="text-[11px] text-[var(--accent)] font-semibold hover:underline"
                  >
                    + Add item
                  </button>
                </div>
                {(cfg.items as string[]).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <TextInput
                      value={item}
                      onChange={e => {
                        const next = [...(cfg.items as string[])];
                        next[idx] = e.target.value;
                        setCfg({ items: next });
                      }}
                      className="text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (cfg.items as string[]).filter((_, i) => i !== idx);
                        setCfg({ items: next });
                      }}
                      className="text-[var(--danger)] hover:opacity-100 opacity-60 p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Specialized: Charts Data Series */}
            {(widget.widgetId === "bar-chart" || widget.widgetId === "line-chart") && Array.isArray(cfg.values) && (
              <Field label="Data Series (0 - 100)" hint="Comma-separated percentage values for chart bars or sparkline">
                <TextInput
                  value={(cfg.values as number[]).join(", ")}
                  onChange={e => {
                    const vals = e.target.value.split(",").map(v => parseInt(v.trim(), 10)).filter(v => Number.isFinite(v));
                    setCfg({ values: vals });
                  }}
                />
              </Field>
            )}

            {/* Specialized: Gauge / Donut / Progress */}
            {(widget.widgetId === "gauge" || widget.widgetId === "donut-chart" || widget.widgetId === "progress") && (
              <Field label="Percentage Value" hint={`${num(strVal("value"), 0)}%`}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={num(strVal("value"), 0)}
                    onChange={e => setCfg({ value: num(e.target.value, 0) })}
                    className="flex-1 accent-[var(--accent)]"
                  />
                  <TextInput
                    type="number"
                    min={0}
                    max={100}
                    value={strVal("value")}
                    onChange={e => setCfg({ value: num(e.target.value, 0) })}
                    className="w-16 text-xs"
                  />
                </div>
              </Field>
            )}

            {/* Specialized: System Panel */}
            {widget.widgetId === "system" && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] px-0.5">System Metrics</span>
                <div className="p-2.5 rounded-lg border space-y-2 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="CPU"><TextInput value={strVal("cpu")} onChange={e => setCfg({ cpu: e.target.value })} /></Field>
                    <Field label="Memory"><TextInput value={strVal("memory")} onChange={e => setCfg({ memory: e.target.value })} /></Field>
                    <Field label="Disk"><TextInput value={strVal("disk")} onChange={e => setCfg({ disk: e.target.value })} /></Field>
                    <Field label="Network"><TextInput value={strVal("network")} onChange={e => setCfg({ network: e.target.value })} /></Field>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )}

        {/* ================= TAB 2: LAYOUT & SIZING ================= */}
        {activeTab === "layout" && (
          <div className="space-y-4">
            {/* Position & Dimensions Grid */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Geometry & Alignment</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={centerHorizontally}
                    title="Center Horizontally on Canvas"
                    className="p-1 rounded hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  >
                    <AlignCenterHorizontal size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={centerVertically}
                    title="Center Vertically on Canvas"
                    className="p-1 rounded hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  >
                    <AlignCenterVertical size={13} />
                  </button>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border space-y-2.5 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                {/* 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">X Position</label>
                    <TextInput
                      type="number"
                      value={g.x}
                      onChange={e => gset({ x: num(e.target.value, g.x) })}
                      className="text-xs font-mono shadow-sm"
                      style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Y Position</label>
                    <TextInput
                      type="number"
                      value={g.y}
                      onChange={e => gset({ y: num(e.target.value, g.y) })}
                      className="text-xs font-mono shadow-sm"
                      style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Width (W)</label>
                    <TextInput
                      type="number"
                      value={g.width}
                      onChange={e => {
                        const w = Math.max(def.minWidth, num(e.target.value, g.width));
                        const h = def.aspectRatio ? Math.round(w / def.aspectRatio) : g.height;
                        gset({ width: w, height: h });
                      }}
                      className="text-xs font-mono shadow-sm"
                      style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] uppercase block mb-1">Height (H)</label>
                    <TextInput
                      type="number"
                      value={g.height}
                      onChange={e => {
                        const h = Math.max(def.minHeight, num(e.target.value, g.height));
                        const w = def.aspectRatio ? Math.round(h * def.aspectRatio) : g.width;
                        gset({ width: w, height: h });
                      }}
                      className="text-xs font-mono shadow-sm"
                      style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
                    />
                  </div>
                </div>

                {def.aspectRatio && (
                  <div className="text-[10px] text-[var(--warning)] flex items-center gap-1 pt-0.5">
                    <Pill tone="warn">1:1 Locked</Pill> Ratio locked by widget definition
                  </div>
                )}
              </div>
            </div>

            {/* Card Bounding Box Quick Toggle */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] px-0.5">Container Frame</span>
              <div className="p-2.5 rounded-lg border bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-[var(--ink)]">Card Bounding Box</div>
                    <div className="text-[10px] text-[var(--ink-3)]">
                      {app.showBoundingBox !== false ? "Visible card frame (border, background, shadow)" : "Frameless (widget floats on canvas wallpaper)"}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={app.showBoundingBox !== false}
                    onChange={e => setApp({ showBoundingBox: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                  />
                </label>
              </div>
            </div>

            {/* Widget Padding Control */}
            <SpacingControl
              label="Widget Padding"
              value={app.padding}
              onChange={val => setApp({ padding: val }, false)}
              onCommit={val => setApp({ padding: val }, true)}
              onReset={() => setApp({ padding: undefined }, true)}
              fallback={app.showBoundingBox === false ? 0 : 12}
            />

            {/* Font Scaling */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                <span>Font Scaling</span>
                <span className="font-mono text-[10px] text-[var(--ink-2)]">{(app.fontScale ?? 1).toFixed(2)}x</span>
              </div>
              <div className="p-2.5 rounded-lg border bg-[var(--panel-2)] shadow-sm flex items-center" style={{ borderColor: "var(--line)" }}>
                <input
                  type="range"
                  min={0.75}
                  max={1.5}
                  step={0.05}
                  value={app.fontScale ?? 1}
                  onChange={e => setApp({ fontScale: parseFloat(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: APPEARANCE & STYLING ================= */}
        {activeTab === "appearance" && (
          <div className="space-y-3.5">
            {isPackaged ? (
              <div className="p-3 rounded-lg border text-xs space-y-1.5 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                <p className="font-semibold text-[var(--ink)]">Packaged Sandbox Widget</p>
                <p className="text-[11px] text-[var(--ink-3)]">
                  This widget runs inside an isolated iframe sandbox and controls its own internal canvas, styles, and rendering. Universal container overrides are disabled.
                </p>
              </div>
            ) : (
              <>
                {/* Card Bounding Box & Frame Settings */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] px-0.5">Container Frame & Radius</span>
                  <div className="p-3 rounded-lg border space-y-3 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">Card Bounding Box</div>
                        <div className="text-[10px] text-[var(--ink-3)]">
                          {app.showBoundingBox !== false ? "Card frame enabled (surface, border, shadow)" : "Frameless mode (floats directly on wallpaper)"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={app.showBoundingBox !== false}
                        onChange={e => setApp({ showBoundingBox: e.target.checked })}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                    </label>

                    {app.showBoundingBox === false ? (
                      <div className="p-2 rounded bg-[var(--panel)] border text-[11px] text-[var(--ink-3)]" style={{ borderColor: "var(--line)" }}>
                        💡 <b>Frameless mode active:</b> Widget renders directly on wallpaper with zero frame or container background.
                      </div>
                    ) : (
                      <div className="space-y-3 pt-2.5 border-t" style={{ borderColor: "var(--line)" }}>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                          <input
                            type="checkbox"
                            checked={!!app.transparentBg}
                            onChange={e => setApp({ transparentBg: e.target.checked })}
                            className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                          />
                          Transparent Card Background
                        </label>

                        {/* 4-Corner Radius Control */}
                        <CornerRadiusControl
                          label="Corner Radius"
                          value={app.borderRadius}
                          onChange={val => setApp({ borderRadius: val }, false)}
                          onCommit={val => setApp({ borderRadius: val }, true)}
                          onReset={() => setApp({ borderRadius: undefined }, true)}
                          fallback={16}
                        />

                        {/* Border Width & Style */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <Field label="Border Width" hint={`${app.borderWidth ?? 1}px`}>
                            <input
                              type="range"
                              min={0}
                              max={6}
                              value={app.borderWidth ?? 1}
                              onChange={e => setApp({ borderWidth: parseInt(e.target.value, 10) })}
                              className="w-full accent-[var(--accent)]"
                            />
                          </Field>
                          <Field label="Border Style">
                            <select
                              value={app.borderStyle || "solid"}
                              onChange={e => setApp({ borderStyle: e.target.value as any })}
                              className="w-full h-7 px-2 rounded text-xs border text-[var(--ink)] cursor-pointer shadow-sm"
                              style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
                            >
                              <option value="solid">Solid</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                              <option value="none">None</option>
                            </select>
                          </Field>
                        </div>

                        {/* Border Color */}
                        <ThemeColorPickerControl
                          label="Border Color"
                          value={app.borderColor || "--canvas-border"}
                          defaultToken="--canvas-border"
                          onChange={cfg => setApp({ borderColor: cfg.value })}
                          onReset={() => setApp({ borderColor: undefined })}
                        />

                        {/* Background Media Picker */}
                        <MediaPickerControl
                          label="Background Media"
                          value={app.background}
                          onChange={bg => setApp({ background: bg })}
                          onReset={() => setApp({ background: undefined })}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 4-Way Padding Control */}
                <SpacingControl
                  label="Widget Padding"
                  value={app.padding}
                  onChange={val => setApp({ padding: val }, false)}
                  onCommit={val => setApp({ padding: val }, true)}
                  onReset={() => setApp({ padding: undefined }, true)}
                  fallback={app.showBoundingBox === false ? 0 : 12}
                />

                {/* Typography Control */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] px-0.5">Typography & Scale</span>
                  <div className="p-3 rounded-lg border space-y-3 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                    <TypographyControl
                      label="Text Typography"
                      value={app.typography?.primary}
                      onChange={(val: any) => setApp({ typography: { ...app.typography, primary: val } })}
                      onReset={() => setApp({ typography: undefined })}
                    />
                    <Field label="Font Scaling" hint={`Scale: ${(app.fontScale ?? 1).toFixed(2)}x`}>
                      <input
                        type="range"
                        min={0.75}
                        max={1.5}
                        step={0.05}
                        value={app.fontScale ?? 1}
                        onChange={e => setApp({ fontScale: parseFloat(e.target.value) })}
                        className="w-full accent-[var(--accent)]"
                      />
                    </Field>
                  </div>
                </div>

                {/* Follow Canvas Theme Toggle */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)] px-0.5">Color System</span>
                  <div className="p-3 rounded-lg border bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-[var(--ink)]">Follow Canvas Theme</div>
                        <div className="text-[10px] text-[var(--ink-3)]">
                          {followCanvasTheme ? "Colors inherit from active theme" : "Custom color slots enabled"}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={followCanvasTheme}
                        onChange={e => setApp({ followCanvasTheme: e.target.checked })}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                    </label>
                  </div>
                </div>

                {/* Theme Bindings or Custom Slots */}
                {followCanvasTheme ? (
                  <div className="space-y-2 p-3 rounded-lg border text-xs text-[var(--ink-2)] bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                        <Sparkles size={14} className="text-[var(--accent)]" /> Theme Bindings
                      </p>
                      <Button variant="ghost" className="text-[10px] py-0.5 px-2" onClick={() => setApp({ followCanvasTheme: false })}>
                        Customize Colors
                      </Button>
                    </div>
                    <p className="text-[11px] text-[var(--ink-3)]">This widget inherits its styling from the canvas theme palette:</p>
                    <div className="space-y-1.5 pt-1">
                      {def.colorSlots.map(slot => (
                        <div key={slot.key} className="flex items-center justify-between text-[11px] py-0.5">
                          <span className="text-[var(--ink-2)]">{slot.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono opacity-70">{slot.defaultThemeToken.replace("--canvas-", "")}</span>
                            <span className="w-3.5 h-3.5 rounded-full border shadow-inner shrink-0" style={{ background: canvasTheme[slot.defaultThemeToken] || "#ffffff", borderColor: "var(--line-2)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 animate-fade-in">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
                          Declared Color Slots
                        </span>
                        <button
                          type="button"
                          onClick={() => setApp({ slots: {} })}
                          className="text-[10px] text-[var(--accent)] flex items-center gap-1 hover:underline font-semibold"
                        >
                          <RotateCcw size={10} /> Reset slots
                        </button>
                      </div>

                      {def.colorSlots.map(slot => {
                        const currentSlotCfg = app.slots?.[slot.key] || { mode: "theme", value: slot.defaultThemeToken };
                        return (
                          <div key={slot.key} className="p-2.5 rounded-lg border space-y-2 bg-[var(--panel-2)] shadow-sm" style={{ borderColor: "var(--line)" }}>
                            <ThemeColorPickerControl
                              label={slot.label}
                              value={currentSlotCfg}
                              defaultToken={slot.defaultThemeToken}
                              onChange={nextCfg => {
                                const nextSlots = { ...(app.slots || {}) };
                                nextSlots[slot.key] = nextCfg;
                                setApp({ slots: nextSlots });
                              }}
                              onReset={() => {
                                const nextSlots = { ...(app.slots || {}) };
                                delete nextSlots[slot.key];
                                setApp({ slots: nextSlots });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ================= TAB 4: ADVANCED JSON ================= */}
        {activeTab === "json" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--ink-3)] uppercase">JSON Scope</span>
              <div className="flex rounded border text-[10px] overflow-hidden" style={{ borderColor: "var(--line)" }}>
                <button
                  type="button"
                  onClick={() => setJsonScope("config")}
                  className={`px-2 py-0.5 font-semibold ${jsonScope === "config" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--panel-2)] text-[var(--ink-2)]"}`}
                >
                  Config & Styles
                </button>
                <button
                  type="button"
                  onClick={() => setJsonScope("widget")}
                  className={`px-2 py-0.5 font-semibold ${jsonScope === "widget" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--panel-2)] text-[var(--ink-2)]"}`}
                >
                  Full Widget
                </button>
              </div>
            </div>

            <Field
              label={jsonScope === "config" ? "Config (Colors, Font Scale & Sizing)" : "Full Widget Document"}
              hint={jsonErr || "Live bidirectional sync. Edits apply on blur."}
            >
              <textarea
                value={json}
                onFocus={() => setIsEditingJson(true)}
                onChange={e => { setJson(e.target.value); setJsonErr(""); }}
                onBlur={() => {
                  setIsEditingJson(false);
                  handleApplyJson(json);
                }}
                spellCheck={false}
                rows={15}
                className="w-full px-2.5 py-2 font-mono text-[11px] rounded-lg border"
                style={{
                  background: "var(--panel-2)",
                  borderColor: jsonErr ? "var(--danger)" : "var(--line)",
                  lineHeight: "1.4",
                }}
              />
            </Field>

            <div className="flex justify-end pt-1">
              <Button
                variant="subtle"
                className="text-xs"
                onClick={() => handleApplyJson(json)}
              >
                Apply Changes
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ================= PERSISTENT BOTTOM ACTION BAR ================= */}
      <div
        className="p-2.5 border-t shrink-0 flex items-center justify-between gap-1.5"
        style={{ background: "var(--panel)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-1">
          <Button variant="subtle" className="text-xs py-1 px-2" onClick={() => onDuplicate(widget.id)} title="Duplicate widget">
            <Copy size={13} /> Duplicate
          </Button>
          <Button variant="ghost" className="p-1 px-2 text-xs" onClick={() => onReorder(widget.id, "front")} title="Bring to Front">
            <BringToFront size={13} />
          </Button>
          <Button variant="ghost" className="p-1 px-2 text-xs" onClick={() => onReorder(widget.id, "back")} title="Send to Back">
            <SendToBack size={13} />
          </Button>
        </div>
        <Button
          variant="danger"
          className="text-xs py-1 px-2.5 ml-auto"
          onClick={() => onDelete(widget.id)}
          title="Delete widget"
        >
          <Trash2 size={13} /> Delete
        </Button>
      </div>
    </div>
  );
}
