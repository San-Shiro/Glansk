// Kiosk display. Thin consumer of the shared canvas renderer so the display is
// pixel-identical to the admin editor's live preview.
//
// Addressing: each physical screen gets its own path — /kiosk/<canvasId> — which
// renders that specific published canvas. A bare /kiosk/ falls back to the first
// active runtime (single-display convenience). Because the path is unique per
// screen, cookies can be scoped to it (Path=/kiosk/<id>), giving each display an
import { renderCanvas, clearWidgetFrames } from '/shared/canvas-render.js';
import { registerPackageWidget } from '/shared/packaged-widget-registry.js';

const stage = document.querySelector('#stage');
const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));

// The display target is the single path segment after /kiosk/ (canvas ids are
// [a-z0-9][a-z0-9._-]* — no slashes), if any.
function displayTarget() {
  const match = location.pathname.match(/\/kiosk\/([a-z0-9][a-z0-9._-]*)\/?$/i);
  return match ? match[1] : null;
}

// Establish a per-screen identity + cookie namespace scoped to this display's
// path so screen-specific state never collides across displays on one host.
// Also records the id in module scope so that render() can forward it as a
// renderContext to the canvas renderer, which propagates it to widget iframes.
let currentDisplayId = null;
function bindDisplay(id) {
  const scope = `/kiosk/${id}`;
  document.cookie = `glansk_display=${encodeURIComponent(id)}; path=${scope}; max-age=31536000; samesite=lax`;
  // Exposed for the widget host / future screen-scoped storage helpers.
  window.__glanskDisplay = { id, scope, cookiePath: scope };
  currentDisplayId = id;
}

let currentDocument;
let handle;
function render(runtimeDocument) {
  currentDocument = runtimeDocument;
  const isPreview = location.search.includes('preview=1');
  if (!isPreview) {
    window.document.title = `${runtimeDocument.name || 'Glansk'} - Glansk`;
  }
  // Only propagate display identity for named kiosk targets (when bindDisplay
  // was called). Bare /kiosk/ fallback and admin editor previews never set
  // currentDisplayId, so widgets there receive no display identity.
  const renderContext = (!isPreview && currentDisplayId) ? { display: { id: currentDisplayId } } : undefined;
  handle = renderCanvas(stage, runtimeDocument, { fit: true, interactive: !isPreview, renderContext });
}

async function load() {
  try {
    try {
      const pkgRes = await fetch('/api/v1/packages/widgets');
      if (pkgRes.ok) {
        const pkgData = await pkgRes.json();
        if (Array.isArray(pkgData.widgets)) {
          for (const w of pkgData.widgets) {
            if (w.packageId && w.widgetId) registerPackageWidget(w.packageId, w.widgetId);
          }
        }
      }
    } catch {}

    const isPreview = location.search.includes('preview=1');
    if (isPreview) {
      document.documentElement.classList.add('preview-mode');
      document.body.classList.add('preview-mode');
    }
    const id = displayTarget();
    if (id) {
      // Targeted display: render this screen's assigned published canvas.
      if (!isPreview) {
        bindDisplay(id);
      }
      const response = await fetch(`/api/v1/canvases/${id}/published`);
      if (response.ok) {
        render((await response.json()).document);
        return;
      }
      // If no published revision exists yet, check the draft workspace document so preview snapshot still shows the actual canvas layout
      if (response.status === 404) {
        const draftRes = await fetch(`/api/v1/canvases/${id}`);
        if (draftRes.ok) {
          const workspace = await draftRes.json();
          if (workspace?.draft?.document) {
            render(workspace.draft.document);
            return;
          }
        }
      }
      if (response.status === 404) throw new Error(`Canvas "${id}" has no published revision yet`);
      if (!response.ok) throw new Error('Published dashboard unavailable');
      return;
    }
    // Bare /kiosk/ — fall back to the most recently updated active runtime.
    const runtimes = await fetch('/api/v1/runtime').then(response => response.json());
    const activeList = runtimes
      .filter(item => item.phase === 'ready' && item.activeRevision)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const active = activeList[0];
    if (!active) throw new Error('No active dashboard');
    const response = await fetch(`/api/v1/canvases/${active.canvasId}/published`);
    if (!response.ok) throw new Error('Published dashboard unavailable');
    render((await response.json()).document);
  } catch (error) {
    stage.innerHTML = `<div class="loading" style="text-align: center; font-family: sans-serif;"><div>${esc(error.message)}</div><a href="/" style="display: inline-block; margin-top: 1rem; color: #44d7ff; text-decoration: none; font-size: 14px;">← Back to Admin</a></div>`;
  }
}
let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (currentDocument) render(currentDocument);
  }, 250);
});
addEventListener('pagehide', () => clearWidgetFrames('pagehide'), { once: true });
load();
