// Bidirectional conversion utilities between raw stored PaddingValue / RadiusValue
// (scalars or structured objects) and control component models.
// Shared by Studio Inspector and SchemaFields.

import type { BoxSides, CornerRadius, PaddingValue, RadiusValue } from "../lib/types";
import { normalizeBox, normalizeRadius } from "@shared/appearance-normalize.js";

/**
 * Normalizes any PaddingValue (scalar number, object, or undefined) into BoxSides.
 */
export function toBoxSides(val?: PaddingValue, fallback = 12): BoxSides {
  return normalizeBox(val, fallback);
}

/**
 * Normalizes any RadiusValue (scalar number, object, or undefined) into CornerRadius.
 */
export function toCornerRadius(val?: RadiusValue, fallback = 16): CornerRadius {
  return normalizeRadius(val, fallback);
}

/**
 * Serializes BoxSides back to PaddingValue:
 * If linked, using "px", and all 4 sides are identical, preserves clean legacy scalar number.
 * Otherwise returns the full 4-side BoxSides object.
 */
export function serializePadding(box: BoxSides): PaddingValue {
  if (
    box.linked !== false &&
    (!box.unit || box.unit === "px") &&
    box.top === box.right &&
    box.right === box.bottom &&
    box.bottom === box.left
  ) {
    return box.top;
  }
  return {
    top: box.top,
    right: box.right,
    bottom: box.bottom,
    left: box.left,
    unit: box.unit || "px",
    linked: box.linked !== false,
  };
}

/**
 * Serializes CornerRadius back to RadiusValue:
 * If linked, using "px", and all 4 corners are identical, preserves clean legacy scalar number.
 * Otherwise returns the full 4-corner CornerRadius object.
 */
export function serializeRadius(radius: CornerRadius): RadiusValue {
  if (
    radius.linked !== false &&
    (!radius.unit || radius.unit === "px") &&
    radius.tl === radius.tr &&
    radius.tr === radius.br &&
    radius.br === radius.bl
  ) {
    return radius.tl;
  }
  return {
    tl: radius.tl,
    tr: radius.tr,
    br: radius.br,
    bl: radius.bl,
    unit: radius.unit || "px",
    linked: radius.linked !== false,
  };
}
