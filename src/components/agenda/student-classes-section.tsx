import { CalendarDays, Trash2 } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { loadAgenda } from "@/lib/agenda-server";
import { WEEKDAYS } from "@/lib/schedule";
import { deleteSchedule } from "@/app/personal/agenda/actions";
import { OccurrenceList } from "./occurrence-list";
import { ScheduleForm } from "./schedule-form";

/** Seção "Aulas presenciais" na página do aluno (lado do Personal). */
export async function StudentClassesSection({ studentId, meId }: { studentId: string; meId: string }) {
  const { schedules, occurrences, today } = await loadAgenda({ studentId, days: 14 });
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 font-display text-xl font-bold">
        <CalendarDays className="size-5" aria-hidden /> Aulas presenciais
      </h2>
      {!!schedules.length && (
        <ul className="mb-3 space-y-1 text-sm">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-border/30 px-3 py-2">
              <span>
                <strong>{WEEKDAYS[s.weekday]}</strong> às {s.start_time.slice(0, 5)} · {s.duration_minutes} min
                {s.personal_id !== meId && <span className="text-muted"> · com {s.personal?.full_name}</span>}
                {s.notes && <span className="block text-xs text-muted">{s.notes}</span>}
              </span>
              {s.personal_id === meId && (
                <form action={deleteSchedule}>
                  <input type="hidden" name="id" value={s.id} />
                  <ConfirmSubmit message="Remover esta aula recorrente?" className="rounded-lg p-1.5 text-muted hover:text-pitanga-600">
                    <Trash2 className="size-4" aria-label="Remover aula recorrente" />
                  </ConfirmSubmit>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {schedules.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold">Próximos 14 dias</p>
          <OccurrenceList occurrences={occurrences} today={today} managerId={meId} />
        </div>
      )}
      <details className="rounded-3xl border border-border bg-surface p-4">
        <summary className="cursor-pointer font-display font-bold">+ Agendar aula recorrente</summary>
        <div className="mt-4">
          <ScheduleForm studentId={studentId} today={today} />
        </div>
      </details>
    </section>
  );
}
