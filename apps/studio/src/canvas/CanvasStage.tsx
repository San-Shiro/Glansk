import { useEffect, useRef } from "react";
import { renderCanvas, type CanvasHandle } from "@shared/canvas-render.js";
import "@shared/canvas.css";
import type { CanvasDocument } from "@/lib/types";

interface CanvasStageProps {
  document: CanvasDocument;
  /** Scale factor when not in fit mode (editor zoom). */
  scale?: number;
  /** Scale to fill the host and center (preview / kiosk parity). */
  fit?: boolean;
  /** Mount live sandboxed widget iframes (true WYSIWYG). Default true. */
  mountWidgets?: boolean;
  /** When false, tiles ignore pointer events (an editor overlay owns them). */
  interactive?: boolean;
  /** Re-render trigger: bump when the document mutates in place. */
  revision?: number;
  className?: string;
  style?: React.CSSProperties;
  onReady?: (handle: CanvasHandle) => void;
}

/**
 * React wrapper around the SHARED canvas renderer. The exact same module powers
 * the kiosk display, guaranteeing the editor preview matches production output.
 */
export default function CanvasStage({
  document, scale = 1, fit = false, mountWidgets = true, interactive = true,
  revision = 0, className, style, onReady,
}: CanvasStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CanvasHandle | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handle = renderCanvas(host, document, { fit, scale, mountWidgets, interactive });
    handleRef.current = handle;
    onReady?.(handle);
    return () => handle.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, scale, fit, mountWidgets, interactive, revision]);

  return <div ref={hostRef} className={className} style={style} />;
}
