import type { CSSProperties, ReactNode } from "react";

/* Shared building blocks for the dashboard shell + tabs.
 * Flat, pastel, squarish — matches the Glansk Studio chrome tokens
 * (see index.css: --panel / --ink / --line / --accent). */

export function Card({ children, className = "", style, onClick }: {
  children: ReactNode; className?: string; style?: CSSProperties; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        ...(onClick ? { cursor: "pointer" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>{title}</h2>
        {subtitle && <p className="text-[12px] mt-0.5" style={{ color: "var(--ink-3)" }}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, hint, tone = "accent" }: {
  icon: ReactNode; label: string; value: ReactNode; hint?: string;
  tone?: "accent" | "ok" | "warn" | "danger";
}) {
  const toneColor: Record<string, string> = {
    accent: "var(--accent)", ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)",
  };
  const toneSoft: Record<string, string> = {
    accent: "var(--accent-soft)", ok: "var(--ok-soft)", warn: "var(--warn-soft)", danger: "var(--danger-soft)",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-7 w-7 grid place-items-center shrink-0"
          style={{ background: toneSoft[tone], color: toneColor[tone], borderRadius: "var(--radius)" }}>
          {icon}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: "var(--ink)" }}>{value}</div>
      {hint && <div className="text-[11px] mt-1" style={{ color: "var(--ink-3)" }}>{hint}</div>}
    </Card>
  );
}

