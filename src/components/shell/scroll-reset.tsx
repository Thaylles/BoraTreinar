"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Posição de rolagem de cada página visitada (para o "voltar" do navegador). */
const positions = new Map<string, number>();

/**
 * No celular só o #conteudo rola: ao abrir uma página, volta ao topo (exceto com âncora #…);
 * ao voltar (botão ou gesto de deslizar do Safari), devolve a página onde ela estava.
 */
export function ScrollReset() {
  const pathname = usePathname();
  const back = useRef(false);

  useEffect(() => {
    const onPop = () => {
      back.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useLayoutEffect(() => {
    const el = document.getElementById("conteudo");
    if (!el) return;
    if (back.current) {
      back.current = false;
      const top = positions.get(pathname) ?? 0;
      el.scrollTo({ top });
      requestAnimationFrame(() => el.scrollTo({ top }));
    } else if (!window.location.hash) {
      el.scrollTo({ top: 0 });
    }
    const save = () => positions.set(pathname, el.scrollTop);
    el.addEventListener("scroll", save, { passive: true });
    return () => el.removeEventListener("scroll", save);
  }, [pathname]);

  return null;
}
