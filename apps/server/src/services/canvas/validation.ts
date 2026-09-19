import type { CanvasDocument } from "../../domain/types";
import { DomainError } from "../../domain/errors";

const ID = /^[a-z0-9][a-z0-9._-]{0,127}$/;

export function validateCanvas(document: CanvasDocument): CanvasDocument {
  if (!document || document.schemaVersion !== 1) throw new DomainError("schema_invalid", "Unsupported canvas schema version");
  if (!ID.test(document.id)) throw new DomainError("schema_invalid", "Canvas id is invalid");
  const { width, height } = document.logicalSize ?? {};
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 320 || width > 7680 || height < 240 || height > 4320) {
    throw new DomainError("schema_invalid", "Logical canvas size is outside supported bounds");
  }
  if (document.theme !== undefined) {
    if (!document.theme || typeof document.theme !== "object" || Array.isArray(document.theme)) throw new DomainError("schema_invalid", "Canvas theme is invalid");
    if (document.theme.preset !== undefined && (typeof document.theme.preset !== "string" || !ID.test(document.theme.preset))) throw new DomainError("schema_invalid", "Canvas theme preset is invalid");
    if (document.theme.variables !== undefined) {
      if (!document.theme.variables || typeof document.theme.variables !== "object" || Array.isArray(document.theme.variables)) throw new DomainError("schema_invalid", "Canvas theme variables are invalid");
      const entries = Object.entries(document.theme.variables);
      if (entries.length > 24 || entries.some(([key, value]) => !/^--canvas-[a-z0-9-]{1,40}$/.test(key) || typeof value !== "string" || value.length > 160 || /[;{}<>]/.test(value))) throw new DomainError("schema_invalid", "Canvas theme variable is unsafe");
    }
  }
  if (!Array.isArray(document.widgets) || document.widgets.length > 256) throw new DomainError("schema_invalid", "Canvas widget count is invalid");
  const ids = new Set<string>();
  for (const widget of document.widgets) {
    if (!ID.test(widget.id) || ids.has(widget.id)) throw new DomainError("schema_invalid", `Invalid or duplicate widget instance: ${widget.id}`);
    ids.add(widget.id);
    const g = widget.geometry;
    if (![g.x, g.y, g.width, g.height, g.zIndex].every(Number.isFinite) || g.x < 0 || g.y < 0 || g.width < 1 || g.height < 1) {
      throw new DomainError("schema_invalid", `Invalid geometry for widget: ${widget.id}`);
    }
  }
  return structuredClone(document);
}
