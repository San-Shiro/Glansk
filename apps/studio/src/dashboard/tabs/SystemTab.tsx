import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Archive, AlertTriangle, Link2, ShieldAlert, Copy, Check } from "lucide-react";
import { api } from "@/lib/api";
import type { ResetKind, Pairing } from "@/lib/types";
import { Button, Pill, Spinner, Modal, Field, TextInput } from "@/components/ui";
import { Card, SectionHeader } from "../primitives";

const RESETS: { kind: ResetKind; title: string; hint: string; tone: "warn" | "danger" }[] = [
  { kind: "editor", title: "Reset editor", hint: "Clears editor sessions. Canvases and runtime are preserved.", tone: "warn" },
  { kind: "runtime", title: "Reset runtime", hint: "Clears runtime activation state. Canvases are preserved.", tone: "warn" },
  { kind: "factory", title: "Factory reset", hint: "Deletes canvases, runtime and packages. A backup is taken first.", tone: "danger" },
];

export default function SystemTab() {
  const [resetKind, setResetKind] = useState<ResetKind | null>(null);
  return (
    <div className="space-y-8">
      <BackupSection />
      <div>
        <SectionHeader title="Reset & recovery" subtitle="Guarded, transactional operations. Each takes a backup and is journaled for rollback." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {RESETS.map(r => (
            <Card key={r.kind} className="p-4 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="h-8 w-8 grid place-items-center shrink-0"
                  style={{ background: r.tone === "danger" ? "var(--danger-soft)" : "var(--warn-soft)", color: r.tone === "danger" ? "var(--danger)" : "var(--warn)", borderRadius: "var(--radius)" }}>
                  {r.tone === "danger" ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
                </span>
                <span className="text-sm font-bold" style={{ color: "var(--ink)" }}>{r.title}</span>
              </div>
              <p className="text-[12px] mt-2 flex-1" style={{ color: "var(--ink-3)" }}>{r.hint}</p>
              <Button variant={r.tone === "danger" ? "danger" : "subtle"} className="mt-3 w-full" onClick={() => setResetKind(r.kind)}>{r.title}</Button>
            </Card>
          ))}
        </div>
      </div>
      <PairingSection />
      {resetKind && <ResetModal kind={resetKind} onClose={() => setResetKind(null)} />}
    </div>
  );
}

function BackupSection() {
  const [name, setName] = useState("");
  const [result, setResult] = useState<string>("");
  const [err, setErr] = useState("");
  const create = useMutation({
    mutationFn: () => api.createBackup(name.trim() || undefined),
    onSuccess: (r) => { setResult(r.path); setErr(""); setName(""); },
    onError: (e) => { setErr((e as Error).message); setResult(""); },
  });
  return (
    <div>
      <SectionHeader title="Backups" subtitle="Snapshot canvases, runtime and packages into a named, restorable backup." />
      <Card className="p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <Field label="Backup name" hint="Optional · a-z 0-9 . _ - (defaults to a timestamp)">
              <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="pre-release" />
            </Field>
          </div>
          <Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Spinner size={13} /> : <Archive size={13} />} Create backup
          </Button>
        </div>
        {result && <div className="text-[12px] mt-3 font-mono px-3 py-2" style={{ background: "var(--ok-soft)", color: "var(--ok)", borderRadius: "var(--radius)" }}>Backup saved → {result}</div>}
        {err && <div className="text-[12px] mt-3" style={{ color: "var(--danger)" }}>{err}</div>}
      </Card>
    </div>
  );
}

function PairingSection() {
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeToken, setRevokeToken] = useState("");
  const [revokeMsg, setRevokeMsg] = useState("");

  const create = useMutation({ mutationFn: api.createPairing, onSuccess: setPairing });
  const revoke = useMutation({
    mutationFn: () => api.revokePairing(revokeToken.trim()),
    onSuccess: () => { setRevokeMsg("Token revoked"); setRevokeToken(""); },
    onError: (e) => setRevokeMsg((e as Error).message),
  });

  return (
    <div>
      <SectionHeader title="Node pairing" subtitle="Issue a short-lived code so a display node can claim a runtime session." />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <Button variant="primary" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? <Spinner size={13} /> : <Link2 size={13} />} Generate pairing code
          </Button>
          {pairing && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-3)" }}>Code</span>
                <span className="text-2xl font-bold tabular-nums tracking-widest" style={{ color: "var(--accent)" }}>{pairing.code}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "var(--ink-3)" }}>Pairing ID</span>
                <button className="flex items-center gap-1.5 text-[12px] font-mono" style={{ color: "var(--ink-2)" }}
                  onClick={() => { navigator.clipboard.writeText(pairing.id); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>
                  {pairing.id} {copied ? <Check size={12} style={{ color: "var(--ok)" }} /> : <Copy size={12} />}
                </button>
              </div>
              <Pill tone="warn">Expires {new Date(pairing.expiresAt).toLocaleTimeString()}</Pill>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <Field label="Revoke session token" hint="Paste a bearer token to revoke its access.">
            <TextInput value={revokeToken} onChange={e => setRevokeToken(e.target.value)} placeholder="token…" />
          </Field>
          <Button variant="subtle" className="mt-3" onClick={() => { setRevokeMsg(""); revoke.mutate(); }} disabled={!revokeToken.trim() || revoke.isPending}>
            {revoke.isPending ? <Spinner size={13} /> : <ShieldAlert size={13} />} Revoke
          </Button>
          {revokeMsg && <div className="text-[12px] mt-2" style={{ color: "var(--ink-2)" }}>{revokeMsg}</div>}
        </Card>
      </div>
    </div>
  );
}

function ResetModal({ kind, onClose }: { kind: ResetKind; onClose: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [done, setDone] = useState<string>("");
  const challengeQ = useQuery({ queryKey: ["reset-challenge", kind], queryFn: () => api.resetChallenge(kind), retry: false, gcTime: 0 });
  const phrase = challengeQ.data?.phrase ?? "";

  const execute = useMutation({
    mutationFn: () => api.resetExecute(kind, challengeQ.data!.token, confirmation),
    onSuccess: (tx) => setDone(tx.state),
  });

  return (
    <Modal title={`Confirm ${kind} reset`} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!phrase || confirmation !== phrase || execute.isPending || !!done} onClick={() => execute.mutate()}>
          {execute.isPending ? <Spinner size={13} /> : "Execute reset"}
        </Button>
      </>}>
      {challengeQ.isLoading ? <div className="grid place-items-center py-6"><Spinner size={18} /></div> : done ? (
        <div className="text-[13px] px-3 py-2" style={{ background: "var(--ok-soft)", color: "var(--ok)", borderRadius: "var(--radius)" }}>
          Reset {done}. You may need to reload.
        </div>
      ) : challengeQ.isError ? (
        <div className="text-[12px]" style={{ color: "var(--danger)" }}>Could not start reset: {(challengeQ.error as Error).message}</div>
      ) : (
        <>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            This is a guarded operation. Type the exact confirmation phrase below to proceed.
          </p>
          <div className="text-center text-sm font-bold font-mono py-2 px-3 my-1" style={{ background: "var(--danger-soft)", color: "var(--danger)", borderRadius: "var(--radius)" }}>{phrase}</div>
          <Field label="Confirmation phrase"><TextInput autoFocus value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder={phrase} /></Field>
          {execute.isError && <div className="text-[12px]" style={{ color: "var(--danger)" }}>{(execute.error as Error).message}</div>}
        </>
      )}
    </Modal>
  );
}
