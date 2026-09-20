import type {
  CanvasDocument,
  CanvasGroup,
  JsonValue,
  WidgetGeometry,
  WidgetInstance,
  WidgetVisibilityConfig,
} from "@/lib/types";

export type InspectorTab = "config" | "style" | "data" | "logic";

export interface InspectorProps {
  doc: CanvasDocument;
  selectedId: string | null;
  selectedGroupId?: string | null;
  onSelect?: (id: string | null) => void;
  onSelectGroup?: (id: string | null) => void;
  onUpdateCanvas: (patch: Partial<CanvasDocument>) => void;
  onUpdateGeometry: (id: string, g: WidgetGeometry) => void;
  onUpdateGroupGeometry?: (id: string, g: CanvasGroup["geometry"]) => void;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
  onUpdateWidgetVisibility?: (id: string, visibility: WidgetVisibilityConfig) => void;
  onUpdateGroup?: (id: string, patch: Partial<CanvasGroup>) => void;
  onUngroup?: (groupId: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, dir: "front" | "back") => void;
  selectedWidgetIds?: string[];
  onGroupSelection?: () => void;
  onAlignSelected?: (dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => void;
  onDistributeSelected?: (axis: "horizontal" | "vertical") => void;
  onDeleteSelected?: () => void;
  onToggleDisabled?: (id: string) => void;
  onCollapse?: () => void;
}

export interface WidgetTabProps {
  widget: WidgetInstance;
  doc: CanvasDocument;
  onUpdateGeometry: (id: string, g: WidgetGeometry) => void;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
  onUpdateWidgetVisibility?: (id: string, visibility: WidgetVisibilityConfig) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (id: string, dir: "front" | "back") => void;
}
