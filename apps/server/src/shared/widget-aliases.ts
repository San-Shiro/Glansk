// Legacy Widget Compatibility and Alias Layer
// Resolves legacy domain widgets into their packaged multi-widget equivalents
// so existing saved canvas documents load seamlessly without requiring migration.

export interface WidgetAlias {
  legacyWidgetId: string;
  targetPackageId: string;
  targetWidgetId: string;
  title: string;
  category: "control" | "data" | "media" | "display";
}

export const LEGACY_WIDGET_ALIASES: Record<string, WidgetAlias> = {
  "env-hub": {
    legacyWidgetId: "env-hub",
    targetPackageId: "com.glansk.infrastructure",
    targetWidgetId: "env-hub",
    title: "Environment Control Hub",
    category: "control",
  },
  "net-sentinel": {
    legacyWidgetId: "net-sentinel",
    targetPackageId: "com.glansk.infrastructure",
    targetWidgetId: "net-sentinel",
    title: "Cyber Sentinel & Radar",
    category: "data",
  },
  "energy-matrix": {
    legacyWidgetId: "energy-matrix",
    targetPackageId: "com.glansk.energy",
    targetWidgetId: "energy-matrix",
    title: "Smart Energy & Grid Matrix",
    category: "control",
  },
  "device-switchboard": {
    legacyWidgetId: "device-switchboard",
    targetPackageId: "com.glansk.control",
    targetWidgetId: "device-switchboard",
    title: "Smart Device Switchboard",
    category: "control",
  },
  "task-matrix": {
    legacyWidgetId: "task-matrix",
    targetPackageId: "com.glansk.productivity",
    targetWidgetId: "task-matrix",
    title: "Task & Action Matrix",
    category: "control",
  },
  "quick-notes": {
    legacyWidgetId: "quick-notes",
    targetPackageId: "com.glansk.productivity",
    targetWidgetId: "quick-notes",
    title: "Quick Notes / Sticky Board",
    category: "control",
  },
  "music-player": {
    legacyWidgetId: "music-player",
    targetPackageId: "com.glansk.media",
    targetWidgetId: "music-player",
    title: "Interactive Music Player",
    category: "media",
  },
  "emitter-widget": {
    legacyWidgetId: "emitter-widget",
    targetPackageId: "com.glansk.emitter",
    targetWidgetId: "emitter-widget",
    title: "Universal App Emitter",
    category: "control",
  },
};

export function isLegacyWidget(widgetId: string): boolean {
  return Boolean(LEGACY_WIDGET_ALIASES[widgetId]);
}

export function getWidgetAlias(widgetId: string): WidgetAlias | null {
  return LEGACY_WIDGET_ALIASES[widgetId] || null;
}

export function resolveWidgetTarget(widgetId: string, packageId?: string): { packageId: string; widgetId: string } {
  if (packageId && packageId !== "glansk.demo" && packageId !== "core" && packageId !== "") {
    return { packageId, widgetId };
  }
  const alias = LEGACY_WIDGET_ALIASES[widgetId];
  if (alias) {
    return { packageId: alias.targetPackageId, widgetId: alias.targetWidgetId };
  }
  return { packageId: packageId || "core", widgetId };
}
