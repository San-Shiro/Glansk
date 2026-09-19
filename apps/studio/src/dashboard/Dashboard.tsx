import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid, Activity, LayoutTemplate, Boxes, Package, Cpu, Settings, ScrollText, Info,
  Menu, X, LogOut, type LucideIcon,
  Zap, Lock, Radio as Broadcast, Sun, Moon, ExternalLink, Plus
} from "lucide-react";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import CreateCanvasModal from "./CreateCanvasModal";
import OverviewTab from "./tabs/OverviewTab";
import CanvasesTab from "./tabs/CanvasesTab";
import WidgetsTab from "./tabs/WidgetsTab";
import ExtensionsTab from "./tabs/ExtensionsTab";
import EmittersTab from "./tabs/EmittersTab";
import SignalsTab from "./tabs/SignalsTab";
import VaultTab from "./tabs/VaultTab";
import DevicesTab from "./tabs/DevicesTab";
import SystemTab from "./tabs/SystemTab";
import AuditTab from "./tabs/AuditTab";
import AboutTab from "./tabs/AboutTab";

type TabId =
  | "overview"
  | "canvases"
  | "widgets"
  | "extensions"
  | "emitters"
  | "signals"
  | "devices"
  | "vault"
  | "system"
  | "audit"
  | "about";

interface TabDef {
  id: TabId;
  label: string;
  icon: LucideIcon;
  badge?: (ctx: { onlineEmitters: number }) => ReactNode;
}

const WORKSPACE_TABS: TabDef[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "canvases", label: "Canvases", icon: LayoutTemplate },
  { id: "widgets", label: "Widgets", icon: Boxes },
  { id: "extensions", label: "Extensions", icon: Package },
];

const REALTIME_TABS: TabDef[] = [
  {
    id: "emitters",
    label: "Live Apps",
    icon: Broadcast,
    badge: ({ onlineEmitters }) =>
      onlineEmitters > 0 ? (
        <span
          className="absolute -top-1 -right-1 text-[9px] font-mono font-bold px-1 rounded-full bg-[var(--coral)] text-white"
        >
          {onlineEmitters}
        </span>
      ) : null,
  },
  {
    id: "signals",
    label: "Event Signals",
    icon: Zap,
    badge: () => (
      <span className="absolute top-0 right-0 flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--coral)] opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--coral)]" />
      </span>
    ),
  },
];

const SYSTEM_TABS: TabDef[] = [
  { id: "devices", label: "Devices", icon: Cpu },
  { id: "vault", label: "Secret Vault", icon: Lock },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "system", label: "System Info", icon: Settings },
  { id: "about", label: "About", icon: Info },
];

