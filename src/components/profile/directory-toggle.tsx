"use client";

import { useActionState } from "react";
import { setDirectoryListed } from "@/app/perfil-actions";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

/** Personal decide se aparece na vitrine para alunos que procuram um Personal. */
export function DirectoryToggle({ listed }: { listed: boolean }) {
  const [state, action] = useActionState(setDirectoryListed, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="listed" value={listed ? "0" : "1"} />
      <p className="font-display text-lg font-bold">Aparecer para novos alunos</p>
      <p className="text-sm text-muted">
        Alunos sem Personal veem sua foto, idade, o valor por aula dos seus pacotes (aba Financeiro) e um botão para te chamar
        no WhatsApp.
      </p>
      <p className="text-sm">
        Status: <strong>{listed ? "visível na busca ✅" : "não aparece"}</strong>
      </p>
      <FormMessage state={state} />
      <SubmitButton variant={listed ? "ghost" : "primary"} pendingText="Salvando…">
        {listed ? "Deixar de aparecer" : "Quero aparecer"}
      </SubmitButton>
    </form>
  );
}
