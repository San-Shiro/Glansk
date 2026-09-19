import React, { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  ChevronDown,
  Plus,
  Save,
  UploadCloud,
  Check,
  ExternalLink,
  ArrowLeft,
  PauseCircle,
  RotateCcw,
  Pencil,
  Play,
  Monitor,
  Trash2,
} from "lucide-react";
import type { CanvasSummary, RuntimeStatus, CanvasVariableDefinition } from "@/lib/types";
import { Spinner } from "@/components/ui";

const CANVAS_SIZE_PRESETS = [
  { label: "1920 × 1080 (16:9 FHD)", w: 1920, h: 1080 },
  { label: "1280 × 720 (16:9 HD)", w: 1280, h: 720 },
  { label: "1024 × 600 (7\" Touch)", w: 1024, h: 600 },
  { label: "800 × 480 (5\" Touch)", w: 800, h: 480 },
  { label: "1080 × 1920 (Portrait)", w: 1080, h: 1920 },
];

interface Props {
  canvases: CanvasSummary[];
  currentId: string | null;
  currentName: string;
  onBack?: () => void;
  onSelectCanvas: (id: string) => void;
  onNewCanvas: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  onZoomFit: () => void;
  dirty: boolean;
  saving: boolean;
  publishing: boolean;
  runtime: RuntimeStatus | undefined;
  onSave: () => void;
  onPublish: () => void;
  onGoLive: () => void;
  onDeactivate?: () => void;
  onRollback?: () => void;
  onDiscardDraft?: () => void;
  onLogout: () => void;
  status: string;
  interactiveMode?: boolean;
  onToggleInteractiveMode?: () => void;
  variables?: Record<string, CanvasVariableDefinition>;
  onUpdateVariables?: (variables: Record<string, CanvasVariableDefinition>) => void;
  logicalSize?: { width: number; height: number };
  onUpdateCanvasSize?: (w: number, h: number) => void;
  onSwitchVersion?: (version: "v1" | "v2") => void;
}

