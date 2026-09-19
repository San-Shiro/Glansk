export interface PackagedWidgetEntry {
  packageId: string;
  widgetId: string;
  entryPath: string;
}

export declare function registerPackageWidget(packageId: string, widgetId: string): void;
export declare function unregisterPackage(packageId: string): void;
export declare function isPackagedWidget(packageId: string, widgetId: string): boolean;
export declare function packagedWidgetPath(packageId: string, widgetId: string): string | undefined;
export declare function listAllPackagedWidgets(): PackagedWidgetEntry[];
