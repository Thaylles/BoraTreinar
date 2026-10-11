"use client";

import { useActionState, useState } from "react";
import { requestTransfer } from "../../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

const OPCOES = {
  compartilhamento: {
    title: "Compartilhar",
    desc: "O aluno passa a ter dois Personais. Você continua responsável e pode revogar quando quiser.",
  },
  transferencia: {
    title: "Transferir",
    desc: "O outro Personal vira o responsável, com todo o histórico. Você perde o acesso ao aluno.",
  },
} as const;

export function TransferForm({ studentId }: { studentId: string }) {
  const [state, action] = useActionState(requestTransfer, undefined);
  const [kind, setKind] = useState<keyof typeof OPCOES>("compartilhamento");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Tipo</legend>
        {(Object.keys(OPCOES) as Array<keyof typeof OPCOES>).map((k) => (
          <label
            key={k}
            className={cn(
              "cursor-pointer rounded-2xl border-2 p-3 text-sm transition",
              kind === k ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/10" : "border-border",
            )}
          >
            <input
              type="radio"
              name="kind"
              value={k}
              checked={kind === k}
              onChange={() => setKind(k)}
              className="sr-only"
            />
            <span className="block font-display font-bold">{OPCOES[k].title}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">{OPCOES[kind].desc}</p>
      <Field
        label="E-mail do outro Personal"
        name="email"
        type="email"
        required
        inputMode="email"
        hint="Ele precisa ter conta de Personal no BoraTreinar e aceitar o pedido."
      />
      <FormMessage state={state} />
      <SubmitButton
        variant={kind === "transferencia" ? "danger" : "primary"}
        className="w-full"
        pendingText="Enviando…"
        onClick={(e) => {
          if (kind === "transferencia" && !confirm("Depois que o outro Personal aceitar, você perde o acesso a este aluno. Continuar?")) {
            e.preventDefault();
          }
        }}
      >
        Enviar pedido de {OPCOES[kind].title.toLowerCase()}
      </SubmitButton>
    </form>
  );
}
