import { useQuery } from "@tanstack/react-query";
import { Info, HeartPulse, Github, BookOpen } from "lucide-react";
import { Card, SectionHeader, KeyValue } from "../primitives";
import { Pill } from "@/components/ui";

export default function AboutTab() {
  const healthQ = useQuery({
    queryKey: ["health"],
    queryFn: async () => { const r = await fetch("/health"); return r.ok ? r.json() : Promise.reject(new Error("down")); },
    refetchInterval: 15000, retry: false,
  });
  const ok = healthQ.data?.status === "ok";

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionHeader title="About Glansk" subtitle="Linux-first, beauty-first dashboard platform for embedded and HDMI displays." />

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="h-10 w-10 grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--radius)" }}>
            <Info size={20} />
          </span>
          <div>
            <div className="text-base font-bold" style={{ color: "var(--ink)" }}>Glansk Studio</div>
            <div className="text-[12px]" style={{ color: "var(--ink-3)" }}>Admin control panel</div>
          </div>
        </div>
        <KeyValue k="Core health" v={<Pill tone={ok ? "ok" : "danger"}><HeartPulse size={10} /> {ok ? "healthy" : "unreachable"}</Pill>} />
        <KeyValue k="Renderer" v="WPE WebKit / Cog (reference)" />
        <KeyValue k="Wire encoding" v="CBOR (canonical) · JSON for human formats" />
        <KeyValue k="Canvas model" v="Fixed logical-pixel · immutable publications" />
      </Card>

      <Card className="p-5">
        <h3 className="text-[13px] font-bold uppercase tracking-wide mb-3" style={{ color: "var(--ink-2)" }}>Principles</h3>
        <ul className="space-y-2 text-[13px]" style={{ color: "var(--ink-2)" }}>
          <li>• Beauty before artificial portability — the reference web result is authoritative.</li>
          <li>• Contracts before components — protocol, schemas and lifecycle precede implementations.</li>
          <li>• Least authority by default — deny is the default; grants are narrow and audited.</li>
          <li>• Transactional change — validate and stage before atomic activation; keep last-known-good.</li>
          <li>• Fail closed, recover visibly — unknown capability or stale revision is denied with a diagnostic.</li>
        </ul>
      </Card>

      <div className="flex items-center gap-4 text-[12px]" style={{ color: "var(--ink-3)" }}>
        <span className="flex items-center gap-1.5"><BookOpen size={13} /> plan/ design baseline</span>
        <span className="flex items-center gap-1.5"><Github size={13} /> PiDashboard / Glansk</span>
      </div>
    </div>
  );
}
