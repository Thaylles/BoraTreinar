"use client";

import { useActionState } from "react";
import { adminDeletePersonal } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";

export function DeletePersonalForm({ id }: { id: string }) {
  const [state, action] = useActionState(adminDeletePersonal, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">
          Para confirmar, digite <strong>EXCLUIR</strong>
        </span>
        <input name="confirm" autoComplete="off" required placeholder="EXCLUIR" className={inputClass} />
      </label>
      <FormMessage state={state} />
      <SubmitButton variant="danger" className="w-full" pendingText="Excluindo…">
        Excluir Personal
      </SubmitButton>
    </form>
  );
}
