// Registry of packaged (sandboxed-iframe) widgets. Shared so the editor and the
// kiosk resolve the exact same widget entry points.
const BUILTIN_REGISTRY = {
  'glansk.demo': new Set(['sdk-status', 'telemetry-chart', 'command-control', 'status-grid', 'aurora-metric']),
  'glansk.media': new Set(['image-carousel']),
};

const dynamicRegistry = new Map();

export function registerPackageWidget(packageId, widgetId) {
  let set = dynamicRegistry.get(packageId);
  if (!set) {
    set = new Set();
    dynamicRegistry.set(packageId, set);
  }
  set.add(widgetId);
}

export function unregisterPackage(packageId) {
  dynamicRegistry.delete(packageId);
}

export function isPackagedWidget(packageId, widgetId) {
  if (!packageId || !widgetId) return false;
  if (packageId === 'core') return false;
  if (BUILTIN_REGISTRY[packageId]?.has(widgetId)) {
    return true;
  }
  if (dynamicRegistry.get(packageId)?.has(widgetId)) {
    return true;
  }
  // For builtin packages (demo/media), restrict strictly to known entries
  if (BUILTIN_REGISTRY[packageId]) {
    return false;
  }
  // Any other non-core package (e.g. glansk.stress-test, custom.speedo.gauge) is a packaged widget
  return true;
}

export function packagedWidgetPath(packageId, widgetId) {
  if (isPackagedWidget(packageId, widgetId)) {
    return `/widgets/${packageId}/${widgetId}/index.html`;
  }
  return undefined;
}

export function listAllPackagedWidgets() {
  const result = [];
  for (const [pkgId, widgetSet] of Object.entries(BUILTIN_REGISTRY)) {
    for (const widgetId of widgetSet) {
      result.push({
        packageId: pkgId,
        widgetId,
        entryPath: `/widgets/${pkgId}/${widgetId}/index.html`,
      });
    }
  }
  for (const [pkgId, widgetSet] of dynamicRegistry.entries()) {
    for (const widgetId of widgetSet) {
      result.push({
        packageId: pkgId,
        widgetId,
        entryPath: `/widgets/${pkgId}/${widgetId}/index.html`,
      });
    }
  }
  return result;
}
