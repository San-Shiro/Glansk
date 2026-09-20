// Widget catalog for the editor palette.
// Glansk Core provides 8 universal primitives; domain-specific and complex
// widgets are loaded as packaged extensions via @glansk/widget-sdk.

import type { JsonValue, WidgetInstance } from "./types";

export type Category = "data" | "display" | "control" | "media";
export interface CatalogItem {
  packageId: string;
  widgetId: string;
  title: string;
  category: Category;
  packaged: boolean;
  defaultGeometry: { width: number; height: number };
  defaultConfig: Record<string, JsonValue>;
}

const core = (widgetId: string, title: string, category: Category, width: number, height: number, defaultConfig: Record<string, JsonValue>): CatalogItem =>
  ({ packageId: "core", widgetId, title, category, packaged: false, defaultGeometry: { width, height }, defaultConfig });

export const CATALOG: CatalogItem[] = [
  // --- The 8 Universal Core Primitives ---
  core("label", "Text / Label", "display", 260, 80, {
    text: "Operational Telemetry",
    subtitle: "Real-time edge subsystem metrics",
    fontSize: "lg",
    fontWeight: "semibold",
    align: "left",
  }),

  core("button", "Action Button", "control", 200, 52, {
    label: "Trigger Command",
    icon: "zap",
    variant: "solid",
    actionType: "command",
    target: "system.action",
  }),

  core("icon", "Icon Symbol", "display", 120, 120, {
    icon: "zap",
    size: 40,
    shape: "rounded",
    badge: "LIVE",
  }),

  core("image", "Static / Web Image", "media", 360, 240, {
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&q=80",
    alt: "Dashboard Asset",
    fit: "cover",
    radius: 12,
    opacity: 100,
  }),

  core("shape", "Shape Container", "display", 240, 160, {
    shapeType: "rounded-rect",
    radius: 16,
    borderWidth: 1,
    blur: 0,
  }),

  core("video", "Video Player / Stream", "media", 440, 260, {
    url: "",
    autoplay: true,
    loop: true,
    muted: true,
    controls: false,
    fit: "cover",
  }),

  core("audio", "Audio Primitive", "media", 360, 100, {
    title: "Audio Stream",
    artist: "Universal Player",
    playing: false,
    src: "",
  }),

  core("slideshow", "Image Slideshow", "media", 560, 320, {
    label: "Image Deck",
    images: [
      "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1280&q=80",
      "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1280&q=80",
      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1280&q=80",
    ],
    interval: 6,
    transitionSpeed: 800,
    transition: "crossfade",
    fit: "cover",
    showIndicators: true,
  }),

  // --- Packaged Showcase Widgets (Loaded via SDK runtime) ---
  { packageId: "glansk.demo", widgetId: "aurora-metric", title: "Aurora Metric", category: "data", packaged: true, defaultGeometry: { width: 360, height: 200 },
    defaultConfig: { eyebrow: "LIVE SIGNAL", label: "Performance", value: "84.2", unit: "%", trend: "12.4%", detail: "Healthy trajectory", values: [24, 38, 31, 52, 49, 70, 64, 82] } },
  { packageId: "glansk.demo", widgetId: "telemetry-chart", title: "Telemetry Chart", category: "data", packaged: true, defaultGeometry: { width: 700, height: 300 },
    defaultConfig: { label: "Live Telemetry", channels: ["showcase/telemetry"], series: [{ key: "cpu", label: "CPU", color: "cyan" }, { key: "memory", label: "Memory", color: "violet" }] } },
  { packageId: "glansk.demo", widgetId: "status-grid", title: "Status Grid", category: "data", packaged: true, defaultGeometry: { width: 650, height: 330 },
    defaultConfig: { label: "Service Status Grid", channels: ["showcase/services", "showcase/incidents"], table: { columns: [{ key: "name", label: "Service" }, { key: "status", label: "State" }, { key: "region", label: "Region" }, { key: "incident", label: "Incident" }] }, empty: { message: "No services" } } },
  { packageId: "glansk.demo", widgetId: "command-control", title: "Incident Command", category: "control", packaged: true, defaultGeometry: { width: 610, height: 100 },
    defaultConfig: { label: "Incident Command", commands: ["showcase.acknowledge"], target: { kind: "service", id: "worker" } } },
  { packageId: "glansk.demo", widgetId: "sdk-status", title: "SDK Broker State", category: "data", packaged: true, defaultGeometry: { width: 612, height: 80 },
    defaultConfig: { label: "SDK Broker State", channel: "showcase/operations", tone: "green" } },
  { packageId: "glansk.media", widgetId: "image-carousel", title: "Image Carousel", category: "media", packaged: true, defaultGeometry: { width: 520, height: 300 },
    defaultConfig: { label: "Packaged Carousel", images: ["assets/aurora.png", "assets/sunrise.png"], intervalMs: 3000, transitionMs: 600, fit: "cover", shuffle: false, showIndicators: true, pauseOnHover: true, radiusPx: 17 } },
];

export const CATEGORY_LABELS: Record<Category, string> = { data: "Data", display: "Display", control: "Control", media: "Media" };
export const CATEGORY_COLORS: Record<Category, string> = { data: "var(--cat-data)", display: "var(--cat-display)", control: "var(--cat-control)", media: "var(--cat-media)" };

let counter = 0;
export function instantiate(item: CatalogItem, x: number, y: number, zIndex: number): WidgetInstance {
  const id = `${item.widgetId}-${Date.now().toString(36)}${(counter++).toString(36)}`.slice(0, 40);
  return {
    id,
    packageId: item.packageId,
    widgetId: item.widgetId,
    geometry: { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)), width: item.defaultGeometry.width, height: item.defaultGeometry.height, zIndex },
    config: structuredClone(item.defaultConfig),
  };
}

let activeDraggingWidget: CatalogItem | null = null;
export function setActiveDraggingWidget(item: CatalogItem | null) {
  activeDraggingWidget = item;
}
export function getActiveDraggingWidget(): CatalogItem | null {
  return activeDraggingWidget;
}
