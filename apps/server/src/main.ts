import { createSecureApp } from "./secure-app";
import { AuthService } from "./security/auth";
import { AuditLog } from "./security/operations";
import { ResetService } from "./operations/reset-service";
import { BackupService } from "./operations/backup-service";
import { DeviceBroker, MemoryDeviceProvider } from "./platform/device-broker";
import { loadConfig } from "./config";
import { DurableCanvasService } from "./services/canvas/durable-canvas-service";
import { FileCanvasRepository } from "./adapters/persistence/file-canvas-repository";
import { FileRuntimeRepository } from "./adapters/runtime/file-runtime-repository";
import { DeterministicRendererAdapter } from "./adapters/runtime/deterministic-renderer";
import { ActivationRuntimeService } from "./runtime/runtime-service";
import { seedShowcase } from "./showcase";
import { ShowcaseWidgetState } from "./widget-sdk/showcase-state";
import { InteractiveStateService } from "./services/interactive-state/interactive-state-service";
import { EmitterService } from "./services/emitter/emitter-service";
import { TmpfsEmitterWatcher } from "./services/emitter/tmpfs-emitter-watcher";

import { SecretVaultService } from "./services/vault/secret-vault-service";
import { PackageService } from "./services/package/package-service";

import { GLANSK_VERSION } from "../../../packages/shared/src/version";

const config = loadConfig();
const canvases = new DurableCanvasService(new FileCanvasRepository(config.dataDirectory));
await canvases.initialize();
const runtime = new ActivationRuntimeService(canvases,new FileRuntimeRepository(config.dataDirectory),new DeterministicRendererAdapter());
await runtime.initialize();
const interactiveState = new InteractiveStateService(config.dataDirectory);
await interactiveState.initialize();
const vault = new SecretVaultService(config.dataDirectory);
await vault.initialize();
const emitters = new EmitterService(canvases);
const tmpfsWatcher = new TmpfsEmitterWatcher(emitters);
await tmpfsWatcher.start();
const packages = new PackageService(config.dataDirectory, {
  onEmitterTelemetry: async (emitterId, data) => {
    emitters.publishState(emitterId, data, "http");
  },
});
await packages.init();
if (Bun.env.GLANSK_SEED_SHOWCASE === "1") await seedShowcase(canvases,runtime);
const reset=new ResetService(config.dataDirectory);await reset.recover();
const devices=new DeviceBroker(new MemoryDeviceProvider(),[4,17,18,27]);await devices.start();
const secret=Bun.env.GLANSK_ADMIN_SECRET??(Bun.env.NODE_ENV==='production'?'':'glansk-dev');
if(!secret)throw new Error('GLANSK_ADMIN_SECRET is required in production');
const devOrigins=Bun.env.NODE_ENV==='production'?[]:['http://localhost:5173','http://127.0.0.1:5173'];
const extraOrigins=(Bun.env.GLANSK_ALLOWED_ORIGINS??'').split(',').map(s=>s.trim()).filter(Boolean);
const fetch=createSecureApp({canvases,runtime,widgetState:new ShowcaseWidgetState(),interactiveState,emitters,vault,packages,auth:new AuthService(secret),audit:new AuditLog(config.dataDirectory+'/audit.ndjson'),reset,backup:new BackupService(config.dataDirectory),devices,allowedOrigins:[`http://localhost:${config.port}`,`http://127.0.0.1:${config.port}`,...devOrigins,...extraOrigins]});
const server = Bun.serve({ hostname: config.host, port: config.port, fetch, idleTimeout: 255 });
process.on("unhandledRejection", (reason) => {
  console.error("[Glansk] Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[Glansk] Uncaught Exception:", err);
});

console.log(`
  ✦ GLANSK Core v${GLANSK_VERSION} [proof-of-concept]
  ➜ Studio UI:     http://localhost:${config.port}/admin/
  ➜ Live Display:  ${server.url}
  ➜ API Gateway:   ${server.url}api/v1/
`);
