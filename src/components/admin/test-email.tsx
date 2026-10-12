"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { adminSendTestEmail } from "@/app/admin/actions";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

/** Botão "Enviar e-mail de teste" (para o e-mail do admin). */
export function TestEmailCard() {
  const [state, action] = useActionState(adminSendTestEmail, undefined);
  return (
    <form action={action} className="mb-8 space-y-3 rounded-3xl border border-border bg-surface p-4">
      <p className="flex items-center gap-2 font-display text-lg font-bold">
        <Mail className="size-5 text-bandeira-500" aria-hidden /> E-mails do app
      </p>
      <p className="text-sm text-muted">
        Manda um e-mail de teste para você agora. Serve para conferir se o lembrete das 7h e o relatório de domingo vão chegar.
      </p>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Enviando…">
        Enviar e-mail de teste
      </SubmitButton>
    </form>
  );
}
