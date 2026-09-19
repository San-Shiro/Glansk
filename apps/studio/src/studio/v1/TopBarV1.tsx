import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  ChevronDown,
  Plus,
  Minus,
  Maximize,
  Save,
  UploadCloud,
  Radio,
  Check,
  ExternalLink,
  LogOut,
  ArrowLeft,
  Zap,
  PauseCircle,
  Undo2,
  RotateCcw,
  Pencil,
  Play,
  Sliders,
} from "lucide-react";
import type { CanvasSummary, RuntimeStatus, CanvasVariableDefinition } from "@/lib/types";
import { Spinner } from "@/components/ui";
import SignalsDrawer from "../SignalsDrawer";
import VariablesDrawer from "../VariablesDrawer";

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
  onSwitchVersion?: (version: "v1" | "v2") => void;
}

export default function TopBar(p: Props) {
  const [open, setOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [sseActive, setSseActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const deployRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let unmounted = false;
    try {
      es = new EventSource("/api/v1/interactive-state/events");
      es.onopen = () => {
        if (!unmounted) setSseActive(true);
      };
      es.onerror = () => {
        if (!unmounted) setSseActive(false);
      };
    } catch {}
    return () => {
      unmounted = true;
      try {
        es?.close();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (deployRef.current && !deployRef.current.contains(e.target as Node)) setDeployOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const live = p.runtime?.phase === "ready" && !!p.runtime.activeRevision;

  return (
    <header
      className="flex items-center gap-3 px-3 h-12 border-b shrink-0 select-none text-[13px]"
      style={{ background: "var(--panel)", borderColor: "var(--line)" }}
    >
      {/* Back to Dashboard / Logo */}
      {p.onBack ? (
        <button
          onClick={p.onBack}
          title="Back to dashboard"
          className="h-7 w-7 grid place-items-center shrink-0 transition-colors hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)]"
          style={{ borderRadius: "var(--radius)" }}
        >
          <ArrowLeft size={15} />
        </button>
      ) : (
        <div
          className="h-7 w-7 grid place-items-center shrink-0"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            borderRadius: "var(--radius)",
          }}
        >
          <LayoutGrid size={15} />
        </div>
      )}

      {/* Subtle separator */}
      <div className="h-4 w-px bg-[var(--line)]" />

      {/* Canvas picker (Breadcrumb style) */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-2 py-1 text-[13px] font-medium transition-colors hover:bg-[var(--panel-2)]"
          style={{ borderRadius: "var(--radius)", color: "var(--ink)" }}
        >
          <span className="font-semibold tracking-tight">{p.currentName || "Select canvas"}</span>
          <ChevronDown
            size={13}
            style={{ color: "var(--ink-3)" }}
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {open && (
          <div
            className="absolute left-0 top-full mt-1.5 w-64 border shadow-xl z-50 animate-fade-in overflow-hidden"
            style={{
              background: "var(--panel)",
              borderColor: "var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <div className="max-h-72 overflow-y-auto py-1">
              {p.canvases.length === 0 && (
                <div className="px-3 py-2 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  No canvases yet
                </div>
              )}
              {p.canvases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    p.onSelectCanvas(c.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-[var(--panel-2)] transition-colors"
                  style={{ color: "var(--ink)" }}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {c.publishedRevision != null && (
                      <span
                        title="Published revision active"
                        className="text-[10px] font-mono text-[var(--ink-3)]"
                      >
                        r{c.publishedRevision}
                      </span>
                    )}
                    {c.id === p.currentId && <Check size={13} style={{ color: "var(--accent)" }} />}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                p.onNewCanvas();
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[12px] font-medium border-t hover:bg-[var(--panel-2)] transition-colors"
              style={{ borderColor: "var(--line)", color: "var(--accent)" }}
            >
              <Plus size={13} /> New canvas
            </button>
          </div>
        )}
      </div>

      {/* Understated Draft Auto-Save indicator */}
      {p.currentId && (
        <div className="hidden sm:flex items-center text-[11px] select-none pl-1">
          {p.saving ? (
            <span className="flex items-center gap-1.5 font-medium text-[var(--ink-3)]">
              <Spinner size={10} />
              <span>Saving draft...</span>
            </span>
          ) : p.dirty ? (
            <span
              className="flex items-center gap-1.5 font-medium text-[var(--ink-2)]"
              title="Edits will auto-save in ~2.5s or press Ctrl+S"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--warn)" }} />
              <span>Edited</span>
            </span>
          ) : (
            <span className="font-medium text-[var(--ink-3)]" title="All edits saved to server draft">
              Saved
            </span>
          )}
        </div>
      )}

      {/* Suffix and Version Switcher */}
      <div className="flex items-center gap-1.5 ml-2">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--line-2)] text-[var(--ink-2)] border border-[var(--line)] uppercase tracking-wider font-mono">
          v1 Classic
        </span>
        {p.onSwitchVersion && (
          <button
            type="button"
            onClick={() => p.onSwitchVersion?.("v2")}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
            title="Switch to Glansk Studio v2 Workstation"
          >
            <span>✨ Switch to Studio v2</span>
          </button>
        )}
      </div>

      {/* Center Spacer */}
      <div className="flex-1" />

      {/* Center Zone: Clean Zoom Segmented Control */}
      <div className="flex items-center bg-[var(--panel-2)] border border-[var(--line)] rounded-md px-1 py-0.5">
        <button
          onClick={() => p.onZoom(Math.max(0.1, p.zoom - 0.1))}
          title="Zoom out"
          className="h-6 w-6 grid place-items-center hover:bg-[var(--panel-3)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors rounded"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={p.onZoomFit}
          title="Reset zoom / fit view"
          className="text-[11px] font-medium tabular-nums px-1.5 min-w-[40px] text-center text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
        >
          {Math.round(p.zoom * 100)}%
        </button>
        <button
          onClick={() => p.onZoom(Math.min(3, p.zoom + 0.1))}
          title="Zoom in"
          className="h-6 w-6 grid place-items-center hover:bg-[var(--panel-3)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors rounded"
        >
          <Plus size={13} />
        </button>
        <div className="h-3 w-px bg-[var(--line)] mx-0.5" />
        <button
          onClick={p.onZoomFit}
          title="Fit canvas to viewport"
          className="h-6 w-6 grid place-items-center hover:bg-[var(--panel-3)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors rounded"
        >
          <Maximize size={12} />
        </button>
      </div>

      {p.status && (
        <span className="hidden xl:inline text-[11px] truncate max-w-xs text-[var(--ink-3)]">
          {p.status}
        </span>
      )}

      {/* Right Spacer */}
      <div className="flex-1" />

      {/* Right Zone: Studio Controls */}
      <div className="flex items-center gap-2">
        {/* Segmented Mode Switcher: [ Edit | Preview ] */}
        {p.onToggleInteractiveMode && (
          <div className="flex items-center bg-[var(--panel-2)] border border-[var(--line)] rounded-md p-0.5">
            <button
              onClick={() => {
                if (p.interactiveMode) p.onToggleInteractiveMode?.();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded transition-all ${
                !p.interactiveMode
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-xs"
                  : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}
              title="Edit canvas structure and widgets"
            >
              <Pencil size={12} />
              <span>Edit</span>
            </button>
            <button
              onClick={() => {
                if (!p.interactiveMode) p.onToggleInteractiveMode?.();
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded transition-all ${
                p.interactiveMode
                  ? "bg-[var(--panel)] text-[var(--accent)] font-semibold shadow-xs"
                  : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
              }`}
              title="Preview interactive widgets live on canvas"
            >
              <Play size={12} />
              <span>Preview</span>
            </button>
          </div>
        )}

        {/* Canvas Variables & Logic Drawer Trigger */}
        <button
          onClick={() => setVariablesOpen((o) => !o)}
          title="Canvas global variables & logic triggers"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded transition-colors ${
            variablesOpen
              ? "bg-[var(--panel-2)] text-[var(--ink)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
          }`}
        >
          <Sliders size={13} className="text-[var(--accent)]" />
          <span className="hidden lg:inline">Variables</span>
          {Object.keys(p.variables || {}).length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] border text-[var(--ink-2)] font-mono leading-none" style={{ borderColor: "var(--line)" }}>
              {Object.keys(p.variables || {}).length}
            </span>
          )}
        </button>

        {/* Signals Drawer Trigger */}
        <button
          onClick={() => setSignalsOpen((o) => !o)}
          title={
            sseActive
              ? "Event Bus connected — open signals drawer"
              : "Event Bus connecting — open signals drawer"
          }
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded transition-colors ${
            signalsOpen
              ? "bg-[var(--panel-2)] text-[var(--ink)]"
              : "text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
          }`}
        >
          <Zap size={13} className={sseActive ? "text-[var(--accent)]" : "text-[var(--ink-3)]"} />
          <span className="hidden lg:inline">Signals</span>
        </button>

        {/* Kiosk Display Link */}
        <a
          href={p.currentId ? `/kiosk/${p.currentId}` : "/kiosk/"}
          target="_blank"
          rel="noreferrer"
          title="Open live kiosk display in a new tab"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
        >
          <ExternalLink size={13} />
          <span className="hidden md:inline">Display</span>
        </a>

        {/* Clean Deploy / Publish Action Button with Dropdown */}
        <div className="relative" ref={deployRef}>
          <button
            onClick={() => setDeployOpen((o) => !o)}
            disabled={!p.currentId || p.saving || p.publishing}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded transition-all shadow-xs ${
              p.dirty
                ? "bg-[var(--accent)] text-white hover:brightness-105"
                : "bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--panel-3)]"
            }`}
            title="Deploy, publish revisions, or manage kiosk broadcast"
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
            {live && !p.dirty && p.runtime?.activeRevision != null && (
              <span className="text-[10px] font-mono opacity-60 ml-0.5">
                r{p.runtime.activeRevision}
              </span>
            )}
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 opacity-70 ${
                deployOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {deployOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-72 border shadow-xl z-50 overflow-hidden animate-fade-in divide-y"
              style={{
                background: "var(--panel)",
                borderColor: "var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              {/* Action 1: Save Draft */}
              <button
                onClick={() => {
                  p.onSave();
                  setDeployOpen(false);
                }}
                disabled={!p.dirty || p.saving}
                className={`w-full flex items-start gap-3 p-3 text-left transition-colors ${
                  !p.dirty
                    ? "opacity-50 cursor-default"
                    : "hover:bg-[var(--panel-2)] cursor-pointer"
                }`}
                style={{ borderColor: "var(--line)" }}
              >
                <div
                  className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                  style={{
                    background: "var(--panel-2)",
                    color: p.dirty ? "var(--accent)" : "var(--ink-3)",
                  }}
                >
                  <Save size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                      Save Draft
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded border"
                      style={{
                        color: "var(--ink-3)",
                        background: "var(--panel-2)",
                        borderColor: "var(--line)",
                      }}
                    >
                      Ctrl+S
                    </span>
                  </div>
                  <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                    {p.dirty
                      ? "Save pending edits immediately"
                      : "Draft is up to date with auto-save"}
                  </p>
                </div>
              </button>

              {/* Action 2: Publish Revision */}
              <button
                onClick={() => {
                  p.onPublish();
                  setDeployOpen(false);
                }}
                disabled={p.publishing}
                className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                style={{ borderColor: "var(--line)" }}
              >
                <div
                  className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                  style={{ background: "var(--panel-2)", color: "var(--accent)" }}
                >
                  <UploadCloud size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                      Publish Revision
                    </span>
                    {p.runtime?.activeRevision != null && (
                      <span className="text-[10px] font-mono" style={{ color: "var(--ink-3)" }}>
                        rev {p.runtime.activeRevision}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                    Create an immutable snapshot of current canvas
                  </p>
                </div>
              </button>

              {/* Action 3: Live Broadcast (Go Live / Take Offline) */}
              {live ? (
                <button
                  onClick={() => {
                    p.onDeactivate?.();
                    setDeployOpen(false);
                  }}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div
                    className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                    style={{ background: "var(--panel-2)", color: "var(--warn)" }}
                  >
                    <PauseCircle size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                        Take Offline
                      </span>
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded border"
                        style={{
                          color: "var(--warn)",
                          background: "var(--panel-2)",
                          borderColor: "var(--line)",
                        }}
                      >
                        STANDBY
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                      Pause live broadcast to kiosk displays
                    </p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => {
                    p.onGoLive();
                    setDeployOpen(false);
                  }}
                  disabled={p.publishing}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div
                    className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                    style={{ background: "var(--panel-2)", color: "var(--accent)" }}
                  >
                    <Radio size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                        Go Live on Display
                      </span>
                      <span
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: "var(--accent)",
                          background: "var(--accent-soft)",
                        }}
                      >
                        BROADCAST
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                      Deploy and stream active canvas to kiosks
                    </p>
                  </div>
                </button>
              )}

              {/* Action 4: Rollback Revision */}
              {p.runtime?.lastKnownGoodRevision != null &&
                p.runtime.lastKnownGoodRevision !== p.runtime.activeRevision && (
                  <button
                    onClick={() => {
                      p.onRollback?.();
                      setDeployOpen(false);
                    }}
                    className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <div
                      className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                      style={{ background: "var(--panel-2)", color: "var(--warn)" }}
                    >
                      <Undo2 size={13} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold" style={{ color: "var(--ink)" }}>
                          Rollback Runtime
                        </span>
                        <span className="text-[10px] font-mono text-[var(--ink-3)]">
                          r{p.runtime.lastKnownGoodRevision}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                        Revert live kiosk to last known good revision
                      </p>
                    </div>
                  </button>
                )}

              {/* Action 5: Discard working draft changes */}
              {p.dirty && p.onDiscardDraft && (
                <button
                  onClick={() => {
                    p.onDiscardDraft?.();
                    setDeployOpen(false);
                  }}
                  className="w-full flex items-start gap-3 p-3 text-left hover:bg-[var(--panel-2)] transition-colors cursor-pointer"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div
                    className="w-7 h-7 rounded grid place-items-center shrink-0 mt-0.5"
                    style={{ background: "var(--panel-2)", color: "var(--danger)" }}
                  >
                    <RotateCcw size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold" style={{ color: "var(--danger)" }}>
                      Discard Draft Edits
                    </span>
                    <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--ink-3)" }}>
                      Reset editor back to last saved revision
                    </p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          onClick={p.onLogout}
          title="Sign out"
          className="h-7 w-7 grid place-items-center text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors rounded"
        >
          <LogOut size={14} />
        </button>
      </div>

      <SignalsDrawer open={signalsOpen} onClose={() => setSignalsOpen(false)} />
      <VariablesDrawer
        open={variablesOpen}
        onClose={() => setVariablesOpen(false)}
        variables={p.variables}
        onUpdateVariables={p.onUpdateVariables}
      />
    </header>
  );
}

