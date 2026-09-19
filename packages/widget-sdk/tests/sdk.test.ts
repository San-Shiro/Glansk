import { describe, it, expect } from "bun:test";
import { WidgetRuntime } from "../src/runtime";
import { WIDGET_PROTOCOL } from "../src/contracts";
import { validateAndPack } from "../cli/glansk-widget";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("@glansk/widget-sdk client runtime", () => {
  it("initializes and handles simulated host connect handshake", async () => {
    let mounted = false;
    let receivedConfig: any = null;

    const busTarget = new EventTarget();
    const mockBus = {
      postMessage: (msg: any) => {},
      addEventListener: (type: string, l: any) => busTarget.addEventListener(type, l),
      removeEventListener: (type: string, l: any) => busTarget.removeEventListener(type, l),
    };

    const runtime = new WidgetRuntime(
      {
        mount(ctx, container) {
          mounted = true;
          receivedConfig = ctx.config;
        },
      },
      undefined,
      mockBus
    );

    const fakeContainer = {
      innerHTML: "",
    } as any;

    runtime.init(fakeContainer);

    // Simulate host message: connected
    busTarget.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: WIDGET_PROTOCOL,
          type: "connected",
          instanceId: "inst_123",
          nonce: "nonce_abc",
          identity: { instanceId: "inst_123", packageId: "com.test", widgetId: "w1" },
          config: { message: "hello" },
        },
      })
    );

    expect(mounted).toBe(true);
    expect(receivedConfig).toEqual({ message: "hello" });

    runtime.destroy();
  });

  it("queues and handles broadcasts and commands correctly", async () => {
    let receivedBroadcast: any = null;
    const busTarget = new EventTarget();
    const mockBus = {
      postMessage: (msg: any) => {},
      addEventListener: (type: string, l: any) => busTarget.addEventListener(type, l),
      removeEventListener: (type: string, l: any) => busTarget.removeEventListener(type, l),
    };

    const runtime = new WidgetRuntime(
      {
        mount(ctx) {
          ctx.events.subscribe("weather:update", (data) => {
            receivedBroadcast = data;
          });
        },
      },
      undefined,
      mockBus
    );

    runtime.init({ innerHTML: "" } as any);

    // Connect
    busTarget.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: WIDGET_PROTOCOL,
          type: "connected",
          instanceId: "inst_999",
          nonce: "nonce_xyz",
          identity: { instanceId: "inst_999", packageId: "pkg", widgetId: "w" },
          config: {},
        },
      })
    );

    // Broadcast message from host
    busTarget.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: WIDGET_PROTOCOL,
          type: "broadcast",
          instanceId: "inst_999",
          nonce: "nonce_xyz",
          topic: "weather:update",
          payload: { temp: 24.5 },
        },
      })
    );

    expect(receivedBroadcast).toEqual({ temp: 24.5 });
    runtime.destroy();
  });

  it("packs a multi-widget folder into a valid .glpkg using CLI validateAndPack", async () => {
    const testDir = join(tmpdir(), "ld_test_pack_" + Math.random().toString(36).substring(2, 8));
    await mkdir(testDir, { recursive: true });

    const manifest = {
      manifestVersion: 2,
      id: "com.test.multi",
      version: "1.0.0",
      name: "Multi Test Package",
      widgets: [
        { id: "widget-one", name: "Widget 1", entry: "w1.html" },
        { id: "widget-two", name: "Widget 2", entry: "w2.html" },
      ],
      files: {},
    };

    await writeFile(join(testDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(testDir, "w1.html"), "<h1>Widget 1</h1>");
    await writeFile(join(testDir, "w2.html"), "<h1>Widget 2</h1>");

    const outLdpkg = join(testDir, "bundle.glpkg");
    const res = await validateAndPack(testDir, outLdpkg);

    expect(res.success).toBe(true);
    expect(res.packageFile).toBe(outLdpkg);

    await rm(testDir, { recursive: true, force: true });
  });
});