export default function TopBar(p: Props) {
  const [open, setOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [sizeOpen, setSizeOpen] = useState(false);

  const ref = useRef<HTMLDivElement>(null);
  const deployRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);

  // Click outside to dismiss popovers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
      if (deployRef.current && !deployRef.current.contains(target)) setDeployOpen(false);
      if (sizeRef.current && !sizeRef.current.contains(target)) setSizeOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const live = p.runtime?.phase === "ready" && !!p.runtime.activeRevision;
  const currentSize = p.logicalSize || { width: 1920, height: 1080 };
  const currentSizePreset = CANVAS_SIZE_PRESETS.find(
    (s) => s.w === currentSize.width && s.h === currentSize.height
  );

  return (
    <header
      className="flex items-center gap-3 px-3 h-12 border-b shrink-0 select-none text-[13px] z-30"
      style={{ background: "var(--panel)", borderColor: "var(--line)" }}
    >
      {/* 1. Left Zone: Brand / Back & Breadcrumb Canvas Switcher */}
      <div className="flex items-center gap-2">
        {p.onBack ? (
          <button
            type="button"
            onClick={p.onBack}
            title="Back to dashboard projects"
            className="h-7 w-7 grid place-items-center rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
          >
            <ArrowLeft size={15} />
          </button>
        ) : (
          <div className="h-7 w-7 grid place-items-center rounded bg-[var(--accent-soft)] text-[var(--accent)] font-bold">
            <LayoutGrid size={15} />
          </div>
        )}

        <div className="h-4 w-px bg-[var(--line)]" />

        {/* Breadcrumb style Canvas Switcher */}
        <div className="relative" ref={ref}>
          <div className="flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
            <span className="hidden sm:inline">Projects</span>
            <span className="opacity-50">/</span>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 px-2 py-1 rounded font-semibold text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {p.currentName || "Select Canvas"}
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-150 opacity-60 ${open ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {open && (
            <div
              className="absolute left-0 top-full mt-1.5 w-64 border shadow-xl rounded-lg z-50 overflow-hidden animate-fade-in bg-[var(--panel)]"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="max-h-72 overflow-y-auto py-1">
                {p.canvases.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-[var(--ink-3)]">No canvases available</div>
                ) : (
                  p.canvases.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        p.onSelectCanvas(c.id);
                        setOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--panel-2)] transition-colors text-[var(--ink)]"
                    >
                      <span className="truncate">{c.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {c.publishedRevision != null && (
                          <span className="text-[10px] font-mono text-[var(--ink-3)]">
                            r{c.publishedRevision}
                          </span>
                        )}
                        {c.id === p.currentId && <Check size={13} className="text-[var(--accent)]" />}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  p.onNewCanvas();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium border-t hover:bg-[var(--panel-2)] transition-colors text-[var(--accent)]"
                style={{ borderColor: "var(--line)" }}
              >
                <Plus size={13} />
                <span>New canvas</span>
              </button>
            </div>
          )}
        </div>

        {/* v2 Suffix Badge */}
        <span
          className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--accent)] text-white tracking-wider font-mono shadow-sm shrink-0"
          title="Glansk Studio v2 Workstation"
        >
          v2
        </span>

        {/* Version Switcher */}
        {p.onSwitchVersion && (
          <div
            className="flex items-center rounded border text-[11px] overflow-hidden shrink-0 ml-0.5"
            style={{ borderColor: "var(--line)" }}
          >
            <button
              type="button"
              onClick={() => p.onSwitchVersion?.("v1")}
              className="px-2 py-0.5 font-medium text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
              title="Switch to Classic Studio v1"
            >
              v1
            </button>
            <div className="w-px h-3.5 bg-[var(--line)]" />
            <button
              type="button"
              className="px-2 py-0.5 font-bold bg-[var(--accent-soft)] text-[var(--accent)] cursor-default"
              title="Currently using Studio v2"
            >
              v2
            </button>
          </div>
        )}
      </div>

      {/* Center Spacer */}
      <div className="flex-1" />

      {/* 2. Center Zone: Canvas Resolution Presets Pill */}
      {p.onUpdateCanvasSize && (
        <div className="relative hidden md:block" ref={sizeRef}>
          <button
            type="button"
            onClick={() => setSizeOpen((o) => !o)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-3)] transition-colors"
            style={{ borderColor: "var(--line)" }}
            title="Canvas resolution preset"
          >
            <Monitor size={12} className="text-[var(--ink-3)]" />
            <span className="font-mono">
              {currentSizePreset ? `${currentSizePreset.w} × ${currentSizePreset.h}` : `${currentSize.width} × ${currentSize.height}`}
            </span>
            <ChevronDown
              size={11}
              className={`transition-transform duration-150 opacity-60 ${sizeOpen ? "rotate-180" : ""}`}
            />
          </button>

          {sizeOpen && (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-60 border shadow-xl rounded-lg z-50 overflow-hidden animate-fade-in bg-[var(--panel)] py-1"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">
                Resolution Presets
              </div>
              {CANVAS_SIZE_PRESETS.map((sz) => (
                <button
                  key={`${sz.w}x${sz.h}`}
                  type="button"
                  onClick={() => {
                    p.onUpdateCanvasSize?.(sz.w, sz.h);
                    setSizeOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-[var(--panel-2)] transition-colors text-[var(--ink)]"
                >
                  <span>{sz.label}</span>
                  {sz.w === currentSize.width && sz.h === currentSize.height && (
                    <Check size={12} className="text-[var(--accent)]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Right Spacer */}
      <div className="flex-1" />

      {/* 3. Right Zone: Mode Switcher, Display Link & Deploy */}
      <div className="flex items-center gap-2">
        {/* Segmented Mode Switcher: [ ✏️ Edit | 👁️ Preview ] */}
        {p.onToggleInteractiveMode && (
          <div
            className="flex items-center rounded-md p-0.5 border bg-[var(--panel-2)]"
            style={{ borderColor: "var(--line)" }}
          >
            <button
              type="button"
              onClick={() => {
                if (p.interactiveMode) p.onToggleInteractiveMode?.();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all ${
                !p.interactiveMode
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-xs font-semibold"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
              title="Design & structure mode"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (!p.interactiveMode) p.onToggleInteractiveMode?.();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-all ${
                p.interactiveMode
                  ? "bg-[var(--panel)] text-[var(--accent)] shadow-xs font-semibold"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
              title="Interactive preview mode"
            >
              <Play size={12} />
              <span>Preview</span>
            </button>
          </div>
        )}

        {/* Kiosk Display Link (Icon-only) */}
        <a
          href={p.currentId ? `/kiosk/${p.currentId}` : "/kiosk/"}
          target="_blank"
          rel="noreferrer"
          title="Open live kiosk display in a new tab"
          className="h-7 w-7 grid place-items-center rounded text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
        >
          <ExternalLink size={14} />
        </a>

        {/* Primary Deploy Split Button (Compacted, no rXX) */}
        <div className="relative" ref={deployRef}>
          <div className="flex items-center">
            <button
              type="button"
              onClick={p.onGoLive}
              disabled={!p.currentId || p.saving || p.publishing}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-l transition-all shadow-xs ${
                p.dirty
                  ? "bg-[var(--accent)] text-white hover:brightness-105"
                  : "bg-[var(--panel-2)] text-[var(--ink)] border-y border-l border-[var(--line)] hover:bg-[var(--panel-3)]"
              }`}
              title="Save, publish revision, and activate on live kiosks"
            >
              {p.saving || p.publishing ? (
                <Spinner size={12} />
              ) : (
                <UploadCloud size={13} />
              )}
              <span>
                {p.saving
                  ? "Saving..."
                  : p.publishing
                  ? "Publishing..."
                  : p.dirty
                  ? "Deploy Changes"
                  : "Deploy"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDeployOpen((o) => !o)}
              disabled={!p.currentId || p.saving || p.publishing}
              className={`px-1 py-1 text-xs rounded-r border-y border-r transition-all ${
                p.dirty
                  ? "bg-[var(--accent)] text-white border-l border-white/20 hover:brightness-105"
                  : "bg-[var(--panel-2)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--panel-3)]"
              }`}
              title="Deployment options"
            >
              <ChevronDown
                size={12}
                className={`transition-transform duration-150 ${deployOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {deployOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-64 border shadow-xl rounded-lg z-50 overflow-hidden animate-fade-in divide-y bg-[var(--panel)]"
              style={{ borderColor: "var(--line)" }}
            >
              {/* Option 1: Save Draft */}
              <button
                type="button"
                onClick={() => {
                  p.onSave();
                  setDeployOpen(false);
                }}
                disabled={p.saving || !p.dirty}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-[var(--panel-2)] disabled:opacity-40 text-[var(--ink)]"
              >
                <span className="flex items-center gap-2">
                  <Save size={13} className="text-[var(--accent)]" />
                  <span>Save Draft</span>
                </span>
                <span className="text-[10px] text-[var(--ink-3)] font-mono">Ctrl+S</span>
              </button>

              {/* Option 2: Publish Snapshot */}
              <button
                type="button"
                onClick={() => {
                  p.onPublish();
                  setDeployOpen(false);
                }}
                disabled={p.publishing}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-[var(--panel-2)] disabled:opacity-40 text-[var(--ink)]"
              >
                <span className="flex items-center gap-2">
                  <UploadCloud size={13} className="text-[var(--accent)]" />
                  <span>Publish Snapshot</span>
                </span>
              </button>

              {/* Option 3: Rollback */}
              {p.onRollback && (
                <button
                  type="button"
                  onClick={() => {
                    p.onRollback?.();
                    setDeployOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--panel-2)] text-[var(--ink)]"
                >
                  <RotateCcw size={13} className="text-[var(--ink-3)]" />
                  <span>Rollback to Prior Revision</span>
                </button>
              )}

              {/* Option 4: Discard Draft */}
              {p.dirty && p.onDiscardDraft && (
                <button
                  type="button"
                  onClick={() => {
                    p.onDiscardDraft?.();
                    setDeployOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--panel-2)] text-[var(--danger)]"
                >
                  <Trash2 size={13} />
                  <span>Discard Draft Edits</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
