import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutTemplate, Pencil, Radio, UploadCloud, RotateCcw, Undo2, Plus,
  Boxes, Search, Check, AlertCircle, Trash2, Settings,
  Copy, ExternalLink, PauseCircle, X
} from "lucide-react";
import { api, ApiError, CANVAS_LIMITS } from "@/lib/api";
import type { CanvasSummary, RuntimeStatus, CanvasDocument } from "@/lib/types";
import { Button, Pill, Spinner, Modal, Field, TextInput, Select } from "@/components/ui";
import { Card, SectionHeader, EmptyState, phaseTone } from "../primitives";

export default function CanvasesTab({ onNewCanvas }: { onNewCanvas: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "draft">("all");
  const [settingsCanvas, setSettingsCanvas] = useState<CanvasSummary | null>(null);
  const [deleteCanvasTarget, setDeleteCanvasTarget] = useState<CanvasSummary | null>(null);

  const [toast, setToast] = useState<{ text: string; tone: "ok" | "err" } | null>(null);

  const flash = (m: string, tone: "ok" | "err" = "ok") => {
    setToast({ text: m, tone });
    window.setTimeout(() => setToast((s) => (s?.text === m ? null : s)), 3500);
  };

  const canvasesQ = useQuery({ queryKey: ["canvases"], queryFn: api.listCanvases });
  const runtimeQ = useQuery({ queryKey: ["runtime"], queryFn: api.listRuntime, refetchInterval: 5000 });
  const runtimeById = useMemo(() => new Map((runtimeQ.data ?? []).map((r) => [r.canvasId, r])), [runtimeQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["runtime"] });
    qc.invalidateQueries({ queryKey: ["canvases"] });
  };

  const publish = useMutation({
    mutationFn: (id: string) => api.publish(id),
    onSuccess: () => { flash("Published", "ok"); invalidate(); },
    onError: (e) => flash(`Publish failed: ${(e as Error).message}`, "err"),
  });

  const goLive = useMutation({
    mutationFn: async (id: string) => {
      const pub = await api.publish(id);
      return api.activate(id, { publicationRevision: pub.revision });
    },
    onSuccess: () => { flash("Dashboard is live on display", "ok"); invalidate(); },
    onError: (e) => flash(e instanceof ApiError ? e.message : `Go live failed: ${(e as Error).message}`, "err"),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.deactivate(id),
    onSuccess: () => { flash("Display runtime paused (taken offline)", "ok"); invalidate(); },
    onError: (e) => flash(`Pause failed: ${(e as Error).message}`, "err"),
  });

  const rollback = useMutation({
    mutationFn: (id: string) => api.rollback(id),
    onSuccess: () => { flash("Rolled back to last-known-good revision", "ok"); invalidate(); },
    onError: (e) => flash(`Rollback failed: ${(e as Error).message}`, "err"),
  });

  const restart = useMutation({
    mutationFn: (id: string) => api.restart(id),
    onSuccess: () => { flash("Display runtime restarted", "ok"); invalidate(); },
    onError: (e) => flash(`Restart failed: ${(e as Error).message}`, "err"),
  });

  const deleteCanvasMut = useMutation({
    mutationFn: (id: string) => api.deleteCanvas(id),
    onSuccess: () => {
      flash("Canvas deleted successfully", "ok");
      invalidate();
      setDeleteCanvasTarget(null);
      setSettingsCanvas(null);
    },
    onError: (e) => flash(`Delete failed: ${(e as Error).message}`, "err"),
  });

  const updateMetaMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; newId?: string; logicalSize?: { width: number; height: number } } }) =>
      api.updateCanvasMeta(id, input),
    onSuccess: () => {
      flash("Canvas details updated", "ok");
      invalidate();
      setSettingsCanvas(null);
    },
    onError: (e) => flash(`Update failed: ${(e as Error).message}`, "err"),
  });

  const canvases = canvasesQ.data ?? [];

  const filteredCanvases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return canvases.filter((c) => {
      const rt = runtimeById.get(c.id);
      const isLive = rt?.phase === "ready" && !!rt.activeRevision;

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "live"
          ? isLive
          : !isLive;

      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [canvases, runtimeById, statusFilter, searchQuery]);

  const liveCount = useMemo(() => {
    return canvases.filter((c) => {
      const rt = runtimeById.get(c.id);
      return rt?.phase === "ready" && !!rt.activeRevision;
    }).length;
  }, [canvases, runtimeById]);
  const draftCount = Math.max(0, canvases.length - liveCount);

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-center gap-2.5 shadow-sm animate-fade-in ${
            toast.tone === "err"
              ? "bg-red-500/10 border-red-500/25 text-red-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
          }`}
        >
          {toast.tone === "err" ? <AlertCircle size={14} className="shrink-0 text-red-400" /> : <Check size={14} className="shrink-0 text-emerald-400" />}
          <span className="font-medium">{toast.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="flex items-center gap-1.5">
          {(["all", "live", "draft"] as const).map((s) => {
            const active = statusFilter === s;
            const count = s === "all" ? canvases.length : s === "live" ? liveCount : draftCount;
            const label = s === "all" ? "All Canvases" : s === "live" ? "Live Displays" : "Drafts";
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: active ? "var(--pill-active-bg)" : "var(--pill-bg)",
                  color: active ? "var(--pill-active-fg)" : "var(--ink-2)",
                  border: "1px solid",
                  borderColor: active ? "transparent" : "var(--border-subtle)",
                }}
              >
                <span>{label}</span>
                <span className="text-[10px] font-mono opacity-60">({count})</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-3)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search canvases..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border focus:outline-none transition-colors"
            style={{
              background: "var(--panel)",
              borderColor: "var(--border-subtle)",
              color: "var(--ink)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      {canvasesQ.isLoading ? (
        <div className="grid place-items-center py-20"><Spinner size={24} /></div>
      ) : canvases.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate size={36} />}
          title="No canvases created yet"
          hint="Create your first fixed-resolution logical canvas and start placing interactive widgets."
          action={<Button variant="primary" onClick={onNewCanvas}><Plus size={14} /> Create Canvas</Button>}
        />
      ) : filteredCanvases.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ borderColor: "var(--line)" }}>
          <LayoutTemplate size={36} className="mx-auto mb-2 opacity-40" style={{ color: "var(--ink-3)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>No canvases match your search</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>Try clearing filters or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,360px))] gap-5 justify-start">
          {filteredCanvases.map((c) => {
            const rt = runtimeById.get(c.id);
            return (
              <CanvasCardItem
                key={c.id}
                canvas={c}
                runtime={rt}
                onEdit={() => navigate(`/canvas/${c.id}/edit/v2`)}
                onEditV1={() => navigate(`/canvas/${c.id}/edit/v1`)}
                onPublish={() => publish.mutate(c.id)}
                onGoLive={() => goLive.mutate(c.id)}
                onDeactivate={() => deactivate.mutate(c.id)}
                onOpenSettings={() => setSettingsCanvas(c)}
                busy={{
                  publish: publish.isPending && publish.variables === c.id,
                  live: goLive.isPending && goLive.variables === c.id,
                  deactivate: deactivate.isPending && deactivate.variables === c.id,
                  rollback: rollback.isPending && rollback.variables === c.id,
                  restart: restart.isPending && restart.variables === c.id,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Canvas Settings & Info Modal */}
      {settingsCanvas && (
        <CanvasSettingsModal
          canvas={settingsCanvas}
          runtime={runtimeById.get(settingsCanvas.id)}
          onClose={() => setSettingsCanvas(null)}
          onSave={(input) => updateMetaMut.mutate({ id: settingsCanvas.id, input })}
          onDelete={() => {
            const target = settingsCanvas;
            setSettingsCanvas(null);
            setDeleteCanvasTarget(target);
          }}
          onRestart={() => restart.mutate(settingsCanvas.id)}
          onRollback={() => rollback.mutate(settingsCanvas.id)}
          busy={{
            restart: restart.isPending && restart.variables === settingsCanvas.id,
            rollback: rollback.isPending && rollback.variables === settingsCanvas.id,
          }}
          isSaving={updateMetaMut.isPending}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteCanvasTarget && (
        <Modal
          title="Delete Canvas"
          onClose={() => setDeleteCanvasTarget(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteCanvasTarget(null)}>Cancel</Button>
              <Button
                variant="danger"
                disabled={deleteCanvasMut.isPending}
                onClick={() => deleteCanvasMut.mutate(deleteCanvasTarget.id)}
              >
                {deleteCanvasMut.isPending ? <Spinner size={13} /> : <Trash2 size={13} />}
                <span>Delete Permanently</span>
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to delete this canvas?</p>
                <p className="mt-1 text-slate-300">
                  Canvas <span className="font-mono font-bold text-white">"{deleteCanvasTarget.name}"</span> (<code className="font-mono text-red-300">/kiosk/{deleteCanvasTarget.id}</code>) and all its widget layouts and revision history will be permanently destroyed.
                </p>
              </div>
            </div>
            <p style={{ color: "var(--ink-3)" }}>
              If any kiosk displays are currently projecting this canvas, they will fall back to the default display.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// Canvas Preview Snapshot Component
// ============================================================================
function CanvasPreviewSnapshot({ canvas, live }: { canvas: CanvasSummary; live: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 340, height: 192 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setContainerSize({ width: clientWidth, height: clientHeight });
        }
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["canvas", canvas.id],
    queryFn: () => api.openCanvas(canvas.id),
    staleTime: 30000,
  });

  const [iframeLoaded, setIframeLoaded] = useState(false);

  const doc = workspace?.draft?.document;
  const width = doc?.logicalSize?.width || canvas.logicalSize.width || 1920;
  const height = doc?.logicalSize?.height || canvas.logicalSize.height || 1080;
  const widgets = doc?.widgets || [];

  const aspectRatio = width / height;
  const aspectTag =
    Math.abs(aspectRatio - 16 / 9) < 0.05
      ? "16:9 Landscape"
      : Math.abs(aspectRatio - 9 / 16) < 0.05
      ? "9:16 Portrait"
      : Math.abs(aspectRatio - 4 / 3) < 0.05
      ? "4:3 Standard"
      : Math.abs(aspectRatio - 1) < 0.05
      ? "1:1 Square"
      : `${width}×${height}`;

  // Keep a minimal 10px buffer so the preview occupies maximum possible space
  const pad = 10;
  const availW = Math.max(120, containerSize.width - pad);
  const availH = Math.max(80, containerSize.height - pad);

  const scale = Math.min(availW / width, availH / height);
  const previewWidth = Math.round(width * scale);
  const previewHeight = Math.round(height * scale);

  return (
    <div
      ref={containerRef}
      className="h-48 relative overflow-hidden flex items-center justify-center p-2 border-b select-none"
      style={{
        background: "var(--bg-canvas)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Background blueprint grid - clean, neutral, non-glowy */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: "linear-gradient(var(--line-2) 1px, transparent 1px), linear-gradient(90deg, var(--line-2) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />

      {/* Miniature preview canvas viewport */}
      <div
        className="relative rounded border overflow-hidden"
        style={{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
          background: doc?.background || "#0A0E14",
          borderColor: "var(--line)",
        }}
      >
        {isLoading ? (
          <div className="w-full h-full grid place-items-center"><Spinner size={14} /></div>
        ) : widgets.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
            <span className="text-[11px] font-mono font-semibold" style={{ color: "var(--ink-2)" }}>
              {width} × {height}
            </span>
            <span className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: "var(--ink-3)" }}>
              {aspectTag} · Empty
            </span>
          </div>
        ) : (
          <div className="relative w-full h-full overflow-hidden">
            {!iframeLoaded && (
              <div className="absolute inset-0 grid place-items-center bg-[var(--panel-2)] z-10">
                <Spinner size={14} />
              </div>
            )}
            <iframe
              src={`/kiosk/${encodeURIComponent(canvas.id)}?preview=1`}
              title={`Preview of ${canvas.name}`}
              onLoad={() => setIframeLoaded(true)}
              style={{
                width: `${width}px`,
                height: `${height}px`,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: "none",
                pointerEvents: "none",
                userSelect: "none",
              }}
              loading="lazy"
              tabIndex={-1}
            />
            {/* Watermark dimensions badge */}
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-mono bg-black/80 text-slate-300 backdrop-blur-md border border-white/10 z-20 pointer-events-none">
              {width}×{height}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Canvas Card Item
// ============================================================================
interface CanvasCardItemProps {
  canvas: CanvasSummary;
  runtime?: RuntimeStatus;
  onEdit: () => void;
  onEditV1?: () => void;
  onPublish: () => void;
  onGoLive: () => void;
  onDeactivate: () => void;
  onOpenSettings: () => void;
  busy: { publish: boolean; live: boolean; deactivate: boolean; rollback: boolean; restart: boolean };
}

function CanvasCardItem({
  canvas,
  runtime,
  onEdit,
  onEditV1,
  onPublish,
  onGoLive,
  onDeactivate,
  onOpenSettings,
  busy,
}: CanvasCardItemProps) {
  const live = runtime?.phase === "ready" && !!runtime.activeRevision;

  return (
    <div
      className={`w-full sm:max-w-[360px] flex flex-col rounded-[20px] border overflow-hidden transition-all duration-200 group ${
        live
          ? "border-[var(--border-subtle)] hover:border-[var(--border-hover)]"
          : "border-[var(--border-subtle)] opacity-80 hover:opacity-100 hover:border-[var(--border-hover)]"
      }`}
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--border-subtle)",
      }}
    >
      {/* Real Visual Canvas Snapshot Preview Area - Clean, standard, non-glowy */}
      <CanvasPreviewSnapshot canvas={canvas} live={live} />

      {/* Card Body - Accented warm background on live, standard greyed out on draft */}
      <div
        className="p-4 flex-1 flex flex-col justify-between gap-3.5 transition-colors"
        style={{
          background: live
            ? "rgba(230, 90, 40, 0.10)"
            : "rgba(0, 0, 0, 0.16)",
        }}
      >
        <div className="min-w-0">
          {/* Title */}
          <h3
            className="text-[15px] font-semibold tracking-tight truncate group-hover:text-[var(--accent)] transition-colors"
            style={{ color: "var(--ink)" }}
            title={canvas.name}
          >
            {canvas.name}
          </h3>
          <p className="text-[11px] font-mono mt-0.5 truncate text-[var(--ink-3)]">
            /kiosk/{canvas.id}
          </p>

          {/* Metadata Row: Clean Micro-Tokens */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border"
              style={{
                background: live ? "rgba(230, 90, 40, 0.12)" : "rgba(255, 255, 255, 0.03)",
                borderColor: live ? "rgba(230, 90, 40, 0.22)" : "rgba(255, 255, 255, 0.06)",
                color: live ? "#FFA88B" : "var(--ink-2)",
              }}
            >
              <Boxes size={11} className={live ? "text-orange-400" : "text-[var(--ink-3)]"} />
              <span>{canvas.widgetCount} {canvas.widgetCount === 1 ? "widget" : "widgets"}</span>
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border"
              style={{
                background: live ? "rgba(230, 90, 40, 0.12)" : "rgba(255, 255, 255, 0.03)",
                borderColor: live ? "rgba(230, 90, 40, 0.22)" : "rgba(255, 255, 255, 0.06)",
                color: live ? "#FFA88B" : "var(--ink-2)",
              }}
            >
              {canvas.publishedRevision != null ? `v${canvas.publishedRevision}` : "Draft"}
            </span>
          </div>
        </div>

        {/* Actions Bar: Primary Edit + Status Toggle + Management Row */}
        <div
          className="pt-3 border-t space-y-2 mt-auto"
          style={{ borderColor: live ? "rgba(230, 90, 40, 0.20)" : "var(--border-subtle)" }}
        >
          {/* Tier 1: Primary Edit + Quick Status Toggle */}
          <div className="flex items-center gap-2">
            {live ? (
              // Live Card: Control button has the vibrant ORANGE ACCENT background
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 text-xs py-2 px-3 font-semibold rounded-xl text-white transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 hover:brightness-110 shadow-sm"
                style={{
                  background: "var(--orange-primary)",
                  border: "1px solid transparent",
                }}
              >
                <Pencil size={13} />
                <span>Edit (v2)</span>
              </button>
            ) : (
              // Draft Card: Control button has STANDARD GREYED OUT background
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 text-xs py-2 px-3 font-medium rounded-xl border transition-all active:scale-[0.99] flex items-center justify-center gap-1.5 text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] hover:border-[var(--border-hover)]"
                style={{
                  background: "var(--badge-bg)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <Pencil size={13} className="text-[var(--ink-3)]" />
                <span>Edit (v2)</span>
              </button>
            )}

            {live ? (
              <button
                onClick={onDeactivate}
                disabled={busy.deactivate}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-150 active:scale-[0.98] hover:bg-orange-500/25 hover:text-white disabled:opacity-50"
                style={{
                  background: "rgba(18, 24, 32, 0.55)",
                  borderColor: "rgba(230, 90, 40, 0.35)",
                  color: "#FF9E7A",
                }}
                title="Pause kiosk display / take offline"
              >
                {busy.deactivate ? <Spinner size={12} /> : <PauseCircle size={13} className="text-orange-400" />}
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={onGoLive}
                disabled={busy.live}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500/25 disabled:opacity-50 text-[var(--ink-3)] hover:text-[var(--ink)]"
                style={{
                  background: "var(--badge-bg)",
                  borderColor: "var(--border-subtle)",
                }}
                title="Activate live on kiosk display"
              >
                {busy.live ? <Spinner size={12} /> : <Radio size={13} className="text-[var(--ink-3)]" />}
                <span>Go Live</span>
              </button>
            )}
          </div>

          {/* Tier 2: Management Actions (Settings, Publish, Open, v1) */}
          <div className="grid grid-cols-4 gap-1.5">
            {onEditV1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditV1(); }}
                title="Open in Classic Studio v1"
                className="inline-flex items-center justify-center gap-1 py-1.5 px-1 rounded-xl text-[11px] font-mono font-medium border transition-all duration-150 active:scale-[0.98] hover:bg-[var(--panel-2)] hover:border-[var(--border-hover)] text-[var(--ink-3)] hover:text-[var(--ink)]"
                style={{
                  borderColor: live ? "rgba(230, 90, 40, 0.22)" : "var(--border-subtle)",
                  background: live ? "rgba(18, 24, 32, 0.6)" : "var(--badge-bg)",
                }}
              >
                <span>v1</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenSettings(); }}
              title="Canvas Settings"
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] hover:bg-[var(--panel-2)] hover:border-[var(--border-hover)] text-[var(--ink-2)] hover:text-[var(--ink)]"
              style={{
                borderColor: live ? "rgba(230, 90, 40, 0.22)" : "var(--border-subtle)",
                background: live ? "rgba(18, 24, 32, 0.6)" : "var(--badge-bg)",
              }}
            >
              <Settings size={13} className={live ? "text-orange-400/80" : "text-[var(--ink-3)]"} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPublish(); }}
              disabled={busy.publish}
              title="Publish"
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] hover:bg-[var(--panel-2)] hover:border-[var(--border-hover)] text-[var(--ink-2)] hover:text-[var(--ink)] disabled:opacity-40"
              style={{
                borderColor: live ? "rgba(230, 90, 40, 0.22)" : "var(--border-subtle)",
                background: live ? "rgba(18, 24, 32, 0.6)" : "var(--badge-bg)",
              }}
            >
              {busy.publish ? <Spinner size={12} /> : <UploadCloud size={13} className={live ? "text-orange-400/80" : "text-[var(--ink-3)]"} />}
              <span>{busy.publish ? "..." : "Publish"}</span>
            </button>

            <a
              href={`/kiosk/${canvas.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open Display"
              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all duration-150 active:scale-[0.98] hover:bg-[var(--panel-2)] hover:border-[var(--border-hover)] text-[var(--ink-2)] hover:text-[var(--ink)]"
              style={{
                borderColor: live ? "rgba(230, 90, 40, 0.22)" : "var(--border-subtle)",
                background: live ? "rgba(18, 24, 32, 0.6)" : "var(--badge-bg)",
              }}
            >
              <ExternalLink size={13} className={live ? "text-orange-400/80" : "text-[var(--ink-3)]"} />
              <span>Open</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Canvas Settings & Information Modal
// ============================================================================
interface CanvasSettingsModalProps {
  canvas: CanvasSummary;
  runtime?: RuntimeStatus;
  onClose: () => void;
  onSave: (input: { name?: string; newId?: string; logicalSize?: { width: number; height: number } }) => void;
  onDelete: () => void;
  onRestart?: () => void;
  onRollback?: () => void;
  busy?: { restart?: boolean; rollback?: boolean };
  isSaving: boolean;
}

function CanvasSettingsModal({
  canvas,
  runtime,
  onClose,
  onSave,
  onDelete,
  onRestart,
  onRollback,
  busy,
  isSaving,
}: CanvasSettingsModalProps) {
  const [name, setName] = useState(canvas.name);
  const [slug, setSlug] = useState(canvas.id);
  const [preset, setPreset] = useState(`${canvas.logicalSize.width}x${canvas.logicalSize.height}`);
  const [customWidth, setCustomWidth] = useState(canvas.logicalSize.width);
  const [customHeight, setCustomHeight] = useState(canvas.logicalSize.height);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const sanitizeSlug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 128);

  const handlePresetChange = (val: string) => {
    setPreset(val);
    if (val !== "custom") {
      const [w, h] = val.split("x").map(Number);
      if (w && h) {
        setCustomWidth(w);
        setCustomHeight(h);
      }
    }
  };

  const handleSave = () => {
    setErrorMsg("");
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();

    if (!trimmedName) {
      setErrorMsg("Canvas name cannot be empty");
      return;
    }

    if (!CANVAS_LIMITS.id.test(trimmedSlug)) {
      setErrorMsg("Invalid display URL: use lowercase letters, numbers, and hyphens.");
      return;
    }

    onSave({
      name: trimmedName,
      newId: trimmedSlug !== canvas.id ? trimmedSlug : undefined,
      logicalSize: { width: customWidth, height: customHeight },
    });
  };

  const copyKioskUrl = () => {
    const fullUrl = `${window.location.origin}/kiosk/${slug || canvas.id}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const aspectRatio = customWidth / customHeight;
  const aspectTag =
    Math.abs(aspectRatio - 16 / 9) < 0.05
      ? "16:9 Landscape"
      : Math.abs(aspectRatio - 9 / 16) < 0.05
      ? "9:16 Portrait"
      : Math.abs(aspectRatio - 4 / 3) < 0.05
      ? "4:3 Standard"
      : `${customWidth}×${customHeight}`;

  return (
    <Modal
      title="Canvas Settings"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={isSaving} onClick={handleSave}>
            {isSaving ? <Spinner size={13} /> : <Check size={13} />}
            <span>Save Changes</span>
          </Button>
        </>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Canvas Name */}
        <Field label="Canvas Name" hint="Title shown across your dashboard and display screens.">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Operations Command Center"
            autoFocus
          />
        </Field>

        {/* Display URL */}
        <Field label="Display URL" hint="Direct web path for screens (/kiosk/...). Lowercase letters, numbers, and hyphens.">
          <TextInput
            value={slug}
            onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
            placeholder="command-center"
          />
        </Field>

        {/* Display Resolution */}
        <Field label="Display Resolution & Orientation">
          <div className="space-y-2">
            <Select value={preset} onChange={(e) => handlePresetChange(e.target.value)}>
              <option value="1920x1080">1920 × 1080 (16:9 Landscape)</option>
              <option value="1280x720">1280 × 720 (720p HD)</option>
              <option value="1024x600">1024 × 600 (7-inch Pi Touch)</option>
              <option value="800x480">800 × 480 (5-inch Pi Display)</option>
              <option value="1080x1920">1080 × 1920 (9:16 Portrait Screen)</option>
              <option value="custom">Custom Resolution...</option>
            </Select>

            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <span className="text-[10px] text-[var(--ink-3)] uppercase block mb-1">Width (px)</span>
                  <TextInput
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Math.max(320, parseInt(e.target.value) || 320))}
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[var(--ink-3)] uppercase block mb-1">Height (px)</span>
                  <TextInput
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Math.max(240, parseInt(e.target.value) || 240))}
                  />
                </div>
              </div>
            )}
          </div>
        </Field>

        {errorMsg && (
          <div className="text-xs p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Display Details Card */}
        <div className="p-3.5 rounded-lg border space-y-2 text-xs" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
          <span className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: "var(--ink-3)" }}>
            Display Details
          </span>

          {/* Kiosk URL with 1-click copy */}
          <div className="flex items-center justify-between gap-2 py-1 border-b" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink-3)" }}>Display Link:</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--accent)]">
              <span>/kiosk/{slug || canvas.id}</span>
              <button
                onClick={copyKioskUrl}
                title="Copy direct kiosk URL"
                className="p-1 rounded hover:bg-[var(--panel)] transition-colors text-[var(--ink-3)] hover:text-[var(--ink)]"
              >
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink-3)" }}>Draft Version:</span>
            <span className="font-mono font-semibold" style={{ color: "var(--ink)" }}>v{canvas.draftRevision}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink-3)" }}>Published Version:</span>
            <span className="font-mono" style={{ color: "var(--ink)" }}>
              {canvas.publishedRevision != null ? `v${canvas.publishedRevision}` : "Draft not yet published"}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink-3)" }}>Status:</span>
            <span className="font-mono capitalize flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
              <span className={`w-1.5 h-1.5 rounded-full ${runtime?.phase === "ready" ? "bg-emerald-400" : "bg-slate-400"}`} />
              {runtime?.phase === "ready" ? `Live (v${runtime.activeRevision})` : (runtime?.phase ?? "idle")}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink-3)" }}>Aspect Ratio:</span>
            <span className="font-mono" style={{ color: "var(--ink)" }}>{aspectTag}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span style={{ color: "var(--ink-3)" }}>Widgets Placed:</span>
            <span className="font-mono font-semibold" style={{ color: "var(--ink)" }}>{canvas.widgetCount} active widgets</span>
          </div>
        </div>

        {/* Runtime Actions: Restart / Restore if available */}
        {((runtime?.phase === "ready" && onRestart) || (runtime?.lastKnownGoodRevision != null && runtime.lastKnownGoodRevision !== runtime.activeRevision && onRollback)) && (
          <div className="flex items-center gap-2 pt-2 border-t" style={{ borderColor: "var(--line)" }}>
            {runtime?.lastKnownGoodRevision != null && runtime.lastKnownGoodRevision !== runtime.activeRevision && onRollback && (
              <button
                type="button"
                onClick={onRollback}
                disabled={busy?.rollback}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-amber-500/10 text-amber-400 disabled:opacity-50"
                style={{ borderColor: "var(--line)" }}
              >
                {busy?.rollback ? <Spinner size={12} /> : <Undo2 size={13} />}
                <span>Restore v{runtime.lastKnownGoodRevision}</span>
              </button>
            )}
            {runtime?.phase === "ready" && onRestart && (
              <button
                type="button"
                onClick={onRestart}
                disabled={busy?.restart}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors hover:bg-[var(--panel)] text-[var(--ink-2)] disabled:opacity-50"
                style={{ borderColor: "var(--line)" }}
              >
                {busy?.restart ? <Spinner size={12} /> : <RotateCcw size={13} />}
                <span>Restart Display</span>
              </button>
            )}
          </div>
        )}

        {/* Danger Zone: Delete Button */}
        <div className="pt-2 border-t flex justify-between items-center" style={{ borderColor: "var(--line)" }}>
          <span className="text-[11px] text-red-400">Danger Zone</span>
          <Button variant="danger" onClick={onDelete} className="text-xs">
            <Trash2 size={12} /> Delete Canvas
          </Button>
        </div>
      </div>
    </Modal>
  );
}
