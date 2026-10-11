"use client";

import { useActionState, useState } from "react";
import { addSchedule } from "@/app/personal/agenda/actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/alert";
import { inputClass } from "@/components/ui/field";
import { WEEKDAYS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/schedule";
import { cn } from "@/lib/cn";

type Kind = "semanal" | "unica";

/**
 * Agenda aula semanal (repete até o Personal remover) ou aula única.
 * Com `students`, mostra a escolha do aluno (usado no calendário); com `date`, já sugere aquele dia.
 */
export function ScheduleForm({
  studentId,
  students,
  today,
  date,
  defaultKind = "semanal",
}: {
  studentId?: string;
  students?: { id: string; full_name: string }[];
  today: string;
  date?: string;
  defaultKind?: Kind;
}) {
  const [state, action] = useActionState(addSchedule, undefined);
  const [kind, setKind] = useState<Kind>(defaultKind);
  const day = date && date >= today ? date : today;
  const [days, setDays] = useState<number[]>(date ? [weekdayOf(day)] : []);
  const [perDay, setPerDay] = useState(false);
  const [time, setTime] = useState("07:00");
  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  // Ordem seg → dom para exibir os horários por dia.
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d));
  return (
    <form action={action} className="space-y-4">
      {studentId ? (
        <input type="hidden" name="student_id" value={studentId} />
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Aluno</span>
          <select name="student_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Escolha o aluno…
            </option>
            {(students ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div role="radiogroup" aria-label="Tipo de aula" className="grid grid-cols-2 gap-1 rounded-2xl bg-border/40 p-1">
        {(
          [
            ["semanal", "Toda semana"],
            ["unica", "Aula única"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="cursor-pointer">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="peer sr-only" />
            <span className="block rounded-xl py-2 text-center text-sm font-bold text-muted transition peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:ring-4 peer-focus-visible:ring-bandeira-500/30">
              {label}
            </span>
          </label>
        ))}
      </div>
      {kind === "semanal" ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Dias da semana <span className="font-normal text-muted">(marque um ou mais)</span></legend>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <label key={i} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="weekday"
                  value={i}
                  checked={days.includes(i)}
                  onChange={() => toggleDay(i)}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "block rounded-xl border-2 border-border py-2 text-center text-xs font-bold text-muted transition",
                    "peer-checked:border-bandeira-500 peer-checked:bg-bandeira-500 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-bandeira-500/30",
                  )}
                >
                  {WEEKDAYS_SHORT[i]}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">
            {days.length > 1 ? `${days.length} aulas por semana. ` : ""}Repete toda semana até você remover. Dá para cancelar datas avulsas.
          </p>
          {days.length > 1 && (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={perDay} onChange={(e) => setPerDay(e.target.checked)} className="size-4 accent-bandeira-500" />
              Horário diferente em cada dia
            </label>
          )}
        </fieldset>
      ) : (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Data</span>
          <input type="date" name="on_date" required defaultValue={day} min={today} className={inputClass} />
        </label>
      )}
      {kind === "semanal" && perDay && days.length > 1 && (
        <div className="grid grid-cols-2 gap-3">
          {ordered.map((d) => (
            <label key={d} className="block">
              <span className="mb-1 block text-sm font-semibold">{WEEKDAYS[d]}</span>
              <input type="time" name={`time_${d}`} required defaultValue={time} className={inputClass} />
            </label>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {!(kind === "semanal" && perDay && days.length > 1) ? (
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Horário</span>
            <input type="time" name="start_time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
          </label>
        ) : (
          <input type="hidden" name="start_time" value={time} />
        )}
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
      {kind === "semanal" && (
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">A partir de</span>
          <input type="date" name="starts_on" defaultValue={day} min={today} className={inputClass} />
        </label>
      )}
      <input name="notes" maxLength={200} placeholder="Observação (opcional): local, foco da aula…" className={inputClass} aria-label="Observação" />
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingText="Agendando…">
        {kind === "semanal" && days.length > 1 ? `Agendar ${days.length} aulas por semana` : "Agendar aula"}
      </SubmitButton>
    </form>
  );
}
