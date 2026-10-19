"use client";

import { useState, useTransition } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { PhotoSourceButtons } from "@/components/photo-source-buttons";
import { createClient } from "@/lib/supabase/client";
import { compressImage, isHeic } from "@/lib/image";
import { EQUIPMENT_BUCKET, MUSCLE_GROUPS, equipmentImageSrc, type Equipment } from "@/lib/catalog";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { saveEquipment } from "./actions";

type Props = { userId: string; initial?: Equipment };

export function EquipmentForm({ userId, initial }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initial ? equipmentImageSrc(initial) : null);
  const [removed, setRemoved] = useState(false);
  const [warnNoImage, setWarnNoImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState(initial?.muscle_group ?? "");
  const [pending, startTransition] = useTransition();

  const hasImage = Boolean(file) || (Boolean(initial?.image_path) && !removed);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/") && !isHeic(f)) return setError("Escolha um arquivo de imagem.");
    if (f.size > 15 * 1024 * 1024) return setError("Imagem muito grande (máx. 15 MB).");
    setFile(f);
    setRemoved(false);
    setWarnNoImage(false);
    setPreview(URL.createObjectURL(f));
  }

  function submit(form: HTMLFormElement, skipImageWarning = false) {
    if (!form.reportValidity()) return;
    if (!hasImage && !skipImageWarning) {
      setWarnNoImage(true);
      return;
    }
    const fd = new FormData(form);
    startTransition(async () => {
      setError(null);
      let image_path: string | null | undefined = undefined;
      if (file) {
        try {
          const blob = await compressImage(file);
          const ext = blob.type === "image/webp" ? "webp" : "jpg";
          const path = `${userId}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await createClient()
            .storage.from(EQUIPMENT_BUCKET)
            .upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
          if (upErr) throw upErr;
          image_path = path;
        } catch {
          setError("Não foi possível enviar a imagem. Tenta de novo?");
          return;
        }
      } else if (removed) {
        image_path = null;
      }
      const result = await saveEquipment({
        id: initial?.id,
        name: String(fd.get("name") ?? ""),
        muscle_group: String(fd.get("muscle_group") ?? ""),
        description: String(fd.get("description") ?? ""),
        is_bodyweight: fd.get("is_bodyweight") === "on",
        intensity_unit: String(fd.get("intensity_unit") ?? ""),
        image_path,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(e.currentTarget);
      }}
    >
      <div className="space-y-2">
        <span className="block text-sm font-semibold">Foto do equipamento</span>
        {preview && !removed ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- pré-visualização local */}
            <img src={preview} alt="Pré-visualização" className="aspect-[4/3] w-full rounded-2xl object-cover" />
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setRemoved(true);
                setPreview(null);
              }}
              className="absolute right-2 top-2 rounded-full bg-surface/90 p-2 text-pitanga-600 shadow"
              aria-label="Remover foto"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border text-muted">
            <ImagePlus className="size-10" aria-hidden />
            <span className="text-sm font-semibold">Tire uma foto ou escolha da galeria</span>
            <PhotoSourceButtons onPick={pickFile} size="sm" />
          </div>
        )}
        {preview && !removed && <PhotoSourceButtons onPick={pickFile} size="sm" />}
      </div>

      <Field label="Nome" name="name" required minLength={2} maxLength={80} defaultValue={initial?.name} placeholder="Ex.: Remada máquina articulada" />
      <div className="space-y-1.5">
        <label htmlFor="muscle_group" className="block text-sm font-semibold">
          Grupo muscular
        </label>
        <select id="muscle_group" name="muscle_group" required value={group} onChange={(e) => setGroup(e.target.value as typeof group)} className={inputClass}>
          <option value="" disabled>
            Escolha…
          </option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>
      {group === "cardio" && (
        <div className="space-y-1.5">
          <label htmlFor="intensity_unit" className="block text-sm font-semibold">
            Intensidade no painel do aparelho
          </label>
          <select id="intensity_unit" name="intensity_unit" defaultValue={initial?.intensity_unit ?? "nivel"} className={inputClass}>
            <option value="velocidade">Velocidade (km/h) e inclinação (%) — como na esteira</option>
            <option value="nivel">Nível de carga — como na bicicleta e no elíptico</option>
          </select>
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm font-semibold">
          Descrição / dicas de execução
        </label>
        <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={initial?.description ?? ""} className={inputClass} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="is_bodyweight" defaultChecked={initial?.is_bodyweight} className="size-5 accent-bandeira-500" />
        Exercício com peso corporal (aceita carga 0)
      </label>

      {warnNoImage && (
        <Alert kind="info">
          <p className="font-semibold">Que tal adicionar uma foto? 📸</p>
          <p>Com a foto, o aluno identifica o equipamento na academia muito mais rápido.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PhotoSourceButtons onPick={pickFile} size="sm" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => submit(e.currentTarget.form!, true)}
            >
              Salvar sem foto
            </Button>
          </div>
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {pending ? "Salvando…" : initial ? "Salvar alterações" : "Cadastrar exercício"}
      </Button>
    </form>
  );
}
