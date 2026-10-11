"use client";

import { useEffect } from "react";
import { LogoMark } from "@/components/brand/Logo";

/** Erro inesperado em qualquer tela: mensagem amigável e opção de tentar de novo. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return (
    <main className="bg-calcadao flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <LogoMark size={64} />
      <h1 className="font-display text-3xl font-extrabold">{offline ? "Sem internet no momento" : "Ops, algo deu errado"}</h1>
      <p className="max-w-sm text-muted">
        {offline
          ? "Confira a conexão e tente de novo. Treinos em andamento continuam salvos no aparelho."
          : "Não foi culpa sua. Tente de novo; se continuar, avise seu Personal ou o suporte."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-2xl bg-bandeira-500 px-5 py-3 font-display font-bold text-white hover:bg-bandeira-600"
      >
        Tentar de novo
      </button>
      {error.digest && <p className="text-xs text-muted">Código: {error.digest}</p>}
    </main>
  );
}
