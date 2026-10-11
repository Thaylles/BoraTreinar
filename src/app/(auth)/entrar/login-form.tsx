"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert, FormMessage } from "@/components/ui/alert";

export function LoginForm({ next, linkError }: { next?: string; linkError?: boolean }) {
  const [state, action] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      {linkError && (
        <Alert>O link expirou ou já foi usado. Tente entrar ou peça um novo.</Alert>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required inputMode="email" />
      <Field label="Senha" name="password" type="password" autoComplete="current-password" required />
      <div className="text-right text-sm">
        <Link href="/recuperar-senha" className="font-semibold text-anil-700 underline-offset-4 hover:underline dark:text-ipe-500">
          Esqueci minha senha
        </Link>
      </div>
      <FormMessage state={state} />
      <SubmitButton size="lg" className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        É Personal e não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-bandeira-600 hover:underline">
          Crie a sua
        </Link>
        <br />
        É aluno? Use o link de convite do seu Personal.
      </p>
    </form>
  );
}
