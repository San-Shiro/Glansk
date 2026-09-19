export type SpacingUnit = "px" | "%";

export interface BoxSides {
  top: number;
  right: number;
  bottom: number;
  left: number;
  unit?: SpacingUnit;
  linked?: boolean;
}

export interface CornerRadius {
  tl: number;
  tr: number;
  br: number;
  bl: number;
  unit?: SpacingUnit;
  linked?: boolean;
}

export type ColorRef =
  | { kind: "literal"; value: string }
  | { kind: "token"; token: string; fallback?: string }
  | { mode?: "theme" | "custom"; value: string };

export function normalizeBox(val: unknown, fallback?: number): BoxSides;
export function boxToCss(box: unknown): string;

export function normalizeRadius(val: unknown, fallback?: number): CornerRadius;
export function radiusToCss(radius: unknown): string;

export function colorToCss(color: unknown, mode?: "cssVar" | "resolved", theme?: Record<string, string>): string | undefined;
