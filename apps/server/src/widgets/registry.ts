export const PACKAGED_WIDGETS = {
  "glansk.demo": new Set(["sdk-status", "telemetry-chart", "command-control", "status-grid", "aurora-metric"]),
  "glansk.media": new Set(["image-carousel"]),
};

const dynamicPackages = new Map<string, Set<string>>();

export function registerPackageWidget(packageId: string, widgetId: string): void {
  let set = dynamicPackages.get(packageId);
  if (!set) {
    set = new Set<string>();
    dynamicPackages.set(packageId, set);
  }
  set.add(widgetId);
}

export function unregisterPackage(packageId: string): void {
  dynamicPackages.delete(packageId);
}

export function isPackagedWidget(packageId: string, widgetId: string): boolean {
  if (
    Object.prototype.hasOwnProperty.call(PACKAGED_WIDGETS, packageId) &&
    (PACKAGED_WIDGETS[packageId as keyof typeof PACKAGED_WIDGETS] as Set<string>).has(widgetId)
  ) {
    return true;
  }
  return Boolean(dynamicPackages.get(packageId)?.has(widgetId));
}

export function listAllPackagedWidgets(): Array<{ packageId: string; widgetId: string; entryPath: string }> {
  const result: Array<{ packageId: string; widgetId: string; entryPath: string }> = [];

  for (const [pkgId, widgetSet] of Object.entries(PACKAGED_WIDGETS)) {
    for (const widgetId of widgetSet) {
      result.push({
        packageId: pkgId,
        widgetId,
        entryPath: `/widgets/${pkgId}/${widgetId}/index.html`,
      });
    }
  }

  for (const [pkgId, widgetSet] of dynamicPackages.entries()) {
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
