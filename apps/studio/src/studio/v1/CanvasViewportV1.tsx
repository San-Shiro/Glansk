import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasStage from "@/canvas/CanvasStage";
import type { CanvasHandle } from "@shared/canvas-render.js";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import type { CanvasDocument, CanvasGroup, WidgetGeometry, WidgetInstance } from "@/lib/types";
import ContextMenu, { type ContextMenuGroup } from "../ContextMenu";
import { 
  FolderPlus, 
  FolderMinus, 
  ArrowUp, 
  ArrowDown, 
  Copy, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  Trash2,
  BringToFront,
  SendToBack
} from "lucide-react";

interface Props {
  doc: CanvasDocument;
  revision: number;
  zoom: number;
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelect: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onCommitGeometry: (id: string, geometry: WidgetGeometry) => void;
  onCommitGroupGeometry: (id: string, geometry: CanvasGroup["geometry"]) => void;
  onDropWidget: (payload: string, xLogical: number, yLogical: number) => void;
  interactiveMode?: boolean;
  onGroupSelection?: () => void;
  onUngroup?: (groupId: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string) => void;
  onToggleDisabled?: (id: string) => void;
  onReorder?: (id: string, dir: "front" | "back") => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CanvasViewport({
  doc,
  revision,
  zoom,
  selectedId,
  selectedGroupId,
  onSelect,
  onSelectGroup,
  onCommitGeometry,
  onCommitGroupGeometry,
  onDropWidget,
  interactiveMode = false,
  onGroupSelection,
  onUngroup,
  onDuplicate,
  onDelete,
  onToggleVisibility,
  onToggleDisabled,
  onReorder,
}: Props) {
  const handleRef = useRef<CanvasHandle | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; groups: ContextMenuGroup[] } | null>(null);
  const { width: LW, height: LH } = doc.logicalSize;

  const groups = doc.groups || [];

  // Helper to compute absolute canvas geometry for a widget (taking group offset into account)
  const getAbsoluteGeometry = useCallback((w: WidgetInstance): WidgetGeometry => {
    if (!w.groupId) return w.geometry;
    const grp = groups.find(g => g.id === w.groupId);
    if (!grp) return w.geometry;
    return {
      ...w.geometry,
      x: grp.geometry.x + w.geometry.x,
      y: grp.geometry.y + w.geometry.y,
    };
  }, [groups]);

