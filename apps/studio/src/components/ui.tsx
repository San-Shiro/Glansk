import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/* Squarish, flat, pastel primitives. No gradients, small radii, soft borders. */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "subtle"; children: ReactNode };
export function Button({ variant = "subtle", className = "", children, ...rest }: BtnProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--orange-primary)",
      color: "#FFFFFF",
      border: "1px solid transparent",
      boxShadow: "none",
    },
    danger: { background: "var(--danger)", color: "#fff", border: "1px solid var(--danger)" },
    ghost: { background: "transparent", color: "var(--ink-2)", border: "1px solid transparent" },
    subtle: { background: "var(--panel)", color: "var(--ink)", border: "1px solid var(--line)" },
  };

  const disabledStyle: React.CSSProperties = rest.disabled
    ? variant === "ghost"
      ? { opacity: 0.35, cursor: "not-allowed", pointerEvents: "none" }
      : {
          background: "var(--btn-disabled-bg)",
          borderColor: "var(--btn-disabled-border)",
          color: "var(--btn-disabled-text)",
          cursor: "not-allowed",
          boxShadow: "none",
        }
    : {};

  return (
    <button
      {...rest}
      style={{
        ...styles[variant],
        borderRadius: "var(--radius)",
        ...disabledStyle,
      }}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold transition-all hover:opacity-90 active:opacity-80 disabled:opacity-50 disabled:hover:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ className = "", children, active, ...rest }: BtnProps & { active?: boolean }) {
  return (
    <button
      {...rest}
      style={{
        borderRadius: "var(--radius)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : rest.disabled ? "var(--btn-disabled-text)" : "var(--ink-2)",
        ...(rest.disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
      }}
      className={`inline-flex items-center justify-center h-8 w-8 transition-colors hover:bg-[var(--panel-2)] disabled:hover:bg-transparent ${className}`}
    >
      {children}
    </button>
  );
}

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "ok" | "accent" | "warn" | "danger"; className?: string }) {
  const map: Record<string, [string, string]> = {
    neutral: ["var(--panel-2)", "var(--ink-2)"],
    ok: ["var(--ok-soft)", "var(--ok)"],
    accent: ["var(--accent-soft)", "var(--accent)"],
    warn: ["var(--warn-soft)", "var(--warn)"],
    danger: ["var(--danger-soft)", "var(--danger)"],
  };
  const [bg, color] = map[tone];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold ${className}`} style={{ background: bg, color, borderRadius: "var(--radius)" }}>{children}</span>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="inline-block rounded-full border-2 animate-spin" style={{ width: size, height: size, borderColor: "var(--line-2)", borderTopColor: "var(--accent)" }} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ink-3)" }}>{label}</span>
      {children}
      {hint && <span className="block text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>{hint}</span>}
    </label>
  );
}

const inputCls = "w-full px-2.5 py-1.5 text-[13px]";
export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className || ""}`} />;
}

export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(30,28,45,0.35)" }} onClick={onClose}>
      <div className="w-full max-w-md border shadow-xl animate-fade-in" style={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: "var(--radius)" }} onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
          <h3 className="text-sm font-bold" style={{ color: "var(--ink)" }}>{title}</h3>
        </div>
        <div className="px-4 py-4 space-y-3">{children}</div>
        {footer && <div className="px-4 py-3 border-t flex justify-end gap-2" style={{ borderColor: "var(--line)" }}>{footer}</div>}
      </div>
    </div>
  );
}
