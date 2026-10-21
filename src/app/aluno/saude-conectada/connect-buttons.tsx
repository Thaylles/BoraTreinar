"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { connectHealthApp } from "./actions";

/** "Conectar" (gera o token e abre o app Android) e "Sincronizar agora" (abre o app com o token salvo). */
export function ConnectButtons({ connected, syncUrl }: { connected: boolean; syncUrl: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      {connected && (
        <a href={syncUrl} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-bandeira-500 py-3 font-display font-bold text-white hover:bg-bandeira-600">
          <RefreshCw className="size-5" aria-hidden /> Sincronizar agora
        </a>
      )}
      <Button
        type="button"
        variant={connected ? "ghost" : "primary"}
        size={connected ? "sm" : "lg"}
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await connectHealthApp();
            if (r.url) window.location.href = r.url;
            else setError(r.error ?? "Não foi possível conectar.");
          })
        }
      >
        {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Smartphone className="size-5" aria-hidden />}
        {connected ? "Conectar de novo (outro celular ou app reinstalado)" : "Conectar com o Health Connect"}
      </Button>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
