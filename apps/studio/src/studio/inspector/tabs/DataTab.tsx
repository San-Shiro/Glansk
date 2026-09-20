import React, { useEffect, useState } from "react";
import { Zap, Link, Copy, Check, Info } from "lucide-react";
import type { WidgetInstance, CanvasDocument, JsonValue } from "@/lib/types";
import { getWidgetDefinition } from "@shared/widget-definitions.js";
import { getActiveVariableStore } from "@shared/canvas-variables.js";
import { AccordionSection, DynamicBindingControl } from "@/studio/controls";

interface Props {
  widget: WidgetInstance;
  doc: CanvasDocument;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
}

export default function DataTab({ widget, doc, onUpdateConfig }: Props) {
  const def = getWidgetDefinition(widget.widgetId);
  const cfg = widget.config || {};
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Live subscription to reactive store
  useEffect(() => {
    const store = getActiveVariableStore();
    if (!store) return;
    return store.watchAll(() => setTick((t) => t + 1));
  }, []);

  const store = getActiveVariableStore();
  const outputDefs = (def as any).outputVariables || {};
  const outputKeys = Object.keys(outputDefs);

  const handleBindingChange = (propKey: string, nextVal: JsonValue) => {
    onUpdateConfig(widget.id, {
      ...cfg,
      [propKey]: nextVal,
    });
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Find bindable properties from schema (supports both WidgetConfigField[] and Record<string, WidgetConfigField>)
  const rawSchema = (def as any).schema || (def as any).configSchema || [];
  const fields: Array<{ key: string; label?: string; type?: string; default?: any }> = Array.isArray(rawSchema)
    ? rawSchema
    : Object.entries(rawSchema).map(([key, val]: [string, any]) => ({ key, ...val }));

  return (
    <div className="space-y-3.5 animate-fade-in">
      {/* 1. Dynamic Input Bindings */}
      <AccordionSection
        title="Dynamic Inputs & Bindings"
        defaultOpen
        actions={
          <span className="text-[10px] text-[var(--accent)] font-medium flex items-center gap-1">
            <Link size={11} /> Reactive
          </span>
        }
      >
        <div className="space-y-2">
          <div className="text-[10px] text-[var(--ink-3)]">
            Bind inputs to canvas variables (<code className="font-mono text-[var(--accent)]">var:</code>) or widget outputs (<code className="font-mono text-[var(--accent)]">wig:</code>).
          </div>

          <div className="divide-y rounded-lg border bg-[var(--panel)] overflow-hidden shadow-xs" style={{ borderColor: "var(--line)" }}>
            {fields.length === 0 ? (
              <div className="text-xs text-[var(--ink-3)] italic p-3 text-center">
                No bindable schema properties on this widget.
              </div>
            ) : (
              fields.map((field) => {
                const propKey = field.key;
                const currentVal = cfg[propKey];
                return (
                  <DynamicBindingControl
                    key={propKey}
                    compact
                    label={field.label || propKey}
                    value={currentVal as any}
                    fallbackDefault={field.default ?? ""}
                    type={field.type === "number" ? "number" : field.type === "boolean" ? "boolean" : "string"}
                    variables={doc.variables}
                    onChange={(nextVal) => handleBindingChange(propKey, nextVal as JsonValue)}
                  >
                    <span className="truncate block">
                      {typeof currentVal === "object" ? JSON.stringify(currentVal) : String(currentVal ?? "")}
                    </span>
                  </DynamicBindingControl>
                );
              })
            )}
          </div>
        </div>
      </AccordionSection>

      {/* 2. Output Variables */}
      <AccordionSection
        title={`Outputs & Emitted State (${outputKeys.length})`}
        defaultOpen
        actions={
          outputKeys.length > 0 ? (
            <span className="text-[10px] text-amber-500 font-medium flex items-center gap-1">
              <Zap size={11} /> Active
            </span>
          ) : undefined
        }
      >
        <div className="divide-y rounded-lg border bg-[var(--panel)] overflow-hidden shadow-xs" style={{ borderColor: "var(--line)" }}>
          {outputKeys.length === 0 ? (
            <div className="text-xs text-[var(--ink-3)] italic p-3 text-center">
              This widget does not emit dynamic output variables.
            </div>
          ) : (
            outputKeys.map((k) => {
              const odef = outputDefs[k];
              const fullKey = `wig:${widget.id}.${k}`;
              const liveVal = store?.get(fullKey);

              return (
                <div
                  key={k}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-[var(--panel-2)] transition-colors text-[11px]"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Zap size={10} className="text-amber-500 shrink-0 fill-amber-500" />
                    <span className="font-semibold text-[var(--ink)] truncate" title={odef.description || odef.label || k}>
                      {odef.label || k}
                    </span>
                    <span className="text-[9px] font-mono text-[var(--ink-3)] uppercase shrink-0">
                      {odef.type || "any"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] text-[var(--accent)] border max-w-[85px] truncate"
                      style={{ borderColor: "var(--line)" }}
                      title={`Live value: ${liveVal !== undefined ? JSON.stringify(liveVal) : "idle"}`}
                    >
                      {liveVal !== undefined ? String(liveVal) : "idle"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullKey, k)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-3)] transition-colors"
                      style={{ borderColor: "var(--line)" }}
                      title="Copy variable reference"
                    >
                      {copiedKey === k ? <Check size={10} className="text-[var(--ok)]" /> : <Copy size={10} />}
                      <span className="text-[9px]">{copiedKey === k ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AccordionSection>
    </div>
  );
}
