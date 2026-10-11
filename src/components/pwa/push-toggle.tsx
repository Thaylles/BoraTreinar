"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { deletePushSubscription, savePushSubscription } from "@/app/push-actions";


type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Liga/desliga as notificações no celular (Web Push) para este aparelho. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) {
      // iPhone/iPad: só funciona com o app instalado na tela de início (iOS 16.4+).
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setState(ios && !standalone ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  function enable() {
    setError(null);
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const { publicKey } = (await fetch("/api/push/key").then((r) => r.json())) as { publicKey: string | null };
          if (!publicKey) return setError("Notificações indisponíveis no momento.");
          sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        }
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const res = await savePushSubscription(json, navigator.userAgent);
        if (res.error) return setError(res.error);
        setState("on");
      } catch {
        setError("Não foi possível ativar neste aparelho.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe().catch(() => undefined);
      }
      setState("off");
    });
  }

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-sm">
      {state === "on" ? <Bell className="size-5 shrink-0 text-bandeira-500" aria-hidden /> : <BellOff className="size-5 shrink-0 text-muted" aria-hidden />}
      <span className="min-w-0 flex-1">
        {state === "on" && "Notificações no celular ativadas."}
        {state === "off" && "Receba avisos de treino, ficha nova e aulas no celular."}
        {state === "denied" && "Notificações bloqueadas. Libere nas configurações do navegador para este site."}
        {state === "ios-install" && "No iPhone, adicione o BoraTreinar à Tela de Início (Compartilhar → Adicionar à Tela de Início) para receber notificações."}
        {error && <span className="block text-pitanga-600">{error}</span>}
      </span>
      {(state === "off" || state === "on") && (
        <button
          type="button"
          onClick={state === "on" ? disable : enable}
          disabled={pending}
          className={
            state === "on"
              ? "shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold text-muted hover:bg-border/50"
              : "shrink-0 rounded-xl bg-bandeira-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-bandeira-600"
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Aguarde" /> : state === "on" ? "Desativar" : "Ativar"}
        </button>
      )}
    </div>
  );
}
