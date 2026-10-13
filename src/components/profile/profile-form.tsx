"use client";

import { useActionState } from "react";
import { updateMyProfile } from "@/app/perfil-actions";
import { Field } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/alert";
import { SubmitButton } from "@/components/ui/submit-button";

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
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
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar</SubmitButton>
    </form>
  );
}
