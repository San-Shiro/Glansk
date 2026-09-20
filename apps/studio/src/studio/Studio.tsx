import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { api, ApiError, CANVAS_LIMITS } from "@/lib/api";
import type { CanvasDocument, CanvasGroup, JsonValue, WidgetGeometry, WidgetVisibilityConfig, CanvasVariableDefinition, WidgetInstance } from "@/lib/types";
import { CATALOG, instantiate, getActiveDraggingWidget, type CatalogItem } from "@/lib/catalog";
import { Button, Field, Modal, Select, TextInput, Spinner } from "@/components/ui";
import TopBar from "./TopBar";
import LeftSidebar, { type LeftNavTab } from "./LeftSidebar";
import Inspector from "./Inspector";
import CanvasViewport from "./CanvasViewport";
import StatusBar from "./StatusBar";

const LAST_KEY = "glansk_last_canvas";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface StudioProps {
  /** Canvas to open on mount (from the /canvas/:id/edit route). */
  initialCanvasId?: string;
  /** Return to the dashboard shell. */
  onExit?: () => void;
  /** Keep the URL in sync when switching canvases inside the editor. */
  onNavigateCanvas?: (id: string) => void;
  /** Switch to another version of the editor ('v1' | 'v2'). */
  onSwitchVersion?: (version: "v1" | "v2") => void;
}

