import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { api, ApiError, CANVAS_LIMITS } from "@/lib/api";
import type { CanvasDocument, CanvasGroup, JsonValue, WidgetGeometry, WidgetVisibilityConfig, CanvasVariableDefinition } from "@/lib/types";
import { CATALOG, instantiate, type CatalogItem } from "@/lib/catalog";
import { Button, Field, Modal, Select, TextInput, Spinner } from "@/components/ui";
import TopBarV1 from "./TopBarV1";
import LeftSidebarV1 from "./LeftSidebarV1";
import InspectorV1 from "./InspectorV1";
import CanvasViewportV1 from "./CanvasViewportV1";

const LAST_KEY = "glansk_last_canvas";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export interface StudioV1Props {
  /** Canvas to open on mount (from the /canvas/:id/edit/v1 route). */
  initialCanvasId?: string;
  /** Return to the dashboard shell. */
  onExit?: () => void;
  /** Keep the URL in sync when switching canvases inside the editor. */
  onNavigateCanvas?: (id: string) => void;
  /** Switch to another version of the editor ('v1' | 'v2'). */
  onSwitchVersion?: (version: "v1" | "v2") => void;
}

export default function StudioV1({ initialCanvasId, onExit, onNavigateCanvas, onSwitchVersion }: StudioV1Props = {}) {
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(initialCanvasId ?? null);
  const [doc, setDoc] = useState<CanvasDocument | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.4);
  const [rev, setRev] = useState(0);
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const centerRef = useRef<HTMLDivElement>(null);

  const flash = useCallback((m: string) => { setStatus(m); window.setTimeout(() => setStatus(s => (s === m ? "" : s)), 3000); }, []);

  const canvasesQ = useQuery({ queryKey: ["canvases"], queryFn: api.listCanvases });
  const runtimeQ = useQuery({ queryKey: ["runtime"], queryFn: api.listRuntime, refetchInterval: 5000 });
  const workspaceQ = useQuery({ queryKey: ["canvas", currentId], queryFn: () => api.openCanvas(currentId!), enabled: !!currentId });

  // pick an initial canvas
  useEffect(() => {
    if (currentId) return;
    if (initialCanvasId) { setCurrentId(initialCanvasId); return; }
    if (!canvasesQ.data?.length) return;
    const last = localStorage.getItem(LAST_KEY);
    setCurrentId(canvasesQ.data.some(c => c.id === last) ? last! : canvasesQ.data[0].id);
  }, [canvasesQ.data, currentId, initialCanvasId]);

  const selectCanvas = useCallback((id: string) => { setCurrentId(id); onNavigateCanvas?.(id); }, [onNavigateCanvas]);

  const fitZoom = useCallback((d?: CanvasDocument | null) => {
    const el = centerRef.current, cd = d ?? doc;
    if (!el || !cd) return;
    setZoom(clamp(Math.min((el.clientWidth - 80) / cd.logicalSize.width, (el.clientHeight - 80) / cd.logicalSize.height), 0.1, 2));
  }, [doc]);

  // load workspace into editable state
  useEffect(() => {
    if (!workspaceQ.data) return;
    const d = structuredClone(workspaceQ.data.draft.document) as CanvasDocument;
    setDoc(d); setDraftRevision(workspaceQ.data.draft.draftRevision); setDirty(false); setSelectedId(null); setSelectedGroupId(null);
    localStorage.setItem(LAST_KEY, d.id);
    requestAnimationFrame(() => fitZoom(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceQ.data]);

  useEffect(() => {
    const onResize = () => fitZoom();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitZoom]);

  // ---- local document mutations ----
  const edit = useCallback((fn: (d: CanvasDocument) => void) => {
    setDoc(prev => { if (!prev) return prev; const next = structuredClone(prev); fn(next); return next; });
    setDirty(true); setRev(r => r + 1);
  }, []);
  const nextZ = (d: CanvasDocument) => (d.widgets.reduce((m, w) => Math.max(m, w.geometry.zIndex), 0) + 1);

  const addWidget = useCallback((item: CatalogItem, x?: number, y?: number) => {
    edit(d => {
      const px = x ?? Math.round(d.logicalSize.width / 2 - item.defaultGeometry.width / 2);
      const py = y ?? Math.round(d.logicalSize.height / 2 - item.defaultGeometry.height / 2);
      const w = instantiate(item, clamp(px, 0, d.logicalSize.width - item.defaultGeometry.width), clamp(py, 0, d.logicalSize.height - item.defaultGeometry.height), nextZ(d));
      d.widgets.push(w);
      setSelectedId(w.id);
    });
  }, [edit]);

  const onDropWidget = useCallback((payload: string, x: number, y: number) => {
    const [packageId, widgetId] = payload.split("/");
    const item = CATALOG.find(c => c.packageId === packageId && c.widgetId === widgetId);
    if (item) addWidget(item, Math.round(x - item.defaultGeometry.width / 2), Math.round(y - item.defaultGeometry.height / 2));
  }, [addWidget]);

  const commitGeometry = useCallback((id: string, g: WidgetGeometry) => edit(d => { const w = d.widgets.find(w => w.id === id); if (w) w.geometry = g; }), [edit]);
  const commitGroupGeometry = useCallback((id: string, g: CanvasGroup["geometry"]) => edit(d => { 
    d.groups = d.groups || [];
    const grp = d.groups.find(g => g.id === id); 
    if (grp) grp.geometry = g; 
  }), [edit]);

  const updateConfig = useCallback((id: string, config: Record<string, JsonValue>) => edit(d => { const w = d.widgets.find(w => w.id === id); if (w) w.config = config; }), [edit]);
  const deleteWidget = useCallback((id: string) => { 
    edit(d => { 
      d.widgets = d.widgets.filter(w => w.id !== id); 
      d.groups = d.groups?.filter(g => g.id !== id);
    }); 
    setSelectedId(s => (s === id ? null : s)); 
    setSelectedGroupId(s => (s === id ? null : s));
  }, [edit]);

  const duplicateWidget = useCallback((id: string) => edit(d => {
    const w = d.widgets.find(w => w.id === id); if (!w) return;
    const copy = structuredClone(w); copy.id = `${w.widgetId}-${Date.now().toString(36)}`.slice(0, 40);
    copy.geometry = { ...w.geometry, x: w.geometry.x + 24, y: w.geometry.y + 24, zIndex: nextZ(d) };
    d.widgets.push(copy); setSelectedId(copy.id); setSelectedGroupId(null);
  }), [edit]);

  const reorder = useCallback((id: string, dir: "front" | "back") => edit(d => {
    d.groups = d.groups || [];
    const w = d.widgets.find(x => x.id === id);
    const grp = d.groups.find(x => x.id === id);
    const target = w || grp;
    if (!target) return;
    const zs = [...d.widgets.map(x => x.geometry.zIndex), ...d.groups.map(x => x.geometry.zIndex)];
    target.geometry.zIndex = dir === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
  }), [edit]);

  const groupSelected = useCallback(() => {
    if (!selectedId) return;
    edit(d => {
      d.groups = d.groups || [];
      const w = d.widgets.find(x => x.id === selectedId);
      if (!w || w.groupId) return;
      const grpId = `group-${Date.now().toString(36)}`;
      const newGroup: CanvasGroup = {
        id: grpId,
        name: `Group ${d.groups.length + 1}`,
        geometry: {
          x: w.geometry.x,
          y: w.geometry.y,
          width: Math.max(120, w.geometry.width),
          height: Math.max(80, w.geometry.height),
          zIndex: nextZ(d),
        },
      };
      w.groupId = grpId;
      w.geometry.x = 0;
      w.geometry.y = 0;
      d.groups.push(newGroup);
      setSelectedGroupId(grpId);
      setSelectedId(null);
    });
  }, [selectedId, edit]);

  const ungroup = useCallback((groupId: string) => {
    edit(d => {
      d.groups = d.groups || [];
      const grp = d.groups.find(g => g.id === groupId);
      if (!grp) return;
      d.widgets.forEach(w => {
        if (w.groupId === groupId) {
          w.groupId = undefined;
          w.geometry.x += grp.geometry.x;
          w.geometry.y += grp.geometry.y;
        }
      });
      d.groups = d.groups.filter(g => g.id !== groupId);
      setSelectedGroupId(null);
    });
  }, [edit]);

  const toggleWidgetVisibility = useCallback((id: string) => edit(d => {
    const w = d.widgets.find(x => x.id === id);
    if (w) {
      const vis = (w.config?.visibility as unknown as WidgetVisibilityConfig) || { defaultVisible: true };
      w.config = { ...w.config, visibility: { ...vis, defaultVisible: !vis.defaultVisible } as unknown as JsonValue };
    }
  }), [edit]);

  const toggleWidgetDisabled = useCallback((id: string) => edit(d => {
    const w = d.widgets.find(x => x.id === id);
    if (w) w.disabled = !w.disabled;
  }), [edit]);

  const toggleGroupVisibility = useCallback((id: string) => edit(d => {
    d.groups = d.groups || [];
    const g = d.groups.find(x => x.id === id);
    if (g) g.collapsed = !g.collapsed;
  }), [edit]);

  const toggleGroupDisabled = useCallback((id: string) => edit(d => {
    d.groups = d.groups || [];
    const g = d.groups.find(x => x.id === id);
    if (g) {
      // toggle disabled for all widgets in group
      const widgetsInGroup = d.widgets.filter(w => w.groupId === id);
      const anyEnabled = widgetsInGroup.some(w => !w.disabled);
      widgetsInGroup.forEach(w => { w.disabled = anyEnabled; });
    }
  }), [edit]);

  const toggleGroupCollapse = useCallback((id: string) => edit(d => {
    d.groups = d.groups || [];
    const g = d.groups.find(x => x.id === id);
    if (g) g.collapsed = !g.collapsed;
  }), [edit]);

  const reorderItem = useCallback((draggedId: string, targetId: string, position: "before" | "after" | "inside") => edit(d => {
    d.groups = d.groups || [];
    const isDraggedWidget = d.widgets.some(w => w.id === draggedId);
    const isDraggedGroup = d.groups.some(g => g.id === draggedId);

    if (isDraggedWidget) {
      const w = d.widgets.find(x => x.id === draggedId)!;
      if (position === "inside") {
        const targetGrp = d.groups.find(g => g.id === targetId);
        if (targetGrp && w.groupId !== targetId) {
          const currentAbsX = w.groupId ? (d.groups.find(g => g.id === w.groupId)?.geometry.x || 0) + w.geometry.x : w.geometry.x;
          const currentAbsY = w.groupId ? (d.groups.find(g => g.id === w.groupId)?.geometry.y || 0) + w.geometry.y : w.geometry.y;
          w.groupId = targetId;
          w.geometry.x = clamp(currentAbsX - targetGrp.geometry.x, 0, Math.max(0, targetGrp.geometry.width - w.geometry.width));
          w.geometry.y = clamp(currentAbsY - targetGrp.geometry.y, 0, Math.max(0, targetGrp.geometry.height - w.geometry.height));
        }
      } else {
        const targetW = d.widgets.find(x => x.id === targetId);
        if (targetW) {
          if (w.groupId !== targetW.groupId) {
            const fromGrp = w.groupId ? d.groups.find(g => g.id === w.groupId) : null;
            const toGrp = targetW.groupId ? d.groups.find(g => g.id === targetW.groupId) : null;
            const absX = fromGrp ? fromGrp.geometry.x + w.geometry.x : w.geometry.x;
            const absY = fromGrp ? fromGrp.geometry.y + w.geometry.y : w.geometry.y;
            w.groupId = targetW.groupId;
            w.geometry.x = toGrp ? clamp(absX - toGrp.geometry.x, 0, Math.max(0, toGrp.geometry.width - w.geometry.width)) : absX;
            w.geometry.y = toGrp ? clamp(absY - toGrp.geometry.y, 0, Math.max(0, toGrp.geometry.height - w.geometry.height)) : absY;
          }
          w.geometry.zIndex = position === "before" ? (targetW.geometry.zIndex || 0) + 1 : Math.max(0, (targetW.geometry.zIndex || 0) - 1);
        }
      }
    } else if (isDraggedGroup) {
      const grp = d.groups.find(g => g.id === draggedId)!;
      const targetGrp = d.groups.find(g => g.id === targetId);
      if (targetGrp) {
        grp.geometry.zIndex = position === "before" ? (targetGrp.geometry.zIndex || 0) + 1 : Math.max(0, (targetGrp.geometry.zIndex || 0) - 1);
      }
    }
  }), [edit]);

  const updateCanvas = useCallback((patch: Partial<CanvasDocument>) => edit(d => Object.assign(d, patch)), [edit]);
  const updateGroup = useCallback((id: string, patch: Partial<CanvasGroup>) => edit(d => {
    d.groups = d.groups || [];
    const g = d.groups.find(x => x.id === id);
    if (g) Object.assign(g, patch);
  }), [edit]);
  const updateWidgetVisibility = useCallback((id: string, visibility: WidgetVisibilityConfig) => edit(d => {
    const w = d.widgets.find(x => x.id === id);
    if (w) w.config = { ...w.config, visibility: visibility as unknown as JsonValue };
  }), [edit]);
  const updateVariables = useCallback((variables: Record<string, CanvasVariableDefinition>) => edit(d => {
    d.variables = variables;
  }), [edit]);

  // ---- server persistence mutations ----
  const saveMut = useMutation({
    mutationFn: async () => api.saveDraft(currentId!, doc!, draftRevision),
    onSuccess: (draft) => { setDraftRevision(draft.draftRevision); setDirty(false); flash("Saved draft"); qc.invalidateQueries({ queryKey: ["canvases"] }); },
    onError: (e: unknown) => flash(e instanceof ApiError && e.status === 409 ? "Conflict — reopen canvas" : `Save failed: ${(e as Error).message}`),
  });
  const publishMut = useMutation({
    mutationFn: async () => { if (dirty) { const dr = await api.saveDraft(currentId!, doc!, draftRevision); setDraftRevision(dr.draftRevision); setDirty(false); } return api.publish(currentId!); },
    onSuccess: (pub) => { flash(`Published revision ${pub.revision}`); qc.invalidateQueries({ queryKey: ["canvases"] }); },
    onError: (e: unknown) => flash(`Publish failed: ${(e as Error).message}`),
  });
  const goLiveMut = useMutation({
    mutationFn: async () => {
      if (dirty) { const dr = await api.saveDraft(currentId!, doc!, draftRevision); setDraftRevision(dr.draftRevision); setDirty(false); }
      const pub = await api.publish(currentId!);
      return api.activate(currentId!, { publicationRevision: pub.revision });
    },
    onSuccess: () => { flash("Dashboard is live"); qc.invalidateQueries({ queryKey: ["runtime"] }); qc.invalidateQueries({ queryKey: ["canvases"] }); },
    onError: (e: unknown) => flash(`Go live failed: ${(e as Error).message}`),
  });
  const deactivateMut = useMutation({
    mutationFn: async () => api.deactivate(currentId!),
    onSuccess: () => { flash("Display runtime taken offline (paused)"); qc.invalidateQueries({ queryKey: ["runtime"] }); },
    onError: (e: unknown) => flash(`Take offline failed: ${(e as Error).message}`),
  });
  const rollbackMut = useMutation({
    mutationFn: async () => api.rollback(currentId!),
    onSuccess: (rt) => { flash(`Rolled back display to rev ${rt.activeRevision}`); qc.invalidateQueries({ queryKey: ["runtime"] }); },
    onError: (e: unknown) => flash(`Rollback failed: ${(e as Error).message}`),
  });

  const discardDraft = useCallback(() => {
    if (!workspaceQ.data) return;
    const baseDoc = (workspaceQ.data.publication?.document ?? workspaceQ.data.draft.document) as CanvasDocument;
    setDoc(structuredClone(baseDoc));
    setDraftRevision(workspaceQ.data.draft.draftRevision);
    setDirty(false);
    flash("Draft changes discarded");
  }, [workspaceQ.data, flash]);

  const runtime = useMemo(() => runtimeQ.data?.find(r => r.canvasId === currentId), [runtimeQ.data, currentId]);
  const publishing = publishMut.isPending || goLiveMut.isPending || deactivateMut.isPending;

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showCreate) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentId && doc && !saveMut.isPending) {
          saveMut.mutate();
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          deleteWidget(selectedId);
        } else if (selectedGroupId) {
          e.preventDefault();
          deleteWidget(selectedGroupId);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          duplicateWidget(selectedId);
        }
      } else if (e.key === "Escape") {
        setSelectedId(null);
        setSelectedGroupId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showCreate, selectedId, selectedGroupId, saveMut, deleteWidget, duplicateWidget, currentId, doc]);

  const currentSummary = canvasesQ.data?.find(c => c.id === currentId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: "var(--bg)" }}>
      <TopBarV1
        canvases={canvasesQ.data ?? []}
        currentId={currentId}
        currentName={doc?.name ?? currentSummary?.name ?? ""}
        onBack={onExit}
        onSelectCanvas={selectCanvas}
        onNewCanvas={() => setShowCreate(true)}
        zoom={zoom}
        onZoom={setZoom}
        onZoomFit={() => fitZoom()}
        dirty={dirty}
        saving={saveMut.isPending}
        publishing={publishing}
        runtime={runtime}
        onSave={() => saveMut.mutate()}
        onPublish={() => publishMut.mutate()}
        onGoLive={() => goLiveMut.mutate()}
        onDeactivate={() => deactivateMut.mutate()}
        onRollback={() => rollbackMut.mutate()}
        onDiscardDraft={discardDraft}
        onLogout={() => { api.logout(); onExit?.(); }}
        status={status}
        interactiveMode={interactiveMode}
        onToggleInteractiveMode={() => setInteractiveMode(m => !m)}
        variables={doc?.variables}
        onUpdateVariables={updateVariables}
        onSwitchVersion={onSwitchVersion}
      />

      <div className="flex-1 flex overflow-hidden min-h-0">
        <LeftSidebarV1
          doc={doc}
          onAdd={addWidget}
          selectedId={selectedId}
          selectedGroupId={selectedGroupId}
          onSelectWidget={(id) => {
            setSelectedId(id);
            if (id) setSelectedGroupId(null);
          }}
          onSelectGroup={(id) => {
            setSelectedGroupId(id);
            if (id) setSelectedId(null);
          }}
          onToggleWidgetVisibility={toggleWidgetVisibility}
          onToggleWidgetDisabled={toggleWidgetDisabled}
          onToggleGroupVisibility={toggleGroupVisibility}
          onToggleGroupDisabled={toggleGroupDisabled}
          onToggleGroupCollapse={toggleGroupCollapse}
          onReorderItem={reorderItem}
          onCreateGroupFromSelected={groupSelected}
        />
        <div ref={centerRef} className="flex-1 min-w-0 relative">
          {doc ? (
            <CanvasViewportV1
              doc={doc}
              revision={rev}
              zoom={zoom}
              selectedId={selectedId}
              selectedGroupId={selectedGroupId}
              onSelect={(id) => {
                setSelectedId(id);
                if (id) setSelectedGroupId(null);
              }}
              onSelectGroup={(id) => {
                setSelectedGroupId(id);
                if (id) setSelectedId(null);
              }}
              onCommitGeometry={commitGeometry}
              onCommitGroupGeometry={commitGroupGeometry}
              onDropWidget={onDropWidget}
              interactiveMode={interactiveMode}
              onGroupSelection={groupSelected}
              onUngroup={ungroup}
              onDuplicate={duplicateWidget}
              onDelete={deleteWidget}
              onToggleVisibility={toggleWidgetVisibility}
              onToggleDisabled={toggleWidgetDisabled}
              onReorder={reorder}
            />
          ) : (
            <div className="h-full grid place-items-center" style={{ background: "var(--panel-2)" }}>
              {workspaceQ.isFetching || canvasesQ.isLoading ? <Spinner size={22} /> : (
                <div className="text-center">
                  <LayoutGrid size={30} style={{ color: "var(--ink-3)" }} className="mx-auto mb-3" />
                  <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>No canvas selected</p>
                  <p className="text-[12px] mt-1 mb-3" style={{ color: "var(--ink-3)" }}>Create your first dashboard canvas.</p>
                  <Button variant="primary" onClick={() => setShowCreate(true)}>New canvas</Button>
                </div>
              )}
            </div>
          )}
        </div>
        {doc && (
          <InspectorV1
            doc={doc}
            selectedId={selectedId}
            selectedGroupId={selectedGroupId}
            onSelect={(id) => {
              setSelectedId(id);
              if (id) setSelectedGroupId(null);
            }}
            onSelectGroup={(id) => {
              setSelectedGroupId(id);
              if (id) setSelectedId(null);
            }}
            onUpdateCanvas={updateCanvas}
            onUpdateGeometry={commitGeometry}
            onUpdateGroupGeometry={commitGroupGeometry}
            onUpdateConfig={updateConfig}
            onUpdateWidgetVisibility={updateWidgetVisibility}
            onUpdateGroup={updateGroup}
            onUngroup={ungroup}
            onDelete={deleteWidget}
            onDuplicate={duplicateWidget}
            onReorder={reorder}
          />
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["canvases"] });
            selectCanvas(id);
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [size, setSize] = useState("1920x1080");
  const [err, setErr] = useState("");
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 128);
  const effectiveId = id || slug(name);

  const create = useMutation({
    mutationFn: async () => {
      const [w, h] = size.split("x").map(Number);
      if (!CANVAS_LIMITS.id.test(effectiveId)) throw new Error("Invalid id (use a-z, 0-9, . _ -)");
      return api.createCanvas({ id: effectiveId, name: name || effectiveId, logicalSize: { width: w, height: h } });
    },
    onSuccess: () => onCreated(effectiveId),
    onError: (e: unknown) => setErr((e as Error).message),
  });

  return (
    <Modal
      title="New canvas"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!effectiveId || create.isPending}
            onClick={() => { setErr(""); create.mutate(); }}
          >
            {create.isPending ? <Spinner size={13} /> : "Create"}
          </Button>
        </>
      }
    >
      <Field label="Name"><TextInput autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Command Center" /></Field>
      <Field label="ID" hint="Lowercase; a-z 0-9 . _ -"><TextInput value={effectiveId} onChange={e => setId(slug(e.target.value))} placeholder="command-center" /></Field>
      <Field label="Size">
        <Select value={size} onChange={e => setSize(e.target.value)}>
          <option value="1920x1080">1920 × 1080</option>
          <option value="1280x720">1280 × 720</option>
          <option value="1024x600">1024 × 600</option>
          <option value="800x480">800 × 480</option>
          <option value="1080x1920">1080 × 1920 (portrait)</option>
        </Select>
      </Field>
      {err && <div className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</div>}
    </Modal>
  );
}
