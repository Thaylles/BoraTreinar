"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, isHeic } from "@/lib/image";
import { AVATAR_BUCKET } from "@/lib/avatar";
import { setAvatar } from "@/app/perfil-actions";
import { Avatar } from "@/components/avatar";
import { PhotoSourceButtons } from "@/components/photo-source-buttons";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/alert";

/** Foto de perfil: tirar uma selfie ou escolher da galeria. */
export function AvatarUploader({ userId, name, path }: { userId: string; name: string; path: string | null }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ error?: string; ok?: string }>();
  const [preview, setPreview] = useState<string | null>(null);
  const router = useRouter();

  function upload(file: File) {
    setState(undefined);
    if (!file.type.startsWith("image/") && !isHeic(file)) return setState({ error: "Escolha um arquivo de imagem." });
    if (file.size > 20 * 1024 * 1024) return setState({ error: "Imagem muito grande (máx. 20 MB)." });
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      try {
        const blob = await compressImage(file, 512, 0.82);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const newPath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient()
          .storage.from(AVATAR_BUCKET)
          .upload(newPath, blob, { contentType: blob.type, cacheControl: "31536000" });
        if (error) throw error;
        setState(await setAvatar(newPath));
        router.refresh();
      } catch {
        setPreview(null);
        setState({ error: "Não foi possível enviar a foto. Tenta de novo?" });
      }
    });
  }

  function remove() {
    if (!confirm("Remover sua foto de perfil?")) return;
    setPreview(null);
    startTransition(async () => {
      setState(await setAvatar(null));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- pré-visualização local
        <img src={preview} alt="" className="size-32 rounded-full object-cover" />
      ) : (
        <Avatar path={path} name={name} size={128} />
      )}
      <PhotoSourceButtons onPick={upload} pending={pending} camera="user" className="justify-center" />
      {path && !preview && (
        <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={pending}>
          <Trash2 className="size-4" aria-hidden /> Remover foto
        </Button>
      )}
      <FormMessage state={state} />
    </div>
  );
}
