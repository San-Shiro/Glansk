import type { JsonValue, WidgetConfigField, MediaValue, CornerRadius, CanvasVariableDefinition } from "@/lib/types";
import { Field, TextInput, Select, Button } from "@/components/ui";
import { Plus, Trash2, Key } from "lucide-react";
import CornerRadiusControl from "./CornerRadiusControl";
import MediaPickerControl from "./MediaPickerControl";
import DynamicBindingControl from "./DynamicBindingControl";

interface SchemaFieldsProps {
  schema: WidgetConfigField[];
  config: Record<string, JsonValue>;
  onChange: (patch: Record<string, JsonValue>) => void;
  vaultKeys?: string[];
  variables?: Record<string, CanvasVariableDefinition>;
  tab?: string;
}

export default function SchemaFields({
  schema,
  config,
  onChange,
  vaultKeys = [],
  variables = {},
  tab,
}: SchemaFieldsProps) {
  if (!schema || schema.length === 0) return null;

  const filteredSchema = schema.filter((field) => {
    if (!tab) return true;
    if (field.tab) return field.tab === tab;
    return tab === "content";
  });

  if (filteredSchema.length === 0) return null;

  const varNames = Object.keys(variables);

  return (
    <div className="space-y-3.5 pt-1">
      {filteredSchema.map((field) => {
        const value = config[field.key] !== undefined ? config[field.key] : field.default;

        switch (field.type) {
          case "string": {
            if (varNames.length > 0 && (field.key === "target" || field.key === "variableName")) {
              const isPredefined = varNames.includes(String(value || ""));
              return (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <div className="space-y-1.5">
                    <Select
                      value={isPredefined ? String(value) : "__custom__"}
                      onChange={(e) => {
                        if (e.target.value !== "__custom__") {
                          onChange({ [field.key]: e.target.value });
                        }
                      }}
                    >
                      <option value="__custom__">Custom target / command...</option>
                      {varNames.map((v) => (
                        <option key={v} value={v}>
                          ⚡ {v} ({variables[v]?.type || "var"})
                        </option>
                      ))}
                    </Select>
                    {(!isPredefined || !value) && (
                      <TextInput
                        value={value !== null && value !== undefined ? String(value) : ""}
                        onChange={(e) => onChange({ [field.key]: e.target.value })}
                        placeholder={field.hint || field.label}
                      />
                    )}
                  </div>
                </Field>
              );
            }

            if (field.allowBinding !== false) {
              return (
                <DynamicBindingControl
                  key={field.key}
                  label={field.label}
                  value={value as any}
                  fallbackDefault={String(field.default || "")}
                  type="string"
                  variables={variables}
                  onChange={(v) => onChange({ [field.key]: v as any })}
                  hint={field.hint}
                >
                  <TextInput
                    value={value !== null && value !== undefined ? String(value) : ""}
                    onChange={(e) => onChange({ [field.key]: e.target.value })}
                    placeholder={field.hint || field.label}
                  />
                </DynamicBindingControl>
              );
            }

            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <TextInput
                  value={value !== null && value !== undefined ? String(value) : ""}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                  placeholder={field.hint || field.label}
                />
              </Field>
            );
          }

          case "textarea":
            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <textarea
                  rows={3}
                  value={value !== null && value !== undefined ? String(value) : ""}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                  placeholder={field.hint || "Enter text..."}
                  className="w-full text-xs p-2 rounded border resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  style={{
                    background: "var(--panel-2)",
                    borderColor: "var(--line)",
                    color: "var(--ink)",
                  }}
                />
              </Field>
            );

          case "radius":
            return (
              <DynamicBindingControl
                key={field.key}
                label={field.label}
                value={value as any}
                fallbackDefault={typeof field.default === "number" ? field.default : 12}
                type="number"
                variables={variables}
                onChange={(v) => onChange({ [field.key]: v as any })}
                hint={field.hint}
              >
                <CornerRadiusControl
                  label=""
                  value={value as any}
                  fallback={typeof field.default === "number" ? field.default : 12}
                  onChange={(val: CornerRadius) => {
                    onChange({ [field.key]: val.linked ? val.tl : (val as any) });
                  }}
                />
              </DynamicBindingControl>
            );

          case "media": {
            const mediaValue: MediaValue | undefined =
              typeof value === "string"
                ? { source: "url", url: value, objectFit: "cover" }
                : (value as MediaValue | undefined);
            return (
              <div key={field.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--ink)]">{field.label}</label>
                  {field.hint && <span className="text-[10px] text-[var(--ink-3)]">{field.hint}</span>}
                </div>
                <MediaPickerControl
                  label={field.label}
                  value={mediaValue}
                  onChange={(m) => {
                    if (typeof field.default === "string" || typeof value === "string") {
                      onChange({ [field.key]: m?.url || "" });
                    } else {
                      onChange({ [field.key]: m as any });
                    }
                  }}
                  onReset={() => onChange({ [field.key]: (field.default as any) ?? "" })}
                />
              </div>
            );
          }

          case "range": {
            const numVal = value !== null && value !== undefined ? Number(value) : (Number(field.default) || 0);
            const min = field.min ?? 0;
            const max = field.max ?? 100;
            const step = field.step ?? 1;

            if (field.allowBinding !== false) {
              return (
                <DynamicBindingControl
                  key={field.key}
                  label={field.label}
                  value={value as any}
                  fallbackDefault={numVal}
                  type="number"
                  variables={variables}
                  onChange={(v) => onChange({ [field.key]: v as any })}
                  hint={field.hint}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={numVal}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        onChange({ [field.key]: Number.isFinite(parsed) ? parsed : min });
                      }}
                      className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--panel-2)] rounded-lg appearance-none"
                    />
                    <TextInput
                      type="number"
                      min={min}
                      max={max}
                      step={step}
                      value={numVal}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        onChange({ [field.key]: Number.isFinite(parsed) ? parsed : min });
                      }}
                      className="w-16 text-right font-mono text-xs"
                    />
                  </div>
                </DynamicBindingControl>
              );
            }

            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={numVal}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      onChange({ [field.key]: Number.isFinite(parsed) ? parsed : min });
                    }}
                    className="flex-1 accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--panel-2)] rounded-lg appearance-none"
                  />
                  <TextInput
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={numVal}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      onChange({ [field.key]: Number.isFinite(parsed) ? parsed : min });
                    }}
                    className="w-16 text-right font-mono text-xs"
                  />
                </div>
              </Field>
            );
          }

          case "number": {
            if (field.key === "radius") {
              return (
                <DynamicBindingControl
                  key={field.key}
                  label={field.label}
                  value={value as any}
                  fallbackDefault={typeof field.default === "number" ? field.default : 12}
                  type="number"
                  variables={variables}
                  onChange={(v) => onChange({ [field.key]: v as any })}
                  hint={field.hint}
                >
                  <CornerRadiusControl
                    label=""
                    value={value as any}
                    fallback={typeof field.default === "number" ? field.default : 12}
                    onChange={(val: CornerRadius) => {
                      onChange({ [field.key]: val.linked ? val.tl : (val as any) });
                    }}
                  />
                </DynamicBindingControl>
              );
            }

            if (field.allowBinding !== false) {
              return (
                <DynamicBindingControl
                  key={field.key}
                  label={field.label}
                  value={value as any}
                  fallbackDefault={Number(field.default || 0)}
                  type="number"
                  variables={variables}
                  onChange={(v) => onChange({ [field.key]: v as any })}
                  hint={field.hint}
                >
                  <TextInput
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step || 1}
                    value={value !== null && value !== undefined ? Number(value) : ""}
                    onChange={(e) => {
                      const parsed = parseFloat(e.target.value);
                      onChange({ [field.key]: Number.isFinite(parsed) ? parsed : 0 });
                    }}
                  />
                </DynamicBindingControl>
              );
            }

            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <TextInput
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                  value={value !== null && value !== undefined ? Number(value) : ""}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    onChange({ [field.key]: Number.isFinite(parsed) ? parsed : 0 });
                  }}
                />
              </Field>
            );
          }

          case "toggle":
          case "boolean": {
            const isChecked = Boolean(value);
            if (field.allowBinding !== false) {
              return (
                <DynamicBindingControl
                  key={field.key}
                  label={field.label}
                  value={value as any}
                  fallbackDefault={Boolean(field.default)}
                  type="boolean"
                  variables={variables}
                  onChange={(v) => onChange({ [field.key]: v as any })}
                  hint={field.hint}
                >
                  <div
                    className="flex items-center justify-between p-2.5 rounded border transition-colors hover:border-[var(--line-strong)]"
                    style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
                  >
                    <span className="text-xs font-semibold text-[var(--ink)] block">
                      {isChecked ? "True (Active)" : "False (Inactive)"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isChecked}
                      onClick={() => onChange({ [field.key]: !isChecked })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isChecked ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          isChecked ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </DynamicBindingControl>
              );
            }

            return (
              <div
                key={field.key}
                className="flex items-center justify-between p-2.5 rounded border transition-colors hover:border-[var(--line-strong)]"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
              >
                <div className="pr-3">
                  <span className="text-xs font-semibold text-[var(--ink)] block">
                    {field.label}
                  </span>
                  {field.hint && (
                    <span className="text-[10px] text-[var(--ink-3)] block leading-tight mt-0.5">{field.hint}</span>
                  )}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isChecked}
                  onClick={() => onChange({ [field.key]: !isChecked })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isChecked ? "bg-[var(--accent)]" : "bg-[var(--line)]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      isChecked ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          }

          case "select":
            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <Select
                  value={value !== null && value !== undefined ? String(value) : ""}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                >
                  {(field.options || []).map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </Field>
            );

          case "color":
            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value && typeof value === "string" ? value : "#000000"}
                    onChange={(e) => onChange({ [field.key]: e.target.value })}
                    className="w-8 h-8 rounded border p-0 cursor-pointer"
                    style={{ borderColor: "var(--line)" }}
                  />
                  <TextInput
                    value={value !== null && value !== undefined ? String(value) : ""}
                    onChange={(e) => onChange({ [field.key]: e.target.value })}
                    placeholder="#hex"
                  />
                </div>
              </Field>
            );

          case "secret-ref":
            return (
              <Field
                key={field.key}
                label={field.label}
                hint={field.hint || "Select a server vault secret key"}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center shrink-0 border"
                    style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
                  >
                    <Key size={14} className="text-[var(--accent)]" />
                  </div>
                  {vaultKeys.length > 0 ? (
                    <Select
                      value={value !== null && value !== undefined ? String(value) : ""}
                      onChange={(e) => onChange({ [field.key]: e.target.value })}
                    >
                      <option value="">-- Choose Secret --</option>
                      {vaultKeys.map((k) => (
                        <option key={k} value={`{vault:${k}}`}>
                          🔑 {k} ({`{vault:${k}}`})
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      value={value !== null && value !== undefined ? String(value) : ""}
                      onChange={(e) => onChange({ [field.key]: e.target.value })}
                      placeholder="{vault:my_secret_key}"
                    />
                  )}
                </div>
              </Field>
            );

          case "string[]": {
            const list = Array.isArray(value) ? (value as string[]) : [];
            return (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <div className="space-y-1.5">
                  {list.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                      <TextInput
                        value={item}
                        onChange={(e) => {
                          const next = [...list];
                          next[idx] = e.target.value;
                          onChange({ [field.key]: next });
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = list.filter((_, i) => i !== idx);
                          onChange({ [field.key]: next });
                        }}
                        className="p-1 text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  <Button
                    variant="subtle"
                    className="w-full text-xs py-1 mt-1"
                    onClick={() => onChange({ [field.key]: [...list, ""] })}
                  >
                    <Plus size={12} /> Add Item
                  </Button>
                </div>
              </Field>
            );
          }

          default:
            return (
              <Field key={field.key} label={field.label}>
                <TextInput
                  value={value !== null && value !== undefined ? String(value) : ""}
                  onChange={(e) => onChange({ [field.key]: e.target.value })}
                />
              </Field>
            );
        }
      })}
    </div>
  );
}
