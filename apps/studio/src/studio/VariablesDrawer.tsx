import { useState, useEffect } from "react";
import { X, Plus, Trash2, Sliders, ToggleLeft, ToggleRight, Sparkles, Check, HelpCircle, Code, Play } from "lucide-react";
import type { CanvasVariableDefinition, CanvasVariableType } from "@/lib/types";
import { Button, Pill, TextInput } from "@/components/ui";

interface VariablesDrawerProps {
  open: boolean;
  onClose: () => void;
  variables?: Record<string, CanvasVariableDefinition>;
  onUpdateVariables?: (variables: Record<string, CanvasVariableDefinition>) => void;
  inline?: boolean;
}

export default function VariablesDrawer({ open, onClose, variables = {}, onUpdateVariables, inline }: VariablesDrawerProps) {
  const [liveValues, setLiveValues] = useState<Record<string, unknown>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<CanvasVariableType>("boolean");
  const [defaultValue, setDefaultValue] = useState<any>(false);
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");

  // Sync live runtime values from active variable store
  useEffect(() => {
    if (!open) return;
    const store = (window as any).__GlanskVariables;
    if (store) {
      setLiveValues(store.getAll() || {});
      const unsub = store.watchAll(() => {
        setLiveValues({ ...store.getAll() });
      });
      return unsub;
    } else {
      // Fallback to defaults
      const initial: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(variables)) {
        initial[k] = v.defaultValue;
      }
      setLiveValues(initial);
    }
  }, [open, variables]);

  if (!open) return null;

  const varList = Object.values(variables);

  const handleCreate = () => {
    setErr("");
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Variable name is required");
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      setErr("Name must start with a letter and contain only letters, numbers, and underscores");
      return;
    }
    if (variables[trimmed]) {
      setErr("A variable with this name already exists");
      return;
    }

    let parsedDefault = defaultValue;
    if (type === "boolean") {
      parsedDefault = Boolean(defaultValue);
    } else if (type === "number") {
      parsedDefault = Number(defaultValue) || 0;
    } else if (type === "json") {
      try {
        parsedDefault = typeof defaultValue === "string" ? JSON.parse(defaultValue) : defaultValue;
      } catch {
        setErr("Invalid JSON default value");
        return;
      }
    } else {
      parsedDefault = String(defaultValue ?? "");
    }

    const nextVars = {
      ...variables,
      [trimmed]: {
        name: trimmed,
        type,
        defaultValue: parsedDefault,
        description: description.trim() || undefined,
      },
    };

    onUpdateVariables?.(nextVars);

    // Also register in live store
    const store = (window as any).__GlanskVariables;
    if (store) {
      store.define(nextVars[trimmed]);
      setLiveValues(store.getAll());
    }

    // Reset form
    setName("");
    setType("boolean");
    setDefaultValue(false);
    setDescription("");
    setIsAdding(false);
  };

  const handleDelete = (varName: string) => {
    const next = { ...variables };
    delete next[varName];
    onUpdateVariables?.(next);

    const store = (window as any).__GlanskVariables;
    if (store) {
      store.remove(varName);
      setLiveValues(store.getAll());
    }
  };

  const handleLiveToggle = (varName: string) => {
    const store = (window as any).__GlanskVariables;
    if (store) {
      store.toggle(varName);
      setLiveValues({ ...store.getAll() });
    } else {
      setLiveValues(prev => ({ ...prev, [varName]: !prev[varName] }));
    }
  };

  const handleLiveSetNumber = (varName: string, delta: number) => {
    const store = (window as any).__GlanskVariables;
    if (store) {
      store.increment(varName, delta);
      setLiveValues({ ...store.getAll() });
    } else {
      setLiveValues(prev => ({ ...prev, [varName]: (Number(prev[varName]) || 0) + delta }));
    }
  };

  const handleLiveSetString = (varName: string, val: string) => {
    const store = (window as any).__GlanskVariables;
    if (store) {
      store.set(varName, val);
      setLiveValues({ ...store.getAll() });
    } else {
      setLiveValues(prev => ({ ...prev, [varName]: val }));
    }
  };

  const addPreset = (presetName: string, presetType: CanvasVariableType, presetDef: any, desc: string) => {
    if (variables[presetName]) return;
    const next = {
      ...variables,
      [presetName]: {
        name: presetName,
        type: presetType,
        defaultValue: presetDef,
        description: desc,
      },
    };
    onUpdateVariables?.(next);
    const store = (window as any).__GlanskVariables;
    if (store) {
      store.define(next[presetName]);
      setLiveValues(store.getAll());
    }
  };

  const panelBody = (
    <div
      className={inline ? "h-full w-full flex flex-col overflow-hidden select-none text-[13px] bg-[var(--panel)]" : "relative w-full max-w-[480px] h-full shadow-2xl flex flex-col pointer-events-auto z-10 border-l animate-in slide-in-from-right duration-200"}
      style={{ background: "var(--panel)", borderColor: "var(--line)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-[var(--accent)]" />
          <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            Canvas Variables
          </h2>
          <Pill tone="neutral">{varList.length}</Pill>
        </div>
        {!inline && (
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {/* Subheader info */}
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            Global state variables shared between buttons, conditional visibility rules, and sandboxed widget iframes with sub-millisecond reactivity.
          </p>

          {/* Add variable toggle / form */}
          {!isAdding ? (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed rounded-md text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--panel-2)] transition-colors"
              style={{ borderColor: "var(--accent)" }}
            >
              <Plus size={14} />
              <span>Define New Variable</span>
            </button>
          ) : (
            <div className="p-3 border rounded-lg space-y-3 bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-[var(--ink)]">New Variable</span>
                <button
                  onClick={() => { setIsAdding(false); setErr(""); }}
                  className="text-[11px] text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  Cancel
                </button>
              </div>

              {err && (
                <div className="p-2 rounded text-[11px] bg-red-500/10 text-red-400 border border-red-500/20">
                  {err}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-3)] block mb-1">Name</label>
                  <TextInput
                    autoFocus
                    placeholder="e.g. showSidebar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-[var(--ink-3)] block mb-1">Type</label>
                  <select
                    className="w-full text-[12px] px-2.5 py-1.5 rounded border bg-[var(--panel)] text-[var(--ink)]"
                    style={{ borderColor: "var(--line)" }}
                    value={type}
                    onChange={(e) => {
                      const t = e.target.value as CanvasVariableType;
                      setType(t);
                      if (t === "boolean") setDefaultValue(false);
                      else if (t === "number") setDefaultValue(0);
                      else if (t === "json") setDefaultValue("{}");
                      else setDefaultValue("");
                    }}
                  >
                    <option value="boolean">Boolean (true / false)</option>
                    <option value="number">Number</option>
                    <option value="string">String / Text</option>
                    <option value="json">JSON Object</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--ink-3)] block mb-1">Default Value</label>
                {type === "boolean" ? (
                  <label className="flex items-center gap-2 text-[12px] text-[var(--ink-2)] cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={Boolean(defaultValue)}
                      onChange={(e) => setDefaultValue(e.target.checked)}
                      className="rounded border-[var(--line)] text-[var(--accent)]"
                    />
                    <span>Default to {defaultValue ? "True" : "False"}</span>
                  </label>
                ) : type === "number" ? (
                  <TextInput
                    type="number"
                    value={String(defaultValue)}
                    onChange={(e) => setDefaultValue(e.target.value)}
                  />
                ) : type === "json" ? (
                  <textarea
                    rows={2}
                    className="w-full font-mono text-[11px] p-2 rounded border bg-[var(--panel)] text-[var(--ink)] resize-none"
                    style={{ borderColor: "var(--line)" }}
                    value={typeof defaultValue === "string" ? defaultValue : JSON.stringify(defaultValue, null, 2)}
                    onChange={(e) => setDefaultValue(e.target.value)}
                  />
                ) : (
                  <TextInput
                    value={String(defaultValue)}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="Initial text value"
                  />
                )}
              </div>

              <div>
                <label className="text-[11px] font-medium text-[var(--ink-3)] block mb-1">Description (optional)</label>
                <TextInput
                  placeholder="Controls modal display or status metric"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => { setIsAdding(false); setErr(""); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleCreate}>
                  Create Variable
                </Button>
              </div>
            </div>
          )}

          {/* Quick presets starter */}
          {varList.length === 0 && !isAdding && (
            <div className="p-4 rounded-lg border text-center space-y-3 bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
              <Sparkles size={24} className="mx-auto text-[var(--accent)] opacity-80" />
              <div>
                <h3 className="text-xs font-semibold text-[var(--ink)]">No variables defined yet</h3>
                <p className="text-[11px] text-[var(--ink-3)] mt-0.5">
                  Get started with common interactive triggers or create your own custom state.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                <button
                  onClick={() => addPreset("showSidebar", "boolean", false, "Toggle sidebar overlay visibility")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border hover:bg-[var(--panel)] text-[var(--ink-2)] transition-colors"
                  style={{ borderColor: "var(--line)" }}
                >
                  + showSidebar (bool)
                </button>
                <button
                  onClick={() => addPreset("isNightMode", "boolean", false, "Canvas night/day theme mode")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border hover:bg-[var(--panel)] text-[var(--ink-2)] transition-colors"
                  style={{ borderColor: "var(--line)" }}
                >
                  + isNightMode (bool)
                </button>
                <button
                  onClick={() => addPreset("activeTab", "number", 1, "Tab or step index")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded border hover:bg-[var(--panel)] text-[var(--ink-2)] transition-colors"
                  style={{ borderColor: "var(--line)" }}
                >
                  + activeTab (num)
                </button>
              </div>
            </div>
          )}

          {/* Variable List cards */}
          <div className="space-y-2.5">
            {varList.map((v) => {
              const currentVal = liveValues[v.name] !== undefined ? liveValues[v.name] : v.defaultValue;
              const isModified = currentVal !== v.defaultValue;

              return (
                <div
                  key={v.name}
                  className="p-3 rounded-lg border bg-[var(--panel)] hover:border-[var(--line-2)] transition-colors shadow-xs"
                  style={{ borderColor: "var(--line)" }}
                >
                  {/* Card top */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[12px] font-semibold text-[var(--ink)]">
                          {v.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-[var(--panel-2)] text-[var(--ink-2)] border" style={{ borderColor: "var(--line)" }}>
                          {v.type}
                        </span>
                        {isModified && (
                          <span className="text-[10px] text-[var(--accent)] font-medium">
                            • Live modified
                          </span>
                        )}
                      </div>
                      {v.description && (
                        <p className="text-[11px] text-[var(--ink-3)] mt-0.5 leading-snug">
                          {v.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDelete(v.name)}
                      title="Delete variable"
                      className="text-[var(--ink-3)] hover:text-red-400 p-1 rounded transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Live Testing Control Zone */}
                  <div className="mt-3 pt-2.5 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--line)" }}>
                    <span className="text-[11px] text-[var(--ink-3)] font-medium flex items-center gap-1">
                      <Play size={10} className="text-[var(--accent)]" />
                      <span>Live Test:</span>
                    </span>

                    {v.type === "boolean" ? (
                      <button
                        onClick={() => handleLiveToggle(v.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          Boolean(currentVal)
                            ? "bg-[var(--accent)] text-white shadow-xs"
                            : "bg-[var(--panel-2)] text-[var(--ink-2)] hover:bg-[var(--panel-3)] border"
                        }`}
                        style={{ borderColor: "var(--line)" }}
                      >
                        {Boolean(currentVal) ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                        <span>{Boolean(currentVal) ? "TRUE" : "FALSE"}</span>
                      </button>
                    ) : v.type === "number" ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleLiveSetNumber(v.name, -1)}
                          className="h-6 w-6 grid place-items-center rounded bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] text-xs border"
                          style={{ borderColor: "var(--line)" }}
                        >
                          -
                        </button>
                        <span className="font-mono text-[12px] font-semibold px-2 min-w-[32px] text-center text-[var(--ink)]">
                          {Number(currentVal) || 0}
                        </span>
                        <button
                          onClick={() => handleLiveSetNumber(v.name, 1)}
                          className="h-6 w-6 grid place-items-center rounded bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] text-xs border"
                          style={{ borderColor: "var(--line)" }}
                        >
                          +
                        </button>
                      </div>
                    ) : v.type === "json" ? (
                      <span className="font-mono text-[11px] text-[var(--ink-2)] truncate max-w-[200px]" title={JSON.stringify(currentVal)}>
                        {JSON.stringify(currentVal)}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={String(currentVal ?? "")}
                        onChange={(e) => handleLiveSetString(v.name, e.target.value)}
                        className="text-[11px] px-2 py-0.5 rounded border bg-[var(--panel-2)] text-[var(--ink)] max-w-[180px]"
                        style={{ borderColor: "var(--line)" }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick instructions box */}
          <div className="p-3 rounded-lg border bg-[var(--panel-2)] text-[11px] space-y-1.5" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
            <div className="flex items-center gap-1.5 font-semibold text-[var(--ink-2)]">
              <Code size={13} className="text-[var(--accent)]" />
              <span>How to bind to variables</span>
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong className="text-[var(--ink)]">Action Buttons</strong>: Set Action to <em className="text-[var(--accent)]">Toggle Variable</em> or <em className="text-[var(--accent)]">Set Variable</em> targeting any variable.</li>
              <li><strong className="text-[var(--ink)]">Conditional Visibility</strong>: Select any element &rarr; Inspector &rarr; Conditional Visibility &rarr; State Rule &rarr; pick this variable to show/hide without remounting.</li>
              <li><strong className="text-[var(--ink)]">Widget SDK</strong>: Inside any widget iframe, access via <code className="font-mono text-[var(--accent)]">context.variables.get('name')</code> or <code className="font-mono text-[var(--accent)]">context.variables.set('name', val)</code>.</li>
            </ul>
          </div>
        </div>
      </div>
  );

  if (inline) return panelBody;

  return (
    <div className="fixed inset-0 z-50 flex justify-end pointer-events-none">
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs pointer-events-auto transition-opacity"
        onClick={onClose}
      />
      {panelBody}
    </div>
  );
}
