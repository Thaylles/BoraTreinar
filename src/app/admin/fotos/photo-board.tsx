"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { generatePhoto, savePhoto } from "./actions";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export type PhotoItem = {
  id: string;
  name: string;
  group: string;
  owner: string | null;
  src: string | null;
  status: "sem" | "fora" | "ok";
};

type Draft = { pending?: boolean; image?: string; error?: string; saved?: boolean };

/** Converte a imagem da IA para WebP 1024×764 (JPEG no Safari, que não gera WebP). */
async function toCatalogFormat(dataUrl: string): Promise<string> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const W = 1024;
  const H = 764;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const webp = canvas.toDataURL("image/webp", 0.86);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.9);
}

/** Exercícios sem foto ou fora do padrão: gera com IA, confere e aprova (uma a uma ou em lote). */
export function PhotoBoard({ items }: { items: PhotoItem[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [hints, setHints] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState(false);
  const set = (id: string, d: Draft) => setDrafts((all) => ({ ...all, [id]: d }));

  async function generate(id: string) {
    set(id, { pending: true });
    try {
      const res = await generatePhoto(id, hints[id] ?? "");
      set(id, res.image ? { image: res.image } : { error: res.error ?? "Erro ao gerar." });
      return !res.error;
    } catch {
      // Página aberta antes de uma atualização do site (ação antiga) ou sem internet.
      set(id, { error: "Não deu para falar com o servidor. Recarregue a página e tente de novo (o site pode ter sido atualizado)." });
      return false;
    }
  }

  async function approve(id: string) {
    const d = drafts[id];
    if (!d?.image) return;
    set(id, { ...d, pending: true });
    try {
      const res = await savePhoto(id, await toCatalogFormat(d.image));
      set(id, res?.error ? { ...d, error: res.error } : { saved: true });
      if (!res?.error) router.refresh();
    } catch {
      set(id, { ...d, error: "Não foi possível preparar a imagem." });
    }
  }

  async function generateAll() {
    if (!confirm(`Gerar fotos com IA para ${todo.length} exercícios? Cada imagem é cobrada na conta do Google (Gemini).`)) return;
    setBatch(true);
    for (const it of todo) {
      const ok = await generate(it.id);
      if (!ok) break; // erro de chave/limite: para o lote
    }
    setBatch(false);
  }

  const todo = items.filter((it) => !drafts[it.id]?.image && !drafts[it.id]?.saved);

  return (
    <>
      {todo.length > 1 && (
        <Button type="button" variant="secondary" className="mb-4" disabled={batch} onClick={generateAll}>
          {batch ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {batch ? "Gerando, uma por vez…" : `Gerar com IA as ${todo.length} que faltam`}
        </Button>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((it) => {
          const d = drafts[it.id] ?? {};
          return (
            <li key={it.id} className="rounded-3xl border border-border bg-surface p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{it.name}</p>
                  <p className="text-xs text-muted">
                    {it.group}
                    {it.owner && ` · exercício de ${it.owner}`}
                  </p>
                </div>
                {d.saved ? (
                  <Badge tone="green">Aprovada ✅</Badge>
                ) : it.status === "sem" ? (
                  <Badge tone="red">Sem foto</Badge>
                ) : it.status === "fora" ? (
                  <Badge tone="yellow">Fora do padrão</Badge>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <figure>
                  <figcaption className="mb-1 text-[11px] font-semibold text-muted">Atual</figcaption>
                  {it.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.src} alt="" className="aspect-[4/3] w-full rounded-xl bg-white object-contain" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-border/40 text-muted">
                      <ImageOff className="size-6" aria-label="Sem foto" />
                    </div>
                  )}
                </figure>
                <figure>
                  <figcaption className="mb-1 text-[11px] font-semibold text-muted">Gerada com IA</figcaption>
                  <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-white">
                    {d.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.image} alt={`Prévia: ${it.name}`} className="size-full object-contain" />
                    ) : d.pending ? (
                      <Loader2 className="size-6 animate-spin text-muted" aria-label="Gerando" />
                    ) : (
                      <Sparkles className="size-6 text-muted/50" aria-hidden />
                    )}
                    {d.image && d.pending && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                        <Loader2 className="size-6 animate-spin" aria-label="Salvando" />
                      </div>
                    )}
                  </div>
                </figure>
              </div>
              {!d.saved && (
                <div className="mt-3 space-y-2">
                  <input
                    value={hints[it.id] ?? ""}
                    onChange={(e) => setHints((h) => ({ ...h, [it.id]: e.target.value }))}
                    maxLength={300}
                    placeholder="Como é o exercício? (opcional, ajuda a IA)"
                    aria-label={`Dica para a IA: ${it.name}`}
                    className={cn(inputClass, "py-2 text-sm")}
                  />
                  {d.error && <p className="text-sm text-pitanga-600">{d.error}</p>}
                  <div className="flex gap-2">
                    {d.image && (
                      <Button type="button" size="sm" className="flex-1" disabled={d.pending} onClick={() => approve(it.id)}>
                        <Check className="size-4" aria-hidden /> Aprovar
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant={d.image ? "ghost" : "secondary"}
                      className="flex-1"
                      disabled={d.pending || batch}
                      onClick={() => generate(it.id)}
                    >
                      {d.image ? <RefreshCw className="size-4" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                      {d.image ? "Gerar outra" : "Gerar com IA"}
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
