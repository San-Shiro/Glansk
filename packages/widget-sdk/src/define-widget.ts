import { WidgetRuntime, type WidgetDefinition } from "./runtime";

export function defineWidget<C = Record<string, unknown>>(definition: WidgetDefinition<C>): WidgetDefinition<C> {
  // If running in browser window and document ready, auto-mount to document.body
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const runtime = new WidgetRuntime<C>(definition);
    const boot = () => {
      const root = document.getElementById("root") || document.body;
      runtime.init(root);
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  return definition;
}
