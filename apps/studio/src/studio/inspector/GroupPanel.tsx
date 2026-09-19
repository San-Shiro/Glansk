import React from "react";
import { Folder, FolderMinus, Trash2, BringToFront, SendToBack, Eye, EyeOff } from "lucide-react";
import type { CanvasGroup, CanvasDocument } from "@/lib/types";
import { AccordionSection } from "@/studio/controls";

interface Props {
  group: CanvasGroup;
  doc: CanvasDocument;
  onUpdateGroupGeometry?: (id: string, g: CanvasGroup["geometry"]) => void;
  onUpdateGroup?: (id: string, patch: Partial<CanvasGroup>) => void;
  onUngroup?: (groupId: string) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, dir: "front" | "back") => void;
}

export default function GroupPanel({
  group,
  doc,
  onUpdateGroupGeometry,
  onUpdateGroup,
  onUngroup,
  onDelete,
  onReorder,
}: Props) {
  const g = group.geometry;
  const childWidgets = doc.widgets.filter((w) => w.groupId === group.id);

  const updateGeometry = (patch: Partial<CanvasGroup["geometry"]>) => {
    onUpdateGroupGeometry?.(group.id, {
      ...g,
      ...patch,
    });
  };

  const isVisible = group.visibility?.defaultVisible !== false;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--panel)]">
      {/* Header */}
      <div
        className="p-3.5 border-b shrink-0 flex items-center justify-between"
        style={{ borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 grid place-items-center rounded bg-[var(--accent-soft)] text-[var(--accent)]">
            <Folder size={15} />
          </div>
          <div>
            <input
              type="text"
              value={group.name}
              onChange={(e) => onUpdateGroup?.(group.id, { name: e.target.value })}
              className="text-xs font-semibold text-[var(--ink)] bg-transparent border-none p-0 focus:ring-0"
            />
            <div className="text-[10px] font-mono text-[var(--ink-3)]">
              {childWidgets.length} member widget{childWidgets.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onUpdateGroup?.(group.id, {
              visibility: { ...group.visibility, defaultVisible: !isVisible },
            })
          }
          className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
          title={isVisible ? "Hide group" : "Show group"}
        >
          {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Geometry */}
        <AccordionSection title="Group Geometry" defaultOpen>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">X Position</label>
              <input
                type="number"
                value={g.x}
                onChange={(e) => updateGeometry({ x: parseInt(e.target.value, 10) || 0 })}
                className="w-full py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Y Position</label>
              <input
                type="number"
                value={g.y}
                onChange={(e) => updateGeometry({ y: parseInt(e.target.value, 10) || 0 })}
                className="w-full py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
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
                className="w-full py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
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
                className="w-full py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                style={{ borderColor: "var(--line)" }}
              />
            </div>
          </div>
        </AccordionSection>

        {/* Member Widgets */}
        <AccordionSection title={`Contained Widgets (${childWidgets.length})`} defaultOpen>
          <div className="space-y-1.5">
            {childWidgets.length === 0 ? (
              <p className="text-xs text-[var(--ink-3)] italic py-1">Empty group container.</p>
            ) : (
              childWidgets.map((cw) => (
                <div
                  key={cw.id}
                  className="flex items-center justify-between p-2 rounded border bg-[var(--panel-2)] text-xs"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span className="font-medium text-[var(--ink)] truncate">
                    {(cw.config?.label as string) || cw.widgetId}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--ink-3)]">
                    {cw.geometry.width}×{cw.geometry.height}
                  </span>
                </div>
              ))
            )}
          </div>
        </AccordionSection>
      </div>

      {/* Footer Actions */}
      <div
        className="p-3 border-t shrink-0 flex items-center justify-between gap-2"
        style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUngroup?.(group.id)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
            style={{ borderColor: "var(--line)" }}
            title="Dissolve group into individual widgets"
          >
            <FolderMinus size={13} />
            <span>Ungroup</span>
          </button>
          <button
            type="button"
            onClick={() => onReorder(group.id, "front")}
            className="p-1 text-xs rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)]"
            style={{ borderColor: "var(--line)" }}
            title="Bring Group to Front"
          >
            <BringToFront size={13} />
          </button>
          <button
            type="button"
            onClick={() => onReorder(group.id, "back")}
            className="p-1 text-xs rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)]"
            style={{ borderColor: "var(--line)" }}
            title="Send Group to Back"
          >
            <SendToBack size={13} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onDelete(group.id)}
          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors"
          title="Delete group"
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>
    </div>
  );
}
