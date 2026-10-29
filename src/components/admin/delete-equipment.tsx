"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { adminDeleteEquipment } from "@/app/admin/actions";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { groupLabel, type MuscleGroup } from "@/lib/catalog";

type Option = { id: string; name: string; muscle_group: MuscleGroup };

/**
 * Admin exclui o exercício. Em uso (fichas ou treinos registrados), escolhe antes o substituto
 * que fica no lugar dele, para o histórico dos alunos continuar.
 */
export function DeleteEquipment({
  equipment,
  usage,
  options,
}: {
  equipment: { id: string; name: string; muscle_group: MuscleGroup };
  usage: { plans: number; sets: number };
  options: Option[];
}) {
  const [state, action, pending] = useActionState(adminDeleteEquipment, {});
  const [replacement, setReplacement] = useState("");
  const inUse = usage.plans + usage.sets > 0;
  const same = options.filter((o) => o.muscle_group === equipment.muscle_group);
  const others = options.filter((o) => o.muscle_group !== equipment.muscle_group);
  const chosen = options.find((o) => o.id === replacement);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = inUse
          ? `Excluir "${equipment.name}"? As fichas e os treinos registrados passam para "${chosen?.name}". Não dá para desfazer.`
          : `Excluir "${equipment.name}" do catálogo? Não dá para desfazer.`;
        if (!confirm(msg)) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="id" value={equipment.id} />
      <input type="hidden" name="name" value={equipment.name} />
      <p className="text-sm text-muted">
        {inUse ? (
          <>
            Está em uso: <strong className="text-foreground">{usage.plans}</strong>{" "}
            {usage.plans === 1 ? "item de ficha" : "itens de fichas"} e <strong className="text-foreground">{usage.sets}</strong>{" "}
            {usage.sets === 1 ? "série registrada" : "séries registradas"}. Escolha o exercício que fica no lugar dele: fichas e histórico
            dos alunos passam para o substituto.
          </>
        ) : (
          "Não está em nenhuma ficha nem treino registrado: pode excluir direto. A foto e as execuções (GIF/vídeo) saem junto."
        )}
      </p>
      {inUse && (
        <select
          name="replacement"
          required
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          className={inputClass}
          aria-label="Exercício substituto"
        >
          <option value="" disabled>
            Substituir por…
          </option>
          {same.length > 0 && (
            <optgroup label={groupLabel(equipment.muscle_group)}>
              {same.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Outros grupos">
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({groupLabel(o.muscle_group)})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      <FormMessage state={state} />
      <button
        type="submit"
        disabled={pending || (inUse && !replacement)}
        className="inline-flex items-center gap-2 rounded-2xl bg-pitanga-500 px-4 py-2.5 font-display font-bold text-white hover:bg-pitanga-600 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        {inUse ? "Substituir e excluir" : "Excluir exercício"}
      </button>
    </form>
  );
}
