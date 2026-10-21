"use client";

import { useActionState, useState } from "react";
import { applyPlansBulk } from "@/app/personal/fichas/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { cn } from "@/lib/cn";

type PlanOpt = { id: string; name: string; detail: string };
type StudentOpt = { id: string; name: string; activePlans: number };

function CheckRow({ name, value, checked, onChange, title, detail }: {
  name: string; value: string; checked: boolean; onChange: () => void; title: string; detail?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition",
        checked ? "border-bandeira-500 bg-bandeira-50 dark:bg-bandeira-500/10" : "border-border bg-surface hover:border-bandeira-500/50",
      )}
    >
      <input type="checkbox" name={name} value={value} checked={checked} onChange={onChange} className="size-5 shrink-0 accent-bandeira-500" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
      </span>
    </label>
  );
}

/** Escolhe fichas/modelos e alunos; mostra quantas fichas serão criadas antes de confirmar. */
export function BulkApplyForm({ plans, students, preselected }: { plans: PlanOpt[]; students: StudentOpt[]; preselected: string[] }) {
  const [state, action] = useActionState(applyPlansBulk, undefined);
  const [selPlans, setSelPlans] = useState<string[]>(preselected);
  const [selStudents, setSelStudents] = useState<string[]>([]);
  const [archive, setArchive] = useState(true);
  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const allStudents = selStudents.length === students.length && students.length > 0;
  const toArchive = archive ? students.filter((s) => selStudents.includes(s.id)).reduce((a, s) => a + s.activePlans, 0) : 0;
  const total = selPlans.length * selStudents.length;

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="mb-2 font-display text-lg font-bold">1. Fichas ou modelos</legend>
        <div className="space-y-2">
          {plans.map((p) => (
            <CheckRow key={p.id} name="plan" value={p.id} checked={selPlans.includes(p.id)} onChange={() => toggle(selPlans, setSelPlans, p.id)} title={p.name} detail={p.detail} />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <div className="mb-2 flex items-center justify-between gap-2">
          <legend className="font-display text-lg font-bold">2. Alunos</legend>
          <button
            type="button"
            onClick={() => setSelStudents(allStudents ? [] : students.map((s) => s.id))}
            className="text-sm font-semibold text-bandeira-600 underline-offset-4 hover:underline dark:text-bandeira-100"
          >
            {allStudents ? "Limpar seleção" : "Selecionar todos"}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {students.map((s) => (
            <CheckRow
              key={s.id}
              name="student"
              value={s.id}
              checked={selStudents.includes(s.id)}
              onChange={() => toggle(selStudents, setSelStudents, s.id)}
              title={s.name}
              detail={`${s.activePlans} ${s.activePlans === 1 ? "ficha ativa" : "fichas ativas"}`}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-surface p-3">
        <input type="checkbox" name="archive" value="1" checked={archive} onChange={(e) => setArchive(e.target.checked)} className="mt-0.5 size-5 accent-bandeira-500" />
        <span>
          <span className="block font-semibold">Substituir as fichas atuais</span>
          <span className="block text-sm text-muted">
            Arquiva as fichas ativas desses alunos antes de aplicar as novas. Fichas arquivadas não somem: dá para reativar depois, e o histórico de treinos continua.
          </span>
        </span>
      </label>

      <div className="sticky bottom-4 rounded-3xl border border-border bg-surface/95 p-4 shadow-lg backdrop-blur">
        <p className="mb-3 text-sm" aria-live="polite">
          {total ? (
            <>
              Serão criadas <strong>{total}</strong> {total === 1 ? "ficha" : "fichas"} ({selPlans.length} × {selStudents.length}{" "}
              {selStudents.length === 1 ? "aluno" : "alunos"})
              {toArchive > 0 && (
                <>
                  {" "}e <strong>{toArchive}</strong> {toArchive === 1 ? "ficha antiga será arquivada" : "fichas antigas serão arquivadas"}
                </>
              )}
              .
            </>
          ) : (
            "Escolha as fichas e os alunos."
          )}
        </p>
        <FormMessage state={state} />
        <SubmitButton className="mt-2 w-full" disabled={!total} pendingText="Aplicando…">
          Aplicar {total ? `${total} ${total === 1 ? "ficha" : "fichas"}` : ""}
        </SubmitButton>
      </div>
    </form>
  );
}
