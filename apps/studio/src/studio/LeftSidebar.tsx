import React, { useState, useEffect } from "react";
import {
  LayoutGrid,
  Layers,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Zap,
  Palette,
} from "lucide-react";
import type { CanvasDocument, CanvasVariableDefinition } from "@/lib/types";
import type { CatalogItem } from "@/lib/catalog";
import HierarchyTree from "./HierarchyTree";
import PaletteCatalog from "./Palette";
import VariablesDrawer from "./VariablesDrawer";
import SignalsDrawer from "./SignalsDrawer";
import CanvasPanel from "./inspector/CanvasPanel";

export type LeftNavTab = "layers" | "blocks" | "canvas" | "variables" | "events" | string;

export interface LeftTabItem {
  id: LeftNavTab;
  label: string;
  icon: React.ReactNode;
  shortcut: string;
  render: () => React.ReactNode;
}

interface Props {
  doc: CanvasDocument | null;
  onAdd: (item: CatalogItem) => void;
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
  onUpdateCanvas?: (p: Partial<CanvasDocument>) => void;
  onUpdateVariables?: (variables: Record<string, CanvasVariableDefinition>) => void;
  activeTab?: LeftNavTab;
  onTabChange?: (tab: LeftNavTab) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function LeftSidebar({
  doc,
  onAdd,
  selectedId,
  selectedGroupId,
  selectedWidgetIds,
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
  onUpdateCanvas,
  onUpdateVariables,
  activeTab: propActiveTab,
  onTabChange,
  collapsed: propCollapsed,
  onToggleCollapse,
}: Props) {
  const [internalTab, setInternalTab] = useState<LeftNavTab>("layers");
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const activeTab = propActiveTab ?? internalTab;
  const collapsed = propCollapsed ?? internalCollapsed;

  const setActiveTab = (t: LeftNavTab) => {
    setInternalTab(t);
    onTabChange?.(t);
  };

  const setCollapsed = (c: boolean) => {
    setInternalCollapsed(c);
    if (propCollapsed !== undefined && onToggleCollapse) {
      if (c !== propCollapsed) onToggleCollapse();
    }
  };

  // --------------------------------------------------------------------------
  // Tab Registry: Adding a new tab to LeftSidebar is as simple as defining an item here
  // --------------------------------------------------------------------------
  const tabs: LeftTabItem[] = [
    {
      id: "layers",
      label: "Layers & Hierarchy",
      icon: <Layers size={17} />,
      shortcut: "Alt+1",
      render: () =>
        doc ? (
          <HierarchyTree
            doc={doc}
            selectedId={selectedId}
            selectedGroupId={selectedGroupId}
            selectedWidgetIds={selectedWidgetIds}
            onSelectWidget={onSelectWidget}
            onSelectWidgets={onSelectWidgets}
            onSelectGroup={onSelectGroup}
            onToggleWidgetVisibility={onToggleWidgetVisibility}
            onToggleWidgetDisabled={onToggleWidgetDisabled}
            onToggleGroupVisibility={onToggleGroupVisibility}
            onToggleGroupDisabled={onToggleGroupDisabled}
            onToggleGroupCollapse={onToggleGroupCollapse}
            onReorderItem={onReorderItem}
            onCreateGroupFromSelected={onCreateGroupFromSelected}
          />
        ) : null,
    },
    {
      id: "blocks",
      label: "Widget Blocks Catalog",
      icon: <LayoutGrid size={17} />,
      shortcut: "Alt+2",
      render: () => <PaletteCatalog onAdd={onAdd} />,
    },
    {
      id: "canvas",
      label: "Canvas Settings & Themes",
      icon: <Palette size={17} />,
      shortcut: "Alt+3",
      render: () =>
        doc && onUpdateCanvas ? (
          <CanvasPanel doc={doc} onUpdateCanvas={onUpdateCanvas} />
        ) : null,
    },
    {
      id: "variables",
      label: "Canvas Variables",
      icon: <Sliders size={17} />,
      shortcut: "Alt+4",
      render: () =>
        doc ? (
          <VariablesDrawer
            open={true}
            inline={true}
            variables={doc.variables || {}}
            onUpdateVariables={onUpdateVariables || (() => {})}
            onClose={() => setCollapsed(true)}
          />
        ) : null,
    },
    {
      id: "events",
      label: "Realtime Event Bus",
      icon: <Zap size={17} />,
      shortcut: "Alt+5",
      render: () => (
        <SignalsDrawer open={true} inline={true} onClose={() => setCollapsed(true)} />
      ),
    },
  ];

  // Dynamic keyboard shortcut map based on registered tabs (Alt+digit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = Boolean(target?.closest?.("input, textarea, select, [contenteditable='true'], [role='textbox']")) || target?.isContentEditable;
      if (isInput) return;
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      const key = e.key;
      const matched = tabs.find((t) => {
        const parts = t.shortcut.split("+");
        const shortcutKey = parts[parts.length - 1];
        return shortcutKey === key;
      });
      if (matched) {
        e.preventDefault();
        setActiveTab(matched.id);
        setCollapsed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs]);

  const handleTabClick = (tabId: LeftNavTab) => {
    if (activeTab === tabId && !collapsed) {
      setCollapsed(true);
    } else {
      setActiveTab(tabId);
      setCollapsed(false);
    }
  };

  const activeTabItem = tabs.find((t) => t.id === activeTab) || tabs[0];

  return (
    <aside
      className="h-full flex select-none shrink-0 border-r z-20"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
    >
      {/* 56px Primary Icon Rail */}
      <div
        className="w-14 h-full flex flex-col items-center justify-between py-3 border-r shrink-0"
        style={{
          background: "var(--panel)",
          borderColor: "var(--line)",
        }}
      >
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Brand Mark */}
          <div className="h-9 w-9 grid place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-xs mb-1">
            <LayoutGrid size={18} />
          </div>

          {/* Dynamic Navigation Tools */}
          <div className="flex flex-col items-center gap-1.5 w-full px-2">
            {tabs.map((item) => {
              const isActive = activeTab === item.id && !collapsed;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  title={`${item.label} (${item.shortcut})`}
                  className={`w-10 h-10 grid place-items-center rounded-xl transition-all ${
                    isActive
                      ? "bg-[var(--panel-2)] text-[var(--accent)] shadow-inner border border-[var(--line-2)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {item.icon}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Rail Collapse Toggle */}
        <div className="flex flex-col items-center w-full px-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand panel" : "Collapse panel"}
            className="w-10 h-10 grid place-items-center rounded-xl text-[var(--ink-3)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)] transition-colors"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* 320px Secondary Drawer with Smooth Slide & Opacity Transition */}
      <div
        className="h-full flex flex-col border-r transition-[width,opacity] duration-200 ease-in-out overflow-hidden"
        style={{
          width: collapsed ? 0 : 320,
          minWidth: collapsed ? 0 : 320,
          maxWidth: 320,
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? "none" : "auto",
          borderColor: collapsed ? "transparent" : "var(--line)",
          borderRightWidth: collapsed ? 0 : 1,
          background: "var(--panel)",
        }}
      >
        {/* Fixed 320px inner shell prevents horizontal squishing during slide */}
        <div className="w-[320px] h-full flex flex-col overflow-hidden">
          {/* Switching Animation: Keyed transition ensures smooth tab switching */}
          <div key={activeTab} className="h-full w-full flex flex-col overflow-hidden animate-fade-in">
            {activeTabItem?.render()}
          </div>
        </div>
      </div>
    </aside>
  );
}
