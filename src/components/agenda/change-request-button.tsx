"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { Repeat, X } from "lucide-react";
import { requestClassChange } from "@/app/aluno/aula-actions";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { WEEKDAYS, addDays, mondayOf } from "@/lib/schedule";

/** Botão "Pedir troca" do aluno: escolhe outro dia (mesma semana ou a seguinte) e horário. */
export function ChangeRequestButton({
  scheduleId,
  date,
  time,
  weekday,
  today,
  personalName,
}: {
  scheduleId: string;
  date: string;
  time: string;
  weekday: number;
  today: string;
  personalName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, action] = useActionState(requestClassChange, undefined);
  const monday = mondayOf(date);
  const min = monday > today ? monday : today;
  const max = addDays(monday, 13);
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex shrink-0 items-center gap-1 rounded-xl border border-border px-2.5 py-1.5 text-xs font-semibold text-anil-700 hover:bg-border/50 dark:text-ipe-400"
      >
        <Repeat className="size-4" aria-hidden /> Pedir troca
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-background p-0 text-foreground backdrop:bg-black/40"
      >
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="schedule_id" value={scheduleId} />
          <input type="hidden" name="date" value={date} />
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="font-display text-xl font-bold">
                Pedir troca de aula
              </h2>
              <p className="text-sm text-muted">
                {WEEKDAYS[weekday]}, {ddmm(date)} às {time}
                {personalName ? ` · com ${personalName}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-full p-2 hover:bg-border/50" aria-label="Fechar">
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="min-w-0 space-y-1.5 text-sm font-semibold">
              <span className="block">Novo dia</span>
              <input type="date" name="new_date" required defaultValue={date} min={min} max={max} className={inputClass} />
            </label>
            <label className="min-w-0 space-y-1.5 text-sm font-semibold">
              <span className="block">Horário</span>
              <input type="time" name="new_time" required defaultValue={time} className={inputClass} />
            </label>
          </div>
          <p className="text-xs text-muted">
            Escolha um dia desta semana ou da próxima (de {ddmm(min)} a {ddmm(max)}).
          </p>
          <label className="block space-y-1.5 text-sm font-semibold">
            <span className="block">Recado para o Personal (opcional)</span>
            <textarea name="note" rows={2} maxLength={300} placeholder="Ex.: tenho consulta nesse horário" className={inputClass} />
          </label>
          <FormMessage state={state?.error ? state : undefined} />
          <SubmitButton className="w-full" pendingText="Enviando…">
            Enviar pedido
          </SubmitButton>
        </form>
      </dialog>
    </>
  );
}
