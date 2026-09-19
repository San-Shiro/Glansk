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

  // Find bindable properties from schema
  const schema = (def as any).schema || (def as any).configSchema || {};
  const schemaKeys = Object.keys(schema);

  return (
    <div className="space-y-4 animate-fade-in">
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
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--ink-3)]">
            Connect widget inputs to canvas variables (<code className="font-mono text-[var(--accent)]">var:</code>) or other widgets (<code className="font-mono text-[var(--accent)]">wig:</code>).
          </p>

          {schemaKeys.length === 0 ? (
            <div className="text-xs text-[var(--ink-3)] italic py-2">
              No bindable schema properties on this widget.
            </div>
          ) : (
            schemaKeys.map((propKey) => {
              const fieldMeta = schema[propKey] || {};
              const currentVal = cfg[propKey];
              return (
                <div key={propKey} className="p-2 rounded-lg border bg-[var(--panel-2)] space-y-1" style={{ borderColor: "var(--line)" }}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-[var(--ink)]">{fieldMeta.label || propKey}</span>
                    <span className="text-[10px] font-mono text-[var(--ink-3)]">{fieldMeta.type || "string"}</span>
                  </div>
                  <DynamicBindingControl
                    label={fieldMeta.label || propKey}
                    value={currentVal as any}
                    fallbackDefault={fieldMeta.default ?? ""}
                    type={fieldMeta.type === "number" ? "number" : fieldMeta.type === "boolean" ? "boolean" : "string"}
                    variables={doc.variables}
                    onChange={(nextVal) => handleBindingChange(propKey, nextVal as JsonValue)}
                  >
                    <div className="text-xs text-[var(--ink-2)] font-mono truncate px-1">
                      {typeof currentVal === "object" ? JSON.stringify(currentVal) : String(currentVal ?? "")}
                    </div>
                  </DynamicBindingControl>
                </div>
              );
            })
          )}
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
        <div className="space-y-2">
          {outputKeys.length === 0 ? (
            <div className="text-xs text-[var(--ink-3)] italic py-2">
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
                  className="p-2.5 rounded-lg border bg-[var(--panel-2)] space-y-1.5"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5">
                      <Zap size={11} className="text-amber-500" />
                      {odef.label || k}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(fullKey, k)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                      style={{ borderColor: "var(--line)" }}
                      title="Copy binding reference"
                    >
                      {copiedKey === k ? <Check size={10} className="text-[var(--ok)]" /> : <Copy size={10} />}
                      <span>{copiedKey === k ? "Copied" : "Copy"}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-[var(--ink-3)]">{odef.description}</div>

                  <div className="flex items-center justify-between pt-1 border-t text-[11px]" style={{ borderColor: "var(--line)" }}>
                    <code className="text-[10px] font-mono text-[var(--accent)] truncate max-w-[180px]">{fullKey}</code>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--panel)] text-[var(--ink)] border" style={{ borderColor: "var(--line)" }}>
                      {liveVal !== undefined ? JSON.stringify(liveVal) : "idle"}
                    </span>
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
