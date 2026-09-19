import { useState, useRef } from "react";
import { PlusCircle, Upload, Link2, Trash2, RotateCcw, Check, Sparkles, RefreshCw } from "lucide-react";
import type { MediaValue, ObjectFit } from "@/lib/types";

const SAMPLE_LIBRARY = [
  { name: "Aurora Gradient", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23064e3b'/><stop offset='50%' stop-color='%230f766e'/><stop offset='100%' stop-color='%23042f2e'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23g)'/></svg>" },
  { name: "Cyber Neon", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='c' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%233b0764'/><stop offset='50%' stop-color='%231e1b4b'/><stop offset='100%' stop-color='%23030712'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23c)'/></svg>" },
  { name: "Dark Grid Pattern", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%2307111f'/><path d='M 40 0 L 0 0 0 40' fill='none' stroke='%2319334d' stroke-width='1'/></svg>" },
  { name: "Carbon Mesh", url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><rect width='20' height='20' fill='%230b131d'/><circle cx='2' cy='2' r='1.5' fill='%231a293b'/><circle cx='12' cy='12' r='1.5' fill='%231a293b'/></svg>" },
];

export default function MediaPickerControl({
  label = "Choose Image",
  value,
  onChange,
  onReset,
}: {
  label?: string;
  value?: MediaValue;
  onChange: (media: MediaValue | undefined) => void;
  onReset?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "library" | "url">("upload");
  const [urlInput, setUrlInput] = useState(value?.url || "");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const media = value || { source: "url", objectFit: "cover" };
  const hasMedia = Boolean(value?.url);

  const setFit = (objectFit: ObjectFit) => {
    onChange({ ...media, objectFit });
  };

  const applyUrl = (url: string) => {
    if (!url.trim()) {
      onChange(undefined);
    } else {
      onChange({ source: "url", url: url.trim(), objectFit: media.objectFit || "cover" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const img = document.createElement("img");
      const reader = new FileReader();

      reader.onload = () => {
        img.onload = async () => {
          const maxDim = 1280;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, w, h);
            const downscaledWebp = canvas.toDataURL("image/webp", 0.85);

            try {
              const res = await fetch("/api/v1/uploads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataUrl: downscaledWebp, filename: file.name }),
              });
              if (res.ok) {
                const data = await res.json();
                onChange({ source: "upload", url: data.url, objectFit: media.objectFit || "cover" });
              } else {
                onChange({ source: "upload", url: downscaledWebp, objectFit: media.objectFit || "cover" });
              }
            } catch {
              onChange({ source: "upload", url: downscaledWebp, objectFit: media.objectFit || "cover" });
            }
          }
          setIsUploading(false);
          setOpen(false);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2 select-none">
      <div className="flex items-center justify-between text-[12px] font-medium text-[var(--ink)]">
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {hasMedia && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" title="Media active" />
          )}
        </div>
        {onReset && hasMedia && (
          <button
            type="button"
            onClick={onReset}
            className="hover:opacity-100 opacity-60 flex items-center gap-1 text-[10px] text-[var(--ink-3)] hover:text-[var(--accent)] transition-all"
            title="Remove media"
          >
            <RotateCcw size={10} /> Reset
          </button>
        )}
      </div>

      {/* Elementor-style Large Rectangular Dropzone Preview Box */}
      <div className="relative group">
        {hasMedia ? (
          <div
            className="w-full h-28 rounded border overflow-hidden relative shadow-sm"
            style={{ borderColor: "var(--line-2)", background: "var(--panel)" }}
          >
            <div
              className="w-full h-full bg-center bg-no-repeat transition-transform duration-200 group-hover:scale-105"
              style={{
                backgroundImage: `url("${value?.url}")`,
                backgroundSize: media.objectFit === "fill" ? "100% 100%" : media.objectFit || "cover",
              }}
            />
            {/* Hover Actions Overlay */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(!open)}
                className="px-2.5 py-1 rounded bg-white text-[11px] font-semibold text-gray-900 shadow hover:bg-gray-100 flex items-center gap-1 transition-all"
                title="Change image"
              >
                <RefreshCw size={11} /> Change
              </button>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="p-1 rounded bg-red-600 text-white shadow hover:bg-red-700 transition-all"
                title="Delete image"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setOpen(!open)}
            className="w-full h-28 rounded border border-dashed hover:border-[var(--accent)] cursor-pointer flex flex-col items-center justify-center gap-1.5 transition-all text-center shadow-sm"
            style={{ borderColor: "var(--line-2)", background: "var(--panel-2)" }}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--panel)] border border-[var(--line-2)] flex items-center justify-center text-[var(--ink-3)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors shadow-sm">
              <PlusCircle size={18} />
            </div>
            <span className="text-[11px] font-medium text-[var(--ink-2)] group-hover:text-[var(--accent)] transition-colors">
              Choose Image
            </span>
          </div>
        )}
      </div>

      {/* Row: Size & Position dropdowns */}
      {hasMedia && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-[var(--ink)]">Display Size</span>
            <select
              value={media.objectFit || "cover"}
              onChange={(e) => setFit(e.target.value as ObjectFit)}
              className="h-7 px-2 rounded text-[11px] border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] shadow-sm"
              style={{ borderColor: "var(--line-2)" }}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill (Stretch)</option>
              <option value="none">None</option>
              <option value="scale-down">Scale Down</option>
            </select>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-[var(--ink)]">Position</span>
            <select
              value={media.objectPosition || "center"}
              onChange={(e) => onChange({ ...media, objectPosition: e.target.value })}
              className="h-7 px-2 rounded text-[11px] border bg-[var(--panel)] text-[var(--ink)] focus:border-[var(--accent)] shadow-sm"
              style={{ borderColor: "var(--line-2)" }}
            >
              <option value="center">Center</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="top left">Top Left</option>
              <option value="top right">Top Right</option>
              <option value="bottom left">Bottom Left</option>
              <option value="bottom right">Bottom Right</option>
            </select>
          </div>
        </div>
      )}

      {/* Expandable Selector Drawer */}
      {open && (
        <div
          className="p-3 rounded border bg-[var(--panel)] space-y-3 animate-fade-in shadow-md"
          style={{ borderColor: "var(--line)" }}
        >
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1 p-0.5 rounded border bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
            <button
              type="button"
              onClick={() => setTab("upload")}
              className={`flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded transition-all ${
                tab === "upload" ? "bg-[var(--panel)] text-[var(--accent)] font-bold shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Upload size={11} /> Upload
            </button>
            <button
              type="button"
              onClick={() => setTab("library")}
              className={`flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded transition-all ${
                tab === "library" ? "bg-[var(--panel)] text-[var(--accent)] font-bold shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Sparkles size={11} /> Library
            </button>
            <button
              type="button"
              onClick={() => setTab("url")}
              className={`flex items-center justify-center gap-1 py-1 text-[10px] font-semibold rounded transition-all ${
                tab === "url" ? "bg-[var(--panel)] text-[var(--accent)] font-bold shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <Link2 size={11} /> URL
            </button>
          </div>

          {/* Upload Tab */}
          {tab === "upload" && (
            <div className="space-y-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--panel-2)] transition-all text-center"
                style={{ borderColor: "var(--line)" }}
              >
                <Upload size={18} className="text-[var(--accent)]" />
                <span className="text-[11px] font-medium text-[var(--ink)]">
                  {isUploading ? "Optimizing & Uploading..." : "Click to select file from computer"}
                </span>
                <span className="text-[9px] text-[var(--ink-3)]">
                  Auto-downscaled to max 1280px WebP
                </span>
              </div>
            </div>
          )}

          {/* Library Tab */}
          {tab === "library" && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-[var(--ink-3)] font-semibold">Sample Patterns</span>
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                {SAMPLE_LIBRARY.map((s) => {
                  const sel = value?.url === s.url;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => {
                        applyUrl(s.url);
                        setOpen(false);
                      }}
                      className={`relative h-14 rounded border bg-cover bg-center overflow-hidden transition-all text-left p-1 ${
                        sel ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--line)] hover:border-[var(--line-2)]"
                      }`}
                      style={{ backgroundImage: `url("${s.url}")` }}
                      title={s.name}
                    >
                      <span className="absolute bottom-1 left-1 px-1 py-0.2 rounded bg-black/70 text-white text-[9px] font-medium backdrop-blur-sm truncate max-w-[90%]">
                        {s.name}
                      </span>
                      {sel && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow">
                          <Check size={10} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* URL Tab */}
          {tab === "url" && (
            <div className="space-y-1.5">
              <span className="text-[10px] text-[var(--ink-3)] font-semibold">Direct Image URL</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="flex-1 h-7 px-2 rounded text-[11px] font-mono border bg-[var(--panel-2)] text-[var(--ink)] focus:border-[var(--accent)]"
                  style={{ borderColor: "var(--line)" }}
                />
                <button
                  type="button"
                  onClick={() => {
                    applyUrl(urlInput);
                    setOpen(false);
                  }}
                  className="px-2.5 h-7 rounded text-[10px] font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-all shadow-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
