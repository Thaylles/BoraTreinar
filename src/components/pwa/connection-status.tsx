"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/** Aviso discreto quando o aparelho fica sem internet. */
export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-anil-700 px-4 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] text-xs font-semibold text-white"
    >
      <WifiOff className="size-3.5" aria-hidden /> Sem internet: seu treino fica salvo no aparelho e sincroniza depois.
    </div>
  );
}
