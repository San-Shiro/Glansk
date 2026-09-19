import { describe, expect, it } from "bun:test";
import {
  normalizeBox,
  boxToCss,
  normalizeRadius,
  radiusToCss,
  colorToCss,
} from "../src/shared/appearance-normalize.js";
import {
  toBoxSides,
  toCornerRadius,
  serializePadding,
  serializeRadius,
} from "../../studio/src/studio/appearance-adapters";

describe("appearance-normalize module", () => {
  it("normalizes legacy scalar numbers for box padding/margin", () => {
    const box = normalizeBox(12);
    expect(box).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
      unit: "px",
      linked: true,
    });
    expect(boxToCss(12)).toBe("12px");
  });

  it("normalizes null/undefined with fallback", () => {
    const box = normalizeBox(null, 6);
    expect(box).toEqual({
      top: 6,
      right: 6,
      bottom: 6,
      left: 6,
      unit: "px",
      linked: true,
    });
    expect(boxToCss(box)).toBe("6px");
  });

  it("handles 4-way asymmetric box padding", () => {
    const box = normalizeBox({ top: 10, right: 20, bottom: 30, left: 40, unit: "px" });
    expect(box).toEqual({
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
      unit: "px",
      linked: false,
    });
    expect(boxToCss(box)).toBe("10px 20px 30px 40px");
  });

  it("handles 2-axis symmetric box padding", () => {
    const box = normalizeBox({ top: 14, right: 24, bottom: 14, left: 24 });
    expect(boxToCss(box)).toBe("14px 24px");
  });

  it("normalizes corner radius scalar and 4-corner object", () => {
    expect(radiusToCss(16)).toBe("16px");

    const r = normalizeRadius({ tl: 8, tr: 16, br: 24, bl: 32 });
    expect(r.linked).toBe(false);
    expect(radiusToCss(r)).toBe("8px 16px 24px 32px");
  });

  it("resolves color references in both cssVar and resolved mode", () => {
    const theme = {
      "--canvas-accent": "#53e0bc",
      "--canvas-surface": "#12243a",
    };

    // String literal
    expect(colorToCss("#ff0000")).toBe("#ff0000");

    // CSS token in cssVar mode
    expect(colorToCss("--canvas-accent", "cssVar")).toBe("var(--canvas-accent)");

    // CSS token in resolved mode (for iframes)
    expect(colorToCss("--canvas-accent", "resolved", theme)).toBe("#53e0bc");

    // Structured token
    expect(colorToCss({ kind: "token", token: "accent" }, "cssVar")).toBe("var(--canvas-accent)");
    expect(colorToCss({ kind: "token", token: "--canvas-surface" }, "resolved", theme)).toBe("#12243a");

    // Structured literal
    expect(colorToCss({ kind: "literal", value: "rgba(0,0,0,0.5)" })).toBe("rgba(0,0,0,0.5)");
  });
});

describe("appearance-adapters module", () => {
  it("toBoxSides normalizes scalars, objects, and empty fallbacks", () => {
    expect(toBoxSides(16)).toEqual({ top: 16, right: 16, bottom: 16, left: 16, unit: "px", linked: true });
    expect(toBoxSides(undefined, 8)).toEqual({ top: 8, right: 8, bottom: 8, left: 8, unit: "px", linked: true });
    expect(toBoxSides({ top: 4, right: 8, bottom: 12, left: 16 })).toEqual({
      top: 4,
      right: 8,
      bottom: 12,
      left: 16,
      unit: "px",
      linked: false,
    });
  });

  it("toCornerRadius normalizes scalars, objects, and empty fallbacks", () => {
    expect(toCornerRadius(12)).toEqual({ tl: 12, tr: 12, br: 12, bl: 12, unit: "px", linked: true });
    expect(toCornerRadius(undefined, 20)).toEqual({ tl: 20, tr: 20, br: 20, bl: 20, unit: "px", linked: true });
    expect(toCornerRadius({ tl: 2, tr: 4, br: 6, bl: 8, unit: "%" })).toEqual({
      tl: 2,
      tr: 4,
      br: 6,
      bl: 8,
      unit: "%",
      linked: false,
    });
  });

  it("serializePadding preserves legacy scalar number when uniform, linked, and px", () => {
    expect(serializePadding({ top: 12, right: 12, bottom: 12, left: 12, unit: "px", linked: true })).toBe(12);
    expect(serializePadding({ top: 0, right: 0, bottom: 0, left: 0, linked: true })).toBe(0);
  });

  it("serializePadding preserves full BoxSides object when asymmetric or unlinked or percentage", () => {
    // Unlinked
    expect(serializePadding({ top: 12, right: 12, bottom: 12, left: 12, unit: "px", linked: false })).toEqual({
      top: 12,
      right: 12,
      bottom: 12,
      left: 12,
      unit: "px",
      linked: false,
    });
    // Asymmetric
    expect(serializePadding({ top: 8, right: 16, bottom: 8, left: 16, unit: "px", linked: true })).toEqual({
      top: 8,
      right: 16,
      bottom: 8,
      left: 16,
      unit: "px",
      linked: true,
    });
    // Percentage unit
    expect(serializePadding({ top: 5, right: 5, bottom: 5, left: 5, unit: "%", linked: true })).toEqual({
      top: 5,
      right: 5,
      bottom: 5,
      left: 5,
      unit: "%",
      linked: true,
    });
  });

  it("serializeRadius preserves legacy scalar number when uniform, linked, and px", () => {
    expect(serializeRadius({ tl: 16, tr: 16, br: 16, bl: 16, unit: "px", linked: true })).toBe(16);
    expect(serializeRadius({ tl: 0, tr: 0, br: 0, bl: 0, linked: true })).toBe(0);
  });

  it("serializeRadius preserves full CornerRadius object when asymmetric or unlinked or percentage", () => {
    // Unlinked
    expect(serializeRadius({ tl: 16, tr: 16, br: 16, bl: 16, unit: "px", linked: false })).toEqual({
      tl: 16,
      tr: 16,
      br: 16,
      bl: 16,
      unit: "px",
      linked: false,
    });
    // Asymmetric
    expect(serializeRadius({ tl: 8, tr: 16, br: 8, bl: 16, unit: "px", linked: true })).toEqual({
      tl: 8,
      tr: 16,
      br: 8,
      bl: 16,
      unit: "px",
      linked: true,
    });
    // Percentage unit
    expect(serializeRadius({ tl: 50, tr: 50, br: 50, bl: 50, unit: "%", linked: true })).toEqual({
      tl: 50,
      tr: 50,
      br: 50,
      bl: 50,
      unit: "%",
      linked: true,
    });
  });
});
