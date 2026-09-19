import { useState, useMemo } from "react";
import { 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Lock, 
  Unlock, 
  GripVertical, 
  Layers, 
  Search, 
  FolderPlus,
  Box,
  Component
} from "lucide-react";
import type { CanvasDocument, CanvasGroup, WidgetInstance } from "@/lib/types";
import { getWidgetDefinition } from "@shared/widget-definitions.js";

interface Props {
  doc: CanvasDocument;
  selectedId: string | null;
  selectedGroupId: string | null;
  selectedWidgetIds?: string[];
  onSelectWidget: (id: string | null) => void;
  onSelectWidgets?: (ids: string[]) => void;
  onSelectGroup: (id: string | null) => void;
  onToggleWidgetVisibility: (id: string) => void;
  onToggleWidgetDisabled: (id: string) => void;
  onToggleGroupVisibility: (id: string) => void;
  onToggleGroupDisabled: (id: string) => void;
  onToggleGroupCollapse: (id: string) => void;
  onReorderItem: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => void;
  onCreateGroupFromSelected?: () => void;
}

export default function HierarchyTree({
  doc,
  selectedId,
  selectedGroupId,
  selectedWidgetIds = [],
  onSelectWidget,
  onSelectWidgets,
  onSelectGroup,
  onToggleWidgetVisibility,
  onToggleWidgetDisabled,
  onToggleGroupVisibility,
  onToggleGroupDisabled,
  onToggleGroupCollapse,
  onReorderItem,
  onCreateGroupFromSelected,
}: Props) {
  const [filter, setFilter] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  const groups = doc.groups || [];
  const widgets = doc.widgets || [];

  // Categorize widgets into groups and root level
  const { groupedWidgets, rootWidgets } = useMemo(() => {
    const grouped = new Map<string, WidgetInstance[]>();
    const root: WidgetInstance[] = [];

    // Sort widgets by local zIndex descending so higher zIndex appears at the top like layers
    const sorted = [...widgets].sort((a, b) => (b.geometry.zIndex ?? 0) - (a.geometry.zIndex ?? 0));

    for (const w of sorted) {
      if (w.groupId && groups.some(g => g.id === w.groupId)) {
        const list = grouped.get(w.groupId) || [];
        list.push(w);
        grouped.set(w.groupId, list);
      } else {
        root.push(w);
      }
    }

    return { groupedWidgets: grouped, rootWidgets: root };
  }, [widgets, groups]);

  // Sort groups by zIndex descending
  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => (b.geometry.zIndex ?? 0) - (a.geometry.zIndex ?? 0));
  }, [groups]);

  // Filter matching
  const matchesFilter = (title: string, id: string) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return title.toLowerCase().includes(q) || id.toLowerCase().includes(q);
  };

  return (
    <div className="flex flex-col h-full select-none text-[13px]" style={{ color: "var(--ink, #f1f5f9)" }}>
      {/* Header & Filter */}
      <div className="p-3 border-b flex flex-col gap-2 shrink-0" style={{ borderColor: "var(--line, #1f2d40)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-3, #64748b)]">
            <Layers size={13} className="text-[var(--accent, #38bdf8)]" />
            <span>Layers & Hierarchy</span>
            <span className="ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--panel-2, #18263a)] text-[var(--ink-2, #94a3b8)]">
              {widgets.length + groups.length}
            </span>
          </div>
          {onCreateGroupFromSelected && (
            <button
              onClick={onCreateGroupFromSelected}
              title="New Group from Selection"
              className="p-1 rounded hover:bg-[var(--panel-2, #18263a)] text-[var(--ink-2, #94a3b8)] hover:text-[var(--accent, #38bdf8)] transition-colors"
            >
              <FolderPlus size={14} />
            </button>
          )}
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3, #64748b)]" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter layers..."
            className="w-full pl-7 pr-2 py-1 text-[12px] bg-[var(--panel-2, #121d2d)] border border-[var(--line, #1f2d40)] rounded-md focus:outline-none focus:border-[var(--accent, #38bdf8)] transition-colors"
            style={{ color: "var(--ink, #f1f5f9)" }}
          />
        </div>
      </div>

      {/* Layer Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sortedGroups.map(grp => {
          const childWidgets = groupedWidgets.get(grp.id) || [];
          const isCollapsed = Boolean(grp.collapsed);
          const isGroupSelected = selectedGroupId === grp.id;
          const isGroupHidden = grp.visibility?.defaultVisible === false;
          const isGroupDisabled = Boolean(grp.disabled);

          if (filter && !matchesFilter(grp.name, grp.id) && !childWidgets.some(w => matchesFilter(w.config?.title as string || w.widgetId, w.id))) {
            return null;
          }

          return (
            <div 
              key={grp.id}
              className="flex flex-col group/folder rounded-lg transition-all"
              onDragOver={e => {
                e.preventDefault();
                setDragOverTargetId(grp.id);
              }}
              onDragLeave={() => {
                if (dragOverTargetId === grp.id) setDragOverTargetId(null);
              }}
              onDrop={e => {
                e.preventDefault();
                if (draggedItemId && draggedItemId !== grp.id) {
                  onReorderItem(draggedItemId, grp.id, "inside");
                }
                setDraggedItemId(null);
                setDragOverTargetId(null);
              }}
            >
              {/* Group Row */}
              <div
                draggable
                onDragStart={() => setDraggedItemId(grp.id)}
                onClick={() => {
                  onSelectGroup(grp.id);
                  onSelectWidget(null);
                }}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
                  isGroupSelected 
                    ? "bg-[var(--accent-soft, rgba(56,189,248,0.12))] text-[var(--accent, #38bdf8)] border border-[var(--accent, #38bdf8)]" 
                    : "hover:bg-[var(--panel-2, #142030)] text-[var(--ink, #f1f5f9)]"
                } ${dragOverTargetId === grp.id ? "ring-2 ring-[var(--accent, #38bdf8)]" : ""}`}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGroupCollapse(grp.id);
                    }}
                    className="p-0.5 text-[var(--ink-3, #64748b)] hover:text-[var(--ink, #f1f5f9)]"
                  >
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>

                  <span className="shrink-0 text-amber-400">
                    {isCollapsed ? <Folder size={14} /> : <FolderOpen size={14} />}
                  </span>

                  <span className="font-semibold truncate text-[12px]">{grp.name}</span>

                  <span className="text-[10px] font-mono px-1 rounded bg-[var(--panel, #0e1726)] text-[var(--ink-3, #64748b)]">
                    {childWidgets.length}
                  </span>
                </div>

                {/* Inline Action Toggles */}
                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/folder:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGroupVisibility(grp.id);
                    }}
                    title={isGroupHidden ? "Show Group" : "Hide Group"}
                    className={`p-1 rounded hover:bg-[var(--panel, #0e1726)] transition-colors ${
                      isGroupHidden ? "text-[var(--ink-3, #64748b)]" : "text-[var(--ink-2, #94a3b8)]"
                    }`}
                  >
                    {isGroupHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleGroupDisabled(grp.id);
                    }}
                    title={isGroupDisabled ? "Enable Group" : "Disable / Lock Group"}
                    className={`p-1 rounded hover:bg-[var(--panel, #0e1726)] transition-colors ${
                      isGroupDisabled ? "text-amber-400" : "text-[var(--ink-3, #64748b)]"
                    }`}
                  >
                    {isGroupDisabled ? <Lock size={13} /> : <Unlock size={13} />}
                  </button>
                </div>
              </div>

              {/* Children (Widgets in Group) with Tree Guide Lines */}
              {!isCollapsed && childWidgets.length > 0 && (
                <div className="relative pl-6 my-0.5 space-y-0.5">
                  {/* Vertical Tree Connector Line matching image copy 3.png */}
                  <div 
                    className="absolute left-3.5 top-0 bottom-2 w-px" 
                    style={{ background: "color-mix(in srgb, var(--line, #223249) 75%, transparent)" }} 
                  />

                  {childWidgets.map(w => renderWidgetRow(w, true))}
                </div>
              )}
            </div>
          );
        })}

        {/* Root Level Widgets */}
        {rootWidgets.map(w => renderWidgetRow(w, false))}

        {widgets.length === 0 && groups.length === 0 && (
          <div className="p-6 text-center text-[12px] text-[var(--ink-3, #64748b)]">
            No widgets on canvas. Drag items from the Palette to start building.
          </div>
        )}
      </div>
    </div>
  );

  function renderWidgetRow(w: WidgetInstance, isNested: boolean) {
    const isSelected = selectedWidgetIds.length > 0 ? selectedWidgetIds.includes(w.id) : selectedId === w.id;
    const isHidden = w.visibility?.defaultVisible === false;
    const isDisabled = Boolean(w.disabled);
    const def = getWidgetDefinition(w.widgetId);
    const title = (w.config?.title as string) || (w.config?.label as string) || def?.title || w.widgetId;

    if (filter && !matchesFilter(title, w.id)) return null;

    return (
      <div
        key={w.id}
        draggable
        onDragStart={() => setDraggedItemId(w.id)}
        onDragOver={e => {
          e.preventDefault();
          setDragOverTargetId(w.id);
        }}
        onDragLeave={() => {
          if (dragOverTargetId === w.id) setDragOverTargetId(null);
        }}
        onDrop={e => {
          e.preventDefault();
          if (draggedItemId && draggedItemId !== w.id) {
            onReorderItem(draggedItemId, w.id, "after");
          }
          setDraggedItemId(null);
          setDragOverTargetId(null);
        }}
        onClick={(e) => {
          if (e.shiftKey && onSelectWidgets) {
            const next = selectedWidgetIds.includes(w.id)
              ? selectedWidgetIds.filter((id) => id !== w.id)
              : [...selectedWidgetIds, w.id];
            onSelectWidgets(next);
            onSelectGroup(null);
          } else {
            onSelectWidget(w.id);
            onSelectGroup(null);
            onSelectWidgets?.([w.id]);
          }
        }}
        className={`group/item flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer transition-all ${
          isSelected
            ? "bg-[var(--accent-soft, rgba(56,189,248,0.12))] text-[var(--accent, #38bdf8)] border border-[var(--accent, #38bdf8)] font-semibold shadow-xs"
            : "hover:bg-[var(--panel-2, #142030)] text-[var(--ink, #f1f5f9)]"
        } ${dragOverTargetId === w.id ? "border-b-2 border-b-[var(--accent, #38bdf8)]" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GripVertical size={12} className="shrink-0 text-[var(--ink-3, #64748b)] cursor-grab opacity-0 group-hover/item:opacity-100 transition-opacity" />

          {/* Node Icon */}
          <span className="shrink-0 text-[var(--accent, #38bdf8)] opacity-85">
            {w.packageId === "core" ? <Box size={13} /> : <Component size={13} />}
          </span>

          <span className="truncate text-[12px]">{title}</span>

          <span className="text-[9px] uppercase tracking-wider font-mono px-1 rounded bg-[var(--panel, #0e1726)] text-[var(--ink-3, #64748b)] shrink-0">
            {w.widgetId}
          </span>
        </div>

        {/* Inline Action Toggles */}
        <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover/item:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWidgetVisibility(w.id);
            }}
            title={isHidden ? "Show Widget" : "Hide Widget"}
            className={`p-1 rounded hover:bg-[var(--panel, #0e1726)] transition-colors ${
              isHidden ? "text-[var(--ink-3, #64748b)]" : "text-[var(--ink-2, #94a3b8)]"
            }`}
          >
            {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleWidgetDisabled(w.id);
            }}
            title={isDisabled ? "Enable Widget" : "Disable / Lock Widget"}
            className={`p-1 rounded hover:bg-[var(--panel, #0e1726)] transition-colors ${
              isDisabled ? "text-amber-400" : "text-[var(--ink-3, #64748b)]"
            }`}
          >
            {isDisabled ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
        </div>
      </div>
    );
  }
}
