"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { isIos, isStandalone } from "@/lib/ios";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "bt:install-dismissed";

/** Convida a instalar o app: botão no Android/Chrome; instruções no iPhone (Safari). */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* sem armazenamento */
    }
    if (dismissed || isStandalone()) return;
    const ios = isIos() && !/crios|fxios/i.test(navigator.userAgent);
    setIos(ios);
    setHidden(!ios);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sem armazenamento */
    }
  };

  if (hidden) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-dashed border-bandeira-500/50 bg-bandeira-50 p-3 text-sm dark:bg-bandeira-500/10">
      <Download className="size-5 shrink-0 text-bandeira-600 dark:text-bandeira-100" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Instale o BoraTreinar no celular</p>
        {ios ? (
          <p className="text-xs text-muted">
            No Safari, toque em <Share className="inline size-3.5" aria-label="Compartilhar" /> e depois em “Adicionar à Tela de Início”.
          </p>
        ) : (
          <p className="text-xs text-muted">Abre como app, mais rápido e funciona até sem internet durante o treino.</p>
        )}
      </div>
      {event && (
        <button
          type="button"
          onClick={async () => {
            await event.prompt();
            await event.userChoice;
            setEvent(null);
            setHidden(true);
          }}
          className="shrink-0 rounded-xl bg-bandeira-500 px-3 py-2 font-display font-bold text-white hover:bg-bandeira-600"
        >
          Instalar
        </button>
      )}
      <button type="button" onClick={dismiss} className="shrink-0 rounded-lg p-1 text-muted hover:text-foreground" aria-label="Dispensar">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
