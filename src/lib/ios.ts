/** iPhone/iPad (o iPadOS se apresenta como Mac, mas tem tela de toque). Só no navegador. */
export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Aberto como app instalado na tela de início (PWA). */
export function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
