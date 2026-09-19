import { useState, useEffect, useRef, useMemo } from "react";
import {
  Radio, Send, Play, Pause, Trash2, Copy, Check, Filter,
  Activity, Bell, Database, Terminal, ChevronDown, ChevronRight,
  RefreshCw, Zap, ShieldAlert
} from "lucide-react";
import { api } from "@/lib/api";
import { Button, Pill, Spinner, TextInput } from "@/components/ui";
import { Card, SectionHeader, StatCard, EmptyState } from "../primitives";

export interface SignalEventItem {
  id: string;
  type: "notification" | "state_update" | "heartbeat" | "error";
  topic?: string;
  senderId?: string;
  sessionId?: string;
  timestamp: number;
  data: any;
}

const PRESET_BROADCASTS = [
  {
    name: "System Notification",
    topic: "system:alert",
    payload: { title: "System Broadcast", message: "Fleet heartbeat nominal", level: "info" },
  },
  {
    name: "Media Play/Pause",
    topic: "media:control",
    payload: { action: "play_pause", source: "dashboard_signals" },
  },
  {
    name: "Sensor Alert",
    topic: "sensor:threshold",
    payload: { sensorId: "temp_core_0", value: 48.2, status: "nominal" },
  },
  {
    name: "Canvas Refresh",
    topic: "canvas:refresh",
    payload: { reason: "signal_broadcast", timestamp: Date.now() },
  },
];

