"use client";

import { useActionState, useState, useTransition } from "react";
import { Search, UserPlus } from "lucide-react";
import { findStudent, requestLink } from "@/app/personal/alunos/vinculo-actions";
import { Avatar } from "@/components/avatar";
import { Alert, FormMessage } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/cn";

/** O Personal adiciona um aluno que já tem conta: busca pelo e-mail ou WhatsApp e envia o pedido. */
export function AddExistingStudent() {
  const [state, action] = useActionState(findStudent, undefined);
  const [sent, setSent] = useState<Record<string, { error?: string; ok?: string }>>({});
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <form action={action} className="flex gap-2">
        <label className="sr-only" htmlFor="busca-aluno">
          E-mail ou WhatsApp do aluno
        </label>
        <input
          id="busca-aluno"
          name="q"
          required
          defaultValue={state?.query}
          placeholder="E-mail ou WhatsApp com DDD"
          className={cn(inputClass, "flex-1")}
          autoComplete="off"
        />
        <SubmitButton aria-label="Buscar" pendingText="…">
          <Search className="size-4" aria-hidden />
        </SubmitButton>
      </form>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.results && !state.results.length && (
        <Alert kind="info">
          Nenhum aluno com esse e-mail ou WhatsApp. Se ele ainda não tem conta, mande um link de convite.
        </Alert>
      )}
      {state?.results?.map((s) => {
        const res = sent[s.id];
        return (
          <div key={s.id} className="rounded-2xl border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <Avatar path={s.avatar_path} name={s.full_name} size={40} />
              <p className="min-w-0 flex-1 truncate font-semibold">{s.full_name}</p>
              {s.linked ? (
                <span className="text-sm text-muted">Já é seu aluno</span>
              ) : s.pending || res?.ok ? (
                <span className="text-sm text-muted">Pedido enviado</span>
              ) : (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await requestLink(s.id);
                      setSent((m) => ({ ...m, [s.id]: r }));
                    })
                  }
                >
                  <UserPlus className="size-4" aria-hidden /> Adicionar
                </Button>
              )}
            </div>
            {res && <FormMessage state={res} />}
          </div>
        );
      })}
    </div>
  );
}
