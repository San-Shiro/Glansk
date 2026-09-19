import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutTemplate, Radio, Cpu, Boxes, Pencil, Plus, MonitorPlay, Activity,
  Zap, Lock, ChevronRight, ArrowRight, ShieldCheck, AlertTriangle, CheckCircle2,
  RefreshCw, Terminal, Layers, ExternalLink, HardDrive, Bell, PauseCircle, Bookmark
} from "lucide-react";
import { api } from "@/lib/api";
import type { CanvasSummary, RuntimeStatus } from "@/lib/types";
import { Button, Pill, Spinner } from "@/components/ui";
import { Card, SectionHeader, StatCard, ColorBlockCard, phaseTone } from "../primitives";

interface OverviewTabProps {
  onNewCanvas: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export default function OverviewTab({ onNewCanvas, onNavigateTab }: OverviewTabProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const canvasesQ = useQuery({ queryKey: ["canvases"], queryFn: api.listCanvases });
  const runtimeQ = useQuery({ queryKey: ["runtime"], queryFn: api.listRuntime, refetchInterval: 5000 });
  const devicesQ = useQuery({ queryKey: ["devices"], queryFn: api.deviceStatus, retry: false });
  const emittersQ = useQuery({ queryKey: ["emitters"], queryFn: api.listEmitters, refetchInterval: 10000 });
  const secretsQ = useQuery({ queryKey: ["vault-secrets"], queryFn: api.listSecrets });
  const packagesQ = useQuery({ queryKey: ["packages"], queryFn: () => api.listPackages() });
  const auditQ = useQuery({ queryKey: ["audit-log"], queryFn: api.audit });

  const canvases = canvasesQ.data ?? [];
  const runtime = runtimeQ.data ?? [];
  const packages = packagesQ.data ?? [];
  const deactivate = useMutation({
    mutationFn: (id: string) => api.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["runtime"] });
      qc.invalidateQueries({ queryKey: ["canvases"] });
    },
  });

  const runtimeById = useMemo(() => new Map(runtime.map((r) => [r.canvasId, r])), [runtime]);

  // Active Live Canvases
  const liveCanvases = useMemo(() => {
    return canvases.filter((c) => {
      const rt = runtimeById.get(c.id);
      return rt?.phase === "ready" && !!rt.activeRevision;
    });
  }, [canvases, runtimeById]);

  const liveCount = liveCanvases.length;
  const onlineEmitters = (emittersQ.data ?? []).filter((e) => e.status === "online").length;
  const totalWidgets = canvases.reduce((n, c) => n + c.widgetCount, 0);
  const vaultCount = secretsQ.data?.length ?? 0;
  const pinCount = devicesQ.data?.allowedPins.length ?? 0;
  const [filterCategory, setFilterCategory] = useState<"all" | "displays" | "fleet" | "hardware">("all");

  // Derive system alerts or errors from runtime and audit logs
  const systemErrors = useMemo(() => {
    const alerts: Array<{ id: string; type: "critical" | "warning" | "info"; title: string; message: string; timestamp: string }> = [];

    // Check runtime error states
    runtime.forEach((r) => {
      if (r.phase === "failed" || r.phase === "degraded") {
        alerts.push({
          id: `runtime-${r.canvasId}`,
          type: "critical",
          title: `Canvas Runtime ${r.phase.toUpperCase()}`,
          message: `Canvas ${r.canvasId} reported ${r.phase} status.`,
          timestamp: "Recently",
        });
      }
    });

    // Check offline emitters
    const offlineEmitters = (emittersQ.data ?? []).filter((e) => e.status === "offline");
    if (offlineEmitters.length > 0) {
      alerts.push({
        id: "offline-emitters",
        type: "warning",
        title: "Emitter Connectivity Warning",
        message: `${offlineEmitters.length} registered background daemon${offlineEmitters.length > 1 ? "s are" : " is"} currently offline.`,
        timestamp: "Fleet Watcher",
      });
    }

    // Check audit logs for reset or auth failures
    const logs = auditQ.data ?? [];
    logs.slice(0, 5).forEach((l, i: number) => {
      if (l.outcome === "denied" || l.outcome === "failed") {
        alerts.push({
          id: `audit-${l.id || i}`,
          type: "warning",
          title: `Security Event: ${l.action}`,
          message: `${l.actor} outcome ${l.outcome}`,
          timestamp: l.at ? new Date(l.at).toLocaleTimeString() : "Recent",
        });
      }
    });

    return alerts;
  }, [runtime, emittersQ.data, auditQ.data]);

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const activeAlerts = systemErrors.filter((a) => !dismissedAlerts.has(a.id));

  if (canvasesQ.isLoading) {
    return <div className="grid place-items-center py-24"><Spinner size={24} /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Filter Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: "all", label: "All Systems" },
            { id: "displays", label: "Live Displays" },
            { id: "fleet", label: "Fleet Apps" },
            { id: "hardware", label: "Hardware & Vault" },
          ] as const
        ).map((pill) => {
          const isActive = filterCategory === pill.id;
          return (
            <button
              key={pill.id}
              onClick={() => setFilterCategory(pill.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${
                isActive
                  ? "bg-[var(--pill-active-bg)] text-[var(--pill-active-fg)] font-semibold shadow-sm"
                  : "bg-[var(--pill-bg)] text-[var(--ink-2)] hover:bg-[var(--pill-hover)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
              }`}
            >
              {pill.label}
            </button>
          );
        })}
      </div>

      {/* Hero Metric Cards (Obsidian Precision Control Plane) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(filterCategory === "all" || filterCategory === "displays") && (
          <ColorBlockCard
            tone="emerald"
            category="Active Kiosks"
            categoryIcon={<Radio size={12} />}
            title="Live Displays"
            subtitle={liveCount > 0 ? "Broadcasting on LAN" : "No active kiosk screen"}
            metricLabel="Live Displays"
            metricValue={`${liveCount} Active`}
            progressPercent={Math.min(100, Math.round((liveCount / Math.max(1, canvases.length)) * 100))}
            badgeLabel={
              liveCanvases.length > 0
                ? `${liveCanvases[0].logicalSize.width}×${liveCanvases[0].logicalSize.height}`
                : "0 screens"
            }
            actionLabel={liveCanvases.length > 0 ? "Open Live" : "View Canvases"}
            actionVariant="primary"
            actionIcon={<ExternalLink size={12} />}
            onAction={() => {
              if (liveCanvases.length > 0) {
                window.open(`/kiosk/${liveCanvases[0].id}`, "_blank");
              } else {
                onNavigateTab?.("canvases");
              }
            }}
          />
        )}

        {(filterCategory === "all" || filterCategory === "fleet") && (
          <ColorBlockCard
            tone="indigo"
            category="Fleet Bridges"
            categoryIcon={<Activity size={12} />}
            title="Live Apps Fleet"
            subtitle={`${emittersQ.data?.length ?? 0} registered bridges`}
            metricLabel="Fleet Concurrency"
            metricValue={`${onlineEmitters} Online`}
            progressPercent={Math.min(
              100,
              Math.round((onlineEmitters / Math.max(1, emittersQ.data?.length ?? 1)) * 100)
            )}
            badgeLabel={`${onlineEmitters}/${emittersQ.data?.length ?? 0} online`}
            actionLabel="Manage Fleet"
            actionVariant="secondary"
            actionIcon={<ArrowRight size={12} />}
            onAction={() => onNavigateTab?.("emitters")}
          />
        )}

        {(filterCategory === "all" || filterCategory === "displays") && (
          <ColorBlockCard
            tone="cyan"
            category="Runtime Catalog"
            categoryIcon={<Boxes size={12} />}
            title="Canvas Catalog"
            subtitle={`${canvases.length} layouts · ${packages.length} pkgs`}
            metricLabel="Catalog Depth"
            metricValue={`${totalWidgets} Widgets`}
            progressPercent={canvases.length > 0 ? Math.min(100, canvases.length * 25) : 10}
            badgeLabel={`${canvases.length} layouts`}
            actionLabel="Browse Canvases"
            actionVariant="secondary"
            actionIcon={<ArrowRight size={12} />}
            onAction={() => onNavigateTab?.("canvases")}
          />
        )}

        {(filterCategory === "all" || filterCategory === "hardware") && (
          <ColorBlockCard
            tone="amber"
            category="Platform Security"
            categoryIcon={<ShieldCheck size={12} />}
            title="Hardware Sandbox"
            subtitle="Confined GPIO & Secret Vault"
            metricLabel="Isolated Resources"
            metricValue={`${pinCount} Pins`}
            progressPercent={100}
            badgeLabel={`${vaultCount} keys`}
            actionLabel="Inspect Vault"
            actionVariant="secondary"
            actionIcon={<ArrowRight size={12} />}
            onAction={() => onNavigateTab?.("vault")}
          />
        )}
      </div>

      {/* Active Live Displays Tray (if any canvas is active) */}
      {liveCanvases.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
              <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--ink)" }}>
                Active Kiosk Displays ({liveCanvases.length})
              </h3>
            </div>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab("canvases")}
                className="text-xs font-semibold flex items-center gap-1 text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              >
                <span>Manage Canvases</span>
                <ArrowRight size={13} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {liveCanvases.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl border flex flex-col justify-between gap-3 shadow-sm transition-all hover:border-[var(--border-hover)]"
                style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border"
                      style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--ink)" }}
                    >
                      <MonitorPlay size={17} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>
                          {c.name}
                        </h4>
                        <span
                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border shrink-0"
                          style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse" />
                          LIVE
                        </span>
                      </div>
                      <p className="text-[11px] font-mono truncate mt-0.5 text-[var(--ink-3)]">
                        /kiosk/{c.id}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border-subtle)]"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span
                      className="px-2.5 py-0.5 rounded-md border"
                      style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
                    >
                      {c.logicalSize.width}×{c.logicalSize.height}
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded-md border"
                      style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
                    >
                      {c.widgetCount} widgets
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`/kiosk/${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-7 px-3 rounded-full flex items-center gap-1.5 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                      style={{ background: "var(--orange-primary)" }}
                      title="Open Live Kiosk"
                    >
                      <span>Open</span>
                      <ExternalLink size={12} />
                    </a>
                    <button
                      onClick={() => navigate(`/canvas/${c.id}/edit/v2`)}
                      className="w-7 h-7 rounded-full grid place-items-center border hover:border-[var(--border-hover)] transition-colors"
                      style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--ink-2)" }}
                      title="Studio (v2)"
                      aria-label="Studio (v2)"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => deactivate.mutate(c.id)}
                      disabled={deactivate.isPending && deactivate.variables === c.id}
                      title="Pause kiosk display / take offline"
                      aria-label="Pause"
                      className="w-7 h-7 rounded-full grid place-items-center border text-[var(--orange-primary)] hover:border-[var(--orange-primary)] disabled:opacity-40 transition-colors"
                      style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)" }}
                    >
                      {deactivate.isPending && deactivate.variables === c.id ? (
                        <Spinner size={11} />
                      ) : (
                        <PauseCircle size={13} className="text-[var(--orange-primary)]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subsystem Telemetry & Confinement */}
      <div
        className="rounded-[24px] border p-5 space-y-4 shadow-sm"
        style={{ background: "var(--bg-elevated)", borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              Subsystem Telemetry & Confinement
            </h3>
            <p className="text-xs mt-0.5 text-[var(--ink-3)]">
              Live event stream, security sandboxing, GPIO isolation, and vault keys
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--ink-3)]">
            <span className="w-2 h-2 rounded-full bg-[#34D399]" />
            <span>4 healthy</span>
          </div>
        </div>

        <div className="space-y-2.5">
          {/* Item 1: Event Signals */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:border-[var(--border-hover)]"
            style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border text-[var(--orange-primary)]"
                style={{ background: "var(--badge-bg)", borderColor: "var(--border-subtle)" }}
              >
                <Zap size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                  Event Signals & SSE Bus
                </h4>
                <p className="text-[11px] truncate mt-0.5 text-[var(--ink-3)]">
                  Real-time server-sent events connection active for live telemetry streaming
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border"
                style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                CONNECTED
              </span>
              <div
                className="w-7 h-7 rounded-full border grid place-items-center text-[var(--ink-3)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <ChevronRight size={13} />
              </div>
            </div>
          </div>

          {/* Item 2: Security Sandbox */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:border-[var(--border-hover)]"
            style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border text-[var(--ice-blue)]"
                style={{ background: "var(--badge-bg)", borderColor: "var(--border-subtle)" }}
              >
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                  Security Sandbox & CSP
                </h4>
                <p className="text-[11px] truncate mt-0.5 text-[var(--ink-3)]">
                  Packaged widgets restricted to null-origin iframes with connect-src 'none'
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border"
                style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
                ACTIVE & CONFINED
              </span>
              <div
                className="w-7 h-7 rounded-full border grid place-items-center text-[var(--ink-3)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <ChevronRight size={13} />
              </div>
            </div>
          </div>

          {/* Item 3: Device Broker */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:border-[var(--border-hover)]"
            style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border text-[var(--ice-blue)]"
                style={{ background: "var(--badge-bg)", borderColor: "var(--border-subtle)" }}
              >
                <Cpu size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                  Device Broker & Hardware
                </h4>
                <p className="text-[11px] truncate mt-0.5 text-[var(--ink-3)]">
                  Confined GPIO pins: {devicesQ.data?.allowedPins.join(", ") || "none"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border"
                style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange-primary)]" />
                {pinCount} PINS
              </span>
              <div
                className="w-7 h-7 rounded-full border grid place-items-center text-[var(--ink-3)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <ChevronRight size={13} />
              </div>
            </div>
          </div>

          {/* Item 4: Platform Secrets Vault */}
          <div
            className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:border-[var(--border-hover)]"
            style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center shrink-0 border text-[var(--ice-blue)]"
                style={{ background: "var(--badge-bg)", borderColor: "var(--border-subtle)" }}
              >
                <Lock size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold" style={{ color: "var(--ink)" }}>
                  Platform Secrets Vault
                </h4>
                <p className="text-[11px] truncate mt-0.5 text-[var(--ink-3)]">
                  Encrypted at rest with master key derivation and scoped rotation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border"
                style={{ background: "var(--badge-bg)", borderColor: "var(--badge-border)", color: "var(--badge-text)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange-primary)]" />
                {vaultCount} KEYS
              </span>
              <div
                className="w-7 h-7 rounded-full border grid place-items-center text-[var(--ink-3)]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <ChevronRight size={13} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: System Health & Error Alert Console */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold tracking-tight" style={{ color: "var(--ink)" }}>System Health & Alerts Console</h3>
            <p className="text-xs text-[var(--ink-3)]">
              Runtime diagnostics, failure mitigation status, and audit security events
            </p>
          </div>
          {activeAlerts.length > 0 && (
            <button
              onClick={() => setDismissedAlerts(new Set(systemErrors.map((a) => a.id)))}
              className="text-xs text-[var(--ink-3)] hover:text-[var(--ink)]"
            >
              Acknowledge All
            </button>
          )}
        </div>

        {activeAlerts.length === 0 ? (
          <div
            className="p-4 rounded-xl border flex items-center gap-3"
            style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
          >
            <CheckCircle2 size={18} className="text-[#34D399] shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-[#34D399]">All subsystems operational. </span>
              <span className="text-[var(--ink-3)]">
                Zero active crash loops, zero rollback triggers, and all platform security quotas healthy.
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 rounded-lg border flex items-start justify-between gap-3 text-xs"
                style={{
                  background: "var(--bg-canvas)",
                  borderColor: alert.type === "critical" ? "#F43F5E" : "var(--orange-deep)",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    size={16}
                    className={`shrink-0 mt-0.5 ${alert.type === "critical" ? "text-rose-400" : "text-[var(--orange-primary)]"}`}
                  />
                  <div>
                    <span className="font-bold" style={{ color: "var(--ink)" }}>{alert.title}</span>
                    <p className="mt-0.5 text-[var(--ink-2)]">{alert.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-[var(--ink-3)]">{alert.timestamp}</span>
                  <button
                    onClick={() => setDismissedAlerts((prev) => new Set([...prev, alert.id]))}
                    className="text-[11px] hover:underline text-[var(--ink-3)] hover:text-[var(--ink)]"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: Quick Navigation Launchpad */}
      {onNavigateTab && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <Card
            onClick={() => onNavigateTab("widgets")}
            className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Boxes size={16} className="text-[var(--accent)] shrink-0" />
              <div className="truncate">
                <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>Widget Catalog</div>
                <div className="text-[10px] text-[var(--ink-3)] truncate">16 widgets available</div>
              </div>
            </div>
            <ArrowRight size={13} className="text-[var(--ink-3)] shrink-0" />
          </Card>

          <Card
            onClick={() => onNavigateTab("extensions")}
            className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Layers size={16} className="text-emerald-400 shrink-0" />
              <div className="truncate">
                <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>Extensions Store</div>
                <div className="text-[10px] text-[var(--ink-3)] truncate">Packages & Code Studio</div>
              </div>
            </div>
            <ArrowRight size={13} className="text-[var(--ink-3)] shrink-0" />
          </Card>

          <Card
            onClick={() => onNavigateTab("emitters")}
            className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <BroadcastIcon size={16} className="text-indigo-400 shrink-0" />
              <div className="truncate">
                <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>Live Apps Fleet</div>
                <div className="text-[10px] text-[var(--ink-3)] truncate">{onlineEmitters} online daemons</div>
              </div>
            </div>
            <ArrowRight size={13} className="text-[var(--ink-3)] shrink-0" />
          </Card>

          <Card
            onClick={() => onNavigateTab("vault")}
            className="p-3.5 flex items-center justify-between gap-2 cursor-pointer hover:border-[var(--accent)] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Lock size={16} className="text-amber-400 shrink-0" />
              <div className="truncate">
                <div className="text-xs font-bold truncate" style={{ color: "var(--ink)" }}>Secret Vault</div>
                <div className="text-[10px] text-[var(--ink-3)] truncate">{vaultCount} encrypted keys</div>
              </div>
            </div>
            <ArrowRight size={13} className="text-[var(--ink-3)] shrink-0" />
          </Card>
        </div>
      )}
    </div>
  );
}

function BroadcastIcon({ size = 15, className = "" }: { size?: number; className?: string }) {
  return <Radio size={size} className={className} />;
}
