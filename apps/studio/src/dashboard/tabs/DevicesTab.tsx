import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cpu, Zap, Power } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button, Pill, Spinner } from "@/components/ui";
import { Card, SectionHeader, EmptyState, KeyValue } from "../primitives";

export default function DevicesTab() {
  const statusQ = useQuery({ queryKey: ["devices"], queryFn: api.deviceStatus, retry: false });

  if (statusQ.isLoading) return <div className="grid place-items-center py-16"><Spinner size={22} /></div>;

  if (statusQ.isError) {
    const denied = statusQ.error instanceof ApiError && (statusQ.error.status === 401 || statusQ.error.status === 403);
    return (
      <EmptyState icon={<Cpu size={30} />} title={denied ? "Device control not permitted" : "Device broker unavailable"}
        hint={denied ? "Your session lacks the device:control grant." : "The GPIO broker did not respond."} />
    );
  }

  const status = statusQ.data!;
  return (
    <div className="space-y-6">
      <SectionHeader title="Devices & GPIO" subtitle="Logical pins are brokered — widget UIs request named capabilities; physical pins belong to node policy." />

      <Card className="p-4 max-w-md">
        <KeyValue k="Provider" v={status.provider} />
        <KeyValue k="Status" v={<Pill tone={status.status === "running" ? "ok" : "warn"}>{status.status}</Pill>} />
        <KeyValue k="Allowed pins" v={status.allowedPins.length} />
      </Card>

      <div>
        <h3 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--ink-2)" }}>Pins</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {status.allowedPins.map(pin => <PinTile key={pin} pin={pin} />)}
        </div>
      </div>
    </div>
  );
}

function PinTile({ pin }: { pin: number }) {
  const qc = useQueryClient();
  const pinQ = useQuery({ queryKey: ["pin", pin], queryFn: () => api.readPin(pin), refetchInterval: 4000 });
  const write = useMutation({
    mutationFn: (value: 0 | 1) => api.writePin(pin, value),
    onSuccess: (s) => { qc.setQueryData(["pin", pin], s); },
  });
  const value = pinQ.data?.value ?? 0;
  const high = value === 1;

  return (
    <Card className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 grid place-items-center shrink-0"
          style={{ background: high ? "var(--ok-soft)" : "var(--panel-2)", color: high ? "var(--ok)" : "var(--ink-3)", borderRadius: "var(--radius)" }}>
          <Zap size={16} />
        </span>
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--ink)" }}>GPIO {pin}</div>
          <div className="text-[11px] font-mono" style={{ color: "var(--ink-3)" }}>{pinQ.isLoading ? "reading…" : high ? "HIGH · 1" : "LOW · 0"}</div>
        </div>
      </div>
      <Button variant={high ? "primary" : "subtle"} onClick={() => write.mutate(high ? 0 : 1)} disabled={write.isPending}>
        {write.isPending ? <Spinner size={12} /> : <Power size={13} />} {high ? "On" : "Off"}
      </Button>
    </Card>
  );
}
