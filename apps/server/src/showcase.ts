import type { CanvasDocument, JsonValue, WidgetInstance } from './domain/types';
import type { CanvasService } from './services/contracts';
import type { RuntimeService } from './runtime/contracts';

export interface DemoWidgetDefinition {
  packageId: string;
  widgetId: string;
  title: string;
  category: 'display' | 'data' | 'control';
  defaultGeometry: { width: number; height: number };
  defaultConfig: Record<string, JsonValue>;
}

const def = (
  widgetId: string,
  title: string,
  category: 'display' | 'data' | 'control',
  width: number,
  height: number,
  defaultConfig: Record<string, JsonValue>
): DemoWidgetDefinition => ({
  packageId: 'glansk.demo',
  widgetId,
  title,
  category,
  defaultGeometry: { width, height },
  defaultConfig,
});

export const demoWidgetCatalog: readonly DemoWidgetDefinition[] = [
  def('env-hub', 'Environment Control Hub', 'control', 560, 360, {
    label: 'Environment Hub',
    location: 'Living Room Hub',
    temperature: 23.4,
    targetTemperature: 22.0,
    humidity: 48,
    airQuality: 32,
    mode: 'auto',
    fanSpeed: 2,
    power: true,
    history: [21, 21.8, 22.4, 23.0, 23.8, 24.2, 23.9, 23.4, 22.8, 22.5, 23.1, 23.4],
  }),
  def('energy-matrix', 'Smart Energy Matrix', 'control', 620, 400, {
    label: 'Energy Flow Matrix',
    solarKw: 5.24,
    homeKw: 2.85,
    batteryKw: 1.95,
    batterySoc: 88,
    batteryCharging: true,
    gridKw: -0.44,
    selfPowered: 94,
    dailySolarKwh: 28.4,
  }),
  def('net-sentinel', 'Cyber Sentinel & Radar', 'data', 560, 360, {
    label: 'Cyber Sentinel Radar',
    threatLevel: 'DEFCON 5: NOMINAL',
    ping: 14,
    jitter: 0.8,
    throughput: 842,
    packetLoss: 0.00,
    onlineNodes: 24,
    totalNodes: 24,
    radarSpeed: 4.0,
    blips: [
      { id: 'gw-1', x: 68, y: 38, label: 'GW-Alpha', tone: 'ok', ping: 8 },
      { id: 'node-2', x: 122, y: 72, label: 'Edge-West', tone: 'ok', ping: 14 },
      { id: 'srv-3', x: 42, y: 118, label: 'Core-DB', tone: 'ok', ping: 11 },
      { id: 'iot-4', x: 118, y: 128, label: 'Sensor-Mesh', tone: 'warn', ping: 42 },
    ],
  }),
];

const w = (
  id: string,
  widgetId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  config: Record<string, JsonValue>
): WidgetInstance => ({
  id,
  packageId: 'glansk.demo',
  widgetId,
  geometry: { x, y, width, height, zIndex: 1 },
  config,
});

export const SHOWCASE_ID = 'glansk-demo-showcase';

export function showcaseDocument(): CanvasDocument {
  return {
    schemaVersion: 1,
    id: SHOWCASE_ID,
    name: 'Demo Command Center Showcase',
    logicalSize: { width: 1920, height: 1080 },
    theme: { preset: 'aurora' },
    widgets: [
      w('env-hub', 'env-hub', 70, 350, 560, 360, {
        label: 'Environment Hub',
        location: 'Living Room Hub',
        temperature: 23.4,
        targetTemperature: 22.0,
        humidity: 48,
        airQuality: 32,
        mode: 'auto',
        fanSpeed: 2,
        power: true,
        history: [21, 21.8, 22.4, 23.0, 23.8, 24.2, 23.9, 23.4, 22.8, 22.5, 23.1, 23.4],
      }),
      w('energy-matrix', 'energy-matrix', 660, 330, 600, 400, {
        label: 'Energy Flow Matrix',
        solarKw: 5.24,
        homeKw: 2.85,
        batteryKw: 1.95,
        batterySoc: 88,
        batteryCharging: true,
        gridKw: -0.44,
        selfPowered: 94,
        dailySolarKwh: 28.4,
      }),
      w('net-sentinel', 'net-sentinel', 1290, 350, 560, 360, {
        label: 'Cyber Sentinel Radar',
        threatLevel: 'DEFCON 5: NOMINAL',
        ping: 14,
        jitter: 0.8,
        throughput: 842,
        packetLoss: 0.00,
        onlineNodes: 24,
        totalNodes: 24,
        radarSpeed: 4.0,
        blips: [
          { id: 'gw-1', x: 68, y: 38, label: 'GW-Alpha', tone: 'ok', ping: 8 },
          { id: 'node-2', x: 122, y: 72, label: 'Edge-West', tone: 'ok', ping: 14 },
          { id: 'srv-3', x: 42, y: 118, label: 'Core-DB', tone: 'ok', ping: 11 },
          { id: 'iot-4', x: 118, y: 128, label: 'Sensor-Mesh', tone: 'warn', ping: 42 },
        ],
      }),
    ],
  };
}

export async function seedShowcase(canvases: CanvasService, runtime: RuntimeService): Promise<boolean> {
  if (await canvases.open(SHOWCASE_ID)) return false;
  await canvases.create({ id: SHOWCASE_ID, name: 'Demo Command Center Showcase', logicalSize: { width: 1920, height: 1080 } });
  await canvases.saveDraft(showcaseDocument());
  const publication = await canvases.publish(SHOWCASE_ID);
  await runtime.activate({ canvasId: SHOWCASE_ID, publicationRevision: publication.revision });
  return true;
}
