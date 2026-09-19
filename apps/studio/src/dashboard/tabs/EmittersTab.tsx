import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radio, Play, Pause, SkipBack, SkipForward, Volume2,
  RefreshCw, Trash2, ChevronDown, ChevronRight, Copy, Check,
  Activity, Music, Gauge, ToggleLeft, Layers, Terminal, AlertCircle,
  Search, Cpu, Wifi, HardDrive
} from "lucide-react";
import { api } from "@/lib/api";
import type { EmitterRegistration, EmitterCategory, EmitterStatus } from "@/lib/types";
import { Button, Pill, Spinner, TextInput } from "@/components/ui";
import { Card, SectionHeader, StatCard, EmptyState } from "../primitives";

const CATEGORY_ICONS: Record<EmitterCategory | "all", typeof Activity> = {
  all: Layers,
  media: Music,
  metrics: Gauge,
  sensor: Cpu,
  switchboard: ToggleLeft,
  custom: Terminal,
};

function formatTimeAgo(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  return `${diffHrs}h ago`;
}

function statusTone(status: EmitterStatus): "ok" | "warn" | "danger" | "neutral" {
  switch (status) {
    case "online": return "ok";
    case "stale": return "warn";
    case "offline": return "danger";
    case "terminated": return "neutral";
    default: return "neutral";
  }
}

