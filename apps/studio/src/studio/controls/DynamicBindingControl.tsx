import { useState } from "react";
import { Zap, Unlink, Settings, Check, X, HelpCircle } from "lucide-react";
import type { DynamicBinding, BoundValue, CanvasVariableDefinition, JsonValue } from "@/lib/types";
import { Button, Select, TextInput, Modal } from "@/components/ui";

export function isDynamicBinding<T = any>(val: any): val is { $bind: DynamicBinding<T> } {
  return typeof val === "object" && val !== null && "$bind" in val && typeof (val as any).$bind === "object";
}

interface DynamicBindingControlProps<T = any> {
  label: string;
  value: BoundValue<T>;
  fallbackDefault: T;
  type?: "string" | "number" | "boolean";
  variables?: Record<string, CanvasVariableDefinition>;
  onChange: (val: BoundValue<T>) => void;
  children: React.ReactNode;
  hint?: string;
  allowExpression?: boolean;
  compact?: boolean;
}

export default function DynamicBindingControl<T = any>({
  label,
  value,
  fallbackDefault,
  type = "string",
  variables = {},
  onChange,
  children,
  hint,
  allowExpression = true,
  compact = false,
}: DynamicBindingControlProps<T>) {
  const bound = isDynamicBinding<T>(value);
  const binding = bound ? value.$bind : null;
  const [modalOpen, setModalOpen] = useState(false);

  // Edit draft state for the modal
  const [draftMode, setDraftMode] = useState<"variable" | "expression">(binding?.mode || "variable");
  const [draftVar, setDraftVar] = useState<string>(binding?.variable || Object.keys(variables)[0] || "");
  const [draftExpr, setDraftExpr] = useState<string>(binding?.expression || (binding?.variable ? `{${binding.variable}}` : ""));
  const [draftFallback, setDraftFallback] = useState<any>(binding ? binding.fallback : fallbackDefault);

  const varNames = Object.keys(variables);

  const openModal = () => {
    if (bound) {
      setDraftMode(binding?.mode || "variable");
      setDraftVar(binding?.variable || Object.keys(variables)[0] || "");
      setDraftExpr(binding?.expression || (binding?.variable ? `{${binding.variable}}` : ""));
      setDraftFallback(binding?.fallback !== undefined ? binding.fallback : fallbackDefault);
    } else {
      setDraftMode("variable");
      setDraftVar(Object.keys(variables)[0] || "");
      setDraftExpr("");
      setDraftFallback(value !== undefined ? value : fallbackDefault);
    }
    setModalOpen(true);
  };

  const handleApplyBinding = () => {
    const fallbackParsed = type === "number"
      ? (Number.isFinite(Number(draftFallback)) ? Number(draftFallback) : 0)
      : type === "boolean"
      ? Boolean(draftFallback)
      : String(draftFallback ?? "");

    const newBinding: DynamicBinding<T> = {
      mode: draftMode,
      variable: draftMode === "variable" ? draftVar : undefined,
      expression: draftMode === "expression" ? draftExpr : undefined,
      fallback: fallbackParsed as T,
    };

    onChange({ $bind: newBinding });
    setModalOpen(false);
  };

  const handleUnbind = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (bound) {
      onChange(binding?.fallback !== undefined ? binding.fallback : fallbackDefault);
    }
  };

  const renderModal = () => (
    <Modal
      title={`Dynamic Binding: ${label}`}
      onClose={() => setModalOpen(false)}
      footer={
        <div className="flex items-center justify-between w-full">
          {bound ? (
            <Button
              variant="ghost"
              className="text-xs text-[var(--danger)] hover:text-[var(--danger)]"
              onClick={() => {
                handleUnbind();
                setModalOpen(false);
              }}
            >
              <Unlink size={12} /> Disconnect Binding
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="text-xs" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" className="text-xs" onClick={handleApplyBinding}>
              <Check size={12} /> Save Binding
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-xs">
        {/* Mode selection: Single Variable vs Multi-Variable Expression */}
        {allowExpression && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[var(--ink-3)] uppercase">Binding Mode</label>
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded border bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
              <button
                type="button"
                onClick={() => setDraftMode("variable")}
                className={`py-1 text-xs font-semibold rounded transition-all ${
                  draftMode === "variable"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs"
                    : "text-[var(--ink-2)] hover:text-[var(--ink)]"
                }`}
              >
                Variable Pick
              </button>
              <button
                type="button"
                onClick={() => setDraftMode("expression")}
                className={`py-1 text-xs font-semibold rounded transition-all ${
                  draftMode === "expression"
                    ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs"
                    : "text-[var(--ink-2)] hover:text-[var(--ink)]"
                }`}
              >
                Expression / Math
              </button>
            </div>
          </div>
        )}

        {/* Variable Mode */}
        {draftMode === "variable" ? (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-[var(--ink-3)] uppercase">
              Select Canvas Variable
            </label>
            {varNames.length > 0 ? (
              <div className="space-y-2">
                <Select
                  value={draftVar}
                  onChange={e => setDraftVar(e.target.value)}
                  className="font-mono text-xs py-1.5"
                >
                  {varNames.map(v => {
                    const vDef = variables[v];
                    const isWidgetOutput = v.startsWith("wig") || vDef?.isOutput;
                    return (
                      <option key={v} value={v}>
                        {isWidgetOutput ? "⚡ [Widget Output] " : "🌐 "}
                        {v} ({vDef?.type || "any"})
                      </option>
                    );
                  })}
                </Select>
                <p className="text-[10px] text-[var(--ink-3)]">
                  Includes custom canvas variables and live widget output variables (<code className="font-mono text-[var(--accent)]">wig...</code>).
                </p>
              </div>
            ) : (
              <div className="p-3 rounded border text-center text-xs text-[var(--ink-3)]" style={{ borderColor: "var(--line)" }}>
                No variables registered yet on canvas. Enter a variable key below:
                <TextInput
                  value={draftVar}
                  onChange={e => setDraftVar(e.target.value)}
                  placeholder="e.g. wigButton-clickCount"
                  className="mt-2 font-mono text-xs"
                />
              </div>
            )}
          </div>
        ) : (
          /* Expression Mode */
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--ink-3)] uppercase">
                Expression / Template Formula
              </label>
              <span className="text-[10px] text-[var(--accent)] font-medium">Zero-eval Safe Math</span>
            </div>
            <TextInput
              value={draftExpr}
              onChange={e => setDraftExpr(e.target.value)}
              placeholder="e.g. {wigBtn-clickCount} * 10 or Temp: {temp}°C"
              className="font-mono text-xs py-1.5"
            />
            <div className="text-[10px] text-[var(--ink-3)] space-y-1 pt-1">
              <p>• Wrap variable names in curly braces: <code className="font-mono text-[var(--accent)]">{"{variableName}"}</code></p>
              <p>• Arithmetic supported: <code className="font-mono text-[var(--ink-2)]">+ - * / % ( )</code></p>
              <p>• Example: <code className="font-mono text-[var(--ink-2)]">{"{wigSlider-val} * 2 + 10"}</code></p>
            </div>
          </div>
        )}

        {/* Fail-safe Default Value */}
        <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[var(--ink-3)] uppercase">
              Fail-safe Default Value
            </label>
            <span className="text-[10px] text-[var(--ink-3)]">Used if variable is undefined/empty</span>
          </div>

          {type === "boolean" ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={Boolean(draftFallback)}
                onChange={e => setDraftFallback(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-xs text-[var(--ink)]">Default state: {Boolean(draftFallback) ? "True (Active)" : "False (Inactive)"}</span>
            </div>
          ) : type === "number" ? (
            <TextInput
              type="number"
              value={draftFallback !== undefined ? Number(draftFallback) : 0}
              onChange={e => setDraftFallback(parseFloat(e.target.value) || 0)}
              className="font-mono text-xs py-1.5"
              placeholder="0"
            />
          ) : (
            <TextInput
              value={draftFallback !== undefined ? String(draftFallback) : ""}
              onChange={e => setDraftFallback(e.target.value)}
              className="font-mono text-xs py-1.5"
              placeholder="Default fallback text"
            />
          )}
        </div>
      </div>
    </Modal>
  );

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 hover:bg-[var(--panel-2)] transition-colors text-[11px] min-h-[32px]">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-[var(--ink)] truncate" title={hint || label}>
            {label}
          </span>
          {type && (
            <span className="text-[9px] font-mono text-[var(--ink-3)] uppercase shrink-0">
              {type === "boolean" ? "bool" : type === "number" ? "num" : type}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 max-w-[60%]">
          {bound ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 border border-amber-500/30 transition-colors"
                title={`Bound to: ${binding?.mode === "variable" ? binding.variable : binding?.expression}`}
              >
                <Zap size={9} className="fill-amber-500 shrink-0" />
                <span className="max-w-[100px] truncate">
                  {binding?.mode === "variable" ? binding.variable : binding?.expression}
                </span>
              </button>
              <button
                type="button"
                onClick={handleUnbind}
                className="p-0.5 rounded hover:bg-[var(--panel-3)] text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors"
                title="Disconnect binding"
              >
                <Unlink size={11} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <div
                onClick={openModal}
                className="text-[11px] font-mono text-[var(--ink-2)] truncate max-w-[110px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] border border-[var(--line)] cursor-pointer hover:border-amber-500/50 hover:text-[var(--ink)] transition-colors"
                title="Click to bind to variable"
              >
                {children}
              </div>
              <button
                type="button"
                onClick={openModal}
                className="p-1 rounded text-[var(--ink-3)] hover:text-amber-500 hover:bg-amber-500/15 transition-colors"
                title="Bind to variable"
              >
                <Zap size={11} />
              </button>
            </div>
          )}
        </div>
        {modalOpen && renderModal()}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--ink-3)]">
        <span title={hint}>{label}</span>
        <div className="flex items-center gap-1">
          {bound ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 transition-colors"
                title="Edit Dynamic Variable Binding"
              >
                <Zap size={10} className="fill-amber-500 text-amber-500" />
                <span className="max-w-[110px] truncate">
                  {binding?.mode === "variable" ? binding.variable : binding?.expression}
                </span>
              </button>
              <button
                type="button"
                onClick={handleUnbind}
                className="p-0.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors"
                title="Disconnect binding and use static literal value"
              >
                <Unlink size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openModal}
              className="p-1 rounded text-[var(--ink-3)] hover:text-amber-500 hover:bg-amber-500/10 transition-colors flex items-center gap-0.5"
              title="Bind property to a dynamic variable or expression"
            >
              <Zap size={11} />
            </button>
          )}
        </div>
      </div>

      {/* When bound, show compact status tile, else render child normal control */}
      {bound ? (
        <div
          onClick={openModal}
          className="p-2 rounded border cursor-pointer transition-all hover:border-amber-500/50 bg-amber-500/5 space-y-1"
          style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap size={12} className="text-amber-500 fill-amber-500 shrink-0" />
              <span className="text-xs font-mono font-bold text-[var(--ink)] truncate">
                {binding?.mode === "variable" ? binding.variable : binding?.expression}
              </span>
            </div>
            <span className="text-[9px] uppercase font-bold text-amber-500 px-1 py-0.2 rounded bg-amber-500/10 shrink-0">
              {binding?.mode}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-[var(--ink-3)] pt-0.5">
            <span>Fail-safe Default:</span>
            <span className="font-mono text-[var(--ink-2)] font-semibold truncate max-w-[120px]">
              {String(binding?.fallback ?? "")}
            </span>
          </div>
        </div>
      ) : (
        children
      )}

      {/* Dynamic Binding Configuration Modal */}
      {modalOpen && renderModal()}
    </div>
  );
}
