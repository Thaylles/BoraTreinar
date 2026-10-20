"use client";

import { useActionState, useState } from "react";
import { addRequestedExercise, linkRequestedExercise } from "@/app/exercise-request-actions";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";
import { inputClass } from "@/components/ui/field";
import { MUSCLE_GROUPS } from "@/lib/catalog";
import { cn } from "@/lib/cn";

/** Formulário "Adicionar ao catálogo" de um pedido (nome editável, grupo e peso do corpo). */
export function AddRequestedForm({ requestKey, name, back }: { requestKey: string; name: string; back: string }) {
  const [state, action] = useActionState(addRequestedExercise, undefined);
  const [group, setGroup] = useState("");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="key" value={requestKey} />
      <input type="hidden" name="back" value={back} />
      <input name="name" defaultValue={name} required maxLength={80} aria-label="Nome do exercício" className={cn(inputClass, "py-2")} />
      <div className="grid grid-cols-2 gap-2">
        <select
          name="muscle_group"
          required
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          aria-label="Grupo muscular"
          className={cn(inputClass, "px-3 py-2")}
        >
          <option value="" disabled>
            Grupo muscular…
          </option>
          {MUSCLE_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        {group === "cardio" ? (
          <select
            name="intensity_unit"
            defaultValue="nivel"
            aria-label="Intensidade do painel"
            className={cn(inputClass, "px-3 py-2 text-sm")}
          >
            <option value="nivel">Painel por nível</option>
            <option value="velocidade">Velocidade e inclinação</option>
          </select>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_bodyweight" className="size-4 accent-bandeira-500" /> Peso do corpo
          </label>
        )}
      </div>
      <textarea
        name="description"
        rows={2}
        maxLength={1000}
        placeholder="Descrição (opcional): como executar"
        className={cn(inputClass, "py-2 text-sm")}
      />
      <FormMessage state={state} />
      <SubmitButton size="sm" pendingText="Adicionando…">
        Adicionar ao catálogo
      </SubmitButton>
    </form>
  );
}

/** "Já existe": aponta o pedido para um exercício do catálogo padrão. */
export function LinkExistingForm({
  requestKey,
  options,
  back,
}: {
  requestKey: string;
  options: { id: string; name: string }[];
  back: string;
}) {
  const [state, action] = useActionState(linkRequestedExercise, undefined);
  return (
    <form action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="key" value={requestKey} />
      <input type="hidden" name="back" value={back} />
      <select
        name="equipment_id"
        required
        defaultValue=""
        aria-label="Exercício do catálogo"
        className={cn(inputClass, "min-w-0 flex-1 px-3 py-2 text-sm")}
      >
        <option value="" disabled>
          Escolha o exercício que já existe…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" variant="secondary" pendingText="Salvando…">
        É este
      </SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
