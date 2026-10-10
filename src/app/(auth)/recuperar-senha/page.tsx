"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";

export default function RecuperarSenhaPage() {
  const [state, action] = useActionState(requestPasswordReset, undefined);
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">Esqueceu a senha?</h1>
      <p className="mb-6 text-muted">Relaxa, acontece. Mandamos um link para você criar outra.</p>
      <form action={action} className="space-y-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required inputMode="email" />
        <FormMessage state={state} />
        <SubmitButton size="lg" className="w-full" pendingText="Enviando…">
          Enviar link
        </SubmitButton>
        <p className="text-center text-sm">
          <Link href="/entrar" className="font-semibold text-bandeira-600 hover:underline">
            Voltar para o login
          </Link>
        </p>
      </form>
    </>
  );
}
