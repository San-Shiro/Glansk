import React, { useState } from "react";
import {
  Sliders,
  Palette,
  Zap,
  SlidersHorizontal,
  Copy,
  Trash2,
  BringToFront,
  SendToBack,
  Eye,
  EyeOff,
  Layers,
  Box,
  PanelRightClose,
  FolderPlus,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { InspectorProps, InspectorTab } from "./types";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import ConfigTab from "./tabs/ConfigTab";
import StyleTab from "./tabs/StyleTab";
import DataTab from "./tabs/DataTab";
import LogicTab from "./tabs/LogicTab";
import CanvasPanel from "./CanvasPanel";
import GroupPanel from "./GroupPanel";
import InspectorErrorBoundary from "./InspectorErrorBoundary";

export default function InspectorRoot(p: InspectorProps) {
  const isMultiSelect = Boolean(p.selectedWidgetIds && p.selectedWidgetIds.length > 1);

  const widget = !isMultiSelect && p.selectedId
    ? p.doc.widgets.find((w) => w.id === p.selectedId) ?? null
    : null;
  const group =
    !isMultiSelect && !widget && p.selectedGroupId
      ? p.doc.groups?.find((g) => g.id === p.selectedGroupId) ?? null
      : null;

  const [activeTab, setActiveTab] = useState<InspectorTab>("config");

  // Query vault keys for secret dropdowns in config schema
  const secretsQ = useQuery({
    queryKey: ["vault-secrets"],
    queryFn: api.listSecrets,
  });
  const vaultKeys = (secretsQ.data ?? []).map((s) => s.id);

  if (!isMultiSelect && !widget && !group) {
    return null;
  }

  if (isMultiSelect) {
    const count = p.selectedWidgetIds!.length;
    return (
      <aside
        className="h-full flex flex-col border-l select-none shrink-0 overflow-hidden"
        style={{ background: "var(--panel)", borderColor: "var(--line)", width: 340 }}
      >
        {/* Header */}
        <div className="p-3 border-b shrink-0 flex items-center justify-between" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded flex items-center justify-center bg-[var(--accent-soft)] text-[var(--accent)]">
              <Layers size={14} />
            </span>
            <div>
              <div className="text-[13px] font-bold" style={{ color: "var(--ink)" }}>Multi-Selection</div>
              <div className="text-[10px] text-[var(--ink-3)] font-mono">{count} widgets selected</div>
            </div>
          </div>
          {p.onCollapse && (
            <button
              onClick={p.onCollapse}
              className="p-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
              title="Collapse Inspector"
            >
              <PanelRightClose size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-[12px]">
          {/* Quick Actions */}
          <div className="p-2.5 rounded-lg border flex flex-col gap-2" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Grouping</div>
            <button
              onClick={() => p.onGroupSelection?.()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md font-semibold text-[12px] bg-[var(--accent)] text-white hover:opacity-90 active:translate-y-px transition-all shadow-xs"
            >
              <FolderPlus size={14} />
              <span>Group Selected ({count} items)</span>
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-black/25">Ctrl+G</kbd>
            </button>
          </div>

          {/* Alignment */}
          <div className="p-2.5 rounded-lg border flex flex-col gap-2" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Alignment</div>
            <div className="grid grid-cols-6 gap-1">
              <button
                onClick={() => p.onAlignSelected?.("left")}
                title="Align Left"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignStartHorizontal size={15} />
              </button>
              <button
                onClick={() => p.onAlignSelected?.("center")}
                title="Align Center"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignCenterHorizontal size={15} />
              </button>
              <button
                onClick={() => p.onAlignSelected?.("right")}
                title="Align Right"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignEndHorizontal size={15} />
              </button>
              <button
                onClick={() => p.onAlignSelected?.("top")}
                title="Align Top"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignStartVertical size={15} />
              </button>
              <button
                onClick={() => p.onAlignSelected?.("middle")}
                title="Align Middle"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignCenterVertical size={15} />
              </button>
              <button
                onClick={() => p.onAlignSelected?.("bottom")}
                title="Align Bottom"
                className="p-1.5 rounded flex items-center justify-center hover:bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] border border-transparent hover:border-[var(--line)] transition-all"
              >
                <AlignEndVertical size={15} />
              </button>
            </div>
          </div>

          {/* Distribution */}
          <div className="p-2.5 rounded-lg border flex flex-col gap-2" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Distribution</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => p.onDistributeSelected?.("horizontal")}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded hover:bg-[var(--panel)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] text-[11px] font-medium transition-colors"
              >
                <AlignHorizontalDistributeCenter size={14} />
                <span>Horizontally</span>
              </button>
              <button
                onClick={() => p.onDistributeSelected?.("vertical")}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded hover:bg-[var(--panel)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] text-[11px] font-medium transition-colors"
              >
                <AlignVerticalDistributeCenter size={14} />
                <span>Vertically</span>
              </button>
            </div>
          </div>

          {/* Bulk Destructive */}
          <div className="pt-2">
            <button
              onClick={() => p.onDeleteSelected?.()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md font-semibold text-[12px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
            >
              <Trash2 size={14} />
              <span>Delete All ({count} items)</span>
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (group) {
    return (
      <aside
        className="h-full flex flex-col border-l select-none shrink-0"
        style={{ background: "var(--panel)", borderColor: "var(--line)", width: 340 }}
      >
        <InspectorErrorBoundary fallbackTitle="Group Panel Error">
          <GroupPanel
            group={group}
            doc={p.doc}
            onUpdateGroupGeometry={p.onUpdateGroupGeometry}
            onUpdateGroup={p.onUpdateGroup}
            onUngroup={p.onUngroup}
            onDelete={p.onDelete}
            onReorder={p.onReorder}
          />
        </InspectorErrorBoundary>
      </aside>
    );
  }

  // Widget selected
  const def = getWidgetDefinition(widget!.widgetId);
  const cfg = widget!.config || {};
  const currentLabel = (cfg.label as string) || def.title || widget!.widgetId;

  const handleRename = (nextLabel: string) => {
    p.onUpdateConfig(widget!.id, {
      ...cfg,
      label: nextLabel,
    });
  };

  const isEnabled = !widget!.disabled;

  const tabs: Array<{ id: InspectorTab; label: string; icon: React.ReactNode }> = [
    { id: "config", label: "Config", icon: <Sliders size={12} /> },
    { id: "style", label: "Style", icon: <Palette size={12} /> },
    { id: "data", label: "Data", icon: <Zap size={12} /> },
    { id: "logic", label: "Logic", icon: <SlidersHorizontal size={12} /> },
  ];

  return (
    <aside
      className="h-full flex flex-col border-l select-none shrink-0 overflow-hidden"
      style={{ background: "var(--panel)", borderColor: "var(--line)", width: 340 }}
    >
      {/* 1. Header Zone: Identity & Quick Actions */}
      <div
        className="p-3 border-b shrink-0 flex flex-col gap-2"
        style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 grid place-items-center rounded bg-[var(--accent-soft)] text-[var(--accent)] shrink-0">
              <Box size={15} />
            </div>
            <div className="min-w-0">
              <input
                type="text"
                value={currentLabel}
                onChange={(e) => handleRename(e.target.value)}
                placeholder="Widget Name"
                className="text-xs font-bold text-[var(--ink)] bg-transparent border-none p-0 focus:ring-0 truncate w-full hover:underline focus:underline cursor-pointer"
                title="Click to rename widget"
              />
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--ink-3)] font-mono">
                <span className="truncate">{widget!.widgetId}</span>
              </div>
            </div>
          </div>

          {/* Quick Header Actions: Duplicate & Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => p.onDuplicate(widget!.id)}
              className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors"
              title="Duplicate (Ctrl+D)"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => p.onDelete(widget!.id)}
              className="p-1 rounded text-[var(--danger)] hover:bg-[var(--danger-soft)] transition-colors"
              title="Delete (Del)"
            >
              <Trash2 size={13} />
            </button>
            {p.onCollapse && (
              <button
                type="button"
                onClick={p.onCollapse}
                className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors border-l pl-1.5 ml-0.5"
                style={{ borderColor: "var(--line)" }}
                title="Collapse Inspector (Shift+I)"
              >
                <PanelRightClose size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Reordering & Enabled Status Pill Bar */}
        <div className="flex items-center justify-between text-xs pt-1 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => p.onReorder(widget!.id, "front")}
              className="p-1 text-[11px] rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)]"
              style={{ borderColor: "var(--line)" }}
              title="Bring to Front"
            >
              <BringToFront size={12} />
            </button>
            <button
              type="button"
              onClick={() => p.onReorder(widget!.id, "back")}
              className="p-1 text-[11px] rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)]"
              style={{ borderColor: "var(--line)" }}
              title="Send to Back"
            >
              <SendToBack size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              p.onUpdateConfig(widget!.id, {
                ...cfg,
                disabled: isEnabled,
              })
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isEnabled
                ? "bg-[var(--ok-soft)] text-[var(--ok)]"
                : "bg-[var(--line-2)] text-[var(--ink-3)]"
            }`}
            title="Toggle widget enabled state"
          >
            {isEnabled ? <Eye size={11} /> : <EyeOff size={11} />}
            <span>{isEnabled ? "Enabled" : "Disabled"}</span>
          </button>
        </div>
      </div>

      {/* 2. Horizontal 4-Tab Navigation Bar */}
      <div
        className="flex items-center border-b shrink-0 px-2 bg-[var(--panel)]"
        style={{ borderColor: "var(--line)" }}
      >
        {tabs.map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium relative transition-colors ${
                isActive
                  ? "text-[var(--accent)] font-semibold"
                  : "text-[var(--ink-2)] hover:text-[var(--ink)]"
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {isActive && (
                <div
                  className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t bg-[var(--accent)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Active Tab Body */}
      <div className="flex-1 overflow-y-auto p-3.5">
        <InspectorErrorBoundary
          resetKey={`${widget?.id}-${activeTab}`}
          fallbackTitle={`${tabs.find((t) => t.id === activeTab)?.label ?? "Tab"} Error`}
        >
          {activeTab === "config" && (
            <ConfigTab
              widget={widget!}
              onUpdateConfig={p.onUpdateConfig}
              vaultKeys={vaultKeys}
            />
          )}
          {activeTab === "style" && (
            <StyleTab
              widget={widget!}
              doc={p.doc}
              onUpdateGeometry={p.onUpdateGeometry}
              onUpdateConfig={p.onUpdateConfig}
            />
          )}
          {activeTab === "data" && (
            <DataTab
              widget={widget!}
              doc={p.doc}
              onUpdateConfig={p.onUpdateConfig}
            />
          )}
          {activeTab === "logic" && (
            <LogicTab
              widget={widget!}
              doc={p.doc}
              onUpdateWidgetVisibility={p.onUpdateWidgetVisibility}
              onUpdateConfig={p.onUpdateConfig}
            />
          )}
        </InspectorErrorBoundary>
      </div>
    </aside>
  );
}
