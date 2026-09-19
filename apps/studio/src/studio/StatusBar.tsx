import React from "react";
import {
  Check,
  AlertTriangle,
  Radio,
  Sliders,
  Loader2,
  Tv,
} from "lucide-react";
import { GLANSK_VERSION } from "@glansk/shared";
import type { RuntimeStatus } from "@/lib/types";

interface StatusBarProps {
  dirty: boolean;
  saving: boolean;
  saveError?: string | null;
  runtime?: RuntimeStatus;
  logicalSize?: { width: number; height: number };
  canvasName?: string;
  selectedWidgetId: string | null;
  selectedWidgetLabel?: string;
  inspectorSuppressed: boolean;
  onToggleInspector?: () => void;
  onOpenEvents?: () => void;
  issuesCount?: number;
}

export default function StatusBar({
  dirty,
  saving,
  saveError,
  runtime,
  logicalSize,
  canvasName,
  selectedWidgetId,
  selectedWidgetLabel,
  inspectorSuppressed,
  onToggleInspector,
  onOpenEvents,
  issuesCount = 0,
}: StatusBarProps) {
  const isLive = runtime?.phase === "ready" && !!runtime?.activeRevision;
  const activeRev = runtime?.activeRevision;

  return (
    <footer
      className="h-7 border-t flex items-center justify-between px-3 text-[11px] font-medium select-none shrink-0 z-20"
      style={{
        background: "var(--panel)",
        borderColor: "var(--line)",
        color: "var(--ink-2)",
      }}
    >
      {/* Left: Save & Draft Status */}
      <div className="flex items-center gap-2 min-w-0">
        {saveError ? (
          <span className="flex items-center gap-1.5 text-[var(--danger)] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[var(--danger)]" />
            <span>Save Failed</span>
          </span>
        ) : saving ? (
          <span className="flex items-center gap-1.5 text-[var(--ink-3)]">
            <Loader2 size={11} className="animate-spin text-[var(--accent)]" />
            <span>Saving draft...</span>
          </span>
        ) : dirty ? (
          <span
            className="flex items-center gap-1.5 text-[var(--ink)] font-semibold cursor-pointer"
            title="Unsaved changes in draft (auto-saves in ~2.5s or press Ctrl+S)"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--warn)] animate-pulse" />
            <span>Edited (Unsaved)</span>
          </span>
        ) : (
          <span
            className="flex items-center gap-1.5 text-[var(--ink-3)]"
            title="Draft is fully synchronized with backend storage"
          >
            <Check size={11} className="text-[var(--ok)]" />
            <span>Draft saved</span>
          </span>
        )}

        <div className="h-3 w-px bg-[var(--line)] mx-1" />

        {/* Glansk Version Token */}
        <span className="text-[10px] text-[var(--accent)] font-mono font-bold" title="Glansk Platform Version">
          v{GLANSK_VERSION}
        </span>

        {/* Canvas Resolution & Name */}
        {logicalSize && (
          <span className="text-[10px] text-[var(--ink-3)] font-mono truncate">
            {logicalSize.width} × {logicalSize.height}
            {canvasName ? ` • ${canvasName}` : ""}
          </span>
        )}
      </div>

      {/* Center: Selected Widget Status / Inspector Callout */}
      <div className="hidden md:flex items-center gap-2">
        {selectedWidgetId ? (
          <button
            type="button"
            onClick={onToggleInspector}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] hover:bg-[var(--panel-2)] transition-colors border"
            style={{
              borderColor: inspectorSuppressed ? "var(--accent)" : "var(--line)",
              color: inspectorSuppressed ? "var(--accent)" : "var(--ink-2)",
              background: inspectorSuppressed ? "var(--accent-soft)" : "transparent",
            }}
            title={inspectorSuppressed ? "Inspector is collapsed — click to expand" : "Click to collapse Inspector"}
          >
            <Sliders size={10} />
            <span className="font-semibold truncate max-w-[160px]">
              {selectedWidgetLabel || selectedWidgetId}
            </span>
            <span className="opacity-60 text-[9px]">
              {inspectorSuppressed ? "[Click to Open]" : "[Visible]"}
            </span>
          </button>
        ) : (
          <span className="text-[10px] text-[var(--ink-3)] italic">
            No widget selected (Inspector hidden)
          </span>
        )}
      </div>

      {/* Right: Runtime Revision & Diagnostics */}
      <div className="flex items-center gap-2">
        {/* Published Revision Pill */}
        {activeRev != null ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
              isLive
                ? "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]"
                : "bg-[var(--panel-2)] text-[var(--warn)] border-[var(--line)]"
            }`}
            title={isLive ? "Active Live Broadcast to Kiosk" : "Standby (Not broadcasting)"}
          >
            <Tv size={10} />
            <span>r{activeRev}</span>
            <span className="text-[9px] opacity-80 uppercase tracking-tight">
              {isLive ? "Live" : "Standby"}
            </span>
          </span>
        ) : (
          <span
            className="text-[10px] text-[var(--ink-3)] font-mono"
            title="Canvas draft has not yet been published to kiosks"
          >
            Draft Only
          </span>
        )}

        <div className="h-3 w-px bg-[var(--line)] mx-1" />

        {/* Diagnostics & Event Bus Pill */}
        <button
          type="button"
          onClick={onOpenEvents}
          className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-[var(--panel-2)] transition-colors"
          title="Click to open Realtime Event Bus & Diagnostics in left drawer"
        >
          {issuesCount > 0 ? (
            <span className="flex items-center gap-1 text-[var(--warn)] font-bold">
              <AlertTriangle size={11} />
              <span>{issuesCount} Warnings</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[var(--ok)]">
              <Radio size={11} className="text-[var(--accent)]" />
              <span>Events & Signals</span>
            </span>
          )}
        </button>
      </div>
    </footer>
  );
}
