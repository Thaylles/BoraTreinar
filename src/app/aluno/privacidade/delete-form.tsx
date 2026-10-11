"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { deleteMyAccount } from "./actions";

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteMyAccount, undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          Para confirmar, digite <strong>EXCLUIR</strong>
        </span>
        <input name="confirm" autoComplete="off" required className={inputClass} placeholder="EXCLUIR" />
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="danger" className="w-full" pendingText="Excluindo…">
        Excluir minha conta e meus dados
      </SubmitButton>
    </form>
  );
}
