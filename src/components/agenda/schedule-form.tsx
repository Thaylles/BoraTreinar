"use client";

import { useActionState } from "react";
import { addSchedule } from "@/app/personal/agenda/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { WEEKDAYS_SHORT } from "@/lib/schedule";
import { cn } from "@/lib/cn";

export function ScheduleForm({ studentId, today }: { studentId: string; today: string }) {
  const [state, action] = useActionState(addSchedule, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Dias da semana</legend>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS_SHORT.map((d, i) => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="weekday" value={i} className="peer sr-only" />
              <span
                className={cn(
                  "block rounded-xl border-2 border-border py-2 text-center text-xs font-bold text-muted transition",
                  "peer-checked:border-bandeira-500 peer-checked:bg-bandeira-500 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-bandeira-500/30",
                )}
              >
                {d}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Horário</span>
          <input type="time" name="start_time" required defaultValue="07:00" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Duração</span>
          <select name="duration" defaultValue="60" className={inputClass}>
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">A partir de</span>
        <input type="date" name="starts_on" defaultValue={today} min={today} className={inputClass} />
      </label>
      <input name="notes" maxLength={200} placeholder="Observação (opcional): local, foco da aula…" className={inputClass} aria-label="Observação" />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Agendando…">
        Agendar aula
      </SubmitButton>
    </form>
  );
}
