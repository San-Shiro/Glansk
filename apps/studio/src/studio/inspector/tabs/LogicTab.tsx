import React from "react";
import { SlidersHorizontal, MousePointerClick, Plus, Trash2, ArrowRight } from "lucide-react";
import type { WidgetInstance, CanvasDocument, WidgetVisibilityConfig, JsonValue } from "@/lib/types";
import { AccordionSection } from "@/studio/controls";
import ConditionRuleBuilder from "../controls/ConditionRuleBuilder";

interface Props {
  widget: WidgetInstance;
  doc: CanvasDocument;
  onUpdateWidgetVisibility?: (id: string, visibility: WidgetVisibilityConfig) => void;
  onUpdateConfig: (id: string, config: Record<string, JsonValue>) => void;
}

export default function LogicTab({
  widget,
  doc,
  onUpdateWidgetVisibility,
  onUpdateConfig,
}: Props) {
  const cfg = widget.config || {};
  const visibility = widget.visibility;

  const handleVisibilityChange = (nextVis: WidgetVisibilityConfig) => {
    onUpdateWidgetVisibility?.(widget.id, nextVis);
  };

  // Actions configured on the widget
  const rawActions = (Array.isArray(cfg.actions) ? cfg.actions : []) as Array<{
    event: string;
    actionType: "setVariable" | "emitSignal" | "navigate";
    target?: string;
    value?: string;
  }>;

  const updateActions = (nextActions: typeof rawActions) => {
    onUpdateConfig(widget.id, {
      ...cfg,
      actions: nextActions as unknown as JsonValue,
    });
  };

  const addAction = () => {
    updateActions([
      ...rawActions,
      {
        event: "click",
        actionType: "setVariable",
        target: Object.keys(doc.variables || {})[0] || "",
        value: "true",
      },
    ]);
  };

  const removeAction = (index: number) => {
    updateActions(rawActions.filter((_, i) => i !== index));
  };

  const updateActionItem = (index: number, patch: Partial<(typeof rawActions)[0]>) => {
    const next = [...rawActions];
    if (next[index]) {
      next[index] = { ...next[index]!, ...patch };
      updateActions(next);
    }
  };

  const varKeys = Object.keys(doc.variables || {});

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 1. Conditional Visibility Rule Builder */}
      <AccordionSection title="Visibility & Conditions" defaultOpen>
        <ConditionRuleBuilder
          visibility={visibility}
          onChange={handleVisibilityChange}
          variables={doc.variables}
        />
      </AccordionSection>

      {/* 2. Interaction Actions */}
      <AccordionSection
        title={`Interactivity & Actions (${rawActions.length})`}
        defaultOpen
        actions={
          <button
            type="button"
            onClick={addAction}
            className="flex items-center gap-1 text-[10px] text-[var(--accent)] font-medium hover:underline"
          >
            <Plus size={11} /> Add Action
          </button>
        }
      >
        <div className="space-y-2">
          <p className="text-[11px] text-[var(--ink-3)]">
            Trigger reactive variable changes or event bus signals on widget click.
          </p>

          {rawActions.length === 0 ? (
            <div className="text-center py-4 border border-dashed rounded-lg text-xs text-[var(--ink-3)] bg-[var(--panel-2)]/40">
              No click actions configured.
            </div>
          ) : (
            rawActions.map((act, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg border bg-[var(--panel-2)] space-y-2"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                    <MousePointerClick size={12} className="text-[var(--accent)]" />
                    <span>On Click</span>
                    <ArrowRight size={11} className="text-[var(--ink-3)]" />
                    <span className="capitalize">{act.actionType}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAction(idx)}
                    className="text-[var(--danger)] hover:opacity-80 p-1"
                    title="Remove action"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Action Type</label>
                    <select
                      value={act.actionType}
                      onChange={(e) => updateActionItem(idx, { actionType: e.target.value as any })}
                      className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <option value="setVariable">Set Variable</option>
                      <option value="emitSignal">Emit Signal</option>
                      <option value="navigate">Navigate</option>
                    </select>
                  </div>

                  {act.actionType === "setVariable" && (
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Target Variable</label>
                      {varKeys.length > 0 ? (
                        <select
                          value={act.target || ""}
                          onChange={(e) => updateActionItem(idx, { target: e.target.value })}
                          className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                          style={{ borderColor: "var(--line)" }}
                        >
                          <option value="">Select...</option>
                          {varKeys.map((vk) => (
                            <option key={vk} value={vk}>
                              @{vk}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={act.target || ""}
                          onChange={(e) => updateActionItem(idx, { target: e.target.value })}
                          placeholder="varName"
                          className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)]"
                          style={{ borderColor: "var(--line)" }}
                        />
                      )}
                    </div>
                  )}

                  {act.actionType === "emitSignal" && (
                    <div>
                      <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Signal Topic</label>
                      <input
                        type="text"
                        value={act.target || ""}
                        onChange={(e) => updateActionItem(idx, { target: e.target.value })}
                        placeholder="e.g. system.alert"
                        className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                        style={{ borderColor: "var(--line)" }}
                      />
                    </div>
                  )}
                </div>

                {act.actionType === "setVariable" && (
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--ink-3)] block mb-1">Value to Set</label>
                    <input
                      type="text"
                      value={act.value || ""}
                      onChange={(e) => updateActionItem(idx, { value: e.target.value })}
                      placeholder="e.g. 100 or true"
                      className="w-full text-xs py-1.5 px-2 rounded border bg-[var(--panel)] text-[var(--ink)] font-mono"
                      style={{ borderColor: "var(--line)" }}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </AccordionSection>
    </div>
  );
}
