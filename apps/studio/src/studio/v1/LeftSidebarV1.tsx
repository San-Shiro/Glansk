import { useState } from "react";
import { LayoutGrid, Layers, Search, ChevronLeft, ChevronRight, Palette as PaletteIcon, Radio } from "lucide-react";
import type { CanvasDocument } from "@/lib/types";
import { CATALOG, type CatalogItem } from "@/lib/catalog";
import HierarchyTree from "../HierarchyTree";
import Palette from "../Palette";

interface Props {
  doc: CanvasDocument | null;
  onAdd: (item: CatalogItem) => void;
  selectedId: string | null;
  selectedGroupId: string | null;
  onSelectWidget: (id: string | null) => void;
  onSelectGroup: (id: string | null) => void;
  onToggleWidgetVisibility: (id: string) => void;
  onToggleWidgetDisabled: (id: string) => void;
  onToggleGroupVisibility: (id: string) => void;
  onToggleGroupDisabled: (id: string) => void;
  onToggleGroupCollapse: (id: string) => void;
  onReorderItem: (draggedId: string, targetId: string, position: "before" | "after" | "inside") => void;
  onCreateGroupFromSelected?: () => void;
}

export type LeftNavTab = "widgets" | "layers";

export default function LeftSidebar({
  doc,
  onAdd,
  selectedId,
  selectedGroupId,
  onSelectWidget,
  onSelectGroup,
  onToggleWidgetVisibility,
  onToggleWidgetDisabled,
  onToggleGroupVisibility,
  onToggleGroupDisabled,
  onToggleGroupCollapse,
  onReorderItem,
  onCreateGroupFromSelected,
}: Props) {
  const [activeTab, setActiveTab] = useState<LeftNavTab>("layers");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="h-full flex select-none shrink-0 border-r" style={{ borderColor: "var(--line, #1f2d40)" }}>
      {/* 56px Primary Icon Rail matching image copy 3.png & image copy.png */}
      <div 
        className="w-14 h-full flex flex-col items-center justify-between py-3 border-r"
        style={{ 
          background: "color-mix(in srgb, var(--panel, #0e1726) 96%, black 4%)", 
          borderColor: "var(--line, #1f2d40)" 
        }}
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Logo / Brand Mark */}
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--accent-soft, rgba(56,189,248,0.12))] text-[var(--accent, #38bdf8)] shadow-xs mb-1">
            <LayoutGrid size={18} />
          </div>

          {/* Navigation Tools */}
          <div className="flex flex-col items-center gap-1.5 w-full px-2">
            {/* Layers & Hierarchy Tree Tab */}
            <button
              onClick={() => {
                if (activeTab === "layers" && !collapsed) {
                  setCollapsed(true);
                } else {
                  setActiveTab("layers");
                  setCollapsed(false);
                }
              }}
              title="Layers & Hierarchy (L)"
              className={`w-10 h-10 grid place-items-center rounded-xl transition-all ${
                activeTab === "layers" && !collapsed
                  ? "bg-[var(--panel-2, #18263a)] text-[var(--accent, #38bdf8)] shadow-inner border border-[var(--line, #283e5c)]"
                  : "text-[var(--ink-2, #94a3b8)] hover:bg-[var(--panel-2, #142030)] hover:text-[var(--ink, #f1f5f9)]"
              }`}
            >
              <Layers size={18} />
            </button>

            {/* Widgets Palette Tab */}
            <button
              onClick={() => {
                if (activeTab === "widgets" && !collapsed) {
                  setCollapsed(true);
                } else {
                  setActiveTab("widgets");
                  setCollapsed(false);
                }
              }}
              title="Widget Library (W)"
              className={`w-10 h-10 grid place-items-center rounded-xl transition-all ${
                activeTab === "widgets" && !collapsed
                  ? "bg-[var(--panel-2, #18263a)] text-[var(--accent, #38bdf8)] shadow-inner border border-[var(--line, #283e5c)]"
                  : "text-[var(--ink-2, #94a3b8)] hover:bg-[var(--panel-2, #142030)] hover:text-[var(--ink, #f1f5f9)]"
              }`}
            >
              <PaletteIcon size={18} />
            </button>
          </div>
        </div>

        {/* Bottom Rail Collapse Toggle */}
        <div className="flex flex-col items-center w-full px-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-10 h-10 grid place-items-center rounded-xl text-[var(--ink-3, #64748b)] hover:bg-[var(--panel-2, #142030)] hover:text-[var(--ink, #f1f5f9)] transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Drawer (240px) */}
      {!collapsed && (
        <div className="w-[244px] h-full flex flex-col bg-[var(--panel, #0e1726)] animate-in fade-in slide-in-from-left-2 duration-100">
          {activeTab === "layers" && doc ? (
            <HierarchyTree
              doc={doc}
              selectedId={selectedId}
              selectedGroupId={selectedGroupId}
              onSelectWidget={onSelectWidget}
              onSelectGroup={onSelectGroup}
              onToggleWidgetVisibility={onToggleWidgetVisibility}
              onToggleWidgetDisabled={onToggleWidgetDisabled}
              onToggleGroupVisibility={onToggleGroupVisibility}
              onToggleGroupDisabled={onToggleGroupDisabled}
              onToggleGroupCollapse={onToggleGroupCollapse}
              onReorderItem={onReorderItem}
              onCreateGroupFromSelected={onCreateGroupFromSelected}
            />
          ) : (
            <Palette onAdd={onAdd} />
          )}
        </div>
      )}
    </aside>
  );
}
