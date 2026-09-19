import { useQuery } from "@tanstack/react-query";
import { ScrollText, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { AuditEvent } from "@/lib/types";
import { Button, Pill, Spinner } from "@/components/ui";
import { Card, SectionHeader, EmptyState } from "../primitives";

const OUTCOME_TONE = { allowed: "ok", denied: "danger", failed: "warn" } as const;

export default function AuditTab() {
  const auditQ = useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 10000 });
  const events: AuditEvent[] = (auditQ.data ?? []).slice().reverse();

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Audit log"
        subtitle="Every privileged action is recorded with actor and outcome."
        action={<Button variant="subtle" onClick={() => auditQ.refetch()} disabled={auditQ.isFetching}>
          {auditQ.isFetching ? <Spinner size={12} /> : <RefreshCw size={13} />} Refresh
        </Button>}
      />
      {auditQ.isLoading ? (
        <div className="grid place-items-center py-16"><Spinner size={22} /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={<ScrollText size={30} />} title="No audit events yet" hint="Privileged operations will appear here as they happen." />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-4 py-2.5 flex items-center text-[11px] font-semibold uppercase tracking-wide" style={{ background: "var(--panel-2)", color: "var(--ink-3)", borderBottom: "1px solid var(--line)" }}>
            <span className="w-40 shrink-0">Time</span>
            <span className="w-32 shrink-0">Actor</span>
            <span className="flex-1">Action</span>
            <span className="w-24 text-right shrink-0">Outcome</span>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {events.map((e, i) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center text-[12px]" style={i < events.length - 1 ? { borderBottom: "1px solid var(--line)" } : {}}>
                <span className="w-40 shrink-0 font-mono" style={{ color: "var(--ink-3)" }}>{new Date(e.at).toLocaleString()}</span>
                <span className="w-32 shrink-0 font-mono truncate" style={{ color: "var(--ink-2)" }}>{e.actor}</span>
                <span className="flex-1 font-mono truncate" style={{ color: "var(--ink)" }}>{e.action}</span>
                <span className="w-24 text-right shrink-0"><Pill tone={OUTCOME_TONE[e.outcome] ?? "neutral"}>{e.outcome}</Pill></span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
