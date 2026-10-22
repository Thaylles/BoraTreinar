"use client";

import { useActionState, useRef } from "react";
import { answerClassChange } from "@/app/personal/agenda/actions";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { WEEKDAYS, weekdayOf } from "@/lib/schedule";

export type ChangeRequest = {
  id: string;
  on_date: string;
  new_date: string;
  new_time: string;
  note: string | null;
  student: { full_name: string } | null;
  schedule: { start_time: string } | null;
};

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Pedido de troca de aula de um aluno: o Personal aceita (remarca) ou recusa com um recado. */
export function ChangeRequestCard({ request: r }: { request: ChangeRequest }) {
  const [state, action] = useActionState(answerClassChange, undefined);
  // O valor do botão clicado não chega no FormData da action: marca a escolha num campo oculto.
  const acceptRef = useRef<HTMLInputElement>(null);
  const choose = (v: "1" | "0") => () => {
    if (acceptRef.current) acceptRef.current.value = v;
  };
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3 rounded-2xl border-2 border-ipe-400 bg-surface p-3 text-sm">
      <input type="hidden" name="id" value={r.id} />
      <input ref={acceptRef} type="hidden" name="accept" defaultValue="0" />
      <p>
        <strong>{r.student?.full_name ?? "Aluno"}</strong> quer trocar a aula de{" "}
        <strong>
          {WEEKDAYS[weekdayOf(r.on_date)].toLowerCase()}, {ddmm(r.on_date)} às {r.schedule?.start_time.slice(0, 5)}
        </strong>{" "}
        para{" "}
        <strong>
          {WEEKDAYS[weekdayOf(r.new_date)].toLowerCase()}, {ddmm(r.new_date)} às {r.new_time.slice(0, 5)}
        </strong>
        .
      </p>
      {r.note && <p className="rounded-xl bg-border/40 px-3 py-2 text-muted">💬 {r.note}</p>}
      <input name="reply" maxLength={300} placeholder="Resposta para o aluno (opcional)" aria-label="Resposta para o aluno" className={inputClass} />
      <FormMessage state={state?.error ? state : undefined} />
      <div className="flex gap-2">
        <SubmitButton onClick={choose("1")} className="flex-1" pendingText="Salvando…">
          Aceitar e remarcar
        </SubmitButton>
        <SubmitButton onClick={choose("0")} variant="ghost" className="flex-1" pendingText="Salvando…">
          Recusar
        </SubmitButton>
      </div>
    </form>
  );
}