  // Dragging a widget
  const beginDrag = useCallback((e: React.PointerEvent, w: WidgetInstance, mode: "move" | "resize") => {
    e.preventDefault(); e.stopPropagation();
    onSelect(w.id);
    onSelectGroup(null);

    if (mode === "move") {
      const box = overlayRef.current?.querySelector<HTMLElement>(`[data-box="${w.id}"]`) ?? null;
      if (box) box.style.pointerEvents = "none";
      const under = document.elementFromPoint(e.clientX, e.clientY);
      if (box) box.style.pointerEvents = "";

      const interactive = under?.closest<HTMLElement>("button, [data-action], input, select, textarea, a");
      if (interactive) {
        interactive.click();
        return;
      }
    }

    const startX = e.clientX, startY = e.clientY;
    const g0 = { ...w.geometry };
    const tile = handleRef.current?.tiles.get(w.id)?.el;
    const box = overlayRef.current?.querySelector<HTMLElement>(`[data-box="${w.id}"]`) ?? null;
    let last: WidgetGeometry = g0;

    const def = getWidgetDefinition(w.widgetId);
    const fixedRatio = def?.aspectRatio ?? null;
    const minW = def?.minWidth ?? 40;
    const minH = def?.minHeight ?? 40;

    const parentGroup = w.groupId ? groups.find(g => g.id === w.groupId) : null;
    const maxX = parentGroup ? parentGroup.geometry.width - g0.width : LW - g0.width;
    const maxY = parentGroup ? parentGroup.geometry.height - g0.height : LH - g0.height;

    const apply = (g: WidgetGeometry) => {
      last = g;
      if (tile) {
        tile.style.left = `${g.x}px`;
        tile.style.top = `${g.y}px`;
        tile.style.width = `${g.width}px`;
        tile.style.height = `${g.height}px`;

        const unit = Math.max(0.45, Math.min(2.5, Math.min(g.width / 320, g.height / 180)));
        tile.style.setProperty('--widget-width', `${g.width}px`);
        tile.style.setProperty('--widget-height', `${g.height}px`);
        tile.style.setProperty('--widget-unit', String(unit));
        tile.dataset.size = (g.width < 220 || g.height < 130) ? 'compact' : (g.width >= 500 && g.height >= 300) ? 'large' : 'normal';
        tile.dataset.aspect = (g.width / g.height > 1.8) ? 'wide' : (g.height / g.width > 1.3) ? 'tall' : 'normal';
      }
      if (box) {
        const absX = parentGroup ? parentGroup.geometry.x + g.x : g.x;
        const absY = parentGroup ? parentGroup.geometry.y + g.y : g.y;
        box.style.left = `${absX * zoom}px`;
        box.style.top = `${absY * zoom}px`;
        box.style.width = `${g.width * zoom}px`;
        box.style.height = `${g.height * zoom}px`;
      }
    };

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom, dy = (ev.clientY - startY) / zoom;
      if (mode === "move") {
        apply({ 
          ...g0, 
          x: clamp(Math.round(g0.x + dx), 0, Math.max(0, maxX)), 
          y: clamp(Math.round(g0.y + dy), 0, Math.max(0, maxY)) 
        });
      } else {
        let newW = Math.round(g0.width + dx);
        let newH = Math.round(g0.height + dy);

        const shouldLockRatio = fixedRatio !== null || ev.shiftKey;
        const ratio = fixedRatio || (g0.width / g0.height);

        if (shouldLockRatio && ratio > 0) {
          if (Math.abs(dx) >= Math.abs(dy)) {
            newW = clamp(newW, minW, (parentGroup ? parentGroup.geometry.width : LW) - g0.x);
            newH = Math.round(newW / ratio);
          } else {
            newH = clamp(newH, minH, (parentGroup ? parentGroup.geometry.height : LH) - g0.y);
            newW = Math.round(newH * ratio);
          }
        } else {
          newW = clamp(newW, minW, (parentGroup ? parentGroup.geometry.width : LW) - g0.x);
          newH = clamp(newH, minH, (parentGroup ? parentGroup.geometry.height : LH) - g0.y);
        }

        apply({ ...g0, width: newW, height: newH });
      }
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onCommitGeometry(w.id, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [zoom, LW, LH, groups, onSelect, onSelectGroup, onCommitGeometry]);

  // Dragging a group container
  const beginDragGroup = useCallback((e: React.PointerEvent, grp: CanvasGroup) => {
    e.preventDefault(); e.stopPropagation();
    onSelectGroup(grp.id);
    onSelect(null);

    const startX = e.clientX, startY = e.clientY;
    const g0 = { ...grp.geometry };
    const groupEl = handleRef.current?.groups?.get(grp.id)?.el;
    const box = overlayRef.current?.querySelector<HTMLElement>(`[data-group-box="${grp.id}"]`) ?? null;
    let last = g0;

    const apply = (g: CanvasGroup["geometry"]) => {
      last = g;
      if (groupEl) {
        groupEl.style.left = `${g.x}px`;
        groupEl.style.top = `${g.y}px`;
      }
      if (box) {
        box.style.left = `${g.x * zoom}px`;
        box.style.top = `${g.y * zoom}px`;
      }
    };

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom, dy = (ev.clientY - startY) / zoom;
      apply({
        ...g0,
        x: clamp(Math.round(g0.x + dx), 0, Math.max(0, LW - g0.width)),
        y: clamp(Math.round(g0.y + dy), 0, Math.max(0, LH - g0.height)),
      });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      onCommitGroupGeometry(grp.id, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, [zoom, LW, LH, onSelectGroup, onSelect, onCommitGroupGeometry]);

  // Right-click context menu builder
  const handleContextMenu = useCallback((e: React.MouseEvent, widgetId?: string, groupId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    const targetWidget = widgetId ? doc.widgets.find(w => w.id === widgetId) : null;
    const targetGroup = groupId ? groups.find(g => g.id === groupId) : null;

    if (targetWidget) {
      onSelect(targetWidget.id);
      onSelectGroup(null);
    } else if (targetGroup) {
      onSelectGroup(targetGroup.id);
      onSelect(null);
    }

    const targetId = targetWidget?.id || targetGroup?.id;
    const isHidden = targetWidget ? targetWidget.visibility?.defaultVisible === false : targetGroup?.visibility?.defaultVisible === false;
    const isDisabled = targetWidget ? Boolean(targetWidget.disabled) : Boolean(targetGroup?.disabled);

    const menuGroups: ContextMenuGroup[] = [];

    // Group 1: Structure & Grouping
    if (targetWidget || targetGroup) {
      const structActions = [];
      if (targetWidget && !targetWidget.groupId && onGroupSelection) {
        structActions.push({
          id: "group",
          label: "Group Selection",
          icon: <FolderPlus size={15} />,
          keycaps: ["⌘", "G"],
          onClick: onGroupSelection,
        });
      }
      if ((targetWidget?.groupId || targetGroup) && onUngroup) {
        structActions.push({
          id: "ungroup",
          label: "Ungroup",
          icon: <FolderMinus size={15} />,
          keycaps: ["⌘", "⇧", "G"],
          onClick: () => onUngroup(targetWidget?.groupId || targetGroup!.id),
        });
      }
      if (structActions.length > 0) menuGroups.push({ actions: structActions });
    }

    // Group 2: Stacking Order
    if (targetId && onReorder) {
      menuGroups.push({
        actions: [
          {
            id: "front",
            label: "Bring to Front",
            icon: <BringToFront size={15} />,
            keycaps: ["⌘", "]"],
            onClick: () => onReorder(targetId, "front"),
          },
          {
            id: "back",
            label: "Send to Back",
            icon: <SendToBack size={15} />,
            keycaps: ["⌘", "["],
            onClick: () => onReorder(targetId, "back"),
          },
        ]
      });
    }

    // Group 3: Visibility & Interactivity
    if (targetId) {
      const editActions = [];
      if (onDuplicate && targetWidget) {
        editActions.push({
          id: "duplicate",
          label: "Duplicate",
          icon: <Copy size={15} />,
          keycaps: ["⌘", "D"],
          onClick: () => onDuplicate(targetId),
        });
      }
      if (onToggleVisibility) {
        editActions.push({
          id: "visibility",
          label: isHidden ? "Show Widget" : "Hide Widget",
          icon: isHidden ? <Eye size={15} /> : <EyeOff size={15} />,
          keycaps: ["⌘", "H"],
          onClick: () => onToggleVisibility(targetId),
        });
      }
      if (onToggleDisabled) {
        editActions.push({
          id: "disable",
          label: isDisabled ? "Enable Widget" : "Disable / Lock",
          icon: isDisabled ? <Unlock size={15} /> : <Lock size={15} />,
          keycaps: ["⌘", "L"],
          onClick: () => onToggleDisabled(targetId),
        });
      }
      if (editActions.length > 0) menuGroups.push({ actions: editActions });
    }

    // Group 4: Destruction
    if (targetId && onDelete) {
      menuGroups.push({
        actions: [
          {
            id: "delete",
            label: "Delete",
            icon: <Trash2 size={15} />,
            keycaps: ["Del"],
            destructive: true,
            onClick: () => onDelete(targetId),
          }
        ]
      });
    }

    if (menuGroups.length > 0) {
      setContextMenu({ x: e.clientX, y: e.clientY, groups: menuGroups });
    }
  }, [doc.widgets, groups, onSelect, onSelectGroup, onGroupSelection, onUngroup, onReorder, onDuplicate, onToggleVisibility, onToggleDisabled, onDelete]);

  const contentW = useMemo(() => {
    let max = LW;
    for (const g of groups) {
      if (g.geometry) max = Math.max(max, (g.geometry.x || 0) + (g.geometry.width || 0));
    }
    for (const w of doc.widgets) {
      const absG = getAbsoluteGeometry(w);
      if (absG) max = Math.max(max, (absG.x || 0) + (absG.width || 0));
    }
    return max;
  }, [LW, groups, doc.widgets, getAbsoluteGeometry]);

  const contentH = useMemo(() => {
    let max = LH;
    for (const g of groups) {
      if (g.geometry) max = Math.max(max, (g.geometry.y || 0) + (g.geometry.height || 0));
    }
    for (const w of doc.widgets) {
      const absG = getAbsoluteGeometry(w);
      if (absG) max = Math.max(max, (absG.y || 0) + (absG.height || 0));
    }
    return max;
  }, [LH, groups, doc.widgets, getAbsoluteGeometry]);

  return (
    <div
      className="relative h-full w-full overflow-auto grid place-items-center p-10"
      style={{ background: "var(--panel-2)" }}
      onPointerDown={e => {
        if (e.target === e.currentTarget) {
          onSelect(null);
          onSelectGroup(null);
        }
      }}
      onContextMenu={e => handleContextMenu(e)}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDrop={e => {
        e.preventDefault();
        const payload = e.dataTransfer.getData("text/glansk-widget");
        if (!payload) return;
        const wrap = overlayRef.current?.getBoundingClientRect();
        if (!wrap) return;
        onDropWidget(payload, (e.clientX - wrap.left) / zoom, (e.clientY - wrap.top) / zoom);
      }}
    >
      <div
        className="relative shrink-0 transition-[width,height] duration-150"
        style={{
          width: contentW * zoom,
          height: contentH * zoom,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
        onPointerDown={e => {
          if (e.target === e.currentTarget) {
            onSelect(null);
            onSelectGroup(null);
          }
          e.stopPropagation();
        }}
      >
        <CanvasStage
          document={doc}
          revision={revision}
          scale={zoom}
          interactive={interactiveMode}
          style={{ position: "absolute", inset: 0 }}
          onReady={h => { handleRef.current = h; }}
        />

        {(contentW > LW || contentH > LH) && (
          <div
            className="absolute pointer-events-none border border-dashed border-cyan-400/40 z-40 flex items-end justify-end p-2"
            style={{ width: LW * zoom, height: LH * zoom, left: 0, top: 0 }}
          >
            <span className="text-[10px] font-mono bg-black/70 px-1.5 py-0.5 rounded text-cyan-300">
              Target {LW}×{LH}
            </span>
          </div>
        )}

        {/* Interaction Overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ isolation: "isolate", pointerEvents: interactiveMode ? "none" : "auto" }}
          onPointerDown={e => {
            if (e.target === e.currentTarget) {
              onSelect(null);
              onSelectGroup(null);
            }
          }}
        >
          {/* Group Overlay Bounding Boxes */}
          {groups.map(grp => {
            const sel = grp.id === selectedGroupId;
            return (
              <div
                key={grp.id}
                data-group-box={grp.id}
                onPointerDown={e => beginDragGroup(e, grp)}
                onContextMenu={e => handleContextMenu(e, undefined, grp.id)}
                style={{
                  position: "absolute",
                  left: grp.geometry.x * zoom,
                  top: grp.geometry.y * zoom,
                  width: grp.geometry.width * zoom,
                  height: grp.geometry.height * zoom,
                  zIndex: sel ? 99998 : (grp.geometry.zIndex ?? 0),
                  cursor: "move",
                  outline: sel ? "2px dashed #f59e0b" : "1px dashed rgba(245, 158, 11, 0.4)",
                  outlineOffset: 2,
                  background: sel ? "rgba(245, 158, 11, 0.05)" : "transparent",
                  borderRadius: 6,
                }}
              >
                {/* Group label pill */}
                <div 
                  className="absolute left-1 -top-6 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs pointer-events-none"
                  style={{
                    background: sel ? "#f59e0b" : "color-mix(in srgb, var(--panel, #0e1726) 90%, black)",
                    color: sel ? "#000" : "#f59e0b",
                    border: "1px solid rgba(245, 158, 11, 0.5)",
                  }}
                >
                  <span>📁</span>
                  <span>{grp.name}</span>
                </div>
              </div>
            );
          })}

          {/* Widget Overlay Bounding Boxes */}
          {doc.widgets.map(w => {
            const sel = w.id === selectedId;
            const def = getWidgetDefinition(w.widgetId);
            const absG = getAbsoluteGeometry(w);
            const isConditionallyHidden = w.visibility?.defaultVisible === false;

            return (
              <div
                key={w.id}
                data-box={w.id}
                onPointerDown={e => beginDrag(e, w, "move")}
                onContextMenu={e => handleContextMenu(e, w.id)}
                style={{
                  position: "absolute",
                  left: absG.x * zoom,
                  top: absG.y * zoom,
                  width: absG.width * zoom,
                  height: absG.height * zoom,
                  zIndex: sel ? 99999 : (absG.zIndex ?? 0),
                  cursor: "move",
                  outline: sel ? "2px solid var(--accent)" : isConditionallyHidden ? "1px dashed #f43f5e" : "none",
                  outlineOffset: -1,
                  background: sel 
                    ? "color-mix(in srgb, var(--accent) 8%, transparent)" 
                    : isConditionallyHidden 
                      ? "rgba(244, 63, 94, 0.05)" 
                      : "transparent",
                }}
                className={sel ? "" : "hover:outline-1 hover:outline-dashed hover:outline-[var(--line-2)] transition-[outline] duration-100"}
              >
                {isConditionallyHidden && (
                  <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-rose-500/80 text-white text-[9px] font-mono shadow-xs">
                    Rule Hidden
                  </div>
                )}
                {sel && (
                  <div
                    onPointerDown={e => beginDrag(e, w, "resize")}
                    title={def?.aspectRatio ? `Fixed ratio ${def.aspectRatio}:1` : "Resize (Hold Shift to lock ratio)"}
                    style={{ position: "absolute", right: -5, bottom: -5, width: 12, height: 12, background: "var(--accent)", border: "2px solid var(--panel)", cursor: "nwse-resize" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          groups={contextMenu.groups}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
