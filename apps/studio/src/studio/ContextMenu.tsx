import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  keycaps?: string[];
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface ContextMenuGroup {
  actions: ContextMenuAction[];
}

interface Props {
  x: number;
  y: number;
  groups: ContextMenuGroup[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, groups, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  // Viewport bounds protection
  const menuWidth = 240;
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 12);
  const clampedY = Math.min(y, window.innerHeight - 380);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[99999] w-[240px] p-2 select-none animate-in fade-in zoom-in-95 duration-100"
      style={{
        left: Math.max(12, clampedX),
        top: Math.max(12, clampedY),
        borderRadius: 20,
        background: "color-mix(in srgb, var(--panel, #0e1726) 92%, #000 8%)",
        border: "1px solid color-mix(in srgb, var(--line, #223249) 80%, rgba(255,255,255,0.12))",
        boxShadow: "0 24px 48px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.04)",
        backdropFilter: "blur(20px)",
      }}
      onContextMenu={e => e.preventDefault()}
    >
      <div className="flex flex-col gap-1">
        {groups.map((grp, gIdx) => (
          <div key={gIdx} className="flex flex-col gap-0.5">
            {gIdx > 0 && (
              <div 
                className="my-1 h-px w-full" 
                style={{ background: "color-mix(in srgb, var(--line, #223249) 60%, transparent)" }} 
              />
            )}
            {grp.actions.map(act => (
              <button
                key={act.id}
                disabled={act.disabled}
                onClick={() => {
                  if (act.disabled) return;
                  act.onClick();
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-left text-[13px] font-medium transition-all ${
                  act.disabled 
                    ? "opacity-35 cursor-not-allowed" 
                    : act.destructive 
                      ? "hover:bg-red-500/15 text-red-400 hover:text-red-300" 
                      : "hover:bg-[var(--panel-2,#162438)] text-[var(--ink,#f1f5f9)]"
                }`}
                style={{ borderRadius: 12 }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`shrink-0 ${act.destructive ? "text-red-400" : "text-[var(--ink-2,#94a3b8)]"}`}>
                    {act.icon}
                  </span>
                  <span className="truncate">{act.label}</span>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  {act.checked !== undefined && (
                    <span className={`w-4 h-4 flex items-center justify-center ${act.checked ? "text-[var(--accent)]" : "opacity-0"}`}>
                      <Check size={13} strokeWidth={2.5} />
                    </span>
                  )}
                  {act.keycaps && act.keycaps.length > 0 && (
                    <div className="flex items-center gap-1">
                      {act.keycaps.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="inline-flex items-center justify-center min-w-[20px] h-[19px] px-1 text-[11px] font-mono font-semibold rounded shadow-xs"
                          style={{
                            background: "color-mix(in srgb, var(--panel-2, #18263a) 80%, black 20%)",
                            color: "var(--ink-2, #94a3b8)",
                            border: "1px solid color-mix(in srgb, var(--line, #283e5c) 70%, transparent)",
                            boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
