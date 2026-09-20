import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CanvasStage from "@/canvas/CanvasStage";
import type { CanvasHandle } from "@shared/canvas-render.js";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import type { CanvasDocument, CanvasGroup, WidgetGeometry, WidgetInstance } from "@/lib/types";
import { getActiveDraggingWidget } from "@/lib/catalog";
import ContextMenu, { type ContextMenuGroup } from "./ContextMenu";
import {
  FolderPlus,
  FolderMinus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  BringToFront,
  SendToBack,
  Minus,
  Plus,
  Maximize,
  MousePointer,
  Hand,
  Layers,
  Lock,
  Unlock,
  Grid,
  Sliders,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";

interface Props {
  doc: CanvasDocument;
  revision: number;
  zoom: number;
  selectedId: string | null;
  selectedWidgetIds?: string[];
  selectedGroupId: string | null;
  onSelect: (id: string | null) => void;
  onSelectWidgets?: (ids: string[]) => void;
  onSelectGroup: (id: string | null) => void;
  onCommitGeometry: (id: string, geometry: WidgetGeometry) => void;
  onCommitGroupGeometry: (id: string, geometry: CanvasGroup["geometry"]) => void;
  onBatchCommitGeometry?: (updates: Array<{ id: string; geometry: WidgetGeometry }>) => void;
  onDropWidget: (payload: string, xLogical: number, yLogical: number) => void;
  interactiveMode?: boolean;
  onGroupSelection?: () => void;
  onUngroup?: (groupId: string) => void;
  onDuplicate?: (id: string) => void;
  onDuplicateSelected?: () => void;
  onDelete?: (id: string) => void;
  onDeleteSelected?: () => void;
  onAlignSelected?: (dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  onDistributeSelected?: (axis: "horizontal" | "vertical") => void;
  onToggleVisibility?: (id: string) => void;
  onToggleDisabled?: (id: string) => void;
  onReorder?: (id: string, dir: "front" | "back") => void;
  onZoom?: (z: number) => void;
  onZoomFit?: () => void;
  onSelectAll?: () => void;
  onOpenCatalog?: () => void;
  onOpenCanvasSettings?: () => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function CanvasViewport({
  doc,
  revision,
  zoom,
  selectedId,
  selectedWidgetIds = [],
  selectedGroupId,
  onSelect,
  onSelectWidgets,
  onSelectGroup,
  onCommitGeometry,
  onCommitGroupGeometry,
  onBatchCommitGeometry,
  onDropWidget,
  interactiveMode = false,
  onGroupSelection,
  onUngroup,
  onDuplicate,
  onDuplicateSelected,
  onDelete,
  onDeleteSelected,
  onAlignSelected,
  onDistributeSelected,
  onToggleVisibility,
  onToggleDisabled,
  onReorder,
  onZoom,
  onZoomFit,
  onSelectAll,
  onOpenCatalog,
  onOpenCanvasSettings,
}: Props) {
  const handleRef = useRef<CanvasHandle | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; groups: ContextMenuGroup[] } | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);

  // Drag and drop blueprint ghost preview
  const [dropGhost, setDropGhost] = useState<{ x: number; y: number; width: number; height: number; title: string } | null>(null);

  const { width: LW, height: LH } = doc.logicalSize;
  const groups = doc.groups || [];

  // Effective selected widget IDs (unifies singular prop and multi-select array)
  const activeWidgetIds = useMemo(() => {
    if (selectedWidgetIds.length > 0) return selectedWidgetIds;
    if (selectedId) return [selectedId];
    return [];
  }, [selectedWidgetIds, selectedId]);

  const setEffectiveSelectedWidgets = useCallback(
    (ids: string[]) => {
      if (onSelectWidgets) {
        onSelectWidgets(ids);
      } else {
        onSelect(ids[0] ?? null);
      }
    },
    [onSelectWidgets, onSelect]
  );

  // Helper to compute absolute canvas geometry for a widget (taking group offset into account)
  const getAbsoluteGeometry = useCallback(
    (w: WidgetInstance): WidgetGeometry => {
      if (!w.groupId) return w.geometry;
      const grp = groups.find((g) => g.id === w.groupId);
      if (!grp) return w.geometry;
      return {
        ...w.geometry,
        x: grp.geometry.x + w.geometry.x,
        y: grp.geometry.y + w.geometry.y,
        zIndex: (grp.geometry.zIndex ?? 0) + (w.geometry.zIndex ?? 0) + 1,
      };
    },
    [groups]
  );

  // Dragging single or multiple widgets
  const beginDrag = useCallback(
    (e: React.PointerEvent, w: WidgetInstance, mode: "move" | "resize") => {
      e.preventDefault();
      e.stopPropagation();

      const isMultiDrag = mode === "move" && activeWidgetIds.includes(w.id) && activeWidgetIds.length > 1;
      const dragIds = isMultiDrag ? activeWidgetIds : [w.id];
      let hasMoved = false;

      if (!isMultiDrag) {
        onSelect(w.id);
        setEffectiveSelectedWidgets([w.id]);
        onSelectGroup(null);
      }

      const startX = e.clientX;
      const startY = e.clientY;

      if (isMultiDrag) {
        // Multi-Widget Drag
        const items = dragIds
          .map((id) => {
            const item = doc.widgets.find((x) => x.id === id);
            if (!item) return null;
            const parent = item.groupId ? groups.find((g) => g.id === item.groupId) : null;
            return {
              w: item,
              g0: { ...item.geometry },
              parent,
              tile: handleRef.current?.tiles.get(item.id)?.el ?? null,
              box: overlayRef.current?.querySelector<HTMLElement>(`[data-box="${item.id}"]`) ?? null,
              last: { ...item.geometry },
            };
          })
          .filter(Boolean) as Array<{
            w: WidgetInstance;
            g0: WidgetGeometry;
            parent: CanvasGroup | null | undefined;
            tile: HTMLElement | null;
            box: HTMLElement | null;
            last: WidgetGeometry;
          }>;

        let minDx = -Infinity, maxDx = Infinity;
        let minDy = -Infinity, maxDy = Infinity;
        for (const item of items) {
          const maxX = item.parent ? item.parent.geometry.width - item.g0.width : LW - item.g0.width;
          const maxY = item.parent ? item.parent.geometry.height - item.g0.height : LH - item.g0.height;
          minDx = Math.max(minDx, -item.g0.x);
          maxDx = Math.min(maxDx, maxX - item.g0.x);
          minDy = Math.max(minDy, -item.g0.y);
          maxDy = Math.min(maxDy, maxY - item.g0.y);
        }

        const onMove = (ev: PointerEvent) => {
          if (!hasMoved && (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2)) {
            hasMoved = true;
          }
          let dx = (ev.clientX - startX) / zoom;
          let dy = (ev.clientY - startY) / zoom;
          if (snapToGrid) {
            dx = Math.round(dx / 8) * 8;
            dy = Math.round(dy / 8) * 8;
          }
          dx = clamp(dx, minDx, Math.max(minDx, maxDx));
          dy = clamp(dy, minDy, Math.max(minDy, maxDy));

          for (const item of items) {
            item.last = {
              ...item.g0,
              x: Math.round(item.g0.x + dx),
              y: Math.round(item.g0.y + dy),
            };
            const absX = item.parent ? item.parent.geometry.x + item.last.x : item.last.x;
            const absY = item.parent ? item.parent.geometry.y + item.last.y : item.last.y;
            if (item.tile) {
              item.tile.style.left = `${item.last.x}px`;
              item.tile.style.top = `${item.last.y}px`;
              item.tile.style.transform = "";
            }
            if (item.box) {
              item.box.style.left = `${absX * zoom}px`;
              item.box.style.top = `${absY * zoom}px`;
              item.box.style.transform = "";
            }
          }
        };

        const onUp = () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          if (!hasMoved) {
            onSelect(w.id);
            setEffectiveSelectedWidgets([w.id]);
            onSelectGroup(null);
            return;
          }
          if (onBatchCommitGeometry) {
            onBatchCommitGeometry(items.map((it) => ({ id: it.w.id, geometry: it.last })));
          } else {
            items.forEach((it) => onCommitGeometry(it.w.id, it.last));
          }
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return;
      }

      // Single Widget Drag / Resize
      const g0 = { ...w.geometry };
      const tile = handleRef.current?.tiles.get(w.id)?.el;
      const box = overlayRef.current?.querySelector<HTMLElement>(`[data-box="${w.id}"]`) ?? null;
      let last: WidgetGeometry = g0;

      const def = getWidgetDefinition(w.widgetId);
      const fixedRatio = def?.aspectRatio ?? null;
      const minW = def?.minWidth ?? 40;
      const minH = def?.minHeight ?? 40;

      const parentGroup = w.groupId ? groups.find((g) => g.id === w.groupId) : null;
      const maxX = parentGroup ? parentGroup.geometry.width - g0.width : LW - g0.width;
      const maxY = parentGroup ? parentGroup.geometry.height - g0.height : LH - g0.height;

      const apply = (g: WidgetGeometry) => {
        last = g;
        if (tile) {
          tile.style.left = `${g.x}px`;
          tile.style.top = `${g.y}px`;
          tile.style.width = `${g.width}px`;
          tile.style.height = `${g.height}px`;
          tile.style.transform = "";
        }
        if (box) {
          const absX = parentGroup ? parentGroup.geometry.x + g.x : g.x;
          const absY = parentGroup ? parentGroup.geometry.y + g.y : g.y;
          box.style.left = `${absX * zoom}px`;
          box.style.top = `${absY * zoom}px`;
          box.style.width = `${g.width * zoom}px`;
          box.style.height = `${g.height * zoom}px`;
          box.style.transform = "";
        }
      };

      const onMove = (ev: PointerEvent) => {
        if (!hasMoved && (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2)) {
          hasMoved = true;
        }
        let dx = (ev.clientX - startX) / zoom;
        let dy = (ev.clientY - startY) / zoom;

        if (mode === "move") {
          let nextX = g0.x + dx;
          let nextY = g0.y + dy;
          if (snapToGrid) {
            nextX = Math.round(nextX / 8) * 8;
            nextY = Math.round(nextY / 8) * 8;
          }
          apply({
            ...g0,
            x: clamp(Math.round(nextX), 0, Math.max(0, maxX)),
            y: clamp(Math.round(nextY), 0, Math.max(0, maxY)),
          });
        } else {
          let nw = Math.max(minW, Math.round(g0.width + dx));
          let nh = Math.max(minH, Math.round(g0.height + dy));

          if (snapToGrid) {
            nw = Math.round(nw / 8) * 8;
            nh = Math.round(nh / 8) * 8;
          }

          if (fixedRatio != null || ev.shiftKey) {
            const ratio = fixedRatio != null ? fixedRatio : g0.width / g0.height;
            if (Math.abs(dx) > Math.abs(dy)) {
              nh = Math.max(minH, Math.round(nw / ratio));
            } else {
              nw = Math.max(minW, Math.round(nh * ratio));
            }
          }

          const limitW = parentGroup ? parentGroup.geometry.width - g0.x : LW - g0.x;
          const limitH = parentGroup ? parentGroup.geometry.height - g0.y : LH - g0.y;

          apply({
            ...g0,
            width: clamp(nw, minW, Math.max(minW, limitW)),
            height: clamp(nh, minH, Math.max(minH, limitH)),
          });
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (hasMoved) {
          onCommitGeometry(w.id, last);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [LW, LH, zoom, onSelect, setEffectiveSelectedWidgets, onSelectGroup, onCommitGeometry, onBatchCommitGeometry, groups, activeWidgetIds, snapToGrid, doc.widgets]
  );

  // Dragging a group
  const beginDragGroup = useCallback(
    (e: React.PointerEvent, grp: CanvasGroup) => {
      e.preventDefault();
      e.stopPropagation();
      onSelectGroup(grp.id);
      onSelect(null);
      setEffectiveSelectedWidgets([]);

      const startX = e.clientX;
      const startY = e.clientY;
      const g0 = { ...grp.geometry };
      let last = g0;
      let hasMoved = false;

      const box = overlayRef.current?.querySelector<HTMLElement>(`[data-group-box="${grp.id}"]`);
      const groupEl = handleRef.current?.groups?.get(grp.id)?.el;
      const memberBoxes = doc.widgets
        .filter((w) => w.groupId === grp.id)
        .map((w) => ({
          widget: w,
          el: overlayRef.current?.querySelector<HTMLElement>(`[data-box="${w.id}"]`),
        }));

      const onMove = (ev: PointerEvent) => {
        if (!hasMoved && (Math.abs(ev.clientX - startX) > 2 || Math.abs(ev.clientY - startY) > 2)) {
          hasMoved = true;
        }
        let dx = (ev.clientX - startX) / zoom;
        let dy = (ev.clientY - startY) / zoom;
        let nextX = g0.x + dx;
        let nextY = g0.y + dy;
        if (snapToGrid) {
          nextX = Math.round(nextX / 8) * 8;
          nextY = Math.round(nextY / 8) * 8;
        }
        last = {
          ...g0,
          x: clamp(Math.round(nextX), 0, Math.max(0, LW - g0.width)),
          y: clamp(Math.round(nextY), 0, Math.max(0, LH - g0.height)),
        };

        if (box) {
          box.style.left = `${last.x * zoom}px`;
          box.style.top = `${last.y * zoom}px`;
          box.style.transform = "";
        }
        if (groupEl) {
          groupEl.style.left = `${last.x}px`;
          groupEl.style.top = `${last.y}px`;
          groupEl.style.transform = "";
        }
        for (const mb of memberBoxes) {
          if (mb.el) {
            mb.el.style.left = `${(last.x + mb.widget.geometry.x) * zoom}px`;
            mb.el.style.top = `${(last.y + mb.widget.geometry.y) * zoom}px`;
            mb.el.style.transform = "";
          }
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (hasMoved) {
          onCommitGroupGeometry(grp.id, last);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [LW, LH, zoom, onSelectGroup, onSelect, setEffectiveSelectedWidgets, onCommitGroupGeometry, snapToGrid, doc.widgets]
  );

  // Click on empty artboard/overlay → deselect everything
  const clickDeselect = useCallback(
    (e: React.PointerEvent) => {
      if (panMode || e.button !== 0) return;
      // Only deselect if clicking directly on the artboard/overlay background
      if (e.target !== e.currentTarget && (e.target as HTMLElement).getAttribute("data-artboard") !== "true") return;
      onSelect(null);
      setEffectiveSelectedWidgets([]);
      onSelectGroup(null);
    },
    [panMode, onSelect, setEffectiveSelectedWidgets, onSelectGroup]
  );

  // Context menu builder
  const handleContextMenu = useCallback(
    (e: React.PointerEvent | React.MouseEvent, widgetId?: string, groupId?: string) => {
      e.preventDefault();
      e.stopPropagation();

      const items: ContextMenuGroup[] = [];

      if (widgetId) {
        let currentSelectedIds = activeWidgetIds;
        if (!activeWidgetIds.includes(widgetId)) {
          currentSelectedIds = [widgetId];
          setEffectiveSelectedWidgets(currentSelectedIds);
          onSelect(widgetId);
          onSelectGroup(null);
        }

        const isMulti = currentSelectedIds.length > 1;

        if (isMulti) {
          // Multi-Selection Menu
          items.push({
            actions: [
              {
                id: "group-multi",
                label: `Group Selection (${currentSelectedIds.length} items)`,
                icon: <FolderPlus size={13} />,
                keycaps: ["Ctrl", "G"],
                onClick: () => onGroupSelection?.(),
              },
            ],
          });

          items.push({
            actions: [
              {
                id: "align-left",
                label: "Align Left",
                icon: <AlignStartHorizontal size={13} />,
                onClick: () => onAlignSelected?.("left"),
              },
              {
                id: "align-center",
                label: "Align Center",
                icon: <AlignCenterHorizontal size={13} />,
                onClick: () => onAlignSelected?.("center"),
              },
              {
                id: "align-right",
                label: "Align Right",
                icon: <AlignEndHorizontal size={13} />,
                onClick: () => onAlignSelected?.("right"),
              },
              {
                id: "align-top",
                label: "Align Top",
                icon: <AlignStartVertical size={13} />,
                onClick: () => onAlignSelected?.("top"),
              },
              {
                id: "align-middle",
                label: "Align Middle",
                icon: <AlignCenterVertical size={13} />,
                onClick: () => onAlignSelected?.("middle"),
              },
              {
                id: "align-bottom",
                label: "Align Bottom",
                icon: <AlignEndVertical size={13} />,
                onClick: () => onAlignSelected?.("bottom"),
              },
            ],
          });

          if (currentSelectedIds.length >= 3) {
            items.push({
              actions: [
                {
                  id: "distribute-h",
                  label: "Distribute Horizontally",
                  icon: <AlignHorizontalDistributeCenter size={13} />,
                  onClick: () => onDistributeSelected?.("horizontal"),
                },
                {
                  id: "distribute-v",
                  label: "Distribute Vertically",
                  icon: <AlignVerticalDistributeCenter size={13} />,
                  onClick: () => onDistributeSelected?.("vertical"),
                },
              ],
            });
          }

          items.push({
            actions: [
              {
                id: "duplicate-multi",
                label: `Duplicate All (${currentSelectedIds.length} items)`,
                icon: <Copy size={13} />,
                keycaps: ["Ctrl", "D"],
                onClick: () => onDuplicateSelected?.(),
              },
              {
                id: "delete-multi",
                label: `Delete All (${currentSelectedIds.length} items)`,
                icon: <Trash2 size={13} />,
                keycaps: ["Del"],
                destructive: true,
                onClick: () => onDeleteSelected?.(),
              },
            ],
          });
        } else {
          // Single Widget Menu
          const w = doc.widgets.find((x) => x.id === widgetId);
          const isHidden = w?.visibility?.defaultVisible === false;
          const isLocked = Boolean(w?.disabled);

          items.push({
            actions: [
              {
                id: "duplicate",
                label: "Duplicate",
                icon: <Copy size={13} />,
                keycaps: ["Ctrl", "D"],
                onClick: () => onDuplicate?.(widgetId),
              },
              {
                id: "group",
                label: "Group Widget",
                icon: <FolderPlus size={13} />,
                keycaps: ["Ctrl", "G"],
                onClick: () => onGroupSelection?.(),
              },
            ],
          });

          items.push({
            actions: [
              {
                id: "bring-front",
                label: "Bring to Front",
                icon: <BringToFront size={13} />,
                onClick: () => onReorder?.(widgetId, "front"),
              },
              {
                id: "send-back",
                label: "Send to Back",
                icon: <SendToBack size={13} />,
                onClick: () => onReorder?.(widgetId, "back"),
              },
            ],
          });

          items.push({
            actions: [
              {
                id: "toggle-visibility",
                label: isHidden ? "Show Widget" : "Hide Widget",
                icon: isHidden ? <Eye size={13} /> : <EyeOff size={13} />,
                onClick: () => onToggleVisibility?.(widgetId),
              },
              {
                id: "toggle-disabled",
                label: isLocked ? "Unlock Widget" : "Lock / Disable Widget",
                icon: isLocked ? <Unlock size={13} /> : <Lock size={13} />,
                onClick: () => onToggleDisabled?.(widgetId),
              },
            ],
          });

          items.push({
            actions: [
              {
                id: "delete",
                label: "Delete",
                icon: <Trash2 size={13} />,
                keycaps: ["Del"],
                destructive: true,
                onClick: () => onDelete?.(widgetId),
              },
            ],
          });
        }
      } else if (groupId) {
        // Group Container Menu
        onSelectGroup(groupId);
        onSelect(null);
        setEffectiveSelectedWidgets([]);

        items.push({
          actions: [
            {
              id: "ungroup",
              label: "Ungroup",
              icon: <FolderMinus size={13} />,
              keycaps: ["Ctrl", "Shift", "G"],
              onClick: () => onUngroup?.(groupId),
            },
            {
              id: "duplicate-group",
              label: "Duplicate Group",
              icon: <Copy size={13} />,
              keycaps: ["Ctrl", "D"],
              onClick: () => onDuplicateSelected?.(),
            },
          ],
        });

        items.push({
          actions: [
            {
              id: "bring-front-group",
              label: "Bring to Front",
              icon: <BringToFront size={13} />,
              onClick: () => onReorder?.(groupId, "front"),
            },
            {
              id: "send-back-group",
              label: "Send to Back",
              icon: <SendToBack size={13} />,
              onClick: () => onReorder?.(groupId, "back"),
            },
          ],
        });

        items.push({
          actions: [
            {
              id: "delete-group",
              label: "Delete Group",
              icon: <Trash2 size={13} />,
              keycaps: ["Del"],
              destructive: true,
              onClick: () => onDelete?.(groupId),
            },
          ],
        });
      } else {
        // Empty Canvas Context Menu
        onSelect(null);
        setEffectiveSelectedWidgets([]);
        onSelectGroup(null);

        items.push({
          actions: [
            {
              id: "add-widget",
              label: "Add Widget...",
              icon: <Plus size={13} />,
              onClick: () => onOpenCatalog?.(),
            },
            {
              id: "select-all",
              label: "Select All",
              icon: <Layers size={13} />,
              keycaps: ["Ctrl", "A"],
              onClick: () => onSelectAll?.(),
            },
          ],
        });

        items.push({
          actions: [
            {
              id: "zoom-fit",
              label: "Zoom to Fit",
              icon: <Maximize size={13} />,
              keycaps: ["F"],
              onClick: () => onZoomFit?.(),
            },
            {
              id: "zoom-100",
              label: "Reset Zoom (100%)",
              icon: <Maximize size={13} />,
              keycaps: ["Ctrl", "0"],
              onClick: () => onZoom?.(1),
            },
            {
              id: "toggle-snapping",
              label: "Snap to 8px Grid",
              icon: <Grid size={13} />,
              checked: snapToGrid,
              onClick: () => setSnapToGrid((s) => !s),
            },
          ],
        });

        items.push({
          actions: [
            {
              id: "canvas-settings",
              label: "Canvas Settings",
              icon: <Sliders size={13} />,
              keycaps: ["C"],
              onClick: () => onOpenCanvasSettings?.(),
            },
          ],
        });
      }

      if (items.length > 0) {
        setContextMenu({ x: e.clientX, y: e.clientY, groups: items });
      }
    },
    [
      activeWidgetIds,
      setEffectiveSelectedWidgets,
      onSelect,
      onSelectGroup,
      onGroupSelection,
      onAlignSelected,
      onDistributeSelected,
      onDuplicateSelected,
      onDeleteSelected,
      doc.widgets,
      onDuplicate,
      onReorder,
      onToggleVisibility,
      onToggleDisabled,
      onDelete,
      onUngroup,
      onOpenCatalog,
      onSelectAll,
      onZoomFit,
      onZoom,
      snapToGrid,
      onOpenCanvasSettings,
    ]
  );

  const selectedWidget = activeWidgetIds.length === 1 ? doc.widgets.find((w) => w.id === activeWidgetIds[0]) ?? null : null;
  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) ?? null : null;

  // Selected item absolute bounding coordinates for Floating Selection Context Bar (single item)
  const selectionBounds = useMemo(() => {
    if (activeWidgetIds.length === 1 && selectedWidget) {
      const absG = getAbsoluteGeometry(selectedWidget);
      return {
        x: absG.x * zoom,
        y: absG.y * zoom,
        width: absG.width * zoom,
        height: absG.height * zoom,
      };
    }
    if (selectedGroup) {
      return {
        x: selectedGroup.geometry.x * zoom,
        y: selectedGroup.geometry.y * zoom,
        width: selectedGroup.geometry.width * zoom,
        height: selectedGroup.geometry.height * zoom,
      };
    }
    return null;
  }, [activeWidgetIds.length, selectedWidget, selectedGroup, getAbsoluteGeometry, zoom]);

  // Multi-Selection Bounding Coordinates for Floating Bar
  const multiSelectionBounds = useMemo(() => {
    if (activeWidgetIds.length <= 1) return null;
    const absGeoms = doc.widgets
      .filter((w) => activeWidgetIds.includes(w.id))
      .map((w) => getAbsoluteGeometry(w));
    if (absGeoms.length === 0) return null;

    const minX = Math.min(...absGeoms.map((g) => g.x));
    const minY = Math.min(...absGeoms.map((g) => g.y));
    const maxX = Math.max(...absGeoms.map((g) => g.x + g.width));
    const maxY = Math.max(...absGeoms.map((g) => g.y + g.height));

    return {
      x: minX * zoom,
      y: minY * zoom,
      width: (maxX - minX) * zoom,
      height: (maxY - minY) * zoom,
    };
  }, [activeWidgetIds, doc.widgets, getAbsoluteGeometry, zoom]);

  const [isPanning, setIsPanning] = useState(false);

  const startPanning = useCallback(
    (e: React.PointerEvent) => {
      if (panMode || e.button === 1) {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startLeft = containerRef.current?.scrollLeft || 0;
        const startTop = containerRef.current?.scrollTop || 0;
        setIsPanning(true);

        const onMove = (ev: PointerEvent) => {
          if (containerRef.current) {
            containerRef.current.scrollLeft = startLeft - (ev.clientX - startX);
            containerRef.current.scrollTop = startTop - (ev.clientY - startY);
          }
        };

        const onUp = () => {
          setIsPanning(false);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }
    },
    [panMode]
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-auto grid place-items-center p-12 select-none"
      style={{
        background: "var(--panel-2)",
        backgroundImage: "radial-gradient(var(--line) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        cursor: panMode ? (isPanning ? "grabbing" : "grab") : "default",
      }}
      onPointerDown={(e) => {
        if (panMode || e.button === 1) {
          startPanning(e);
          return;
        }
        if (e.target === e.currentTarget && e.button === 0) {
          onSelect(null);
          setEffectiveSelectedWidgets([]);
          onSelectGroup(null);
        }
      }}
      onContextMenu={(e) => handleContextMenu(e)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        const overlay = overlayRef.current;
        if (!overlay) return;
        const rect = overlay.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / zoom;
        const rawY = (e.clientY - rect.top) / zoom;

        const activeDrag = getActiveDraggingWidget();
        let width = activeDrag?.defaultGeometry.width ?? 320;
        let height = activeDrag?.defaultGeometry.height ?? 240;
        let title = activeDrag?.title ?? "Widget";
        if (!activeDrag) {
          try {
            const dimRaw = e.dataTransfer.getData("text/glansk-dim");
            if (dimRaw) {
              const dim = JSON.parse(dimRaw);
              if (dim.width) width = dim.width;
              if (dim.height) height = dim.height;
              if (dim.title) title = dim.title;
            }
          } catch {}
        }

        const snapX = snapToGrid ? Math.round((rawX - width / 2) / 8) * 8 : Math.round(rawX - width / 2);
        const snapY = snapToGrid ? Math.round((rawY - height / 2) / 8) * 8 : Math.round(rawY - height / 2);

        const clampedX = clamp(snapX, 0, Math.max(0, LW - width));
        const clampedY = clamp(snapY, 0, Math.max(0, LH - height));

        setDropGhost({ x: clampedX, y: clampedY, width, height, title });
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setDropGhost(null);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropGhost(null);
        const payload = e.dataTransfer.getData("text/glansk-widget");
        if (!payload) return;
        const overlay = overlayRef.current;
        if (!overlay) return;
        const rect = overlay.getBoundingClientRect();

        const activeDrag = getActiveDraggingWidget();
        let width = activeDrag?.defaultGeometry.width ?? 320;
        let height = activeDrag?.defaultGeometry.height ?? 240;
        if (!activeDrag) {
          try {
            const dimRaw = e.dataTransfer.getData("text/glansk-dim");
            if (dimRaw) {
              const dim = JSON.parse(dimRaw);
              if (dim.width) width = dim.width;
              if (dim.height) height = dim.height;
            }
          } catch {}
        }

        const rawX = (e.clientX - rect.left) / zoom;
        const rawY = (e.clientY - rect.top) / zoom;
        const snapX = snapToGrid ? Math.round((rawX - width / 2) / 8) * 8 : Math.round(rawX - width / 2);
        const snapY = snapToGrid ? Math.round((rawY - height / 2) / 8) * 8 : Math.round(rawY - height / 2);

        const clampedX = clamp(snapX, 0, Math.max(0, LW - width));
        const clampedY = clamp(snapY, 0, Math.max(0, LH - height));

        onDropWidget(payload, clampedX, clampedY);
      }}
    >
      {/* Wrapper: contains artboard + floating bars so bars scroll with artboard but aren't clipped */}
      <div className="relative shrink-0">
      {/* Centered Canvas Artboard */}
      <div
        data-artboard="true"
        className="relative shrink-0 transition-[width,height] duration-150"
        style={{
          width: LW * zoom,
          height: LH * zoom,
          boxShadow: "0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px var(--line)",
          borderRadius: 8,
          overflow: "hidden",
        }}
        onPointerDown={(e) => {
          if (panMode || e.button === 1) return;
          if (e.button === 0 && (e.target === e.currentTarget || (e.target as HTMLElement).getAttribute("data-artboard") === "true")) {
            clickDeselect(e);
          }
        }}
      >
        <CanvasStage
          document={doc}
          revision={revision}
          scale={zoom}
          interactive={interactiveMode}
          style={{ position: "absolute", inset: 0 }}
          onReady={(h) => {
            handleRef.current = h;
          }}
        />

        {/* Interaction Overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ isolation: "isolate", pointerEvents: interactiveMode ? "none" : "auto" }}
          onPointerDown={(e) => {
            if (panMode || e.button === 1) return;
            if (e.target === e.currentTarget && e.button === 0) {
              clickDeselect(e);
            }
          }}
        >
          {/* Palette Drop Blueprint Ghost */}
          {dropGhost && (
            <div
              style={{
                position: "absolute",
                left: dropGhost.x * zoom,
                top: dropGhost.y * zoom,
                width: dropGhost.width * zoom,
                height: dropGhost.height * zoom,
                border: "2px dashed var(--accent)",
                background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                pointerEvents: "none",
                zIndex: 999995,
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 24px color-mix(in srgb, var(--accent) 30%, transparent)",
              }}
            >
              <div
                className="px-2.5 py-1 rounded text-[11px] font-mono font-bold flex items-center gap-1.5 shadow-md"
                style={{
                  background: "var(--accent)",
                  color: "#fff",
                }}
              >
                <span>X: {dropGhost.x}, Y: {dropGhost.y}</span>
                <span className="opacity-70">&bull;</span>
                <span>{dropGhost.width}&times;{dropGhost.height}</span>
              </div>
            </div>
          )}

          {/* Group Overlay Bounding Boxes */}
          {groups.map((grp) => {
            const sel = grp.id === selectedGroupId;
            return (
              <div
                key={grp.id}
                data-group-box={grp.id}
                onPointerDown={(e) => beginDragGroup(e, grp)}
                onContextMenu={(e) => handleContextMenu(e, undefined, grp.id)}
                style={{
                  position: "absolute",
                  left: grp.geometry.x * zoom,
                  top: grp.geometry.y * zoom,
                  width: grp.geometry.width * zoom,
                  height: grp.geometry.height * zoom,
                  zIndex: grp.geometry.zIndex ?? 0,
                  cursor: "move",
                  outline: sel ? "2px dashed #f59e0b" : "1px dashed rgba(245, 158, 11, 0.4)",
                  outlineOffset: 2,
                  background: sel ? "rgba(245, 158, 11, 0.05)" : "transparent",
                  borderRadius: 6,
                }}
              >
                <div
                  className="absolute left-1 -top-6 px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs cursor-pointer select-none"
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
          {doc.widgets.map((w) => {
            const sel = activeWidgetIds.includes(w.id);
            const def = getWidgetDefinition(w.widgetId);
            const absG = getAbsoluteGeometry(w);
            const isConditionallyHidden = w.visibility?.defaultVisible === false;

            return (
              <div
                key={w.id}
                data-box={w.id}
                onPointerDown={(e) => {
                  if (e.button === 2) return;
                  if (e.shiftKey) {
                    e.stopPropagation();
                    const next = activeWidgetIds.includes(w.id)
                      ? activeWidgetIds.filter((id) => id !== w.id)
                      : [...activeWidgetIds, w.id];
                    setEffectiveSelectedWidgets(next);
                    onSelectGroup(null);
                    return;
                  }
                  if (!activeWidgetIds.includes(w.id)) {
                    setEffectiveSelectedWidgets([w.id]);
                    onSelect(w.id);
                    onSelectGroup(null);
                  }
                  beginDrag(e, w, "move");
                }}
                onContextMenu={(e) => handleContextMenu(e, w.id)}
                style={{
                  position: "absolute",
                  left: absG.x * zoom,
                  top: absG.y * zoom,
                  width: absG.width * zoom,
                  height: absG.height * zoom,
                  zIndex: absG.zIndex ?? 0,
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
                {/* Resize Handle (only for single widget selection) */}
                {sel && activeWidgetIds.length === 1 && (
                  <div
                    onPointerDown={(e) => beginDrag(e, w, "resize")}
                    title={def?.aspectRatio ? `Fixed ratio ${def.aspectRatio}:1` : "Resize (Hold Shift to lock ratio)"}
                    style={{
                      position: "absolute",
                      right: -5,
                      bottom: -5,
                      width: 12,
                      height: 12,
                      background: "var(--accent)",
                      border: "2px solid var(--panel)",
                      cursor: "nwse-resize",
                    }}
                  />
                )}
              </div>
            );
          })}

        </div>
      </div>

      {/* Floating Selection Bars — absolute within wrapper, outside artboard overflow:hidden */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 60 }}
      >
        {/* 1. Floating Selection Context Bar (Single Item) */}
        {selectionBounds && !interactiveMode && activeWidgetIds.length <= 1 && (
          <div
            className="absolute z-50 flex items-center gap-1 p-1 rounded-lg border shadow-xl animate-fade-in pointer-events-auto"
            style={{
              left: clamp(
                selectionBounds.x + selectionBounds.width / 2,
                120,
                Math.max(120, LW * zoom - 120)
              ),
              top: Math.max(
                8,
                selectionBounds.y < 50
                  ? selectionBounds.y + selectionBounds.height + 12
                  : selectionBounds.y - 44
              ),
              transform: "translateX(-50%)",
              background: "var(--panel)",
              borderColor: "var(--line)",
              backdropFilter: "blur(8px)",
            }}
          >
            {selectedWidget && (
              <>
                <button
                  type="button"
                  onClick={() => onGroupSelection?.()}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Group Widget (Ctrl+G)"
                >
                  <FolderPlus size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDuplicate?.(selectedWidget.id)}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Duplicate (Ctrl+D)"
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onReorder?.(selectedWidget.id, "front")}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Bring to Front"
                >
                  <BringToFront size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onReorder?.(selectedWidget.id, "back")}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Send to Back"
                >
                  <SendToBack size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleVisibility?.(selectedWidget.id)}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Toggle Visibility"
                >
                  <Eye size={13} />
                </button>
                <div className="h-3 w-px bg-[var(--line)] mx-0.5" />
                <button
                  type="button"
                  onClick={() => onDelete?.(selectedWidget.id)}
                  className="p-1.5 rounded hover:bg-[var(--danger-soft)] text-[var(--danger)] transition-colors"
                  title="Delete (Del)"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}

            {selectedGroup && (
              <>
                <button
                  type="button"
                  onClick={() => onUngroup?.(selectedGroup.id)}
                  className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                  title="Ungroup (Ctrl+Shift+G)"
                >
                  <FolderMinus size={13} />
                </button>
                <div className="h-3 w-px bg-[var(--line)] mx-0.5" />
                <button
                  type="button"
                  onClick={() => onDelete?.(selectedGroup.id)}
                  className="p-1.5 rounded hover:bg-[var(--danger-soft)] text-[var(--danger)] transition-colors"
                  title="Delete Group"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {/* 2. Floating Multi-Selection Context Bar */}
        {multiSelectionBounds && !interactiveMode && (
          <div
            className="absolute z-50 flex items-center gap-1 p-1 rounded-lg border shadow-xl animate-fade-in pointer-events-auto"
            style={{
              left: clamp(
                multiSelectionBounds.x + multiSelectionBounds.width / 2,
                160,
                Math.max(160, LW * zoom - 160)
              ),
              top: Math.max(
                8,
                multiSelectionBounds.y < 50
                  ? multiSelectionBounds.y + multiSelectionBounds.height + 12
                  : multiSelectionBounds.y - 44
              ),
              transform: "translateX(-50%)",
              background: "var(--panel)",
              borderColor: "var(--line)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="px-2 text-[11px] font-semibold text-[var(--ink-2)] border-r border-[var(--line)]">
              {activeWidgetIds.length} items
            </div>
            <button
              type="button"
              onClick={() => onGroupSelection?.()}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors flex items-center gap-1 text-[11px]"
              title="Group Selection (Ctrl+G)"
            >
              <FolderPlus size={13} />
              <span>Group</span>
            </button>
            <div className="h-3 w-px bg-[var(--line)] mx-0.5" />
            <button
              type="button"
              onClick={() => onAlignSelected?.("left")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Left"
            >
              <AlignStartHorizontal size={13} />
            </button>
            <button
              type="button"
              onClick={() => onAlignSelected?.("center")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Center"
            >
              <AlignCenterHorizontal size={13} />
            </button>
            <button
              type="button"
              onClick={() => onAlignSelected?.("right")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Right"
            >
              <AlignEndHorizontal size={13} />
            </button>
            <button
              type="button"
              onClick={() => onAlignSelected?.("top")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Top"
            >
              <AlignStartVertical size={13} />
            </button>
            <button
              type="button"
              onClick={() => onAlignSelected?.("middle")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Middle"
            >
              <AlignCenterVertical size={13} />
            </button>
            <button
              type="button"
              onClick={() => onAlignSelected?.("bottom")}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Align Bottom"
            >
              <AlignEndVertical size={13} />
            </button>
            <div className="h-3 w-px bg-[var(--line)] mx-0.5" />
            <button
              type="button"
              onClick={() => onDuplicateSelected?.()}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              title="Duplicate All (Ctrl+D)"
            >
              <Copy size={13} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteSelected?.()}
              className="p-1.5 rounded hover:bg-[var(--danger-soft)] text-[var(--danger)] transition-colors"
              title="Delete All (Del)"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
      </div>{/* close wrapper */}

      {/* 3. Floating Bottom Canvas Dock */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-lg animate-fade-in"
        style={{
          background: "color-mix(in srgb, var(--panel, #141a22) 85%, transparent)",
          borderColor: "var(--line)",
        }}
      >
        {/* Zoom Controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onZoom?.(Math.max(0.1, zoom - 0.1))}
            className="w-7 h-7 grid place-items-center rounded-full hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            title="Zoom Out"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={() => onZoomFit?.()}
            className="text-xs font-mono font-medium px-2 py-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink)] transition-colors tabular-nums min-w-[48px] text-center"
            title="Click to Reset / Fit Viewport"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            onClick={() => onZoom?.(Math.min(3, zoom + 0.1))}
            className="w-7 h-7 grid place-items-center rounded-full hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            title="Zoom In"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => onZoomFit?.()}
            className="w-7 h-7 grid place-items-center rounded-full hover:bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            title="Fit to Canvas (F)"
          >
            <Maximize size={12} />
          </button>
        </div>

        <div className="h-4 w-px bg-[var(--line)]" />

        {/* Pan Mode vs Select Pointer Mode */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPanMode(false)}
            className={`w-7 h-7 grid place-items-center rounded-full transition-colors ${
              !panMode
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
            }`}
            title="Select Tool (V)"
          >
            <MousePointer size={13} />
          </button>
          <button
            type="button"
            onClick={() => setPanMode(true)}
            className={`w-7 h-7 grid place-items-center rounded-full transition-colors ${
              panMode
                ? "bg-[var(--accent)] text-white shadow-xs"
                : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
            }`}
            title="Hand Pan Tool (H)"
          >
            <Hand size={13} />
          </button>
        </div>

        <div className="h-4 w-px bg-[var(--line)]" />

        {/* Grid Snapping Toggle */}
        <button
          type="button"
          onClick={() => setSnapToGrid((s) => !s)}
          className={`w-7 h-7 grid place-items-center rounded-full transition-colors ${
            snapToGrid
              ? "bg-[var(--accent)] text-white shadow-xs"
              : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
          }`}
          title={`Snap to 8px Grid (${snapToGrid ? "ON" : "OFF"}) (S)`}
        >
          <Grid size={13} />
        </button>
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
