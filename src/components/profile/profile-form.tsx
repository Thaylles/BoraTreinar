"use client";

import { useActionState } from "react";
import { updateMyProfile } from "@/app/perfil-actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({
  name,
  phone,
  birthDate,
  requireBirth = false,
}: {
  name: string;
  phone: string | null;
  birthDate: string | null;
  /** Personal: obrigatória (a idade aparece na busca de Personais). */
  requireBirth?: boolean;
}) {
  const [state, action] = useActionState(updateMyProfile, undefined);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nome" name="full_name" required minLength={2} maxLength={120} defaultValue={name} autoComplete="name" />
      <Field
        label="WhatsApp"
        name="phone"
        type="tel"
        inputMode="tel"
        defaultValue={phone ?? ""}
        placeholder="(11) 91234-5678"
        hint="Com DDD. Aparece no botão de WhatsApp para quem te acompanha."
        autoComplete="tel"
      />
      <Field
        label="Data de nascimento"
        name="birth_date"
        type="date"
        defaultValue={birthDate ?? ""}
        autoComplete="bday"
        required={requireBirth}
        hint={requireBirth ? "Sua idade aparece para alunos que procuram um Personal." : undefined}
      />
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  );
}
