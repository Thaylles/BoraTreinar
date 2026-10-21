"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** No celular só o #conteudo rola: ao trocar de página, volta ao topo (exceto com âncora #…). */
export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.location.hash) return;
    document.getElementById("conteudo")?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
