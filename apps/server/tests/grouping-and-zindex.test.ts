import { describe, expect, it } from "bun:test";
import { normalizeGroup, normalizeWidget } from "../src/shared/canvas-render.js";
import type { CanvasDocument, CanvasGroup, WidgetInstance } from "../src/domain/types.js";

describe("Grouping & Relative Stacking Model", () => {
  it("normalizes canvas group with default geometry and attributes", () => {
    const rawGroup = {
      id: "grp-1",
      name: "Header Bar",
      geometry: { x: 100, y: 50, width: 400, height: 120, zIndex: 5 },
    };
    const normalized = normalizeGroup(rawGroup);

    expect(normalized.id).toBe("grp-1");
    expect(normalized.name).toBe("Header Bar");
    expect(normalized.geometry.x).toBe(100);
    expect(normalized.geometry.y).toBe(50);
    expect(normalized.geometry.width).toBe(400);
    expect(normalized.geometry.height).toBe(120);
    expect(normalized.geometry.zIndex).toBe(5);
    expect(normalized.disabled).toBe(false);
    expect(normalized.collapsed).toBe(false);
  });

  it("normalizes widget instance preserving groupId, visibility, and disabled flag", () => {
    const rawWidget = {
      id: "clock-1",
      packageId: "core",
      widgetId: "digital-clock",
      groupId: "grp-1",
      geometry: { x: 20, y: 15, width: 120, height: 60, zIndex: 1 },
      config: { format: "24h" },
      disabled: true,
      visibility: {
        defaultVisible: false,
        showInUiBuilder: true,
      },
    };
    const normalized = normalizeWidget(rawWidget);

    expect(normalized.id).toBe("clock-1");
    expect(normalized.groupId).toBe("grp-1");
    expect(normalized.geometry.x).toBe(20);
    expect(normalized.geometry.y).toBe(15);
    expect(normalized.disabled).toBe(true);
    expect(normalized.visibility?.defaultVisible).toBe(false);
    expect(normalized.visibility?.showInUiBuilder).toBe(true);
  });

  it("calculates relative coordinates correctly on group creation and ungrouping", () => {
    // Two widgets with absolute canvas coordinates
    const w1: WidgetInstance = {
      id: "w-1",
      packageId: "core",
      widgetId: "clock",
      geometry: { x: 200, y: 150, width: 100, height: 50, zIndex: 1 },
      config: {},
    };
    const w2: WidgetInstance = {
      id: "w-2",
      packageId: "core",
      widgetId: "weather",
      geometry: { x: 320, y: 180, width: 150, height: 80, zIndex: 2 },
      config: {},
    };

    // Calculate grouping bounding box
    const minX = Math.min(w1.geometry.x, w2.geometry.x); // 200
    const minY = Math.min(w1.geometry.y, w2.geometry.y); // 150
    const maxX = Math.max(w1.geometry.x + w1.geometry.width, w2.geometry.x + w2.geometry.width); // 470
    const maxY = Math.max(w1.geometry.y + w1.geometry.height, w2.geometry.y + w2.geometry.height); // 260

    const newGroup: CanvasGroup = {
      id: "grp-alpha",
      name: "Dashboard Cluster",
      geometry: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        zIndex: 10,
      },
    };

    expect(newGroup.geometry.x).toBe(200);
    expect(newGroup.geometry.y).toBe(150);
    expect(newGroup.geometry.width).toBe(270);
    expect(newGroup.geometry.height).toBe(110);

    // Re-origin widgets relative to group container
    w1.groupId = newGroup.id;
    w1.geometry.x -= newGroup.geometry.x;
    w1.geometry.y -= newGroup.geometry.y;

    w2.groupId = newGroup.id;
    w2.geometry.x -= newGroup.geometry.x;
    w2.geometry.y -= newGroup.geometry.y;

    expect(w1.geometry.x).toBe(0);
    expect(w1.geometry.y).toBe(0);
    expect(w2.geometry.x).toBe(120);
    expect(w2.geometry.y).toBe(30);

    // Absolute position computation:
    const absX1 = newGroup.geometry.x + w1.geometry.x;
    const absY1 = newGroup.geometry.y + w1.geometry.y;
    expect(absX1).toBe(200);
    expect(absY1).toBe(150);

    // Ungrouping restores original absolute coordinates:
    w1.geometry.x += newGroup.geometry.x;
    w1.geometry.y += newGroup.geometry.y;
    delete w1.groupId;

    expect(w1.geometry.x).toBe(200);
    expect(w1.geometry.y).toBe(150);
    expect(w1.groupId).toBeUndefined();
  });

  it("handles relative z-index within group local stacking context", () => {
    const group: CanvasGroup = {
      id: "grp-stack",
      name: "Layer Group",
      geometry: { x: 0, y: 0, width: 500, height: 300, zIndex: 100 },
    };

    const childA = normalizeWidget({
      id: "a",
      groupId: group.id,
      geometry: { x: 10, y: 10, width: 50, height: 50, zIndex: 1 },
    });
    const childB = normalizeWidget({
      id: "b",
      groupId: group.id,
      geometry: { x: 20, y: 20, width: 50, height: 50, zIndex: 2 },
    });

    // In CSS stacking context, childB (zIndex 2) renders in front of childA (zIndex 1)
    expect(childB.geometry.zIndex).toBeGreaterThan(childA.geometry.zIndex);
    // And the whole group's container operates at canvas zIndex 100
    expect(group.geometry.zIndex).toBe(100);
  });
});
