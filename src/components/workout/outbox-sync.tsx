"use client";

import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { outbox } from "@/lib/outbox";
import { saveSession } from "@/app/treino-actions";

/** Envia treinos que ficaram salvos só no aparelho assim que houver internet. */
export function OutboxSync() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let running = false;
    async function flush() {
      if (running || !navigator.onLine) return;
      running = true;
      for (const item of outbox.list()) {
        try {
          const res = await saveSession(item);
          // Erro de validação não se resolve tentando de novo: descarta para não travar a fila.
          outbox.remove(item.client_id);
          if (!res.ok) console.warn("Treino offline rejeitado:", res.error);
        } catch {
          break; // ainda sem conexão
        }
      }
      setPending(outbox.list().length);
      running = false;
    }
    setPending(outbox.list().length);
    flush();
    window.addEventListener("online", flush);
    const t = setInterval(flush, 60_000);
    return () => {
      window.removeEventListener("online", flush);
      clearInterval(t);
    };
  }, []);

  if (!pending) return null;
  return (
    <div className="mb-4 flex items-center gap-2 rounded-2xl bg-ipe-100 px-4 py-3 text-sm text-anil-900 dark:bg-ipe-500/15 dark:text-ipe-400" role="status">
      <CloudUpload className="size-4 shrink-0" aria-hidden />
      {pending === 1 ? "1 treino salvo no aparelho" : `${pending} treinos salvos no aparelho`}, aguardando internet para sincronizar.
    </div>
  );
}
