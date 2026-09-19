import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Lock, Key, Plus, Trash2, Edit3, Copy, Check, Eye, EyeOff,
  ShieldCheck, Globe, Search, RefreshCw, AlertCircle, Info, Shield
} from "lucide-react";
import { api } from "@/lib/api";
import type { VaultSecretMeta, SaveSecretInput } from "@/lib/types";
import { Button, Pill, Spinner, TextInput, Modal, Field } from "@/components/ui";
import { Card, SectionHeader, StatCard, EmptyState } from "../primitives";

export default function VaultTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSecret, setEditingSecret] = useState<VaultSecretMeta | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDomains, setFormDomains] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formErr, setFormErr] = useState("");

  const { data: secrets = [], isLoading, refetch } = useQuery({
    queryKey: ["vault-secrets"],
    queryFn: api.listSecrets,
  });

  const saveMutation = useMutation({
    mutationFn: (input: SaveSecretInput) => api.saveSecret(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-secrets"] });
      closeModal();
    },
    onError: (err) => {
      setFormErr(err instanceof Error ? err.message : "Failed to save secret");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteSecret(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vault-secrets"] });
    },
  });

  const openNewModal = () => {
    setEditingSecret(null);
    setFormId("");
    setFormName("");
    setFormValue("");
    setFormDescription("");
    setFormDomains("");
    setFormErr("");
    setShowPassword(false);
    setModalOpen(true);
  };

  const openEditModal = (s: VaultSecretMeta) => {
    setEditingSecret(s);
    setFormId(s.id);
    setFormName(s.name);
    setFormValue(""); // Leave blank unless user is rotating/replacing
    setFormDescription(s.description || "");
    setFormDomains(s.allowedDomains.join(", "));
    setFormErr("");
    setShowPassword(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingSecret(null);
    setFormErr("");
  };

  const handleSubmit = () => {
    setFormErr("");
    const id = formId.trim().toLowerCase();
    if (!id || !/^[a-z0-9_-]{2,64}$/.test(id)) {
      setFormErr("Secret ID must be 2-64 chars (lowercase letters, numbers, hyphens, underscores).");
      return;
    }
    if (!formName.trim()) {
      setFormErr("Friendly name is required.");
      return;
    }
    if (!editingSecret && !formValue) {
      setFormErr("Secret value cannot be empty.");
      return;
    }

    const domains = formDomains
      .split(/[\s,]+/)
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    saveMutation.mutate({
      id,
      name: formName.trim(),
      value: formValue, // if editing and empty, backend preserves existing value or caller must provide
      description: formDescription.trim() || undefined,
      allowedDomains: domains,
    });
  };

  const copyRef = (id: string) => {
    const ref = `{vault:${id}}`;
    navigator.clipboard.writeText(ref);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return secrets;
    return secrets.filter(
      s =>
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        s.allowedDomains.some(d => d.toLowerCase().includes(q))
    );
  }, [secrets, search]);

  const totalDomains = useMemo(() => {
    const set = new Set<string>();
    secrets.forEach(s => s.allowedDomains.forEach(d => set.add(d)));
    return set.size;
  }, [secrets]);

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Lock size={15} />}
          label="Encrypted Secrets"
          value={secrets.length}
          hint="AES-256-GCM authenticated"
          tone="accent"
        />
        <StatCard
          icon={<ShieldCheck size={15} />}
          label="Vault Security"
          value="Node Encrypted"
          hint="PBKDF2 key derivation"
          tone="ok"
        />
        <StatCard
          icon={<Globe size={15} />}
          label="Domain Policies"
          value={totalDomains}
          hint="outbound origin boundaries"
          tone="accent"
        />
        <StatCard
          icon={<Shield size={15} />}
          label="Iframe Isolation"
          value="Enforced"
          hint="strict connect-src 'none'"
          tone="ok"
        />
      </div>

      {/* Main Section Header */}
      <div>
        <SectionHeader
          title="Secret Vault Manager"
          subtitle="Safely store API keys, auth tokens, and credentials encrypted at rest. Widgets reference keys via {vault:id} without exposing credentials to sandboxed guest iframes."
          action={
            <Button variant="primary" onClick={openNewModal}>
              <Plus size={13} /> Add Secret
            </Button>
          }
        />

        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
            <TextInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search secrets by name, ID, or domain..."
              className="pl-8 text-xs"
            />
          </div>

          <Button variant="subtle" onClick={() => refetch()} disabled={isLoading} className="text-xs">
            <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {/* Secrets Grid */}
        {isLoading && secrets.length === 0 ? (
          <div className="grid place-items-center py-20"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Lock size={32} />}
            title={secrets.length === 0 ? "No secrets stored" : "No matching secrets found"}
            hint={
              secrets.length === 0
                ? "Click 'Add Secret' to store your first encrypted API token or service credential."
                : "Try adjusting your search criteria."
            }
            action={
              secrets.length === 0 ? (
                <Button variant="primary" onClick={openNewModal}>
                  <Plus size={13} /> Add Secret
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(secret => (
              <SecretCard
                key={secret.id}
                secret={secret}
                onCopyRef={() => copyRef(secret.id)}
                isCopied={copiedId === secret.id}
                onEdit={() => openEditModal(secret)}
                onDelete={() => {
                  if (confirm(`Are you sure you want to delete secret "${secret.name}" (${secret.id})?`)) {
                    deleteMutation.mutate(secret.id);
                  }
                }}
                isDeleting={deleteMutation.isPending && deleteMutation.variables === secret.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Secret Modal */}
      {modalOpen && (
        <Modal
          title={editingSecret ? `Edit Secret: ${editingSecret.name}` : "Store New Secret"}
          onClose={closeModal}
          footer={
            <>
              <Button variant="ghost" onClick={closeModal}>Cancel</Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? <Spinner size={13} /> : <Check size={13} />}
                {editingSecret ? "Update Secret" : "Encrypt & Store"}
              </Button>
            </>
          }
        >
          <div className="space-y-3.5">
            <div className="p-3 rounded-lg border bg-[var(--panel-2)] text-xs text-[var(--ink-2)] flex items-start gap-2.5" style={{ borderColor: "var(--line)" }}>
              <Info size={15} className="text-[var(--accent)] shrink-0 mt-0.5" />
              <div>
                Values are encrypted at rest with <strong>AES-256-GCM</strong>. Widgets configure credentials using the reference placeholder <code>{`{vault:your_key}`}</code>.
              </div>
            </div>

            <Field label="Secret Identifier (ID)" hint="Unique identifier referenced in widget configs, e.g. openweather_key">
              <TextInput
                value={formId}
                onChange={e => setFormId(e.target.value)}
                placeholder="e.g. openweather_api_key"
                disabled={!!editingSecret}
                className="font-mono text-xs"
              />
            </Field>

            <Field label="Friendly Name">
              <TextInput
                value={formName}
                onChange={e => setFormName(e.target.value)}
                placeholder="e.g. OpenWeatherMap Production Token"
              />
            </Field>

            <Field
              label={editingSecret ? "New Secret Value (Leave blank to keep current)" : "Secret Value / API Key"}
              hint="Encrypted with node master key before writing to disk"
            >
              <div className="relative">
                <TextInput
                  type={showPassword ? "text" : "password"}
                  value={formValue}
                  onChange={e => setFormValue(e.target.value)}
                  placeholder={editingSecret ? "••••••••••••••••" : "Paste raw API key, bearer token, or secret"}
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)] p-1"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>

            <Field label="Allowed Outbound Domains" hint="Comma-separated domains permitted to receive this secret (e.g. api.openweathermap.org, *.weather.gov)">
              <TextInput
                value={formDomains}
                onChange={e => setFormDomains(e.target.value)}
                placeholder="api.openweathermap.org, api.example.com"
                className="font-mono text-xs"
              />
            </Field>

            <Field label="Description (Optional)">
              <textarea
                rows={2}
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Notes on usage, rate limits, expiration..."
                className="w-full text-xs p-2 rounded border resize-none focus:outline-none"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </Field>

            {formErr && (
              <div className="p-2.5 rounded bg-[var(--danger-soft)] text-[var(--danger)] text-xs flex items-center gap-1.5 font-medium">
                <AlertCircle size={14} className="shrink-0" /> {formErr}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function SecretCard({
  secret,
  onCopyRef,
  isCopied,
  onEdit,
  onDelete,
  isDeleting,
}: {
  secret: VaultSecretMeta;
  onCopyRef: () => void;
  isCopied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <Card className="p-4 flex flex-col justify-between border space-y-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
              style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--accent)" }}
            >
              <Key size={15} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-[var(--ink)] truncate">{secret.name}</h4>
              <div className="text-[11px] font-mono text-[var(--ink-3)] truncate">{secret.id}</div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
              title="Edit secret"
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors"
              title="Delete secret"
            >
              {isDeleting ? <Spinner size={12} /> : <Trash2 size={13} />}
            </button>
          </div>
        </div>

        {secret.description && (
          <p className="text-xs text-[var(--ink-3)] mt-2 line-clamp-2">{secret.description}</p>
        )}

        {/* Domain tags */}
        <div className="mt-3 flex flex-wrap gap-1">
          {secret.allowedDomains.length === 0 ? (
            <span className="text-[10px] text-[var(--ink-3)] italic">No domain restrictions (global broker)</span>
          ) : (
            secret.allowedDomains.map(d => (
              <span
                key={d}
                className="text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink-2)" }}
              >
                <Globe size={9} /> {d}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Copy Reference bar */}
      <div className="pt-3 border-t flex items-center justify-between gap-2" style={{ borderColor: "var(--line)" }}>
        <button
          onClick={onCopyRef}
          className="flex-1 flex items-center justify-between px-2.5 py-1 rounded border text-[11px] font-mono hover:bg-[var(--panel-2)] transition-colors"
          style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
          title="Click to copy {vault:...} placeholder"
        >
          <span className="truncate">{`{vault:${secret.id}}`}</span>
          <span className="text-[var(--accent)] shrink-0 ml-1.5 font-sans font-semibold text-[10px] flex items-center gap-1">
            {isCopied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </span>
        </button>
      </div>
    </Card>
  );
}
