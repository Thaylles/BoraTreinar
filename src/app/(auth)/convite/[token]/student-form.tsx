"use client";

import { useActionState } from "react";
import { signUpStudent } from "../../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { TermsCheckbox } from "@/components/terms-checkbox";

export function StudentSignUpForm({ token }: { token: string }) {
  const [state, action] = useActionState(signUpStudent, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Nome completo" name="full_name" autoComplete="name" required minLength={2} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required inputMode="email" />
      <Field
        label="WhatsApp"
        name="phone"
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        placeholder="(11) 99999-0000"
        required
        hint="Seu Personal usa para combinar os treinos."
      />
      <Field label="Data de nascimento (opcional)" name="birth_date" type="date" autoComplete="bday" />
      <Field
        label="Senha"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Mínimo de 8 caracteres."
      />
      <TermsCheckbox />
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Criando conta…">
        Criar conta e bora!
      </SubmitButton>
    </form>
  );
}
