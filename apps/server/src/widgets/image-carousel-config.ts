import type { JsonValue } from "../domain/types";

export const CAROUSEL_CONFIG_MAX_BYTES = 12 * 1024;
export const CAROUSEL_IMAGE_MAX = 32;
export const CAROUSEL_FILE_MAX_BYTES = 256 * 1024;
export const CAROUSEL_PACKAGE_MAX_BYTES = 2 * 1024 * 1024;
const PATH = /^assets\/[a-z0-9][a-z0-9._/-]*\.(?:jpe?g|png|webp|avif)$/i;
export type CarouselFit = "cover" | "contain" | "fill" | "none" | "scale-down";
export interface CarouselConfig { images: string[]; intervalMs: number; transitionMs: number; fit: CarouselFit; shuffle: boolean; shuffleSeed: number; showIndicators: boolean; pauseOnHover: boolean; radiusPx: number }
const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const integer = (value: unknown, fallback: number, min: number, max: number) => Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max ? Number(value) : fallback;
export function isSafeCarouselMediaPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 160 || !PATH.test(value) || value.includes("\\") || value.includes("?") || value.includes("#")) return false;
  let decoded: string; try { decoded = decodeURIComponent(value); } catch { return false; }
  if (decoded !== value || decoded.split("/").some(part => part === "." || part === "..") || /^(?:data|blob|https?|file):/i.test(value)) return false;
  return true;
}
export function deterministicShuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values]; let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; const j = state % (i + 1); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
export function normalizeCarouselConfig(value: unknown): CarouselConfig {
  let bytes = Infinity; try { bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength; } catch {}
  if (bytes > CAROUSEL_CONFIG_MAX_BYTES || !plain(value)) throw new Error("invalid carousel config envelope");
  if (!Array.isArray(value.images) || value.images.length < 1 || value.images.length > CAROUSEL_IMAGE_MAX || !value.images.every(isSafeCarouselMediaPath)) throw new Error("invalid carousel images");
  const images = [...new Set(value.images as string[])];
  const fit: CarouselFit = ["cover","contain","fill","none","scale-down"].includes(String(value.fit)) ? value.fit as CarouselFit : "cover";
  const config: CarouselConfig = { images, intervalMs: integer(value.intervalMs, 6000, 3000, 60000), transitionMs: integer(value.transitionMs, 800, 0, 2000), fit, shuffle: value.shuffle === true, shuffleSeed: integer(value.shuffleSeed, 1, 0, 0xffffffff), showIndicators: value.showIndicators !== false, pauseOnHover: value.pauseOnHover === true, radiusPx: integer(value.radiusPx, 0, 0, 128) };
  if (config.shuffle) config.images = deterministicShuffle(config.images, config.shuffleSeed);
  return config;
}
export function asJsonConfig(config: CarouselConfig): Record<string, JsonValue> { return { ...config, images: [...config.images] }; }
export function retryDelayMs(failures: number): number { return Math.min(30000, 1000 * 2 ** Math.min(5, Math.max(0, failures - 1))); }