export default function EmittersTab() {
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [commandFeedback, setCommandFeedback] = useState<Record<string, string>>({});

  // Query emitters initial list
  const { data: emitters = [], isLoading, refetch } = useQuery({
    queryKey: ["emitters"],
    queryFn: api.listEmitters,
    refetchInterval: 10000,
  });

  // Real-time SSE listener
  useEffect(() => {
    let es: EventSource | null = null;
    let unmounted = false;

    try {
      es = new EventSource("/api/v1/emitters/events");

      es.addEventListener("emitter_update", (evt) => {
        if (unmounted) return;
        try {
          const payload = JSON.parse(evt.data) as { emitter: EmitterRegistration };
          if (payload.emitter) {
            qc.setQueryData<EmitterRegistration[]>(["emitters"], (old = []) => {
              const idx = old.findIndex(e => e.manifest.id === payload.emitter.manifest.id);
              if (idx >= 0) {
                const next = [...old];
                next[idx] = payload.emitter;
                return next;
              }
              return [...old, payload.emitter];
            });
          }
        } catch {
          refetch();
        }
      });

      es.addEventListener("emitter_status", (evt) => {
        if (unmounted) return;
        try {
          const payload = JSON.parse(evt.data) as { id: string; status: EmitterStatus };
          if (payload.id && payload.status) {
            qc.setQueryData<EmitterRegistration[]>(["emitters"], (old = []) => {
              return old.map(e => e.manifest.id === payload.id ? { ...e, status: payload.status } : e);
            });
          }
        } catch {
          refetch();
        }
      });

      es.addEventListener("emitter_pruned", (evt) => {
        if (unmounted) return;
        try {
          const payload = JSON.parse(evt.data) as { id: string };
          if (payload.id) {
            qc.setQueryData<EmitterRegistration[]>(["emitters"], (old = []) => {
              return old.filter(e => e.manifest.id !== payload.id);
            });
          }
        } catch {
          refetch();
        }
      });
    } catch {
      // EventSource not supported or blocked
    }

    return () => {
      unmounted = true;
      try { es?.close(); } catch {}
    };
  }, [qc, refetch]);

  // Dispatch Command Mutation
  const dispatchCommand = useMutation({
    mutationFn: async ({ id, command, payload }: { id: string; command: string; payload?: any }) => {
      return api.dispatchEmitterCommand(id, command, payload);
    },
    onSuccess: (res, vars) => {
      if (res.ok) {
        setCommandFeedback(prev => ({ ...prev, [vars.id]: `✓ Command "${vars.command}" dispatched` }));
      } else {
        setCommandFeedback(prev => ({ ...prev, [vars.id]: `✗ ${res.error || "Command failed"}` }));
      }
      setTimeout(() => {
        setCommandFeedback(prev => {
          const next = { ...prev };
          delete next[vars.id];
          return next;
        });
      }, 3000);
      qc.invalidateQueries({ queryKey: ["emitters"] });
    },
    onError: (err, vars) => {
      setCommandFeedback(prev => ({ ...prev, [vars.id]: `✗ ${err instanceof Error ? err.message : "Error"}` }));
    },
  });

  // Unregister Mutation
  const unregister = useMutation({
    mutationFn: async (id: string) => api.unregisterEmitter(id),
    onSuccess: (_, id) => {
      qc.setQueryData<EmitterRegistration[]>(["emitters"], (old = []) => old.filter(e => e.manifest.id !== id));
    },
  });

  // Filtered emitters
  const filtered = useMemo(() => {
    return emitters.filter(e => {
      const matchCat = selectedCategory === "all" || e.manifest.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchQuery = !q ||
        e.manifest.name.toLowerCase().includes(q) ||
        e.manifest.id.toLowerCase().includes(q) ||
        (e.manifest.description && e.manifest.description.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [emitters, selectedCategory, search]);

  const onlineCount = emitters.filter(e => e.status === "online").length;
  const categories: Array<EmitterCategory | "all"> = ["all", "media", "metrics", "sensor", "switchboard", "custom"];

  return (
    <div className="space-y-8">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Radio size={15} />}
          label="Registered Apps"
          value={emitters.length}
          hint="active emitters & daemons"
          tone="accent"
        />
        <StatCard
          icon={<Activity size={15} />}
          label="Online Fleet"
          value={onlineCount}
          hint={`${emitters.length - onlineCount} offline or stale`}
          tone={onlineCount > 0 ? "ok" : "warn"}
        />
        <StatCard
          icon={<Wifi size={15} />}
          label="Transports"
          value={Array.from(new Set(emitters.map(e => e.transport))).join(", ") || "none"}
          hint="HTTP / WebSocket / TmpFS"
          tone="accent"
        />
        <StatCard
          icon={<Terminal size={15} />}
          label="Command Engine"
          value="Enabled"
          hint="sub-50ms dispatch loop"
          tone="ok"
        />
      </div>

      {/* Header & Controls Bar */}
      <div>
        <SectionHeader
          title="Live Apps & Telemetry Emitters"
          subtitle="Real-time background processes providing OS telemetry, media controls, and sensor streams directly to dashboard widgets."
          action={
            <Button variant="subtle" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} /> Refresh
            </Button>
          }
        />

        {/* Filter Pills & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {categories.map(cat => {
              const Icon = CATEGORY_ICONS[cat];
              const active = selectedCategory === cat;
              const count = cat === "all" ? emitters.length : emitters.filter(e => e.manifest.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shrink-0"
                  style={{
                    background: active ? "var(--accent)" : "var(--panel-2)",
                    color: active ? "var(--accent-ink)" : "var(--ink-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Icon size={12} />
                  <span className="capitalize">{cat}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>

          <div className="relative min-w-[220px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
            <TextInput
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search emitters..."
              className="pl-8 text-xs"
            />
          </div>
        </div>

        {/* Emitters Grid */}
        {isLoading && emitters.length === 0 ? (
          <div className="grid place-items-center py-20"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Radio size={32} />}
            title={emitters.length === 0 ? "No emitters connected" : "No matching emitters found"}
            hint={
              emitters.length === 0
                ? "Run a background emitter daemon (such as the Go media monitor or system telemetry agent) to connect."
                : "Try adjusting your search query or category filter."
            }
          />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filtered.map(emitter => (
              <EmitterCard
                key={emitter.manifest.id}
                emitter={emitter}
                onCommand={(cmd, payload) => dispatchCommand.mutate({ id: emitter.manifest.id, command: cmd, payload })}
                isDispatching={dispatchCommand.isPending && dispatchCommand.variables?.id === emitter.manifest.id}
                feedback={commandFeedback[emitter.manifest.id]}
                onUnregister={() => unregister.mutate(emitter.manifest.id)}
                isUnregistering={unregister.isPending && unregister.variables === emitter.manifest.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmitterCard({
  emitter,
  onCommand,
  isDispatching,
  feedback,
  onUnregister,
  isUnregistering,
}: {
  emitter: EmitterRegistration;
  onCommand: (cmd: string, payload?: any) => void;
  isDispatching: boolean;
  feedback?: string;
  onUnregister: () => void;
  isUnregistering: boolean;
}) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  const { manifest, state, lastSeen, transport, status, instanceId } = emitter;
  const isMedia = manifest.category === "media" || ("is_playing" in state && ("track" in state || "artist" in state || "album" in state));

  const title = String(state.title || state.track || "No track playing");
  const artist = String(state.artist || state.author || "");
  const isPlaying = Boolean(state.is_playing || state.playing);
  const volume = typeof state.volume === "number" ? state.volume : undefined;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(state, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="flex flex-col overflow-hidden border">
      {/* Top Details */}
      <div className="p-4 flex items-start justify-between gap-3 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-lg grid place-items-center shrink-0 border"
            style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--accent)" }}
          >
            {isMedia ? <Music size={18} /> : manifest.category === "metrics" ? <Gauge size={18} /> : <Terminal size={18} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold truncate text-[var(--ink)]">{manifest.name}</h3>
              <Pill tone={statusTone(status)}>{status}</Pill>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--ink-3)] font-mono">
              <span>{manifest.id}</span>
              <span>•</span>
              <span className="uppercase font-semibold tracking-wider text-[9px] px-1.5 py-0.5 rounded bg-[var(--panel-2)] border border-[var(--line)]">
                {transport}
              </span>
              <span>•</span>
              <span>seen {formatTimeAgo(lastSeen)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onUnregister}
          disabled={isUnregistering}
          title="Unregister emitter"
          className="p-1.5 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--danger)] transition-colors shrink-0"
        >
          {isUnregistering ? <Spinner size={13} /> : <Trash2 size={14} />}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-4 space-y-4 flex-1">
        {/* If Media, display dedicated Media Control Panel */}
        {isMedia && (
          <div className="p-3 rounded-lg border space-y-3" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
            <div className="flex items-center justify-between min-w-0 gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold truncate text-[var(--ink)]">{title}</div>
                {artist && <div className="text-[11px] truncate text-[var(--ink-3)]">{artist}</div>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onCommand("previous")}
                  disabled={isDispatching}
                  className="p-2 rounded hover:bg-[var(--panel)] text-[var(--ink-2)] transition-colors"
                  title="Previous track"
                >
                  <SkipBack size={15} />
                </button>
                <button
                  onClick={() => onCommand("play_pause")}
                  disabled={isDispatching}
                  className="p-2 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] transition-transform active:scale-95 shadow-sm"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => onCommand("next")}
                  disabled={isDispatching}
                  className="p-2 rounded hover:bg-[var(--panel)] text-[var(--ink-2)] transition-colors"
                  title="Next track"
                >
                  <SkipForward size={15} />
                </button>
              </div>
            </div>

            {volume !== undefined && (
              <div className="flex items-center gap-2 pt-1 text-xs text-[var(--ink-3)]">
                <Volume2 size={13} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={e => onCommand("set_volume", { volume: Number(e.target.value) })}
                  className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
                />
                <span className="font-mono text-[10px] w-8 text-right">{volume}%</span>
              </div>
            )}
          </div>
        )}

        {/* Custom Manifest Controls */}
        {manifest.controls && manifest.controls.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {manifest.controls.map(ctrl => (
              <Button
                key={ctrl.id}
                variant="subtle"
                onClick={() => onCommand(ctrl.id)}
                disabled={isDispatching}
                className="text-xs justify-center"
              >
                {ctrl.label}
              </Button>
            ))}
          </div>
        )}

        {/* Feedback alert if any */}
        {feedback && (
          <div className="text-[11px] font-medium px-2.5 py-1.5 rounded border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)] animate-fade-in flex items-center gap-1.5">
            <Activity size={12} className="text-[var(--accent)]" /> {feedback}
          </div>
        )}

        {/* Collapsible State Inspector */}
        <div className="pt-2 border-t" style={{ borderColor: "var(--line)" }}>
          <button
            onClick={() => setShowJson(!showJson)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors py-1"
          >
            <span className="flex items-center gap-1.5">
              <Terminal size={12} /> Live State ({Object.keys(state).length} keys)
            </span>
            <div className="flex items-center gap-1">
              {showJson ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
          </button>

          {showJson && (
            <div className="mt-2 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-[var(--ink-3)]">
                  {instanceId ? `Instance: ${instanceId}` : "State Tree"}
                </span>
                <button
                  onClick={copyJson}
                  className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline font-semibold"
                >
                  {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy JSON</>}
                </button>
              </div>
              <pre
                className="p-2.5 rounded text-[11px] font-mono overflow-x-auto max-h-48 border"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink-2)" }}
              >
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
