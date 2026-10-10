"use client";

import { useActionState } from "react";
import { updatePassword } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";

export function NewPasswordForm() {
  const [state, action] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nova senha" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Mínimo de 8 caracteres." />
      <Field label="Confirme a nova senha" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
