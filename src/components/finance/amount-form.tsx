"use client";

import { useActionState } from "react";
import { setPaymentAmount } from "@/app/personal/financeiro/actions";
import { inputClass } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

/** Ajuste do valor de uma cobrança em aberto (aula extra, desconto…). */
export function AmountForm({ id, amount }: { id: string; amount: number }) {
  const [state, action] = useActionState(setPaymentAmount, undefined);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="min-w-0 flex-1 space-y-1 text-xs font-semibold">
        <span className="block">Novo valor (R$)</span>
        <input name="amount" inputMode="decimal" required defaultValue={amount.toFixed(2).replace(".", ",")} className={inputClass} />
      </label>
      <SubmitButton size="sm" variant="secondary" pendingText="…">
        Ajustar
      </SubmitButton>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
