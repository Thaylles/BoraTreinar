"use client";

import { useActionState, useState } from "react";
import { saveCardioGoal } from "@/app/cardio-actions";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { GOAL_KIND_LABEL, type CardioGoal, type CardioGoalKind } from "@/lib/cardio";

const KINDS: CardioGoalKind[] = ["minutos", "distancia", "intenso"];
const fmt = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));

/** Formulário da meta de cardio: tipo (tempo, distância ou ritmo forte) e alvo semanal. */
export function CardioGoalForm({ studentId, goal }: { studentId: string; goal: CardioGoal | null }) {
  const [state, action] = useActionState(saveCardioGoal, undefined);
  const [kind, setKind] = useState<CardioGoalKind>(goal?.kind ?? "minutos");
  const unit = kind === "distancia" ? "km" : "min";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="student_id" value={studentId} />
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Tipo de meta</legend>
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-2xl border-2 px-2 py-2 text-center text-xs font-bold transition ${
                kind === k ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/10" : "border-border"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {GOAL_KIND_LABEL[k]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        Meta por semana ({unit})
        <input
          name="target"
          inputMode="decimal"
          required
          defaultValue={goal?.kind === kind ? fmt(goal.target) : kind === "distancia" ? "10" : kind === "intenso" ? "60" : "150"}
          key={kind}
          className={`${inputClass} mt-1.5`}
        />
      </label>
      {kind === "intenso" && (
        <div className="space-y-2 rounded-2xl bg-background p-3">
          <p className="text-xs text-muted">
            Conta como ritmo forte o cardio feito a partir destes valores (preencha um ou os dois):
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">
              Esteira: velocidade ≥ (km/h)
              <input name="min_speed" inputMode="decimal" defaultValue={fmt(goal?.min_speed_kmh) || "8"} className={`${inputClass} mt-1`} />
            </label>
            <label className="text-xs font-semibold">
              Bicicleta/elíptico: nível ≥
              <input name="min_level" inputMode="numeric" defaultValue={fmt(goal?.min_level) || "6"} className={`${inputClass} mt-1`} />
            </label>
          </div>
        </div>
      )}
      <SubmitButton className="w-full" pendingText="Salvando…">
        Salvar meta de cardio
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
