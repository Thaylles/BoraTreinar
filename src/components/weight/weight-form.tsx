"use client";

import { useActionState } from "react";
import { Scale } from "lucide-react";
import { saveWeight } from "@/app/aluno/peso/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export function WeightForm({ next, today, lastKg }: { next?: string; today: string; lastKg?: number | null }) {
  const [state, action] = useActionState(saveWeight, undefined);
  return (
    <form action={action} className="space-y-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Peso (kg)</span>
          <input
            name="weight_kg"
            inputMode="decimal"
            required
            autoFocus
            placeholder={lastKg ? lastKg.toLocaleString("pt-BR") : "Ex.: 72,5"}
            className={cn(inputClass, "text-center font-display text-2xl font-bold")}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Data</span>
          <input name="measured_on" type="date" defaultValue={today} max={today} className={cn(inputClass, "px-3")} />
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Salvando…">
        <Scale className="size-5" aria-hidden /> Registrar peso
      </SubmitButton>
    </form>
  );
}
