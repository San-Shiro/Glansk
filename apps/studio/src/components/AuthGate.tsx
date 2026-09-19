import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, KeyRound } from "lucide-react";
import { api, getToken, ApiError } from "@/lib/api";
import { Button, TextInput, Spinner } from "@/components/ui";

// Canvas/runtime routes are open; we validate an existing token against the
// admin-only /api/audit endpoint. No token (or an invalid one) => show login.
export default function AuthGate({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const auth = useQuery({
    queryKey: ["auth"],
    retry: false,
    queryFn: async () => {
      if (!getToken()) return { ok: false } as const;
      try { await api.audit(); return { ok: true } as const; }
      catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return { ok: false } as const; throw e; }
    },
  });

  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (auth.isLoading) {
    return <div className="h-full grid place-items-center"><Spinner size={22} /></div>;
  }
  if (auth.data?.ok) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await api.login(secret); await qc.invalidateQueries({ queryKey: ["auth"] }); }
    catch { setError("Incorrect admin secret."); }
    finally { setBusy(false); }
  };

  return (
    <div className="h-full grid place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm border p-6 animate-fade-in" style={{ background: "var(--panel)", borderColor: "var(--line)", borderRadius: "var(--radius)" }}>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-9 w-9 grid place-items-center" style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--radius)" }}>
            <LayoutGrid size={18} />
          </div>
          <div>
            <div className="text-base font-bold leading-none" style={{ color: "var(--ink)" }}>Glansk Studio</div>
            <div className="text-[12px] mt-1" style={{ color: "var(--ink-3)" }}>Sign in to continue</div>
          </div>
        </div>
        <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--ink-3)" }}>Admin secret</label>
        <div className="relative">
          <KeyRound size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-3)" }} />
          <TextInput type="password" autoFocus value={secret} onChange={e => setSecret(e.target.value)} placeholder="glansk-dev" style={{ paddingLeft: 30 }} />
        </div>
        {error && <div className="text-[12px] mt-2" style={{ color: "var(--danger)" }}>{error}</div>}
        <Button type="submit" variant="primary" disabled={busy || !secret} className="w-full mt-4">
          {busy ? <Spinner size={14} /> : "Sign in"}
        </Button>
        <p className="text-[11px] mt-3 text-center" style={{ color: "var(--ink-3)" }}>Local dev secret is <code>glansk-dev</code></p>
      </form>
    </div>
  );
}
