"use client";

import { useEffect } from "react";

/** Registra o service worker (só em produção, para não atrapalhar o desenvolvimento). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("Service worker não registrado:", e));
  }, []);
  return null;
}
