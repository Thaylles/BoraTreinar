"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone } from "lucide-react";
import type { AppRelease } from "@/lib/app-release";
import { isIos } from "@/lib/ios";

const SEEN_KEY = "bt:app-versao-baixada";

/**
 * App Android: mostra a versão mais nova e o botão de baixar.
 * Quando sai uma versão depois da última que a pessoa baixou neste navegador, destaca "Nova versão".
 */
export function AppDownload() {
  const [release, setRelease] = useState<AppRelease | null>(null);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    if (isIos()) return;
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY)) || 0);
    } catch {
      /* sem armazenamento */
    }
    fetch("/api/app/versao")
      .then((r) => r.json())
      .then((r: AppRelease) => r.versionCode > 0 && r.url && setRelease(r))
      .catch(() => {});
  }, []);

  if (!release) return null;
  const isNew = seen > 0 && release.versionCode > seen;
  const date = release.publishedAt ? new Date(release.publishedAt).toLocaleDateString("pt-BR") : "";
  return (
    <div className={`mb-4 flex items-center gap-3 rounded-2xl border-2 p-3 text-sm ${isNew ? "border-ipe-500 bg-ipe-100/60 dark:bg-ipe-500/10" : "border-border bg-surface"}`}>
      <Smartphone className="size-5 shrink-0 text-bandeira-600 dark:text-bandeira-100" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{isNew ? "Nova versão do app Android 🎉" : "App Android do BoraTreinar"}</p>
        <p className="text-xs text-muted">
          Versão {release.versionName}
          {date ? ` · ${date}` : ""}
          {release.sizeMb ? ` · ${release.sizeMb} MB` : ""}
          {isNew ? ". Baixe e instale por cima, sem desinstalar." : ". Funciona sem internet e sincroniza com o Health Connect."}
        </p>
      </div>
      <a
        href={release.url}
        onClick={() => {
          try {
            localStorage.setItem(SEEN_KEY, String(release.versionCode));
          } catch {
            /* sem armazenamento */
          }
          setSeen(release.versionCode);
        }}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-bandeira-500 px-3 py-2 font-display font-bold text-white hover:bg-bandeira-600"
      >
        <Download className="size-4" aria-hidden /> {isNew ? "Atualizar" : "Baixar"}
      </a>
    </div>
  );
}
