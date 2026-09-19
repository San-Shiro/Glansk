import { useState, useEffect } from "react";
import {
  Code, Sparkles, Plus, Trash2, Check, AlertTriangle, X,
  Loader2, Download, Layers, Radio, Cpu
} from "lucide-react";
import { api } from "@/lib/api";
import type { PackageRecord, PackageKind, StarterTemplate } from "@/lib/types";

interface CreateExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pkg: PackageRecord) => void;
  packageToEdit?: PackageRecord | null;
}

export default function CreateExtensionModal({
  isOpen,
  onClose,
  onSuccess,
  packageToEdit,
}: CreateExtensionModalProps) {
  const isEditing = Boolean(packageToEdit);

  const [step, setStep] = useState<"template" | "editor">(isEditing ? "editor" : "template");
  const [templates, setTemplates] = useState<StarterTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("glansk.gauge.circular");

  // Metadata
  const [pkgId, setPkgId] = useState(packageToEdit?.id || "");
  const [pkgName, setPkgName] = useState(packageToEdit?.name || "");
  const [pkgVersion, setPkgVersion] = useState(packageToEdit?.version || "1.0.0");
  const [pkgKind, setPkgKind] = useState<PackageKind>(packageToEdit?.kind || "widget");
  const [pkgAuthor, setPkgAuthor] = useState(packageToEdit?.author || "Admin");
  const [pkgDesc, setPkgDesc] = useState(packageToEdit?.description || "");

  // Files
  const [files, setFiles] = useState<Record<string, string>>({});
  const [activeFileName, setActiveFileName] = useState<string>("index.html");
  const [newFileName, setNewFileName] = useState("");
  const [showAddFile, setShowAddFile] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);

  // Fetch starter templates
  useEffect(() => {
    if (!isOpen) return;
    api.listStarterTemplates().then(setTemplates).catch(() => {});
  }, [isOpen]);

  // Load files when editing
  useEffect(() => {
    if (!isOpen) return;
    if (packageToEdit) {
      setStep("editor");
      setPkgId(packageToEdit.id);
      setPkgName(packageToEdit.name);
      setPkgVersion(packageToEdit.version);
      setPkgKind(packageToEdit.kind);
      setPkgAuthor(packageToEdit.author);
      setPkgDesc(packageToEdit.description);

      setIsLoading(true);
      api.getPackage(packageToEdit.id)
        .then((res) => {
          setFiles(res.files || {});
          const keys = Object.keys(res.files || {});
          setActiveFileName(keys.includes("index.html") ? "index.html" : keys[0] || "manifest.json");
        })
        .catch((err) => setError(err.message))
        .finally(() => setIsLoading(false));
    } else {
      setStep("template");
      setPkgId("com.custom.my-extension");
      setPkgName("My Extension");
      setPkgVersion("1.0.0");
      setPkgKind("widget");
      setPkgAuthor("Admin");
      setPkgDesc("Custom Glansk extension package");
    }
  }, [isOpen, packageToEdit]);

  if (!isOpen) return null;

  const handleSelectTemplate = (template: StarterTemplate) => {
    setSelectedTemplateId(template.id);
    setPkgKind(template.kind);
    setPkgName(template.name);
    setPkgDesc(template.description);
    setPkgId(`com.custom.${template.id.split(".").pop() || "ext"}`);

    const clonedFiles = { ...template.files };
    setFiles(clonedFiles);
    const firstKey = Object.keys(clonedFiles).find((k) => k !== "manifest.json") || "manifest.json";
    setActiveFileName(firstKey);
    setStep("editor");
    setError(null);
  };

  const handleCreateBlank = (kind: PackageKind) => {
    setPkgKind(kind);
    setPkgId(`com.custom.new-${kind}`);
    setPkgName(`Custom ${kind.charAt(0).toUpperCase() + kind.slice(1)}`);
    setPkgDesc(`Custom ${kind} extension created in Glansk Studio`);

    const blankFiles: Record<string, string> = {
      "manifest.json": JSON.stringify(
        {
          schemaVersion: 1,
          id: `com.custom.new-${kind}`,
          name: `Custom ${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
          version: "1.0.0",
          kind,
          description: `Custom ${kind} extension created in Glansk Studio`,
          author: "Admin",
          entry: kind === "emitter" ? undefined : "index.html",
          capabilities: kind === "emitter" ? ["telemetry-emitter"] : ["interactive-state"],
        },
        null,
        2
      ),
    };

    if (kind === "widget" || kind === "composite") {
      blankFiles["index.html"] = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="card">
    <h2 id="title">Custom Widget</h2>
    <p id="counter">Live Value: 0</p>
  </div>
  <script src="/shared/widget-sdk.js"></script>
  <script src="main.js"></script>
</body>
</html>`;
      blankFiles["styles.css"] = `body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: #fff;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.card {
  padding: 1rem 1.5rem;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
}
h2 { margin: 0 0 0.5rem; font-size: 1.1rem; color: #38bdf8; }
p { margin: 0; font-size: 0.9rem; color: #94a3b8; }`;
      blankFiles["main.js"] = `console.log("Widget initialized");
if (window.GlanskSDK) {
  GlanskSDK.init({
    onState: (state) => {
      if (state && typeof state.value !== "undefined") {
        document.getElementById("counter").textContent = "Live Value: " + state.value;
      }
    }
  });
}`;
    }

    if (kind === "emitter" || kind === "composite") {
      blankFiles["daemon.py"] = `#!/usr/bin/env python3
# Custom Glansk Telemetry Daemon
import time, json, urllib.request

SERVER = "http://localhost:8080"
EMITTER_ID = "custom-emitter"

while True:
    payload = {"state": {"uptime": int(time.time()), "status": "ok"}}
    try:
        req = urllib.request.Request(f"{SERVER}/api/v1/emitters/{EMITTER_ID}/state",
                                     data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req) as resp:
            pass
    except Exception as e:
        print("Error:", e)
    time.sleep(5)
`;
    }

    setFiles(blankFiles);
    setActiveFileName(kind === "emitter" ? "daemon.py" : "index.html");
    setStep("editor");
    setError(null);
  };

  const handleActiveFileChange = (newContent: string) => {
    setFiles((prev) => ({ ...prev, [activeFileName]: newContent }));
    if (activeFileName === "manifest.json") {
      try {
        JSON.parse(newContent);
        setManifestError(null);
      } catch (err: any) {
        setManifestError(err.message);
      }
    }
  };

  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const clean = newFileName.trim().replace(/^\/+/, "");
    if (files[clean]) {
      setError(`File '${clean}' already exists`);
      return;
    }
    setFiles((prev) => ({ ...prev, [clean]: "" }));
    setActiveFileName(clean);
    setNewFileName("");
    setShowAddFile(false);
  };

  const handleDeleteFile = (name: string) => {
    if (name === "manifest.json") {
      setError("manifest.json cannot be deleted");
      return;
    }
    const next = { ...files };
    delete next[name];
    setFiles(next);
    const remaining = Object.keys(next);
    setActiveFileName(remaining[0] || "manifest.json");
  };

  const handleSaveOrInstall = async () => {
    setIsSaving(true);
    setError(null);

    try {
      // Sync manifest.json with form metadata if needed
      let manifestObj: any = {};
      try {
        manifestObj = files["manifest.json"] ? JSON.parse(files["manifest.json"]) : {};
      } catch {
        throw new Error("manifest.json has syntax errors. Please fix before saving.");
      }

      manifestObj.id = pkgId.trim();
      manifestObj.name = pkgName.trim();
      manifestObj.version = pkgVersion.trim();
      manifestObj.kind = pkgKind;
      manifestObj.author = pkgAuthor.trim();
      manifestObj.description = pkgDesc.trim();

      const updatedFiles = {
        ...files,
        "manifest.json": JSON.stringify(manifestObj, null, 2),
      };

      let resultPkg: PackageRecord;

      if (isEditing && packageToEdit) {
        const res = await api.updatePackageFiles(packageToEdit.id, updatedFiles);
        resultPkg = res.package;
      } else {
        const res = await api.createPackage({
          manifest: manifestObj,
          files: updatedFiles,
          allowUnsigned: true,
        });
        resultPkg = res.package;
      }

      onSuccess(resultPkg);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save package");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden border rounded-xl shadow-2xl bg-[var(--panel)] border-[var(--edge)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[var(--edge)] bg-[var(--panel-2)]/30">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <Code size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[var(--ink)]">
                  {isEditing ? `Edit Extension · ${packageToEdit?.name}` : "Extension Scaffolder & Code Studio"}
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[var(--panel-2)] text-[var(--ink-2)] border border-[var(--edge)]">
                  {pkgKind}
                </span>
              </div>
              <p className="text-xs text-[var(--ink-3)]">
                Author, test, and install extensions directly from the Admin Panel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing && step === "editor" && (
              <button
                type="button"
                onClick={() => setStep("template")}
                className="px-3 py-1.5 text-xs rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
              >
                Change Template
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        {step === "template" && !isEditing ? (
          <div className="flex-1 p-8 overflow-y-auto space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-[var(--ink)]">Choose a Starter Template</h4>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">
                Kickstart with pre-wired SDK bindings or start from a clean slate
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-5 rounded-xl border cursor-pointer transition-all hover:border-[var(--accent)] hover:shadow-lg ${
                    selectedTemplateId === tpl.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-[var(--edge)] bg-[var(--panel-2)]/40 hover:bg-[var(--panel-2)]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="p-2.5 rounded-lg bg-[var(--panel)] text-[var(--accent)] border border-[var(--edge)]">
                      {tpl.kind === "widget" ? <Layers size={18} /> : tpl.kind === "emitter" ? <Radio size={18} /> : <Cpu size={18} />}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[var(--panel)] text-[var(--ink-2)] border border-[var(--edge)]">
                      {tpl.kind}
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-[var(--ink)]">{tpl.name}</h5>
                  <p className="text-xs text-[var(--ink-3)] mt-1 line-clamp-2">{tpl.description}</p>
                  <div className="mt-4 pt-3 border-t border-[var(--edge)] text-[11px] font-mono text-[var(--ink-3)]">
                    {Object.keys(tpl.files).length} files included
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[var(--edge)]">
              <h4 className="text-xs font-semibold text-[var(--ink-2)] mb-3">Or Start from Scratch</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleCreateBlank("widget")}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)] hover:border-[var(--accent)] transition-all"
                >
                  <Layers size={15} className="text-sky-400" />
                  Blank Canvas Widget
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateBlank("emitter")}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)] hover:border-[var(--accent)] transition-all"
                >
                  <Radio size={15} className="text-emerald-400" />
                  Blank Telemetry Emitter
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateBlank("composite")}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)] hover:border-[var(--accent)] transition-all"
                >
                  <Cpu size={15} className="text-purple-400" />
                  Blank Composite Suite
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left sidebar: Package Metadata & File Tree */}
            <div className="w-full md:w-72 border-r border-[var(--edge)] bg-[var(--panel-2)]/30 flex flex-col shrink-0">
              <div className="p-4 border-b border-[var(--edge)] space-y-3">
                <div className="text-xs font-semibold text-[var(--ink)]">Package Metadata</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-[var(--ink-3)] block mb-0.5">Package ID</label>
                    <input
                      type="text"
                      disabled={isEditing}
                      value={pkgId}
                      onChange={(e) => setPkgId(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs font-mono rounded border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--ink-3)] block mb-0.5">Display Name</label>
                    <input
                      type="text"
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-[var(--ink-3)] block mb-0.5">Kind</label>
                      <select
                        disabled={isEditing}
                        value={pkgKind}
                        onChange={(e) => setPkgKind(e.target.value as PackageKind)}
                        className="w-full px-2 py-1 text-xs rounded border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] disabled:opacity-60"
                      >
                        <option value="widget">Widget</option>
                        <option value="emitter">Emitter</option>
                        <option value="composite">Composite</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--ink-3)] block mb-0.5">Version</label>
                      <input
                        type="text"
                        value={pkgVersion}
                        onChange={(e) => setPkgVersion(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs font-mono rounded border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* File Explorer */}
              <div className="flex-1 p-3 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-[11px] font-semibold text-[var(--ink-3)] uppercase tracking-wider">
                    Files ({Object.keys(files).length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddFile(true)}
                    className="p-1 rounded text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                    title="Add file"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {showAddFile && (
                  <form onSubmit={handleAddFile} className="p-2 mb-2 rounded bg-[var(--panel)] border border-[var(--edge)] space-y-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. helper.js or script.py"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono rounded border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowAddFile(false)}
                        className="px-2 py-0.5 text-[11px] rounded text-[var(--ink-3)] hover:text-[var(--ink)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-2.5 py-0.5 text-[11px] rounded bg-[var(--accent)] text-white"
                      >
                        Add
                      </button>
                    </div>
                  </form>
                )}

                {Object.keys(files).map((name) => (
                  <div
                    key={name}
                    onClick={() => setActiveFileName(name)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-all ${
                      activeFileName === name
                        ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                        : "text-[var(--ink-2)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span className="truncate">{name}</span>
                    {name !== "manifest.json" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(name);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete file"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Code Editor & Bottom Bar */}
            <div className="flex-1 flex flex-col overflow-hidden bg-[var(--panel)]">
              {/* Active Tab bar */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--edge)] bg-[var(--panel-2)]/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium text-[var(--ink)]">{activeFileName}</span>
                  {activeFileName === "manifest.json" && manifestError && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-400">
                      <AlertTriangle size={12} /> Syntax Error
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--ink-3)]">UTF-8</span>
              </div>

              {/* Text Area */}
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  value={files[activeFileName] || ""}
                  onChange={(e) => handleActiveFileChange(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full p-4 font-mono text-xs leading-relaxed resize-none border-none outline-none bg-transparent text-[var(--ink)] selection:bg-[var(--accent)]/30"
                  placeholder="Enter file contents here..."
                />
              </div>

              {/* Status & Error Footer */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span className="truncate">{error}</span>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--edge)] bg-[var(--panel-2)]/30">
                <div className="text-xs text-[var(--ink-3)]">
                  Zero restart · Changes take effect immediately
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving}
                    className="px-3.5 py-1.5 text-xs rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel-2)] transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveOrInstall}
                    disabled={isSaving || Boolean(manifestError)}
                    className="flex items-center gap-2 px-5 py-1.5 text-xs font-medium rounded-lg text-white bg-[var(--accent)] hover:opacity-90 transition-all border border-transparent disabled:bg-[var(--btn-disabled-bg)] disabled:border-[var(--btn-disabled-border)] disabled:text-[var(--btn-disabled-text)] disabled:cursor-not-allowed disabled:opacity-100"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {isEditing ? "Save & Hot Reload" : "Validate & Install to Node"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
