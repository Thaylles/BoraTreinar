"use client";

import { useActionState } from "react";
import { adminUpdateProfile } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";

type P = { id: string; full_name: string; email: string; phone: string | null; birth_date: string | null };

/** Admin edita os dados de cadastro de um Personal ou aluno. */
export function AdminProfileForm({ profile }: { profile: P }) {
  const [state, action] = useActionState(adminUpdateProfile, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={profile.id} />
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Nome</span>
        <input name="full_name" required defaultValue={profile.full_name} className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">E-mail (login)</span>
        <input name="email" type="email" required defaultValue={profile.email} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">WhatsApp</span>
          <input name="phone" inputMode="tel" defaultValue={profile.phone ?? ""} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Nascimento</span>
          <input name="birth_date" type="date" defaultValue={profile.birth_date ?? ""} className={inputClass} />
        </label>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Salvando…">Salvar alterações</SubmitButton>
    </form>
  );
}
