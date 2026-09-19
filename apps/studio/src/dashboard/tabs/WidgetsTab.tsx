import { useState, useEffect, useMemo } from "react";
import {
  Boxes, Package, Layers, Plus, Search, RefreshCw,
  ShieldCheck, Cpu, Radio, Sparkles, ExternalLink, Info, X,
  ArrowUpRight
} from "lucide-react";
import { CATALOG, CATEGORY_LABELS, CATEGORY_COLORS, type Category, type CatalogItem } from "@/lib/catalog";
import { Pill, Button } from "@/components/ui";
import { Card, SectionHeader } from "../primitives";
import CreateExtensionModal from "../modals/CreateExtensionModal";

const ORDER: Category[] = ["data", "display", "control", "media"];

interface WidgetsTabProps {
  onNavigateToExtensions?: () => void;
  onNavigateToCanvases?: () => void;
}

export default function WidgetsTab({ onNavigateToExtensions, onNavigateToCanvases }: WidgetsTabProps) {
  const [customWidgets, setCustomWidgets] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"all" | Category | "packaged">("all");
  const [selectedWidget, setSelectedWidget] = useState<CatalogItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchWidgets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/packages/widgets");
      if (res.ok) {
        const data = await res.json();
        if (data?.widgets && Array.isArray(data.widgets)) {
          const extra: CatalogItem[] = data.widgets
            .filter((w: any) => !CATALOG.some((c) => c.packageId === w.packageId && c.widgetId === w.widgetId))
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
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWidgets();
  }, []);

  const allWidgets = useMemo(() => {
    return [...CATALOG, ...customWidgets];
  }, [customWidgets]);

  const filteredWidgets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allWidgets.filter((w) => {
      const matchCategory =
        selectedCategory === "all"
          ? true
          : selectedCategory === "packaged"
          ? w.packaged
          : w.category === selectedCategory;

      const matchSearch =
        !q ||
        w.title.toLowerCase().includes(q) ||
        w.widgetId.toLowerCase().includes(q) ||
        w.packageId.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [allWidgets, selectedCategory, searchQuery]);

  const packagedCount = allWidgets.filter((w) => w.packaged).length;
  const builtInCount = allWidgets.length - packagedCount;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>Widgets</h2>
            <Pill tone="accent">{allWidgets.length} Items</Pill>
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
            Palette catalog for canvas layouts · {builtInCount} native core · {packagedCount} sandboxed extensions
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white transition-opacity hover:opacity-90 shadow-sm"
            style={{ background: "var(--accent)" }}
          >
            <Plus size={14} />
            Create Widget
          </button>
          {onNavigateToExtensions && (
            <button
              type="button"
              onClick={onNavigateToExtensions}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-[var(--panel-2)]"
              style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink)" }}
            >
              <Package size={14} />
              Extensions Store
            </button>
          )}
          <button
            type="button"
            onClick={fetchWidgets}
            className="p-1.5 rounded-lg border transition-colors hover:bg-[var(--panel-2)]"
            style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink-3)" }}
            title="Refresh Widgets"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b" style={{ borderColor: "var(--line)" }}>
        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setSelectedCategory("all")}
            className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0"
            style={{
              background: selectedCategory === "all" ? "var(--accent-soft)" : "transparent",
              color: selectedCategory === "all" ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            All ({allWidgets.length})
          </button>
          {ORDER.map((cat) => {
            const count = allWidgets.filter((w) => w.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0"
                style={{
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-3)",
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[cat] }} />
                <span>{CATEGORY_LABELS[cat]} ({count})</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelectedCategory("packaged")}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0"
            style={{
              background: selectedCategory === "packaged" ? "var(--accent-soft)" : "transparent",
              color: selectedCategory === "packaged" ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>Packaged ({packagedCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--ink-3)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter widgets..."
            className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border focus:outline-none transition-colors"
            style={{
              background: "var(--panel)",
              borderColor: "var(--line)",
              color: "var(--ink)",
            }}
          />
        </div>
      </div>

      {/* Compact Pill Grid */}
      {filteredWidgets.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl" style={{ borderColor: "var(--line)" }}>
          <Boxes size={32} className="mx-auto mb-2 opacity-40" style={{ color: "var(--ink-3)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>No widgets match your filter</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-3)" }}>Try adjusting your search query or category filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {filteredWidgets.map((item) => {
            const catColor = CATEGORY_COLORS[item.category] || "var(--accent)";
            return (
              <div
                key={`${item.packageId}/${item.widgetId}`}
                onClick={() => setSelectedWidget(item)}
                className="px-3 py-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:border-[var(--accent)] hover:shadow-sm group"
                style={{
                  background: "var(--panel)",
                  borderColor: "var(--line)",
                }}
              >
                {/* Left: Category Icon Pill + Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg grid place-items-center shrink-0 border"
                    style={{
                      background: "var(--panel-2)",
                      borderColor: "var(--line)",
                      color: catColor,
                    }}
                  >
                    {item.packaged ? <Package size={15} /> : <Boxes size={15} />}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate group-hover:text-[var(--accent)] transition-colors" style={{ color: "var(--ink)" }}>
                      {item.title}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px]" style={{ color: "var(--ink-3)" }}>
                      <span className="font-mono truncate max-w-[110px]">{item.widgetId}</span>
                      <span>•</span>
                      <span className="capitalize" style={{ color: catColor }}>{item.category}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Sizing & Security Pills */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono border"
                    style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink-2)" }}
                  >
                    {item.defaultGeometry.width}×{item.defaultGeometry.height}
                  </span>

                  {item.packaged ? (
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold border text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    >
                      <ShieldCheck size={10} />
                      pkg
                    </span>
                  ) : (
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-semibold border"
                      style={{ background: "var(--panel-2)", borderColor: "var(--line)", color: "var(--ink-3)" }}
                    >
                      core
                    </span>
                  )}

                  <ArrowUpRight size={13} className="text-[var(--ink-3)] group-hover:text-[var(--accent)] transition-colors opacity-0 group-hover:opacity-100" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Widget Details Modal */}
      {selectedWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedWidget(null)} />
          <div
            className="relative w-full max-w-md border rounded-xl shadow-2xl p-5 space-y-4 animate-fade-in z-10"
            style={{ background: "var(--panel)", borderColor: "var(--line)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
                  style={{ background: "var(--panel-2)", color: CATEGORY_COLORS[selectedWidget.category] || "var(--accent)" }}
                >
                  {selectedWidget.packaged ? <Package size={18} /> : <Boxes size={18} />}
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>{selectedWidget.title}</h3>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {selectedWidget.packageId}/{selectedWidget.widgetId}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWidget(null)}
                className="p-1 rounded-lg hover:bg-[var(--panel-2)] transition-colors"
                style={{ color: "var(--ink-3)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg border" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
                <div>
                  <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink-3)" }}>Category</span>
                  <p className="font-medium capitalize mt-0.5" style={{ color: "var(--ink)" }}>{selectedWidget.category}</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase" style={{ color: "var(--ink-3)" }}>Default Size</span>
                  <p className="font-mono mt-0.5" style={{ color: "var(--ink)" }}>
                    {selectedWidget.defaultGeometry.width}px × {selectedWidget.defaultGeometry.height}px
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border space-y-1" style={{ background: "var(--panel-2)", borderColor: "var(--line)" }}>
                <div className="flex items-center gap-1.5 font-semibold" style={{ color: "var(--ink)" }}>
                  {selectedWidget.packaged ? (
                    <>
                      <ShieldCheck size={13} className="text-emerald-400" />
                      <span>Security: Hardened Null-Origin Sandboxed Iframe</span>
                    </>
                  ) : (
                    <>
                      <Boxes size={13} className="text-[var(--accent)]" />
                      <span>Runtime: Native Core Component</span>
                    </>
                  )}
                </div>
                <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                  {selectedWidget.packaged
                    ? "Runs inside an opaque null-origin iframe (sandbox='allow-scripts') with CSP connect-src 'none'."
                    : "High-performance component rendered directly by Glansk engine."}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--line)" }}>
              <span className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                Ready to place in Studio
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setSelectedWidget(null)}>
                  Close
                </Button>
                {onNavigateToCanvases && (
                  <Button variant="primary" onClick={() => { setSelectedWidget(null); onNavigateToCanvases(); }}>
                    Open Canvases
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Extension Modal */}
      <CreateExtensionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => {
          setIsCreateOpen(false);
          fetchWidgets();
        }}
      />
    </div>
  );
}
