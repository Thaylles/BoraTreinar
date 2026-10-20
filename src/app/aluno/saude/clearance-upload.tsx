"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { FormMessage } from "@/components/ui/alert";
import { setClearance } from "./actions";

const MAX = 5 * 1024 * 1024;

/** Envio da liberação médica (PDF ou foto), guardada em arquivo privado. */
export function ClearanceUpload({ userId, hasFile, url }: { userId: string; hasFile: boolean; url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>();
  const router = useRouter();

  function upload(file: File) {
    setState(undefined);
    start(async () => {
      try {
        let body: Blob = file;
        let ext = "pdf";
        if (file.type !== "application/pdf") {
          body = await compressImage(file, 1800, 0.85);
          ext = body.type === "image/webp" ? "webp" : "jpg";
        }
        if (body.size > MAX) return setState({ error: "Arquivo muito grande (máx. 5 MB)." });
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient().storage.from("medical").upload(path, body, { contentType: body.type || "application/pdf" });
        if (error) throw error;
        setState(await setClearance(path));
        router.refresh();
      } catch {
        setState({ error: "Não foi possível enviar o arquivo. Tente uma foto (JPG/PNG) ou um PDF." });
      }
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 rounded-2xl bg-bandeira-500 px-4 py-2.5 font-display font-bold text-white hover:bg-bandeira-600 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {hasFile ? "Trocar liberação médica" : "Enviar liberação médica"}
        </button>
        {hasFile && url && (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-2xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-bandeira-500">
            Ver arquivo enviado
          </a>
        )}
        {hasFile && (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm("Remover a liberação médica enviada?") && start(async () => (setState(await setClearance(null)), router.refresh()))}
            className="inline-flex items-center gap-1 rounded-2xl px-3 py-2.5 text-sm font-semibold text-muted hover:text-pitanga-600"
          >
            <Trash2 className="size-4" aria-hidden /> Remover
          </button>
        )}
      </div>
      <p className="text-xs text-muted">PDF ou foto do atestado/liberação. Só você e seus Personais conseguem ver.</p>
      <FormMessage state={state} />
    </div>
  );
}
