import { useState, useEffect, useMemo } from "react";
import {
  Boxes, Package, Layers, Radio, Cpu, Plus, Upload, Download,
  Edit3, Trash2, Globe, Check, AlertTriangle, Search, RefreshCw,
  Copy, ExternalLink, ShieldCheck
} from "lucide-react";
import { api } from "@/lib/api";
import type { PackageRecord, PackageKind, CatalogItem, RepositoryFeed } from "@/lib/types";
import { Card, SectionHeader } from "../primitives";
import { Pill } from "@/components/ui";
import CreateExtensionModal from "../modals/CreateExtensionModal";
import ImportPackageModal from "../modals/ImportPackageModal";

interface ExtensionsTabProps {
  onNavigateToWidgets?: () => void;
}

export default function ExtensionsTab({ onNavigateToWidgets }: ExtensionsTabProps = {}) {
  const [subTab, setSubTab] = useState<"installed" | "catalog" | "repositories">("installed");
  const [installedPackages, setInstalledPackages] = useState<PackageRecord[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [repositories, setRepositories] = useState<RepositoryFeed[]>([]);

  const [kindFilter, setKindFilter] = useState<"all" | PackageKind>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState<PackageRecord | null>(null);

  // Add Repository Form
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [isAddingRepo, setIsAddingRepo] = useState(false);
  const [copiedFeedUrl, setCopiedFeedUrl] = useState(false);

  const refreshAll = async () => {
    setIsLoading(true);
    try {
      const [pkgs, catRes, repos] = await Promise.all([
        api.listPackages().catch(() => []),
        api.getCatalog().catch(() => ({ catalog: [] })),
        api.listRepositories().catch(() => []),
      ]);
      setInstalledPackages(pkgs);
      setCatalog(catRes.catalog || []);
      setRepositories(repos);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const handleUninstall = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to uninstall extension "${name}"?`)) return;
    try {
      await api.uninstallPackage(id);
      setActionMessage(`Uninstalled ${name}`);
      setTimeout(() => setActionMessage(null), 3000);
      refreshAll();
    } catch (err: any) {
      alert(`Failed to uninstall: ${err.message}`);
    }
  };

  const handleInstallCatalogItem = async (item: CatalogItem) => {
    setInstallingId(item.id);
    try {
      const downloadUrl = item.downloadUrl.startsWith("http")
        ? item.downloadUrl
        : `${window.location.origin}${item.downloadUrl}`;

      await api.importPackageUrl(downloadUrl, true);
      setActionMessage(`Successfully installed ${item.name}!`);
      setTimeout(() => setActionMessage(null), 3000);
      await refreshAll();
    } catch (err: any) {
      alert(`Failed to install ${item.name}: ${err.message}`);
    } finally {
      setInstallingId(null);
    }
  };

  const handleAddRepository = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoUrl.trim()) return;
    try {
      await api.addRepository(newRepoName.trim() || "Custom Repo", newRepoUrl.trim());
      setNewRepoName("");
      setNewRepoUrl("");
      setIsAddingRepo(false);
      refreshAll();
    } catch (err: any) {
      alert(`Failed to add repository: ${err.message}`);
    }
  };

  const handleDeleteRepository = async (id: string) => {
    if (!confirm("Remove this repository source?")) return;
    try {
      await api.deleteRepository(id);
      refreshAll();
    } catch (err: any) {
      alert(`Failed to delete repository: ${err.message}`);
    }
  };

  const copyLocalFeedUrl = () => {
    const url = api.getLocalRepositoryIndexUrl();
    navigator.clipboard.writeText(url);
    setCopiedFeedUrl(true);
    setTimeout(() => setCopiedFeedUrl(false), 2000);
  };

  // Filtered lists
  const filteredInstalled = useMemo(() => {
    return installedPackages.filter((p) => {
      const matchKind = kindFilter === "all" || p.kind === kindFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchKind && matchQuery;
    });
  }, [installedPackages, kindFilter, searchQuery]);

  const filteredCatalog = useMemo(() => {
    const installedIds = new Set(installedPackages.map((p) => p.id));
    return catalog.filter((item) => {
      const matchKind = kindFilter === "all" || item.kind === kindFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
      return matchKind && matchQuery;
    });
  }, [catalog, installedPackages, kindFilter, searchQuery]);

  const installedIdsSet = useMemo(() => new Set(installedPackages.map((p) => p.id)), [installedPackages]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--ink)]">Extensions & Marketplace</h2>
          <p className="text-xs text-[var(--ink-3)] mt-0.5">
            Modular platform extensions — sandboxed UI widgets, background telemetry daemons, and hardware bridges
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {onNavigateToWidgets && (
            <button
              type="button"
              onClick={onNavigateToWidgets}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
            >
              <Boxes size={14} />
              Widget Catalog
            </button>
          )}
          <button
            type="button"
            onClick={() => { setPackageToEdit(null); setIsCreateOpen(true); }}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg text-white bg-[var(--accent)] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus size={15} />
            Create Extension
          </button>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
          >
            <Upload size={14} />
            Import Package
          </button>
          <button
            type="button"
            onClick={refreshAll}
            className="p-1.5 rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
            title="Refresh All"
          >
            <RefreshCw size={15} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Check size={16} />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Sub-Navigation Bar */}
      <div className="flex items-center justify-between border-b border-[var(--edge)]">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => { setSubTab("installed"); setSearchQuery(""); }}
            className={`pb-3 text-xs font-medium border-b-2 transition-all ${
              subTab === "installed"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]"
            }`}
          >
            Installed Extensions ({installedPackages.length})
          </button>

          <button
            type="button"
            onClick={() => { setSubTab("catalog"); setSearchQuery(""); }}
            className={`pb-3 text-xs font-medium border-b-2 transition-all ${
              subTab === "catalog"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]"
            }`}
          >
            Extension Store / Catalog ({catalog.length})
          </button>

          <button
            type="button"
            onClick={() => setSubTab("repositories")}
            className={`pb-3 text-xs font-medium border-b-2 transition-all ${
              subTab === "repositories"
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--ink-3)] hover:text-[var(--ink)]"
            }`}
          >
            Repository Feeds & Local Hub ({repositories.length})
          </button>
        </div>

        {/* Filter controls (for Installed and Catalog) */}
        {subTab !== "repositories" && (
          <div className="flex items-center gap-3 pb-2">
            <div className="flex p-0.5 rounded-lg bg-[var(--panel-2)] border border-[var(--edge)]">
              {(["all", "widget", "emitter", "composite"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilter(k)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                    kindFilter === k
                      ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm"
                      : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {k === "all" ? "All" : k.charAt(0).toUpperCase() + k.slice(1) + "s"}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
              <input
                type="text"
                placeholder="Search extensions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 pl-8 pr-2.5 py-1 text-xs rounded-lg border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tab 1: Installed Extensions */}
      {subTab === "installed" && (
        <div className="space-y-4">
          {filteredInstalled.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-[var(--edge)] bg-[var(--panel-2)]/30">
              <span className="p-3 rounded-full bg-[var(--panel-2)] text-[var(--ink-3)] mb-3">
                <Package size={28} />
              </span>
              <h4 className="text-sm font-semibold text-[var(--ink)]">No extensions installed</h4>
              <p className="text-xs text-[var(--ink-3)] max-w-sm mt-1">
                Install extensions from the Store tab, upload a package archive, or author a custom extension using the in-admin scaffolder.
              </p>
              <div className="flex gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => setSubTab("catalog")}
                  className="px-4 py-2 text-xs font-medium rounded-lg text-white bg-[var(--accent)]"
                >
                  Browse Store
                </button>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)]"
                >
                  Import ZIP Archive
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstalled.map((pkg) => {
                const isWidget = pkg.kind === "widget" || pkg.kind === "composite";
                const isEmitter = pkg.kind === "emitter" || pkg.kind === "composite";

                return (
                  <Card key={pkg.id} className="p-4 flex flex-col justify-between hover:border-[var(--accent)]/40 transition-colors">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2.5 rounded-lg bg-[var(--panel-2)] text-[var(--accent)]">
                            {pkg.kind === "widget" ? <Layers size={18} /> : pkg.kind === "emitter" ? <Radio size={18} /> : <Cpu size={18} />}
                          </span>
                          <div>
                            <h4 className="text-sm font-semibold text-[var(--ink)] leading-snug">{pkg.name}</h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[11px] font-mono text-[var(--ink-3)]">{pkg.id}</span>
                              <span className="text-[10px] text-[var(--ink-3)]">· v{pkg.version}</span>
                            </div>
                          </div>
                        </div>

                        <Pill tone={pkg.kind === "composite" ? "accent" : pkg.kind === "emitter" ? "ok" : "neutral"}>
                          {pkg.kind}
                        </Pill>
                      </div>

                      <p className="text-xs text-[var(--ink-2)] mt-3 line-clamp-2">
                        {pkg.description || "No description provided."}
                      </p>

                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {pkg.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--panel-2)] text-[var(--ink-3)] border border-[var(--edge)]"
                          >
                            {cap}
                          </span>
                        ))}
                        {pkg.trusted && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck size={11} /> verified
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--edge)]">
                      <span className="text-[11px] text-[var(--ink-3)]">by {pkg.author}</span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setPackageToEdit(pkg); setIsCreateOpen(true); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-[var(--edge)] bg-[var(--panel-2)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--accent)] transition-all"
                          title="Edit code in browser"
                        >
                          <Edit3 size={12} />
                          Edit Code
                        </button>

                        <a
                          href={api.getPackageExportUrl(pkg.id)}
                          download={`${pkg.id}.glpkg`}
                          className="p-1.5 rounded-md border border-[var(--edge)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
                          title="Export package (.glpkg)"
                        >
                          <Download size={13} />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleUninstall(pkg.id, pkg.name)}
                          className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Uninstall"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sub-Tab 2: Extension Store / Catalog */}
      {subTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[var(--panel-2)]/40">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)]">
                <Globe size={18} />
              </span>
              <div>
                <h4 className="text-sm font-semibold text-[var(--ink)]">Curated Extension Marketplace</h4>
                <p className="text-xs text-[var(--ink-3)]">
                  Discover community extensions and official bundles aggregated across your subscribed repository feeds
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={refreshAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-2)]"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin" : ""} />
              Sync Feeds
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalog.map((item) => {
              const isInstalled = installedIdsSet.has(item.id);
              const isInstalling = installingId === item.id;

              return (
                <Card key={item.id} className="p-4 flex flex-col justify-between hover:border-[var(--accent)]/40 transition-colors">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2.5 rounded-lg bg-[var(--panel-2)] text-[var(--accent)]">
                          {item.kind === "widget" ? <Layers size={18} /> : item.kind === "emitter" ? <Radio size={18} /> : <Cpu size={18} />}
                        </span>
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--ink)] leading-snug">{item.name}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-[var(--ink-3)]">{item.id}</span>
                            <span className="text-[10px] text-[var(--ink-3)]">· v{item.version}</span>
                          </div>
                        </div>
                      </div>

                      <Pill tone={item.kind === "composite" ? "accent" : item.kind === "emitter" ? "ok" : "neutral"}>
                        {item.kind}
                      </Pill>
                    </div>

                    <p className="text-xs text-[var(--ink-2)] mt-3 line-clamp-2">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {item.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-[var(--panel-2)] text-[var(--ink-3)] border border-[var(--edge)]"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--edge)]">
                    <span className="text-[11px] text-[var(--ink-3)] truncate max-w-[120px]">
                      {item.repositoryName}
                    </span>

                    {isInstalled ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-400">
                        <Check size={14} /> Installed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallCatalogItem(item)}
                        disabled={isInstalling}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg text-white bg-[var(--accent)] hover:opacity-90 transition-all border border-transparent disabled:bg-[var(--btn-disabled-bg)] disabled:border-[var(--btn-disabled-border)] disabled:text-[var(--btn-disabled-text)] disabled:cursor-not-allowed disabled:opacity-100"
                      >
                        {isInstalling && <RefreshCw size={12} className="animate-spin" />}
                        {isInstalling ? "Installing..." : "Install"}
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Repository Sources & Local Hub */}
      {subTab === "repositories" && (
        <div className="space-y-6">
          {/* Local Repository Hub Card */}
          <div className="p-6 rounded-xl border border-[var(--edge)] bg-gradient-to-br from-[var(--panel)] to-[var(--panel-2)]/40 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Globe size={22} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[var(--ink)]">Local Node Repository Hub</h3>
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active & Serving
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5">
                    This Glansk device hosts its own repository feed so other screens and kiosks on your LAN can install packages from here.
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-bold text-[var(--ink)]">{installedPackages.length}</div>
                <div className="text-[11px] text-[var(--ink-3)]">Packages Hosted</div>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--panel-2)] border border-[var(--edge)]">
              <span className="text-[11px] font-mono text-[var(--ink-2)] truncate flex-1 select-all">
                {api.getLocalRepositoryIndexUrl()}
              </span>
              <button
                type="button"
                onClick={copyLocalFeedUrl}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md bg-[var(--panel)] text-[var(--ink)] border border-[var(--edge)] hover:bg-[var(--panel-2)] transition-colors shrink-0"
              >
                {copiedFeedUrl ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copiedFeedUrl ? "Copied" : "Copy URL"}
              </button>
            </div>
          </div>

          {/* Subscribed Repository Feeds Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink)]">Subscribed Repository Feeds</h3>
                <p className="text-xs text-[var(--ink-3)]">External sources providing extensions to the Store</p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingRepo(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)] hover:bg-[var(--panel-2)] transition-colors"
              >
                <Plus size={14} />
                Add Repository Source
              </button>
            </div>

            {isAddingRepo && (
              <form onSubmit={handleAddRepository} className="p-4 rounded-xl border border-[var(--accent)]/40 bg-[var(--panel-2)]/60 space-y-3">
                <h4 className="text-xs font-semibold text-[var(--ink)]">Add External Repository Feed</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[var(--ink-3)] block mb-1">Feed Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Community Pi Extensions"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[var(--ink-3)] block mb-1">Repository Feed URL (index.json)</label>
                    <input
                      type="url"
                      required
                      placeholder="http://192.168.1.100:8080/api/v1/packages/repository/index.json"
                      value={newRepoUrl}
                      onChange={(e) => setNewRepoUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-[var(--edge)] bg-[var(--panel)] text-[var(--ink)]"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingRepo(false)}
                    className="px-3 py-1 text-xs rounded-lg text-[var(--ink-3)] hover:text-[var(--ink)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 text-xs font-medium rounded-lg bg-[var(--accent)] text-white"
                  >
                    Save Repository
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {repositories.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[var(--panel)] hover:border-[var(--accent)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-lg bg-[var(--panel-2)] text-[var(--ink-2)]">
                      <Globe size={16} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[var(--ink)]">{repo.name}</span>
                        {repo.id === "official" && (
                          <span className="px-1.5 py-0.2 text-[10px] rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                            Official
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[var(--ink-3)] block mt-0.5">{repo.url}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {repo.packageCount && (
                      <span className="text-[11px] text-[var(--ink-3)]">
                        {repo.packageCount} packages
                      </span>
                    )}

                    {repo.id !== "official" && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRepository(repo.id)}
                        className="p-1 rounded text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove repository"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateExtensionModal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setPackageToEdit(null); }}
        packageToEdit={packageToEdit}
        onSuccess={() => {
          refreshAll();
          setActionMessage(packageToEdit ? "Extension updated!" : "Extension created and live!");
          setTimeout(() => setActionMessage(null), 3000);
        }}
      />

      <ImportPackageModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={(pkg) => {
          refreshAll();
          setActionMessage(`Extension "${pkg.name}" imported and installed!`);
          setTimeout(() => setActionMessage(null), 3000);
        }}
      />
    </div>
  );
}
