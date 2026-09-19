import { useEffect, useMemo, useState } from "react";
import { Search, Radio } from "lucide-react";
import { CATALOG, CATEGORY_LABELS, CATEGORY_COLORS, type Category, type CatalogItem } from "@/lib/catalog";
import { TextInput } from "@/components/ui";

const ORDER: Category[] = ["data", "display", "control", "media"];

interface DiscoveredEmitter {
  manifest: {
    id: string;
    name: string;
    category?: string;
  };
  state?: Record<string, any>;
  lastSeen?: number;
}

export default function Palette({ onAdd }: { onAdd: (item: CatalogItem) => void }) {
  const [q, setQ] = useState("");
  const [activeEmitters, setActiveEmitters] = useState<DiscoveredEmitter[]>([]);
  const [customWidgets, setCustomWidgets] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let unmounted = false;
    const fetchEmitters = async () => {
      try {
        const res = await fetch("/api/v1/emitters");
        if (res.ok && !unmounted) {
          const list = await res.json();
          if (Array.isArray(list)) setActiveEmitters(list);
        }
      } catch {}
    };
    const fetchCustomWidgets = async () => {
      try {
        const res = await fetch("/api/v1/packages/widgets");
        if (res.ok && !unmounted) {
          const data = await res.json();
          if (data?.widgets && Array.isArray(data.widgets)) {
            const extra = data.widgets
              .filter((w: any) => !CATALOG.some(c => c.packageId === w.packageId && c.widgetId === w.widgetId))
              .map((w: any) => ({
                packageId: w.packageId,
                widgetId: w.widgetId,
                title: w.name || w.widgetId,
                category: "display" as Category,
                packaged: true,
                defaultGeometry: w.defaultGeometry
                  ? { width: (w.defaultGeometry.w || 3) * 80, height: (w.defaultGeometry.h || 3) * 80 }
                  : { width: 320, height: 240 },
                defaultConfig: {},
              }));
            setCustomWidgets(extra);
          }
        }
      } catch {}
    };

    fetchEmitters();
    fetchCustomWidgets();

    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/v1/emitters/events");
      es.addEventListener("emitter_update", () => {
        if (!unmounted) fetchEmitters();
      });
    } catch {}

    const interval = setInterval(() => {
      fetchEmitters();
      fetchCustomWidgets();
    }, 10000);

    return () => {
      unmounted = true;
      clearInterval(interval);
      try { es?.close(); } catch {}
    };
  }, []);

  const groups = useMemo(() => {
    const combined = [...CATALOG, ...customWidgets];
    const query = q.trim().toLowerCase();
    const items = query ? combined.filter(c => c.title.toLowerCase().includes(query) || c.widgetId.includes(query)) : combined;
    return ORDER.map(cat => ({ cat, items: items.filter(i => i.category === cat) })).filter(g => g.items.length);
  }, [q, customWidgets]);

  return (
    <div className="h-full w-full flex flex-col select-none text-[13px] overflow-hidden" style={{ background: "var(--panel)", color: "var(--ink)" }}>
      <div className="px-3.5 py-2.5 border-b shrink-0" style={{ borderColor: "var(--line)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--ink-3)" }}>Widget Catalog</div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
          <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="Search widgets..." style={{ paddingLeft: 28 }} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {activeEmitters.length > 0 && (
          <div className="pb-2 border-b" style={{ borderColor: "var(--line)" }}>
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <span className="inline-block rounded-full h-2 w-2 shrink-0 bg-emerald-500"></span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">Live Apps / Emitters</span>
            </div>
            <div className="space-y-1.5">
              {activeEmitters.map((em) => {
                const item: CatalogItem = {
                  packageId: "glansk.demo",
                  widgetId: "emitter-widget",
                  title: em.manifest.name || em.manifest.id,
                  category: "control",
                  packaged: false,
                  defaultGeometry: { width: 520, height: 260 },
                  defaultConfig: {
                    emitterId: em.manifest.id,
                    label: em.manifest.name || em.manifest.id,
                    category: em.manifest.category || "custom",
                    state: em.state || {},
                  },
                };
                return (
                  <button
                    key={`emitter-${em.manifest.id}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/glansk-widget", `glansk.demo/emitter-widget`);
                      e.dataTransfer.setData("text/glansk-dim", JSON.stringify(item.defaultGeometry));
                      e.dataTransfer.setData("text/glansk-title", item.title);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => onAdd(item)}
                    className="w-full text-left px-2 py-1.5 border transition-all hover:border-emerald-500 hover:bg-emerald-950/20 active:translate-y-px flex items-center justify-between"
                    style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--panel)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold truncate" style={{ color: "var(--ink)" }}>{em.manifest.name || em.manifest.id}</div>
                      <div className="text-[9px] uppercase tracking-wider text-emerald-500/80 font-mono mt-0.5">{em.manifest.category || "emitter"}</div>
                    </div>
                    <Radio size={12} className="text-emerald-400 shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {groups.map(({ cat, items }) => (
          <div key={cat}>
            <div className="flex items-center gap-1.5 px-1 mb-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[cat] }} />
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{CATEGORY_LABELS[cat]}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map(item => (
                <button
                  key={`${item.packageId}/${item.widgetId}`}
                  draggable
                  onDragStart={e => {
                    e.dataTransfer.setData("text/glansk-widget", `${item.packageId}/${item.widgetId}`);
                    e.dataTransfer.setData("text/glansk-dim", JSON.stringify(item.defaultGeometry));
                    e.dataTransfer.setData("text/glansk-title", item.title);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => onAdd(item)}
                  title={item.packaged ? "Packaged widget (sandboxed)" : "Built-in widget"}
                  className="text-left px-2 py-2 border transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] active:translate-y-px"
                  style={{ borderColor: "var(--line)", borderRadius: "var(--radius)", background: "var(--panel)" }}
                >
                  <div className="text-[12px] font-semibold leading-tight" style={{ color: "var(--ink)" }}>{item.title}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "var(--ink-3)" }}>{item.packaged ? "packaged" : "built-in"}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t text-[10px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
        Drag onto the canvas, or click to add.
      </div>
    </div>
  );
}
