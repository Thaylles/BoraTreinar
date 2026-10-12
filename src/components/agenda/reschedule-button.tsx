"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { rescheduleClass } from "@/app/personal/agenda/actions";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { addDays, WEEKDAYS } from "@/lib/schedule";
import { cn } from "@/lib/cn";

/** Botão "Remarcar" de uma data da agenda: só esta aula ou (aula semanal) esta e as próximas. */
export function RescheduleButton({
  scheduleId,
  date,
  time,
  weekday,
  recurring,
  today,
  studentName,
}: {
  scheduleId: string;
  date: string;
  time: string;
  weekday: number;
  recurring: boolean;
  today: string;
  studentName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<"unica" | "serie">("unica");
  const [state, action] = useActionState(rescheduleClass, undefined);
  const label = `${date.slice(8, 10)}/${date.slice(5, 7)} às ${time}`;

  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-xl p-2 text-anil-700 hover:bg-border/50 dark:text-ipe-400"
        aria-label="Remarcar aula"
        title="Remarcar aula"
      >
        <CalendarClock className="size-5" aria-hidden />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl bg-background p-0 text-foreground backdrop:bg-black/40"
      >
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="schedule_id" value={scheduleId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="mode" value={mode} />
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id={titleId} className="font-display text-xl font-bold">
                Remarcar aula
              </h2>
              <p className="text-sm text-muted">
                {studentName ? `${studentName} · ` : ""}
                {WEEKDAYS[weekday]}, {label}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="rounded-full p-2 hover:bg-border/50"
              aria-label="Fechar"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {recurring && (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="O que remarcar">
              {(
                [
                  ["unica", "Só esta aula", "Troca só esta data"],
                  ["serie", "Esta e as próximas", "Muda o horário fixo"],
                ] as const
              ).map(([value, title, hint]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={mode === value}
                  onClick={() => setMode(value)}
                  className={cn(
                    "rounded-2xl border p-3 text-left text-sm transition",
                    mode === value
                      ? "border-bandeira-500 bg-bandeira-500 text-white"
                      : "border-border bg-surface hover:bg-border/40",
                  )}
                >
                  <span className="block font-semibold">{title}</span>
                  <span className={cn("block text-xs", mode === value ? "text-white/85" : "text-muted")}>{hint}</span>
                </button>
              ))}
            </div>
          )}

          {mode === "unica" ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                <span className="block">Nova data</span>
                <input
                  type="date"
                  name="new_date"
                  required
                  defaultValue={date}
                  min={today}
                  max={addDays(today, 60)}
                  className={inputClass}
                />
              </label>
              <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                <span className="block">Horário</span>
                <input type="time" name="start_time" required defaultValue={time} className={inputClass} />
              </label>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                  <span className="block">Novo dia</span>
                  <select name="weekday" defaultValue={weekday} className={inputClass}>
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 space-y-1.5 text-sm font-semibold">
                  <span className="block">Horário</span>
                  <input type="time" name="start_time" required defaultValue={time} className={inputClass} />
                </label>
              </div>
              <p className="text-xs text-muted">
                Vale a partir de {date.slice(8, 10)}/{date.slice(5, 7)}: daí em diante as aulas ficam sempre no novo dia e
                horário. As anteriores não mudam.
              </p>
            </>
          )}

          <FormMessage state={state?.error ? state : undefined} />
          <SubmitButton className="w-full" pendingText="Remarcando…">
            Remarcar e avisar o aluno
          </SubmitButton>
        </form>
      </dialog>
    </>
  );
}
