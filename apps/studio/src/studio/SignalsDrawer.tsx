import { useState, useEffect } from "react";
import { X, Send, Radio, Trash2, Check, Copy, Zap, Terminal } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Pill, TextInput } from "@/components/ui";

interface SignalsDrawerProps {
  open: boolean;
  onClose: () => void;
  inline?: boolean;
}

interface MiniSignal {
  id: string;
  type: string;
  topic?: string;
  timestamp: number;
  data: any;
}

export default function SignalsDrawer({ open, onClose, inline }: SignalsDrawerProps) {
  const [events, setEvents] = useState<MiniSignal[]>([]);
  const [topic, setTopic] = useState("system:alert");
  const [payload, setPayload] = useState(JSON.stringify({ text: "Ping from Studio" }, null, 2));
  const [sending, setSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    let es: EventSource | null = null;
    let unmounted = false;

    try {
      es = new EventSource("/api/v1/interactive-state/events");
      es.addEventListener("notification", (evt) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(evt.data);
          setEvents(prev => [
            {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              type: "notify",
              topic: data.topic,
              timestamp: data.timestamp || Date.now(),
              data: data.payload,
            },
            ...prev.slice(0, 49),
          ]);
        } catch {}
      });

      es.addEventListener("state_update", (evt) => {
        if (unmounted) return;
        try {
          const data = JSON.parse(evt.data);
          setEvents(prev => [
            {
              id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              type: "state",
              topic: `${data.mode}:${data.key}`,
              timestamp: data.updatedAt || Date.now(),
              data: data.state,
            },
            ...prev.slice(0, 49),
          ]);
        } catch {}
      });
    } catch {}

    return () => {
      unmounted = true;
      try { es?.close(); } catch {}
    };
  }, [open]);

  if (!open) return null;

  const handleSend = async () => {
    setStatusMsg("");
    let parsed: any;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setStatusMsg("Invalid JSON");
      return;
    }

    setSending(true);
    try {
      const res = await api.sendNotification(topic.trim(), parsed);
      if (res.ok) {
        setStatusMsg("Dispatched ✓");
        setTimeout(() => setStatusMsg(""), 2500);
      } else {
        setStatusMsg("Failed");
      }
    } catch {
      setStatusMsg("Error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={inline ? "h-full w-full flex flex-col overflow-hidden select-none text-[13px] bg-[var(--panel)]" : "fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l shadow-2xl animate-fade-in"}
      style={{ background: "var(--panel)", borderColor: "var(--line)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3.5 py-2.5 shrink-0" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-[var(--accent)]" />
          <h3 className="text-xs font-bold text-[var(--ink)]">Realtime Event Bus</h3>
        </div>
        {!inline && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--panel-2)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Broadcast mini-form */}
      <div className="p-3 border-b space-y-2 shrink-0" style={{ borderColor: "var(--line)" }}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Quick Dispatch</span>
        <TextInput
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="Topic (e.g. media:control)"
          className="text-xs py-1"
        />
        <textarea
          rows={3}
          value={payload}
          onChange={e => setPayload(e.target.value)}
          placeholder="{ ... }"
          spellCheck={false}
          className="w-full text-xs font-mono p-2 rounded border resize-none focus:outline-none"
          style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink)" }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-[var(--ok)]">{statusMsg}</span>
          <Button variant="primary" onClick={handleSend} disabled={sending} className="text-xs py-1 px-2.5">
            <Send size={11} /> Send
          </Button>
        </div>
      </div>

      {/* Live Stream List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--ink-3)]">Live Events</span>
          <button
            onClick={() => setEvents([])}
            className="text-[10px] text-[var(--ink-3)] hover:text-[var(--danger)] flex items-center gap-1"
          >
            <Trash2 size={10} /> Clear
          </button>
        </div>

        {events.length === 0 ? (
          <div className="py-12 text-center text-[11px] text-[var(--ink-3)]">
            Listening for widget notifications & state updates...
          </div>
        ) : (
          events.map(e => (
            <div
              key={e.id}
              className="p-2 rounded border text-xs space-y-1"
              style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[11px] text-[var(--ink)] truncate">{e.topic || e.type}</span>
                <span className="text-[9px] text-[var(--ink-3)] font-mono">{new Date(e.timestamp).toLocaleTimeString()}</span>
              </div>
              <pre className="text-[10px] font-mono text-[var(--ink-2)] overflow-x-auto max-h-20">
                {JSON.stringify(e.data, null, 2)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