export function EmptyState({ icon, title, hint, action }: {
  icon: ReactNode; title: string; hint?: string; action?: ReactNode;
}) {
  return (
    <Card className="py-12 flex flex-col items-center justify-center text-center px-6">
      <span style={{ color: "var(--ink-3)" }} className="mb-3">{icon}</span>
      <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{title}</p>
      {hint && <p className="text-[12px] mt-1 max-w-sm" style={{ color: "var(--ink-3)" }}>{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function KeyValue({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "var(--line)" }}>
      <span className="text-[12px]" style={{ color: "var(--ink-3)" }}>{k}</span>
      <span className="text-[13px] font-medium tabular-nums text-right" style={{ color: "var(--ink)" }}>{v}</span>
    </div>
  );
}

/** Minimal inline sparkline / bar for tiny previews. */
export function Sparkline({ data, color = "var(--accent)", height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return <div style={{ height }} />;
  const max = Math.max(...data, 1);
  const w = 100;
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${height - (v / max) * height}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const PHASE_TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "accent"> = {
  ready: "ok", starting: "accent", degraded: "warn", failed: "danger", inactive: "neutral",
};
export function phaseTone(phase?: string) { return PHASE_TONE[phase ?? "inactive"] ?? "neutral"; }

export type CardTone = "emerald" | "indigo" | "cyan" | "amber" | "purple" | "charcoal";

export interface ColorBlockCardProps {
  tone: CardTone;
  category: string;
  categoryIcon?: ReactNode;
  topAction?: ReactNode;
  title: string;
  subtitle?: string;
  metricLabel?: string;
  metricValue?: string;
  progressPercent?: number;
  badgeLabel?: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  actionHref?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionVariant?: "primary" | "secondary";
  extraActions?: ReactNode;
  children?: ReactNode;
}

export function ColorBlockCard({
  tone,
  category,
  categoryIcon,
  topAction,
  title,
  subtitle,
  metricLabel,
  metricValue,
  progressPercent,
  badgeLabel,
  actionLabel,
  actionIcon,
  actionHref,
  onAction,
  actionDisabled,
  actionVariant,
  extraActions,
  children,
}: ColorBlockCardProps) {
  // Normalize legacy tones
  const resolvedTone =
    tone === "purple" ? "indigo" : tone === "charcoal" ? "amber" : tone;

  const toneMap: Record<
    "emerald" | "indigo" | "cyan" | "amber",
    {
      accent: string;
      dotColor: string;
      defaultVariant: "primary" | "secondary";
    }
  > = {
    emerald: {
      accent: "var(--emerald)",
      dotColor: "var(--emerald)",
      defaultVariant: "primary",
    },
    indigo: {
      accent: "var(--indigo)",
      dotColor: "var(--indigo)",
      defaultVariant: "secondary",
    },
    cyan: {
      accent: "var(--cyan)",
      dotColor: "var(--cyan)",
      defaultVariant: "secondary",
    },
    amber: {
      accent: "var(--amber)",
      dotColor: "var(--amber)",
      defaultVariant: "secondary",
    },
  };

  const t = toneMap[resolvedTone as "emerald" | "indigo" | "cyan" | "amber"] ?? toneMap.emerald;
  const isPrimary = (actionVariant ?? t.defaultVariant) === "primary";

  return (
    <div
      className="p-5 rounded-[22px] border flex flex-col justify-between space-y-4 shadow-sm transition-all hover:border-[var(--border-hover)] hover:shadow-md relative overflow-hidden group"
      style={{
        background: "var(--bg-elevated)",
        borderColor: "var(--border-subtle)",
      }}
    >

      {/* Top row: Category Pill (Solid Neutral — No Lighter Shade Tint) */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase border shadow-sm"
          style={{
            background: "var(--badge-bg)",
            borderColor: "var(--badge-border)",
            color: "var(--badge-text)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.dotColor }} />
          <span>{category}</span>
        </span>
        {topAction}
      </div>

      {/* Main Title & Subtitle */}
      <div className="min-w-0">
        <h3
          className="text-[15px] md:text-base font-bold leading-snug tracking-tight line-clamp-2"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs font-mono mt-1 text-[var(--ink-3)] truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Metric / Progress track */}
      {(metricLabel || typeof progressPercent === "number") && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--ink-2)]">
            <span>{metricLabel ?? "Status"}</span>
            {metricValue && (
              <span className="font-mono font-semibold" style={{ color: "var(--ink)" }}>
                {metricValue}
              </span>
            )}
          </div>
          {typeof progressPercent === "number" && (
            <div
              className="h-1.5 w-full rounded-full border overflow-hidden"
              style={{
                background: "var(--track)",
                borderColor: "var(--border-subtle)",
              }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(Math.max(progressPercent, 5), 100)}%`,
                  background: isPrimary ? "var(--orange-primary)" : t.accent,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Extra child content */}
      {children}

      {/* Bottom row: Authentic Metadata Badge + Precision Action button */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
        <div>
          {badgeLabel && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-mono border"
              style={{
                background: "var(--badge-bg)",
                borderColor: "var(--badge-border)",
                color: "var(--badge-text)",
              }}
            >
              {badgeLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {extraActions}
          {actionLabel && actionHref ? (
            <a
              href={actionHref}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 ${
                isPrimary
                  ? "text-white hover:brightness-110 shadow-md shadow-orange-950/20"
                  : "border hover:opacity-85"
              }`}
              style={{
                background: isPrimary ? "var(--orange-primary)" : "var(--badge-bg)",
                borderColor: isPrimary ? "transparent" : "var(--badge-border)",
                color: isPrimary ? "#FFFFFF" : "var(--ink-2)",
              }}
            >
              {actionIcon}
              <span>{actionLabel}</span>
            </a>
          ) : actionLabel && onAction ? (
            <button
              onClick={onAction}
              disabled={actionDisabled}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-100 ${
                actionDisabled
                  ? "border shadow-none"
                  : isPrimary
                  ? "text-white hover:brightness-110 shadow-md shadow-orange-950/20"
                  : "border hover:opacity-85"
              }`}
              style={{
                background: actionDisabled ? "var(--btn-disabled-bg)" : isPrimary ? "var(--orange-primary)" : "var(--badge-bg)",
                borderColor: actionDisabled ? "var(--btn-disabled-border)" : isPrimary ? "transparent" : "var(--badge-border)",
                color: actionDisabled ? "var(--btn-disabled-text)" : isPrimary ? "#FFFFFF" : "var(--ink-2)",
              }}
            >
              {actionIcon}
              <span>{actionLabel}</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

