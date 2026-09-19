import { describe, expect, test } from "bun:test";
import { deterministicShuffle, isSafeCarouselMediaPath, normalizeCarouselConfig, retryDelayMs } from "../src/widgets/image-carousel-config";
import { isPackagedWidget } from "../src/widgets/registry";

describe("hardened image carousel policy", () => {
  test("normalizes a strict typed bounded config", () => { const c=normalizeCarouselConfig({images:["assets/one.png","assets/two.webp"],intervalMs:3000,transitionMs:0,fit:"contain",shuffle:true,shuffleSeed:7,pauseOnHover:true,radiusPx:12}); expect(c.images).toEqual(deterministicShuffle(["assets/one.png","assets/two.webp"],7)); expect(c.fit).toBe("contain"); });
  test("rejects unsafe media paths and envelopes", () => { for(const path of ["../x.png","assets/%2e%2e/x.png","assets/x.svg","assets/x.gif","https://x/a.png","data:image/png,x","blob:x","assets/x.png?q=1","assets/x.png#x","/assets/x.png"]) expect(isSafeCarouselMediaPath(path)).toBe(false); expect(()=>normalizeCarouselConfig({images:[]})).toThrow(); expect(()=>normalizeCarouselConfig({images:Array(33).fill("assets/a.png")})).toThrow(); expect(()=>normalizeCarouselConfig({images:["assets/a.png"],padding:"x".repeat(13000)})).toThrow(); });
  test("shuffle and retry backoff are deterministic and bounded", () => { expect(deterministicShuffle([1,2,3,4],42)).toEqual(deterministicShuffle([1,2,3,4],42)); expect(retryDelayMs(1)).toBe(1000); expect(retryDelayMs(99)).toBe(30000); });
  test("uses a narrow packaged widget registry", () => { expect(isPackagedWidget("glansk.media","image-carousel")).toBe(true); expect(isPackagedWidget("glansk.demo","aurora-metric")).toBe(true); expect(isPackagedWidget("glansk.media","other")).toBe(false); });
});
