"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { EQUIPMENT_BUCKET } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { setCatalogImage } from "./actions";

/** Troca a foto de um exercício do catálogo padrão (vale para todos os usuários do app). */
export function CatalogPhoto({
  equipmentId,
  userId,
  hasPhoto,
}: {
  equipmentId: string;
  userId: string;
  hasPhoto: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const router = useRouter();

  function upload(file: File) {
    setError(null);
    setDone(null);
    if (!file.type.startsWith("image/")) return setError("Escolha um arquivo de imagem.");
    if (file.size > 15 * 1024 * 1024) return setError("Imagem muito grande (máx. 15 MB).");
    startTransition(async () => {
      try {
        const blob = await compressImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await createClient()
          .storage.from(EQUIPMENT_BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (upErr) throw upErr;
        const res = await setCatalogImage(equipmentId, path);
        if (res?.error) return setError(res.error);
        setDone("Foto atualizada para todos! 📸");
        router.refresh();
      } catch {
        setError("Não foi possível enviar a foto. Tenta de novo?");
      }
    });
  }

  function restore() {
    if (!confirm("Voltar para a ilustração original? A foto atual deixa de aparecer para todos.")) return;
    setError(null);
    startTransition(async () => {
      const res = await setCatalogImage(equipmentId, null);
      if (res?.error) return setError(res.error);
      setDone("Ilustração original restaurada.");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 rounded-3xl border border-border bg-surface p-4">
      <h2 className="font-display text-lg font-bold">Foto do aparelho</h2>
      <p className="mb-3 text-sm text-muted">
        Tire uma foto do aparelho para os alunos reconhecerem na academia. A foto vale para todos que usam o
        BoraTreinar e mostra que foi você quem enviou.
      </p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => fileRef.current?.click()} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
          {hasPhoto ? "Trocar foto" : "Enviar foto"}
        </Button>
        {hasPhoto && (
          <Button type="button" variant="ghost" onClick={restore} disabled={pending}>
            <RotateCcw className="size-4" aria-hidden /> Voltar à ilustração
          </Button>
        )}
      </div>
      {error && <Alert className="mt-3">{error}</Alert>}
      {done && <Alert kind="success" className="mt-3">{done}</Alert>}
    </div>
  );
}