const ALL_TABS = [...WORKSPACE_TABS, ...REALTIME_TABS, ...SYSTEM_TABS];

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const canvasesQ = useQuery({ queryKey: ["canvases"], queryFn: api.listCanvases });
  const emittersQ = useQuery({ queryKey: ["emitters"], queryFn: api.listEmitters, refetchInterval: 10000 });

  const canvasCount = canvasesQ.data?.length ?? 0;
  const onlineEmitters = (emittersQ.data ?? []).filter(e => e.status === "online").length;

  const openTab = (id: TabId) => { setActiveTab(id); setSidebarOpen(false); };
  const logout = async () => { await api.logout(); qc.invalidateQueries({ queryKey: ["auth"] }); };

  const currentTabDef = ALL_TABS.find(t => t.id === activeTab);

  const NavIconBtn = ({ tab }: { tab: TabDef }) => {
    const active = activeTab === tab.id;
    const Icon = tab.icon;
    const badgeEl = tab.badge?.({ onlineEmitters });
    return (
      <button
        onClick={() => openTab(tab.id)}
        title={tab.label}
        aria-label={tab.label}
        className={`relative w-11 h-11 rounded-2xl grid place-items-center transition-all duration-200 ${
          active
            ? "bg-[var(--nav-active)] text-[var(--nav-active-fg)] shadow-md shadow-black/20 font-bold scale-105"
            : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 hover:scale-105"
        }`}
      >
        <Icon size={19} />
        {badgeEl}
      </button>
    );
  };

  const IconRailContent = () => (
    <>
      {/* Top brand icon */}
      <div className="flex flex-col items-center">
        <div
          className="w-11 h-11 rounded-2xl grid place-items-center shadow-lg text-white mb-5 bg-gradient-to-br from-[var(--orange-primary)] to-[var(--orange-deep)] border border-white/15 transition-transform hover:scale-105"
          title="Glansk Control Plane"
        >
          <LayoutGrid size={20} />
        </div>

        {/* Primary workspace tabs */}
        <div className="flex flex-col items-center gap-2">
          {WORKSPACE_TABS.map(t => <NavIconBtn key={t.id} tab={t} />)}
        </div>

        {/* Divider */}
        <div className="w-7 h-px my-3" style={{ background: "var(--border-subtle)" }} />

        {/* Real-time and hardware tabs */}
        <div className="flex flex-col items-center gap-2">
          {REALTIME_TABS.map(t => <NavIconBtn key={t.id} tab={t} />)}
        </div>

        {/* Divider */}
        <div className="w-7 h-px my-3" style={{ background: "var(--border-subtle)" }} />

        {/* System tabs */}
        <div className="flex flex-col items-center gap-2">
          {SYSTEM_TABS.map(t => <NavIconBtn key={t.id} tab={t} />)}
        </div>
      </div>

      {/* Bottom actions: Theme and Sign out */}
      <div className="flex flex-col items-center gap-2 pt-3 border-t w-full" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light mode" : "Switch to Dark mode"}
          className="w-10 h-10 rounded-xl grid place-items-center text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-indigo-400" />}
        </button>
        <button
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="w-10 h-10 rounded-xl grid place-items-center text-[var(--ink-3)] hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <LogOut size={17} />
        </button>
      </div>
    </>
  );

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab onNewCanvas={() => setShowCreate(true)} onNavigateTab={(id) => openTab(id as TabId)} />;
      case "canvases": return <CanvasesTab onNewCanvas={() => setShowCreate(true)} />;
      case "widgets": return <WidgetsTab onNavigateToExtensions={() => openTab("extensions")} onNavigateToCanvases={() => openTab("canvases")} />;
      case "extensions": return <ExtensionsTab onNavigateToWidgets={() => openTab("widgets")} />;
      case "emitters": return <EmittersTab />;
      case "signals": return <SignalsTab />;
      case "vault": return <VaultTab />;
      case "devices": return <DevicesTab />;
      case "system": return <SystemTab />;
      case "audit": return <AuditTab />;
      case "about": return <AboutTab />;
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[var(--bg-outer)] p-2.5 md:p-3 gap-2.5 md:gap-3 overflow-hidden select-none">
      {/* Desktop ultra-slim 68px icon rail */}
      <aside
        className="hidden md:flex flex-col justify-between items-center w-[68px] h-full py-4 shrink-0 rounded-[24px] border z-30 overflow-y-auto"
        style={{ background: "var(--bg-rail)", borderColor: "var(--border-subtle)" }}
      >
        <IconRailContent />
      </aside>

      {/* Mobile drawer toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl border shadow-lg transition-colors"
        style={{ background: "var(--bg-rail)", borderColor: "var(--border-subtle)", color: "var(--ink)" }}
        aria-label="Open sidebar menu"
      >
        <Menu size={18} />
      </button>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside
            className="relative flex flex-col justify-between items-center w-20 h-full py-5 border-r z-10 animate-fade-in"
            style={{ background: "var(--bg-rail)", borderColor: "var(--border-subtle)" }}
          >
            <button onClick={() => setSidebarOpen(false)} className="absolute top-3 right-3 p-1 text-[var(--ink-3)]">
              <X size={16} />
            </button>
            <IconRailContent />
          </aside>
        </div>
      )}

      {/* Main Canvas with rounded container, integrated search & profile header */}
      <div
        className="flex-1 min-w-0 h-full rounded-[26px] md:rounded-[30px] border flex flex-col overflow-hidden shadow-2xl"
        style={{ background: "var(--bg-canvas)", borderColor: "var(--border-subtle)" }}
      >
        {/* Canvas Top Header */}
        <header
          className="px-6 py-4 flex items-center justify-between gap-4 border-b shrink-0"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {/* Active View Title & Status Badge */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
              {activeTab === "overview" ? "Studio Overview" : currentTabDef?.label}
            </h1>
            {activeTab === "canvases" && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border"
                style={{
                  background: "var(--badge-bg)",
                  borderColor: "var(--badge-border)",
                  color: "var(--badge-text)",
                }}
              >
                {canvasCount} {canvasCount === 1 ? "canvas" : "canvases"}
              </span>
            )}
            {activeTab === "emitters" && (
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border"
                style={{
                  background: "var(--badge-bg)",
                  borderColor: "var(--badge-border)",
                  color: "var(--badge-text)",
                }}
              >
                {onlineEmitters} online
              </span>
            )}
          </div>

          {/* Primary Top Header Action */}
          <div className="flex items-center gap-3">
            {(activeTab === "canvases" || activeTab === "overview") && (
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90 active:opacity-80"
                style={{
                  background: "var(--orange-primary)",
                  border: "1px solid transparent",
                  boxShadow: "none",
                }}
              >
                <Plus size={14} />
                <span>New Canvas</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Canvas Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 animate-fade-in">
          {renderTab()}
        </main>
      </div>

      {showCreate && (
        <CreateCanvasModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["canvases"] });
            navigate(`/canvas/${id}/edit/v2`);
          }}
        />
      )}
    </div>
  );
}
