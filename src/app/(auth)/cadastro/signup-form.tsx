"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpPersonal } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { TermsCheckbox } from "@/components/terms-checkbox";

export function SignUpPersonalForm() {
  const [state, action] = useActionState(signUpPersonal, undefined);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome completo" name="full_name" autoComplete="name" required minLength={2} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required inputMode="email" />
      <Field
        label="WhatsApp (opcional)"
        name="phone"
        type="tel"
        autoComplete="tel-national"
        inputMode="tel"
        placeholder="(11) 99999-0000"
      />
      <Field
        label="Data de nascimento"
        name="birth_date"
        type="date"
        autoComplete="bday"
        required
        hint="Sua idade aparece para alunos que procuram um Personal."
      />
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
        Criar conta
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-semibold text-bandeira-600 hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
