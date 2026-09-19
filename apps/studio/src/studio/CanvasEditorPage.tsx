import { lazy, Suspense } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";

const Studio = lazy(() => import("./Studio"));
const StudioV1 = lazy(() => import("./v1/StudioV1"));

export interface CanvasEditorPageProps {
  mode?: "v1" | "v2";
}

/** Route wrapper supporting /canvas/:id/edit, /canvas/:id/edit/v2, /canvas/:id/edit/v1 */
export default function CanvasEditorPage({ mode }: CanvasEditorPageProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active version based on route prop, path suffix, or query param
  const isV1 =
    mode === "v1" ||
    location.pathname.endsWith("/v1") ||
    location.pathname.endsWith("-v1") ||
    new URLSearchParams(location.search).get("v") === "1";

  const handleSwitchVersion = (targetVersion: "v1" | "v2") => {
    navigate(`/canvas/${id}/edit/${targetVersion}`);
  };

  const loadingFallback = (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <span className="text-xs font-mono tracking-wider">LOADING {isV1 ? "STUDIO V1" : "STUDIO V2"}...</span>
      </div>
    </div>
  );

  return (
    <Suspense fallback={loadingFallback}>
      {isV1 ? (
        <StudioV1
          initialCanvasId={id}
          onExit={() => navigate("/")}
          onNavigateCanvas={(cid) => navigate(`/canvas/${cid}/edit/v1`, { replace: true })}
          onSwitchVersion={handleSwitchVersion}
        />
      ) : (
        <Studio
          initialCanvasId={id}
          onExit={() => navigate("/")}
          onNavigateCanvas={(cid) => navigate(`/canvas/${cid}/edit/v2`, { replace: true })}
          onSwitchVersion={handleSwitchVersion}
        />
      )}
    </Suspense>
  );
}
