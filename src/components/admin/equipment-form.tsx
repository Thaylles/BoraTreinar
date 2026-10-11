"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Camera, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { adminSaveEquipment } from "@/app/admin/actions";
import { FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import {
  MUSCLE_GROUPS,
  equipmentImageSrc,
  type Equipment,
} from "@/lib/catalog";
import { compressImage } from "@/lib/image";

type Props = {
  equipment: Pick<
    Equipment,
    | "id"
    | "name"
    | "muscle_group"
    | "description"
    | "is_bodyweight"
    | "locked"
    | "image_path"
    | "image_url"
  >;
};

/** Admin edita um exercício, inclusive a foto e a trava. */
export function AdminEquipmentForm({ equipment: eq }: Props) {
  const [state, action, pending] = useActionState(
    adminSaveEquipment,
    undefined,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [savedState, setSavedState] = useState(state);
  // Depois de salvar, a foto escolhida já está no servidor: volta a mostrar a foto atual.
  if (state !== savedState) {
    setSavedState(state);
    if (state?.ok) {
      setFile(null);
      setRemove(false);
    }
  }

  const fileUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(
    () => () => void (fileUrl && URL.revokeObjectURL(fileUrl)),
    [fileUrl],
  );
  const preview =
    fileUrl ?? (remove ? (eq.image_url ?? null) : equipmentImageSrc(eq));

  function pick(f: File | null) {
    setLocalError(null);
    if (!f) return;
    if (!f.type.startsWith("image/"))
      return setLocalError("Escolha um arquivo de imagem.");
    if (f.size > 15 * 1024 * 1024)
      return setLocalError("Imagem muito grande (máx. 15 MB).");
    setFile(f);
    setRemove(false);
  }

  async function submit(form: HTMLFormElement) {
    setLocalError(null);
    const fd = new FormData(form);
    fd.delete("photo_input");
    if (file) {
      try {
        const blob = await compressImage(file);
        fd.set(
          "photo",
          blob,
          blob.type === "image/webp" ? "foto.webp" : "foto.jpg",
        );
      } catch {
        return setLocalError("Não foi possível ler a imagem. Tenta outra?");
      }
    }
    if (remove) fd.set("remove_photo", "1");
    startTransition(() => action(fd));
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget);
      }}
    >
      <input type="hidden" name="id" value={eq.id} />
      <div className="space-y-2">
        <span className="block text-sm font-semibold">Foto</span>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto atual ou pré-visualização local
          <img
            src={preview}
            alt={eq.name}
            className="aspect-[4/3] w-full rounded-2xl border border-border bg-white object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-muted transition hover:border-bandeira-500 hover:text-bandeira-600"
          >
            <ImagePlus className="size-10" aria-hidden />
            <span className="text-sm font-semibold">Escolher imagem</span>
          </button>
        )}
        <input
          ref={fileRef}
          name="photo_input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Camera className="size-4" aria-hidden />{" "}
            {preview ? "Trocar foto" : "Enviar foto"}
          </Button>
          {(file || (eq.image_path && !remove)) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (file) setFile(null);
                else setRemove(true);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              <RotateCcw className="size-4" aria-hidden />{" "}
              {file
                ? "Desfazer troca"
                : eq.image_url
                  ? "Voltar à ilustração do catálogo"
                  : "Remover foto"}
            </Button>
          )}
        </div>
        {(file || remove) && (
          <p className="text-xs text-muted">A foto muda quando você salvar.</p>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Nome</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={eq.name}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Grupo muscular</span>
        <select
          name="muscle_group"
          required
          defaultValue={eq.muscle_group}
          className={inputClass}
        >
          {MUSCLE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          Descrição / dicas de execução
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={1000}
          defaultValue={eq.description ?? ""}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="is_bodyweight"
          defaultChecked={eq.is_bodyweight}
          className="size-5 accent-bandeira-500"
        />
        Exercício com peso corporal (aceita carga 0)
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="locked"
          defaultChecked={eq.locked}
          className="size-5 accent-pitanga-500"
        />
        🔒 Travado: nenhum Personal edita, exclui ou troca a foto
      </label>

      <FormMessage state={localError ? { error: localError } : state} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Salvando…" : "Salvar alterações"}
      </Button>
    </form>
  );
}
