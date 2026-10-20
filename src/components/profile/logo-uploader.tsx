"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, imageReadError, isHeic } from "@/lib/image";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/avatar";
import { setLogo } from "@/app/perfil-actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";

/** Logo do Personal (PNG com fundo transparente fica melhor). Aparece no topo do app dos alunos dele. */
export function LogoUploader({ userId, name, path }: { userId: string; name: string; path: string | null }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>();
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const src = preview ?? avatarUrl(path);

  function upload(file: File) {
    setState(undefined);
    if (!file.type.startsWith("image/") && !isHeic(file)) return setState({ error: "Escolha um arquivo de imagem (PNG, JPG, WebP ou SVG)." });
    if (file.size > 20 * 1024 * 1024) return setState({ error: "Imagem muito grande (máx. 20 MB)." });
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      let blob: Blob;
      try {
        blob = await compressImage(file, 600, 0.9);
      } catch {
        setPreview(null);
        return setState({ error: imageReadError(file) });
      }
      try {
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const newPath = `${userId}/logo-${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient()
          .storage.from(AVATAR_BUCKET)
          .upload(newPath, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        setState(await setLogo(newPath));
        router.refresh();
      } catch {
        setPreview(null);
        setState({ error: "Não foi possível enviar o logo. Tenta de novo?" });
      }
    });
  }

  function remove() {
    if (!confirm("Remover seu logo? Seus alunos voltam a ver o logo do BoraTreinar.")) return;
    setPreview(null);
    startTransition(async () => {
      setState(await setLogo(null));
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Como seus alunos veem o topo do app</p>
      <div className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3">
        {src ? (
          <span className="flex h-9 max-w-[60%] items-center rounded-lg bg-white px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- logo do bucket público ou pré-visualização local */}
            <img src={src} alt={`Logo de ${name}`} className="max-h-7 w-auto object-contain" />
          </span>
        ) : (
          <span className="text-sm text-muted">Seu logo aparece aqui</span>
        )}
        <span className="flex items-center gap-2 text-xs text-muted">
          Aluno <span className="size-7 rounded-full bg-border" aria-hidden />
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) upload(f);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => input.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
          {path ? "Trocar logo" : "Enviar meu logo"}
        </Button>
        {path && !preview && (
          <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending}>
            <Trash2 className="size-4" aria-hidden /> Remover
          </Button>
        )}
      </div>
      <p className="text-xs text-muted">Dica: use PNG com fundo transparente, no formato horizontal.</p>
      <FormMessage state={state} />
    </div>
  );
}