export default function Studio({ initialCanvasId, onExit, onNavigateCanvas, onSwitchVersion }: StudioProps = {}) {
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<string | null>(initialCanvasId ?? null);
  const [doc, setDoc] = useState<CanvasDocument | null>(null);
  const [draftRevision, setDraftRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [selectedWidgetIds, setSelectedWidgetIds] = useState<string[]>([]);
  const selectedId = selectedWidgetIds[0] ?? null;
  const setSelectedId = useCallback((id: string | null) => {
    setSelectedWidgetIds(id ? [id] : []);
  }, []);
  const [inspectorSuppressed, setInspectorSuppressed] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftNavTab>("layers");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
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
    setDoc(d); setDraftRevision(workspaceQ.data.draft.draftRevision); setDirty(false); setSelectedWidgetIds([]);
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
      setSelectedWidgetIds([w.id]);
      setSelectedGroupId(null);
    });
  }, [edit]);

  const onDropWidget = useCallback((payload: string, x: number, y: number) => {
    const [packageId, widgetId] = payload.split("/");
    const activeDrag = getActiveDraggingWidget();
    let item = (activeDrag && activeDrag.packageId === packageId && activeDrag.widgetId === widgetId)
      ? activeDrag
      : CATALOG.find(c => c.packageId === packageId && c.widgetId === widgetId);
    if (!item) {
      item = {
        packageId,
        widgetId,
        title: widgetId,
        category: "display",
        packaged: true,
        defaultGeometry: { width: 320, height: 240 },
        defaultConfig: {},
      };
    }
    addWidget(item, Math.round(x), Math.round(y));
  }, [addWidget]);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const commitGeometry = useCallback((id: string, g: WidgetGeometry) => edit(d => { const w = d.widgets.find(w => w.id === id); if (w) w.geometry = g; }), [edit]);
  const commitGroupGeometry = useCallback((id: string, g: CanvasGroup["geometry"]) => edit(d => { 
    d.groups = d.groups || [];
    const grp = d.groups.find(g => g.id === id); 
    if (grp) grp.geometry = g; 
  }), [edit]);

  const batchCommitGeometry = useCallback((updates: Array<{ id: string; geometry: WidgetGeometry }>) => {
    edit(d => {
      for (const u of updates) {
        const w = d.widgets.find(x => x.id === u.id);
        if (w) w.geometry = u.geometry;
      }
    });
  }, [edit]);

  const updateConfig = useCallback((id: string, config: Record<string, JsonValue>) => edit(d => { const w = d.widgets.find(w => w.id === id); if (w) w.config = config; }), [edit]);
  const deleteWidget = useCallback((id: string) => { 
    edit(d => { 
      d.widgets = d.widgets.filter(w => w.id !== id); 
      d.groups = d.groups?.filter(g => g.id !== id);
    }); 
    setSelectedWidgetIds(s => s.filter(x => x !== id)); 
    setSelectedGroupId(s => (s === id ? null : s));
  }, [edit]);

  const duplicateWidget = useCallback((id: string) => edit(d => {
    const w = d.widgets.find(w => w.id === id); if (!w) return;
    const copy = structuredClone(w); copy.id = `${w.widgetId}-${Date.now().toString(36)}`.slice(0, 40);
    copy.geometry = { ...w.geometry, x: w.geometry.x + 24, y: w.geometry.y + 24, zIndex: nextZ(d) };
    d.widgets.push(copy); setSelectedWidgetIds([copy.id]); setSelectedGroupId(null);
  }), [edit]);

  const duplicateSelected = useCallback(() => {
    if (selectedGroupId) {
      edit(d => {
        d.groups = d.groups || [];
        const grp = d.groups.find(g => g.id === selectedGroupId);
        if (!grp) return;
        const newGrpId = `group-${Date.now().toString(36)}`;
        const newGroup: CanvasGroup = {
          ...structuredClone(grp),
          id: newGrpId,
          name: `${grp.name} (Copy)`,
          geometry: {
            ...grp.geometry,
            x: grp.geometry.x + 24,
            y: grp.geometry.y + 24,
            zIndex: nextZ(d),
          },
        };
        const memberWidgets = d.widgets.filter(w => w.groupId === selectedGroupId);
        for (const mw of memberWidgets) {
          const copy = structuredClone(mw);
          copy.id = `${mw.widgetId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 40);
          copy.groupId = newGrpId;
          d.widgets.push(copy);
        }
        d.groups.push(newGroup);
        setSelectedGroupId(newGrpId);
        setSelectedWidgetIds([]);
      });
    } else if (selectedWidgetIds.length > 0) {
      edit(d => {
        const newIds: string[] = [];
        for (const id of selectedWidgetIds) {
          const w = d.widgets.find(x => x.id === id);
          if (!w) continue;
          const copy = structuredClone(w);
          copy.id = `${w.widgetId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 40);
          copy.geometry = {
            ...w.geometry,
            x: w.geometry.x + 24,
            y: w.geometry.y + 24,
            zIndex: nextZ(d),
          };
          d.widgets.push(copy);
          newIds.push(copy.id);
        }
        setSelectedWidgetIds(newIds);
      });
    }
  }, [selectedGroupId, selectedWidgetIds, edit]);

  const deleteSelected = useCallback(() => {
    if (selectedGroupId) {
      deleteWidget(selectedGroupId);
    } else if (selectedWidgetIds.length > 0) {
      edit(d => {
        d.widgets = d.widgets.filter(w => !selectedWidgetIds.includes(w.id));
      });
      setSelectedWidgetIds([]);
    }
  }, [selectedGroupId, selectedWidgetIds, deleteWidget, edit]);

  const reorder = useCallback((id: string, dir: "front" | "back") => edit(d => {
    d.groups = d.groups || [];
    const w = d.widgets.find(x => x.id === id);
    const grp = d.groups.find(x => x.id === id);
    const target = w || grp;
    if (!target) return;
    const zs = [...d.widgets.map(x => x.geometry.zIndex), ...d.groups.map(x => x.geometry.zIndex)];
    target.geometry.zIndex = dir === "front" ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
  }), [edit]);

  const groupSelected = useCallback((targetIds?: string[]) => {
    const ids = targetIds && targetIds.length > 0 ? targetIds : selectedWidgetIds;
    if (ids.length === 0) return;
    edit(d => {
      d.groups = d.groups || [];
      const widgetsToGroup = d.widgets.filter(w => ids.includes(w.id));
      if (widgetsToGroup.length === 0) return;

      const getAbs = (w: WidgetInstance) => {
        if (!w.groupId) return { ...w.geometry };
        const g = d.groups?.find(grp => grp.id === w.groupId);
        if (!g) return { ...w.geometry };
        return {
          ...w.geometry,
          x: g.geometry.x + w.geometry.x,
          y: g.geometry.y + w.geometry.y,
        };
      };

      const absGeoms = widgetsToGroup.map(w => getAbs(w));
      const minX = Math.min(...absGeoms.map(g => g.x));
      const minY = Math.min(...absGeoms.map(g => g.y));
      const maxX = Math.max(...absGeoms.map(g => g.x + g.width));
      const maxY = Math.max(...absGeoms.map(g => g.y + g.height));

      const grpId = `group-${Date.now().toString(36)}`;
      const newGroup: CanvasGroup = {
        id: grpId,
        name: `Group ${d.groups.length + 1}`,
        geometry: {
          x: Math.round(minX),
          y: Math.round(minY),
          width: Math.max(60, Math.round(maxX - minX)),
          height: Math.max(40, Math.round(maxY - minY)),
          zIndex: nextZ(d),
        },
      };

      for (const w of widgetsToGroup) {
        const abs = getAbs(w);
        w.groupId = grpId;
        w.geometry.x = Math.round(abs.x - minX);
        w.geometry.y = Math.round(abs.y - minY);
      }

      d.groups.push(newGroup);

      // Prune groups that are now empty (lost all members to the new group)
      d.groups = d.groups.filter(g => {
        if (g.id === grpId) return true; // keep the newly created group
        return d.widgets.some(w => w.groupId === g.id);
      });

      setSelectedGroupId(grpId);
      setSelectedWidgetIds([]);
    });
  }, [selectedWidgetIds, edit]);

  const ungroup = useCallback((groupId: string) => {
    edit(d => {
      const grp = d.groups?.find(g => g.id === groupId);
      if (!grp) return;
      const childIds: string[] = [];
      for (const w of d.widgets) {
        if (w.groupId === groupId) {
          w.geometry.x = Math.round(grp.geometry.x + w.geometry.x);
          w.geometry.y = Math.round(grp.geometry.y + w.geometry.y);
          delete w.groupId;
          childIds.push(w.id);
        }
      }
      d.groups = d.groups?.filter(g => g.id !== groupId);
      setSelectedGroupId(null);
      setSelectedWidgetIds(childIds);
    });
  }, [edit]);

  const alignSelected = useCallback((dir: "left" | "center" | "right" | "top" | "middle" | "bottom") => {
    if (selectedWidgetIds.length < 2) return;
    edit(d => {
      d.groups = d.groups || [];
      const widgets = d.widgets.filter(w => selectedWidgetIds.includes(w.id));
      if (widgets.length < 2) return;

      const getAbs = (w: WidgetInstance) => {
        if (!w.groupId) return { ...w.geometry };
        const g = d.groups?.find(grp => grp.id === w.groupId);
        if (!g) return { ...w.geometry };
        return { ...w.geometry, x: g.geometry.x + w.geometry.x, y: g.geometry.y + w.geometry.y };
      };

      const absGeoms = widgets.map(w => getAbs(w));
      const minX = Math.min(...absGeoms.map(g => g.x));
      const minY = Math.min(...absGeoms.map(g => g.y));
      const maxX = Math.max(...absGeoms.map(g => g.x + g.width));
      const maxY = Math.max(...absGeoms.map(g => g.y + g.height));
      const centerX = minX + (maxX - minX) / 2;
      const centerY = minY + (maxY - minY) / 2;

      for (const w of widgets) {
        const grp = w.groupId ? d.groups.find(g => g.id === w.groupId) : null;
        const grpOffsetX = grp ? grp.geometry.x : 0;
        const grpOffsetY = grp ? grp.geometry.y : 0;

        let targetAbsX = grpOffsetX + w.geometry.x;
        let targetAbsY = grpOffsetY + w.geometry.y;

        if (dir === "left") targetAbsX = minX;
        else if (dir === "center") targetAbsX = Math.round(centerX - w.geometry.width / 2);
        else if (dir === "right") targetAbsX = maxX - w.geometry.width;
        else if (dir === "top") targetAbsY = minY;
        else if (dir === "middle") targetAbsY = Math.round(centerY - w.geometry.height / 2);
        else if (dir === "bottom") targetAbsY = maxY - w.geometry.height;

        w.geometry.x = Math.round(targetAbsX - grpOffsetX);
        w.geometry.y = Math.round(targetAbsY - grpOffsetY);
      }
    });
  }, [selectedWidgetIds, edit]);

  const distributeSelected = useCallback((axis: "horizontal" | "vertical") => {
    if (selectedWidgetIds.length < 3) return;
    edit(d => {
      d.groups = d.groups || [];
      const widgets = d.widgets.filter(w => selectedWidgetIds.includes(w.id));
      if (widgets.length < 3) return;

      const getAbs = (w: WidgetInstance) => {
        if (!w.groupId) return { ...w.geometry };
        const g = d.groups?.find(grp => grp.id === w.groupId);
        if (!g) return { ...w.geometry };
        return { ...w.geometry, x: g.geometry.x + w.geometry.x, y: g.geometry.y + w.geometry.y };
      };

      if (axis === "horizontal") {
        const sorted = [...widgets].sort((a, b) => getAbs(a).x - getAbs(b).x);
        const minX = getAbs(sorted[0]).x;
        const last = sorted[sorted.length - 1];
        const maxX = getAbs(last).x + last.geometry.width;
        const totalWidgetWidth = sorted.reduce((sum, w) => sum + w.geometry.width, 0);
        const freeSpace = Math.max(0, maxX - minX - totalWidgetWidth);
        const gap = freeSpace / (sorted.length - 1);

        let currentX = minX;
        for (const w of sorted) {
          const grp = w.groupId ? d.groups.find(g => g.id === w.groupId) : null;
          const grpOffsetX = grp ? grp.geometry.x : 0;
          w.geometry.x = Math.round(currentX - grpOffsetX);
          currentX += w.geometry.width + gap;
        }
      } else {
        const sorted = [...widgets].sort((a, b) => getAbs(a).y - getAbs(b).y);
        const minY = getAbs(sorted[0]).y;
        const last = sorted[sorted.length - 1];
        const maxY = getAbs(last).y + last.geometry.height;
        const totalWidgetHeight = sorted.reduce((sum, w) => sum + w.geometry.height, 0);
        const freeSpace = Math.max(0, maxY - minY - totalWidgetHeight);
        const gap = freeSpace / (sorted.length - 1);

        let currentY = minY;
        for (const w of sorted) {
          const grp = w.groupId ? d.groups.find(g => g.id === w.groupId) : null;
          const grpOffsetY = grp ? grp.geometry.y : 0;
          w.geometry.y = Math.round(currentY - grpOffsetY);
          currentY += w.geometry.height + gap;
        }
      }
    });
  }, [selectedWidgetIds, edit]);

  const toggleWidgetVisibility = useCallback((id: string) => {
    edit(d => {
      const w = d.widgets.find(x => x.id === id);
      if (!w) return;
      const cur = w.visibility?.defaultVisible !== false;
      w.visibility = { ...w.visibility, defaultVisible: !cur };
    });
  }, [edit]);

  const toggleWidgetDisabled = useCallback((id: string) => {
    edit(d => {
      const w = d.widgets.find(x => x.id === id);
      if (!w) return;
      w.disabled = !w.disabled;
    });
  }, [edit]);

  const toggleGroupVisibility = useCallback((id: string) => {
    edit(d => {
      const g = d.groups?.find(x => x.id === id);
      if (!g) return;
      const cur = g.visibility?.defaultVisible !== false;
      g.visibility = { ...g.visibility, defaultVisible: !cur };
    });
  }, [edit]);

  const toggleGroupDisabled = useCallback((id: string) => {
    edit(d => {
      const g = d.groups?.find(x => x.id === id);
      if (!g) return;
      g.disabled = !g.disabled;
    });
  }, [edit]);

  const toggleGroupCollapse = useCallback((id: string) => {
    edit(d => {
      const g = d.groups?.find(x => x.id === id);
      if (!g) return;
      g.collapsed = !g.collapsed;
    });
  }, [edit]);

  const updateWidgetVisibility = useCallback((id: string, visibility: WidgetVisibilityConfig) => {
    edit(d => {
      const w = d.widgets.find(x => x.id === id);
      if (w) w.visibility = visibility;
    });
  }, [edit]);

  const updateGroup = useCallback((id: string, patch: Partial<CanvasGroup>) => {
    edit(d => {
      d.groups = d.groups || [];
      const grp = d.groups.find(g => g.id === id);
      if (grp) Object.assign(grp, patch);
    });
  }, [edit]);

  const updateVariables = useCallback((variables: Record<string, CanvasVariableDefinition>) => {
    edit(d => {
      d.variables = variables;
    });
  }, [edit]);

  const reorderItem = useCallback((draggedId: string, targetId: string, position: "before" | "after" | "inside") => {
    edit(d => {
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

      // Normalize z-indices to ensure distinct, monotonic values (prevents collisions at 0)
      const allItems: Array<{ geometry: { zIndex: number } }> = [
        ...d.widgets,
        ...(d.groups || []),
      ];
      allItems.sort((a, b) => (a.geometry.zIndex ?? 0) - (b.geometry.zIndex ?? 0));
      allItems.forEach((item, i) => { item.geometry.zIndex = i + 1; });
    });
  }, [edit]);

  const updateCanvas = useCallback((patch: Partial<CanvasDocument>) => edit(d => Object.assign(d, patch)), [edit]);

  // ---- server mutations ----
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

  // Periodic debounced auto-save as working draft
  useEffect(() => {
    if (!dirty || !currentId || !doc || saveMut.isPending) return;
    const timer = setTimeout(() => {
      if (dirty && !saveMut.isPending && currentId && doc) {
        saveMut.mutate();
      }
    }, 2500); // Auto-save 2.5s after last edit
    return () => clearTimeout(timer);
  }, [dirty, currentId, doc, saveMut]);

  const runtime = useMemo(() => runtimeQ.data?.find(r => r.canvasId === currentId), [runtimeQ.data, currentId]);
  const publishing = publishMut.isPending || goLiveMut.isPending || deactivateMut.isPending;

  useEffect(() => {
    const onResize = () => fitZoom();
    window.addEventListener("resize", onResize); return () => window.removeEventListener("resize", onResize);
  }, [fitZoom]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showCreate) return;
      const target = e.target as HTMLElement;
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (currentId && doc && !saveMut.isPending) {
          saveMut.mutate();
        }
        return;
      }

      if (isInput) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (doc) {
          setSelectedWidgetIds(doc.widgets.map((w) => w.id));
          setSelectedGroupId(null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelected();
        return;
      } else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        fitZoom();
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key === "0") {
        e.preventDefault();
        setZoom(1);
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (selectedGroupId) {
          ungroup(selectedGroupId);
        } else if (selectedWidgetIds.length > 0) {
          const w = doc?.widgets.find(x => selectedWidgetIds.includes(x.id) && x.groupId);
          if (w?.groupId) ungroup(w.groupId);
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (selectedWidgetIds.length > 0) {
          groupSelected();
        }
        return;
      } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (selectedWidgetIds.length > 0 || selectedGroupId) {
          e.preventDefault();
          const step = e.shiftKey ? 8 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          if (selectedGroupId) {
            edit((d) => {
              const grp = d.groups?.find((g) => g.id === selectedGroupId);
              if (grp) {
                grp.geometry.x = clamp(grp.geometry.x + dx, 0, d.logicalSize.width - grp.geometry.width);
                grp.geometry.y = clamp(grp.geometry.y + dy, 0, d.logicalSize.height - grp.geometry.height);
              }
            });
          } else if (selectedWidgetIds.length > 0) {
            edit((d) => {
              for (const id of selectedWidgetIds) {
                const w = d.widgets.find((x) => x.id === id);
                if (w) {
                  if (w.groupId) {
                    const parentGrp = d.groups?.find((g) => g.id === w.groupId);
                    if (parentGrp) {
                      w.geometry.x = clamp(w.geometry.x + dx, 0, Math.max(0, parentGrp.geometry.width - w.geometry.width));
                      w.geometry.y = clamp(w.geometry.y + dy, 0, Math.max(0, parentGrp.geometry.height - w.geometry.height));
                    } else {
                      w.geometry.x = clamp(w.geometry.x + dx, 0, d.logicalSize.width - w.geometry.width);
                      w.geometry.y = clamp(w.geometry.y + dy, 0, d.logicalSize.height - w.geometry.height);
                    }
                  } else {
                    w.geometry.x = clamp(w.geometry.x + dx, 0, d.logicalSize.width - w.geometry.width);
                    w.geometry.y = clamp(w.geometry.y + dy, 0, d.logicalSize.height - w.geometry.height);
                  }
                }
              }
            });
          }
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentId, doc, saveMut, selectedWidgetIds, selectedGroupId, groupSelected, ungroup, duplicateSelected, deleteSelected, fitZoom, edit]);

  const selectedWidget = doc?.widgets.find(w => w.id === selectedId);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden select-none" style={{ background: "var(--bg)" }}>
      {/* 1. Slim Top Bar (48px) */}
      <TopBar
        canvases={canvasesQ.data ?? []}
        currentId={currentId}
        currentName={doc?.name ?? ""}
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
        onLogout={async () => { await api.logout(); qc.invalidateQueries({ queryKey: ["auth"] }); }}
        status={status}
        interactiveMode={interactiveMode}
        onToggleInteractiveMode={() => {
          setInteractiveMode(m => !m);
          setSelectedId(null);
          setSelectedGroupId(null);
        }}
        variables={doc?.variables}
        onUpdateVariables={updateVariables}
        logicalSize={doc?.logicalSize}
        onUpdateCanvasSize={(w, h) => updateCanvas({ logicalSize: { width: w, height: h } })}
        onSwitchVersion={onSwitchVersion}
      />

      {/* 2. Workspace Body: Left Sidebar + Canvas Viewport + Contextual Inspector */}
      <div className="flex-1 flex min-h-0">
        <LeftSidebar
          doc={doc}
          onAdd={addWidget}
          selectedId={selectedId}
          selectedWidgetIds={selectedWidgetIds}
          selectedGroupId={selectedGroupId}
          onSelectWidget={(id) => {
            setSelectedWidgetIds(id ? [id] : []);
            if (id) {
              setSelectedGroupId(null);
              setInspectorSuppressed(false);
            }
          }}
          onSelectWidgets={(ids) => {
            setSelectedWidgetIds(ids);
            if (ids.length > 0) {
              setSelectedGroupId(null);
              setInspectorSuppressed(false);
            }
          }}
          onSelectGroup={(id) => {
            setSelectedGroupId(id);
            if (id) {
              setSelectedWidgetIds([]);
              setInspectorSuppressed(false);
            }
          }}
          onToggleWidgetVisibility={toggleWidgetVisibility}
          onToggleWidgetDisabled={toggleWidgetDisabled}
          onToggleGroupVisibility={toggleGroupVisibility}
          onToggleGroupDisabled={toggleGroupDisabled}
          onToggleGroupCollapse={toggleGroupCollapse}
          onReorderItem={reorderItem}
          onCreateGroupFromSelected={() => groupSelected()}
          onUpdateCanvas={updateCanvas}
          onUpdateVariables={updateVariables}
          activeTab={leftTab}
          onTabChange={setLeftTab}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed((c) => !c)}
        />
        <div ref={centerRef} className="flex-1 min-w-0 relative">
          {doc ? (
            <CanvasViewport
              doc={doc}
              revision={rev}
              zoom={zoom}
              selectedId={selectedId}
              selectedWidgetIds={selectedWidgetIds}
              selectedGroupId={selectedGroupId}
              onSelect={(id) => {
                setSelectedWidgetIds(id ? [id] : []);
                if (id) {
                  setSelectedGroupId(null);
                  setInspectorSuppressed(false);
                }
              }}
              onSelectWidgets={(ids) => {
                setSelectedWidgetIds(ids);
                if (ids.length > 0) {
                  setSelectedGroupId(null);
                  setInspectorSuppressed(false);
                }
              }}
              onSelectGroup={(id) => {
                setSelectedGroupId(id);
                if (id) {
                  setSelectedWidgetIds([]);
                  setInspectorSuppressed(false);
                }
              }}
              onCommitGeometry={commitGeometry}
              onCommitGroupGeometry={commitGroupGeometry}
              onBatchCommitGeometry={batchCommitGeometry}
              onDropWidget={onDropWidget}
              interactiveMode={interactiveMode}
              onGroupSelection={() => groupSelected()}
              onUngroup={ungroup}
              onDuplicate={duplicateWidget}
              onDuplicateSelected={duplicateSelected}
              onDelete={deleteWidget}
              onDeleteSelected={deleteSelected}
              onAlignSelected={alignSelected}
              onDistributeSelected={distributeSelected}
              onToggleVisibility={toggleWidgetVisibility}
              onToggleDisabled={toggleWidgetDisabled}
              onReorder={reorder}
              onZoom={setZoom}
              onZoomFit={() => fitZoom()}
              onSelectAll={() => {
                if (doc) {
                  setSelectedWidgetIds(doc.widgets.map((w) => w.id));
                  setSelectedGroupId(null);
                }
              }}
              onOpenCatalog={() => {
                setLeftTab("blocks");
                setLeftCollapsed(false);
              }}
              onOpenCanvasSettings={() => {
                setLeftTab("canvas");
                setLeftCollapsed(false);
              }}
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
        {doc && (selectedWidgetIds.length > 0 || selectedGroupId) && !inspectorSuppressed && (
          <Inspector
            doc={doc}
            selectedId={selectedId}
            selectedWidgetIds={selectedWidgetIds}
            selectedGroupId={selectedGroupId}
            onSelect={(id) => {
              setSelectedWidgetIds(id ? [id] : []);
              if (id) {
                setSelectedGroupId(null);
                setInspectorSuppressed(false);
              }
            }}
            onSelectGroup={(id) => {
              setSelectedGroupId(id);
              if (id) {
                setSelectedWidgetIds([]);
                setInspectorSuppressed(false);
              }
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
            onGroupSelection={() => groupSelected()}
            onAlignSelected={alignSelected}
            onDistributeSelected={distributeSelected}
            onDeleteSelected={deleteSelected}
            onToggleDisabled={toggleWidgetDisabled}
            onReorder={reorder}
            onCollapse={() => setInspectorSuppressed(true)}
          />
        )}
      </div>

      {/* 3. Bottom Status Bar (28px) */}
      <StatusBar
        dirty={dirty}
        saving={saveMut.isPending}
        saveError={saveMut.error ? (saveMut.error as Error).message : null}
        runtime={runtime}
        logicalSize={doc?.logicalSize}
        canvasName={doc?.name}
        selectedWidgetId={selectedId}
        selectedWidgetLabel={selectedWidget ? (selectedWidget.config?.label as string) || selectedWidget.widgetId : undefined}
        inspectorSuppressed={inspectorSuppressed}
        onToggleInspector={() => setInspectorSuppressed((s) => !s)}
        onOpenEvents={() => {
          setLeftTab("events");
          setLeftCollapsed(false);
        }}
      />

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["canvases"] }); selectCanvas(id); }} />}
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
    <Modal title="New canvas" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!effectiveId || create.isPending} onClick={() => { setErr(""); create.mutate(); }}>
          {create.isPending ? <Spinner size={13} /> : "Create"}
        </Button>
      </>}>
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
