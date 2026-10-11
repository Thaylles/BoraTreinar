"use client";

import { useActionState } from "react";
import { saveWeightSettings } from "@/app/aluno/peso/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

export function WeightSettingsForm({ visible, frequency }: { visible: boolean; frequency: "semanal" | "quinzenal" }) {
  const [state, action] = useActionState(saveWeightSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start justify-between gap-4">
        <span>
          <span className="block font-semibold">Meu Personal pode ver meu peso</span>
          <span className="text-sm text-muted">
            Desligado, o peso não aparece para nenhum Personal em nenhuma tela, gráfico ou relatório.
          </span>
        </span>
        <input type="checkbox" name="weight_visible" defaultChecked={visible} className="peer sr-only" />
        <span
          aria-hidden
          className="relative mt-1 h-7 w-12 shrink-0 rounded-full bg-border transition peer-checked:bg-bandeira-500 peer-focus-visible:ring-4 peer-focus-visible:ring-bandeira-500/30 after:absolute after:left-1 after:top-1 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
        />
      </label>
      <fieldset>
        <legend className="mb-2 font-semibold">Frequência de pesagem</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["semanal", "quinzenal"] as const).map((f) => (
            <label key={f} className="cursor-pointer">
              <input type="radio" name="frequency" value={f} defaultChecked={frequency === f} className="peer sr-only" />
              <span
                className={cn(
                  "block rounded-2xl border-2 border-border p-3 text-center font-semibold transition",
                  "peer-checked:border-bandeira-500 peer-checked:bg-bandeira-50 dark:peer-checked:bg-bandeira-500/10",
                )}
              >
                {f === "semanal" ? "Semanal (7 dias)" : "Quinzenal (14 dias)"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full" pendingText="Salvando…">
        Salvar preferências
      </SubmitButton>
    </form>
  );
}
