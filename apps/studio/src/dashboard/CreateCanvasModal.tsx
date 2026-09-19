import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, CANVAS_LIMITS } from "@/lib/api";
import { Button, Field, Modal, Select, TextInput, Spinner } from "@/components/ui";

/** Shared "new canvas" dialog used by the shell, Overview and Canvases tabs. */
export default function CreateCanvasModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [size, setSize] = useState("1920x1080");
  const [err, setErr] = useState("");
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 128);
  const effectiveId = id || slug(name);

  const create = useMutation({
    mutationFn: async () => {
      const [w, h] = size.split("x").map(Number);
      if (!CANVAS_LIMITS.id.test(effectiveId)) throw new Error("Invalid id (use a-z, 0-9, . _ -)");
      return api.createCanvas({ id: effectiveId, name: name || effectiveId, logicalSize: { width: w, height: h } });
    },
    onSuccess: () => onCreated(effectiveId),
    onError: (e) => setErr((e as Error).message),
  });

  return (
    <Modal title="New canvas" onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!effectiveId || create.isPending} onClick={() => { setErr(""); create.mutate(); }}>
          {create.isPending ? <Spinner size={13} /> : "Create & edit"}
        </Button>
      </>}>
      <Field label="Name"><TextInput autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Command Center" /></Field>
      <Field label="ID" hint="Lowercase; a-z 0-9 . _ -"><TextInput value={effectiveId} onChange={e => setId(slug(e.target.value))} placeholder="command-center" /></Field>
      <Field label="Size">
        <Select value={size} onChange={e => setSize(e.target.value)}>
          <option value="1920x1080">1920 × 1080</option>
          <option value="1280x720">1280 × 720</option>
          <option value="1024x600">1024 × 600</option>
          <option value="800x480">800 × 480</option>
          <option value="1080x1920">1080 × 1920 (portrait)</option>
        </Select>
      </Field>
      {err && <div className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</div>}
    </Modal>
  );
}
