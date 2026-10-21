"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { generateGif, generateMissingGifs, refreshAiVideos, startAiVideo } from "./actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClass } from "@/components/ui/field";
import { PUBLIC_DB } from "@/lib/exercise-media";
import { cn } from "@/lib/cn";

/** GIF do banco público para um exercício (a correspondência sugerida pode ser trocada). */
export function GifForm({ equipmentId, suggestion }: { equipmentId: string; suggestion: string | null }) {
  const [state, action] = useActionState(generateGif, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="equipment_id" value={equipmentId} />
      <label className="block text-xs font-semibold text-muted">
        Exercício no banco público ({" "}
        <a href={`${PUBLIC_DB.url}/tree/main/exercises`} target="_blank" rel="noopener noreferrer" className="underline">
          ver lista
        </a>
        )
        <input
          name="dataset_id"
          defaultValue={suggestion ?? ""}
          required
          placeholder="Ex.: Barbell_Curl"
          className={cn(inputClass, "mt-1 py-2 text-sm font-normal")}
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="secondary" pendingText="Gerando GIF…">
        <Wand2 className="size-4" aria-hidden /> Gerar GIF
      </SubmitButton>
    </form>
  );
}

/** Converte a foto do exercício em JPEG (base64) no navegador: a IA não aceita WebP. */
async function photoAsJpeg(src: string): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
}

/** "Gerar vídeo com IA" a partir da foto atual do exercício. */
export function AiVideoButton({ equipmentId, photo }: { equipmentId: string; photo: string | null }) {
  const [state, setState] = useState<{ error?: string; ok?: string }>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (!photo) return <p className="text-xs text-muted">Sem foto: adicione uma foto ao exercício para gerar vídeo com IA.</p>;
  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => {
          if (!confirm("Gerar vídeo com IA? Cada vídeo é cobrado na conta do Google (Gemini) por segundo gerado.")) return;
          startTransition(async () => {
            try {
              setState(await startAiVideo(equipmentId, await photoAsJpeg(photo)));
              router.refresh();
            } catch {
              setState({ error: "Não foi possível ler a foto do exercício." });
            }
          });
        }}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />} Gerar vídeo com IA
      </Button>
      <FormMessage state={state} />
    </div>
  );
}

/** Gera os GIFs que faltam, em lotes, até acabar (mostra o progresso). */
export function BatchGifs({ missing }: { missing: number }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const router = useRouter();
  if (!missing && !log) return null;
  async function run() {
    setRunning(true);
    let total = 0;
    const errors: string[] = [];
    try {
      for (let round = 0; round < 20; round++) {
        const r = await generateMissingGifs(6);
        total += r.done;
        errors.push(...r.errors);
        setLog(`${total} GIF(s) gerado(s)… faltam ${r.left}`);
        router.refresh();
        if (!r.left || (!r.done && r.errors.length)) break;
      }
      setLog(`Pronto: ${total} GIF(s) gerado(s).${errors.length ? ` Falharam: ${errors.join("; ")}` : ""}`);
    } finally {
      setRunning(false);
    }
  }
  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-sm">
      {missing > 0 && (
        <Button type="button" onClick={run} disabled={running}>
          {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Wand2 className="size-4" aria-hidden />}
          Gerar GIFs do banco público para os {missing} sem execução
        </Button>
      )}
      {log && <p className="mt-2 text-muted">{log}</p>}
    </div>
  );
}

/** Enquanto houver vídeo de IA em produção, confere a cada 15 s e atualiza a página quando ficar pronto. */
export function AiPoller({ pending }: { pending: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      const r = await refreshAiVideos().catch(() => null);
      if (r?.finished) router.refresh();
    }, 15_000);
    return () => clearInterval(t);
  }, [pending, router]);
  if (!pending) return null;
  return (
    <p className="mb-4 flex items-center gap-2 rounded-2xl bg-ipe-100 px-4 py-3 text-sm dark:bg-ipe-500/15">
      <Loader2 className="size-4 animate-spin" aria-hidden /> {pending} vídeo(s) de IA em produção. Esta página atualiza sozinha.
    </p>
  );
}