export default function SignalsTab() {
  const [events, setEvents] = useState<SignalEventItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filterTopic, setFilterTopic] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [isConnected, setIsConnected] = useState(false);

  // Broadcast state
  const [broadcastTopic, setBroadcastTopic] = useState("system:alert");
  const [broadcastPayload, setBroadcastPayload] = useState(
    JSON.stringify({ title: "Live Test", message: "Broadcast from Event Bus monitor", level: "info" }, null, 2)
  );
  const [broadcastErr, setBroadcastErr] = useState("");
  const [broadcastSuccess, setBroadcastSuccess] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const listBottomRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // SSE Stream Listener
  useEffect(() => {
    let es: EventSource | null = null;
    let unmounted = false;

    const connect = () => {
      try {
        es = new EventSource("/api/v1/interactive-state/events");

        es.onopen = () => {
          if (!unmounted) setIsConnected(true);
        };

        es.onerror = () => {
          if (!unmounted) setIsConnected(false);
        };

        es.addEventListener("notification", (evt) => {
          if (unmounted || isPausedRef.current) return;
          try {
            const data = JSON.parse(evt.data);
            const item: SignalEventItem = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              type: "notification",
              topic: data.topic,
              senderId: data.senderId,
              sessionId: data.sessionId,
              timestamp: data.timestamp || Date.now(),
              data: data.payload,
            };
            setEvents(prev => [item, ...prev.slice(0, 199)]);
          } catch {}
        });

        es.addEventListener("state_update", (evt) => {
          if (unmounted || isPausedRef.current) return;
          try {
            const data = JSON.parse(evt.data);
            const item: SignalEventItem = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              type: "state_update",
              topic: `${data.mode}:${data.key}`,
              timestamp: data.updatedAt || Date.now(),
              data: { state: data.state, revision: data.revision },
            };
            setEvents(prev => [item, ...prev.slice(0, 199)]);
          } catch {}
        });

        const handleBeat = (evt: MessageEvent) => {
          if (unmounted || isPausedRef.current) return;
          try {
            const data = JSON.parse(evt.data || "{}");
            const item: SignalEventItem = {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              type: "heartbeat",
              timestamp: data.timestamp || Date.now(),
              data,
            };
            setEvents(prev => [item, ...prev.slice(0, 199)]);
          } catch {}
        };

        es.addEventListener("heartbeat", handleBeat);
        es.addEventListener("ping", handleBeat);
      } catch {}
    };

    connect();

    return () => {
      unmounted = true;
      try { es?.close(); } catch {}
    };
  }, []);

  // Handle Send Notification
  const handleSend = async () => {
    setBroadcastErr("");
    setBroadcastSuccess("");
    let parsed: any;
    try {
      parsed = JSON.parse(broadcastPayload);
    } catch {
      setBroadcastErr("Invalid JSON in payload");
      return;
    }

    if (!broadcastTopic.trim()) {
      setBroadcastErr("Topic cannot be empty");
      return;
    }

    setIsBroadcasting(true);
    try {
      const res = await api.sendNotification(broadcastTopic.trim(), parsed);
      if (res.ok) {
        setBroadcastSuccess(`Dispatched to "${broadcastTopic.trim()}"`);
        setTimeout(() => setBroadcastSuccess(""), 3000);
      } else {
        setBroadcastErr("Broadcast failed");
      }
    } catch (err) {
      setBroadcastErr(err instanceof Error ? err.message : "Broadcast error");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchType = filterType === "all" || e.type === filterType;
      const matchTopic = !filterTopic || (e.topic && e.topic.toLowerCase().includes(filterTopic.toLowerCase()));
      return matchType && matchTopic;
    });
  }, [events, filterType, filterTopic]);

  const uniqueTopics = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => { if (e.topic) s.add(e.topic); });
    return Array.from(s);
  }, [events]);

  return (
    <div className="space-y-8">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Radio size={15} />}
          label="Stream Connection"
          value={isConnected ? "Active" : "Connecting"}
          hint="SSE /interactive-state/events"
          tone={isConnected ? "ok" : "warn"}
        />
        <StatCard
          icon={<Zap size={15} />}
          label="Signals Captured"
          value={events.length}
          hint={isPaused ? "Feed paused" : "Streaming live"}
          tone="accent"
        />
        <StatCard
          icon={<Bell size={15} />}
          label="Active Topics"
          value={uniqueTopics.length}
          hint="distinct event channels"
          tone="accent"
        />
        <StatCard
          icon={<Terminal size={15} />}
          label="Publisher Engine"
          value="Ready"
          hint="REST POST /widget-notify"
          tone="ok"
        />
      </div>

      {/* Main Grid: Broadcaster (Left/Top) & Event Log (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Broadcast Station */}
        <div className="space-y-4">
          <Card className="p-4 flex flex-col space-y-4">
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line)" }}>
              <Send size={15} className="text-[var(--accent)]" />
              <h3 className="text-sm font-bold text-[var(--ink)]">Test Broadcast</h3>
            </div>

            <p className="text-xs text-[var(--ink-3)]">
              Publish live signals into the bus to trigger interactive widget state handlers and canvas listeners.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase text-[var(--ink-3)]">Preset Payloads</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_BROADCASTS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setBroadcastTopic(p.topic);
                      setBroadcastPayload(JSON.stringify(p.payload, null, 2));
                    }}
                    className="text-left text-[11px] px-2.5 py-1.5 rounded border hover:bg-[var(--panel-2)] transition-colors truncate"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--ink)]">Topic</label>
              <TextInput
                value={broadcastTopic}
                onChange={e => setBroadcastTopic(e.target.value)}
                placeholder="e.g. system:alert"
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-[var(--ink)]">Payload (JSON)</label>
              <textarea
                rows={6}
                value={broadcastPayload}
                onChange={e => setBroadcastPayload(e.target.value)}
                placeholder="{ ... }"
                spellCheck={false}
                className="w-full text-xs font-mono p-2.5 rounded border resize-none focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink)" }}
              />
            </div>

            {broadcastErr && (
              <div className="p-2 rounded bg-[var(--danger-soft)] text-[var(--danger)] text-xs flex items-center gap-1.5">
                <ShieldAlert size={13} /> {broadcastErr}
              </div>
            )}

            {broadcastSuccess && (
              <div className="p-2 rounded bg-[var(--ok-soft)] text-[var(--ok)] text-xs flex items-center gap-1.5">
                <Check size={13} /> {broadcastSuccess}
              </div>
            )}

            <Button
              variant="primary"
              onClick={handleSend}
              disabled={isBroadcasting}
              className="w-full justify-center text-xs"
            >
              {isBroadcasting ? <Spinner size={13} /> : <Send size={13} />} Dispatch Signal
            </Button>
          </Card>
        </div>

        {/* Right Column: Live Stream */}
        <div className="lg:col-span-2 flex flex-col space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[var(--ink)]">Live Stream Log</h2>
              <Pill tone={isConnected ? "ok" : "warn"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Pill>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="subtle"
                onClick={() => setIsPaused(!isPaused)}
                className="text-xs"
              >
                {isPaused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEvents([])}
                className="text-xs text-[var(--ink-3)] hover:text-[var(--danger)]"
                title="Clear log"
              >
                <Trash2 size={13} /> Clear
              </Button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 rounded-lg border bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-1">
              {(["all", "notification", "state_update", "heartbeat"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-colors ${
                    filterType === t
                      ? "bg-[var(--accent)] text-[var(--accent-ink)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--panel)]"
                  }`}
                >
                  {t === "all" ? "All" : t === "state_update" ? "State" : t === "notification" ? "Notify" : "Beat"}
                </button>
              ))}
            </div>

            <div className="flex-1 min-w-[160px]">
              <TextInput
                value={filterTopic}
                onChange={e => setFilterTopic(e.target.value)}
                placeholder="Filter by topic / channel..."
                className="text-xs py-1"
              />
            </div>
          </div>

          {/* Events Log List */}
          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredEvents.length === 0 ? (
              <EmptyState
                icon={<Radio size={30} />}
                title={events.length === 0 ? "Listening for signals..." : "No matching signals"}
                hint={
                  events.length === 0
                    ? "Interactive widgets, emitter commands, and test broadcasts will appear here in real-time."
                    : "No events match the active filters."
                }
              />
            ) : (
              filteredEvents.map(evt => (
                <SignalCard key={evt.id} item={evt} />
              ))
            )}
            <div ref={listBottomRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalCard({ item }: { item: SignalEventItem }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const typeColor = {
    notification: "var(--accent)",
    state_update: "var(--ok)",
    heartbeat: "var(--ink-3)",
    error: "var(--danger)",
  }[item.type];

  const copyData = () => {
    navigator.clipboard.writeText(JSON.stringify(item.data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-3 border text-xs flex flex-col space-y-1.5 transition-colors hover:border-[var(--line-2)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0 shadow-sm"
            style={{ background: typeColor }}
            title={item.type}
          />
          <span className="font-mono font-bold truncate text-[var(--ink)]">
            {item.topic || item.type}
          </span>
          <span className="text-[10px] text-[var(--ink-3)] font-semibold uppercase px-1.5 py-0.5 rounded bg-[var(--panel-2)] border border-[var(--line)]">
            {item.type}
          </span>
          {item.senderId && (
            <span className="text-[10px] text-[var(--ink-3)] truncate hidden sm:inline">
              from: {item.senderId}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-[var(--ink-3)] tabular-nums font-mono">
            {new Date(item.timestamp).toLocaleTimeString()}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)]"
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="pt-2 border-t space-y-1.5 animate-fade-in" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-[var(--ink-3)]">Payload</span>
            <button
              onClick={copyData}
              className="text-[10px] flex items-center gap-1 text-[var(--accent)] hover:underline font-semibold"
            >
              {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
            </button>
          </div>
          <pre
            className="p-2 rounded text-[11px] font-mono overflow-x-auto max-h-40 border"
            style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink-2)" }}
          >
            {JSON.stringify(item.data, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}
