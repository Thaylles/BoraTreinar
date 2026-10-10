"use client";

import { useActionState } from "react";
import { createInvite } from "../actions";
import { Field, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { CopyButton, ShareButton } from "@/components/copy-button";

export function InviteForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState(createInvite, undefined);
  const link = state?.token ? `${appUrl}/convite/${state.token}` : null;

  return (
    <form action={action} className="space-y-4">
      <Field
        label="Para quem é? (opcional)"
        name="label"
        maxLength={80}
        placeholder="Ex.: Maria, turma da manhã"
        hint="Só você vê. Ajuda a lembrar quem já usou o convite."
      />
      <div className="space-y-1.5">
        <label htmlFor="days" className="block text-sm font-semibold">
          Validade
        </label>
        <select id="days" name="days" defaultValue="7" className={inputClass}>
          <option value="1">1 dia</option>
          <option value="3">3 dias</option>
          <option value="7">7 dias (padrão)</option>
          <option value="15">15 dias</option>
          <option value="30">30 dias</option>
        </select>
      </div>
      <SubmitButton className="w-full" pendingText="Gerando…">
        Gerar link de convite
      </SubmitButton>
      <FormMessage state={state} />
      {link && (
        <div className="space-y-2 rounded-2xl bg-background p-3">
          <p className="break-all font-mono text-sm">{link}</p>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={link} />
            <ShareButton url={link} text="Bora treinar? Crie sua conta no BoraTreinar pelo meu convite:" />
          </div>
        </div>
      )}
    </form>
  );
}
