import { useState, useRef } from "react";
import { Upload, Globe, AlertTriangle, CheckCircle, X, Loader2, FileArchive } from "lucide-react";
import { api } from "@/lib/api";
import type { PackageRecord } from "@/lib/types";

interface ImportPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (pkg: PackageRecord) => void;
}

export default function ImportPackageModal({ isOpen, onClose, onSuccess }: ImportPackageModalProps) {
  const [tab, setTab] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [allowUnsigned, setAllowUnsigned] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0]!;
      if (dropped.name.endsWith(".zip") || dropped.name.endsWith(".glpkg")) {
        setFile(dropped);
        setError(null);
      } else {
        setError("Only .zip and .glpkg archives are supported");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let result: { ok: boolean; package: PackageRecord };
      if (tab === "file") {
        if (!file) throw new Error("Please select an extension package archive file");
        result = await api.importPackageZip(file, allowUnsigned);
      } else {
        if (!url.trim()) throw new Error("Please enter a valid package archive URL");
        result = await api.importPackageUrl(url.trim(), allowUnsigned);
      }

      onSuccess(result.package);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to import package");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg overflow-hidden border rounded-xl shadow-2xl bg-[var(--panel)] border-[var(--edge)]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--edge)]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
              <Upload size={18} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-[var(--ink)]">Import Extension Package</h3>
              <p className="text-xs text-[var(--ink-3)]">Install widgets, telemetry emitters, or composite suites</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="flex p-1 rounded-lg bg-[var(--panel-2)] border border-[var(--edge)]">
            <button
              type="button"
              onClick={() => { setTab("file"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === "file"
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <FileArchive size={14} />
              Upload Archive (.zip / .glpkg)
            </button>
            <button
              type="button"
              onClick={() => { setTab("url"); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === "url"
                  ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Globe size={14} />
              Install from URL
            </button>
          </div>

          {/* Tab 1: File Dropzone */}
          {tab === "file" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                isDragOver
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : file
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-[var(--edge)] hover:border-[var(--accent)]/60 bg-[var(--panel-2)]/50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.glpkg"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setFile(e.target.files[0]!);
                    setError(null);
                  }
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="p-3 rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle size={24} />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">{file.name}</div>
                    <div className="text-xs text-[var(--ink-3)]">{(file.size / 1024).toFixed(1)} KB · Ready to verify</div>
                  </div>
                  <span className="text-[11px] text-[var(--accent)] underline mt-1">Choose different file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="p-3 rounded-full bg-[var(--panel-2)] text-[var(--ink-3)]">
                    <Upload size={22} />
                  </span>
                  <div>
                    <div className="text-sm font-medium text-[var(--ink)]">Drag and drop extension archive here</div>
                    <div className="text-xs text-[var(--ink-3)] mt-0.5">Supports .glpkg or standard .zip bundles</div>
                  </div>
                  <span className="px-3 py-1 mt-2 text-xs rounded-md bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--edge)]">
                    Browse Computer
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--ink-2)]">Extension Package URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/releases/download/v1.0.0/package.glpkg"
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--ink-3)]"
              />
              <p className="text-[11px] text-[var(--ink-3)]">
                Direct download link to a release archive (.glpkg / .zip) or repository asset.
              </p>
            </div>
          )}

          {/* Security Toggle */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--panel-2)] border border-[var(--edge)]">
            <input
              id="unsigned-toggle"
              type="checkbox"
              checked={allowUnsigned}
              onChange={(e) => setAllowUnsigned(e.target.checked)}
              className="mt-0.5 rounded border-[var(--edge)] text-[var(--accent)] focus:ring-0"
            />
            <label htmlFor="unsigned-toggle" className="text-xs cursor-pointer select-none">
              <span className="font-medium text-[var(--ink)]">Allow development / community unsigned packages</span>
              <span className="block text-[11px] text-[var(--ink-3)] mt-0.5">
                Widgets remain strictly sandboxed (null-origin iframe, strict CSP, connect-src &apos;none&apos;).
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (tab === "file" && !file) || (tab === "url" && !url.trim())}
              className="flex items-center gap-2 px-5 py-2 text-xs font-medium rounded-lg text-white bg-[var(--accent)] hover:opacity-90 transition-all border border-transparent disabled:bg-[var(--btn-disabled-bg)] disabled:border-[var(--btn-disabled-border)] disabled:text-[var(--btn-disabled-text)] disabled:cursor-not-allowed disabled:opacity-100"
            >
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              {isLoading ? "Validating & Installing..." : "Install Extension"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
