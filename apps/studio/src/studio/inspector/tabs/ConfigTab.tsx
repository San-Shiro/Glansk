import React from "react";
import type { WidgetInstance, JsonValue } from "@/lib/types";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import { SchemaFields } from "@/studio/controls";

interface Props {
  widget: WidgetInstance;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
  vaultKeys?: string[];
}

export default function ConfigTab({ widget, onUpdateConfig, vaultKeys = [] }: Props) {
  const def = getWidgetDefinition(widget.widgetId);
  const cfg = widget.config || {};

  const handleFieldChange = (patch: Record<string, JsonValue>) => {
    onUpdateConfig(widget.id, {
      ...cfg,
      ...patch,
    });
  };

  const schema = def.configSchema || [];
  const hasSchema = schema.length > 0;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Widget Overview Card */}
      <div
        className="p-2.5 rounded-lg border text-xs text-[var(--ink-2)] bg-[var(--panel-2)] flex items-center justify-between"
        style={{ borderColor: "var(--line)" }}
      >
        <span>Parameters for <strong>{def.title}</strong></span>
        <span className="text-[10px] font-mono text-[var(--ink-3)]">{widget.widgetId}</span>
      </div>

      {/* Schema Form Fields */}
      {hasSchema ? (
        <div className="space-y-3">
          <SchemaFields
            schema={schema as any}
            config={cfg}
            onChange={handleFieldChange}
            vaultKeys={vaultKeys}
          />
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-[var(--ink-3)] space-y-1">
          <p className="font-medium">Standard Widget</p>
          <p>This widget does not require additional configuration parameters.</p>
        </div>
      )}
    </div>
  );
}
