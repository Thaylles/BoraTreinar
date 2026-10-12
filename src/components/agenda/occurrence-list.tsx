import { CalendarX2, RotateCcw } from "lucide-react";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { RescheduleButton } from "@/components/agenda/reschedule-button";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { dayLabel, type Occurrence, type ScheduleLike } from "@/lib/schedule";
import { toggleOccurrence } from "@/app/personal/agenda/actions";
import { cn } from "@/lib/cn";

type S = ScheduleLike & {
  personal_id: string;
  student: { id: string; full_name: string; phone: string | null } | null;
  personal: { full_name: string } | null;
};

/** Próximas aulas agrupadas por dia. O Personal dono da aula pode remarcar, cancelar ou reativar uma data. */
export function OccurrenceList({
  occurrences,
  today,
  managerId,
  showStudent = false,
  showPersonal = false,
  hideDayHeader = false,
}: {
  occurrences: Occurrence<S>[];
  today: string;
  managerId?: string;
  showStudent?: boolean;
  showPersonal?: boolean;
  hideDayHeader?: boolean;
}) {
  if (!occurrences.length) return <p className="text-sm text-muted">Nenhuma aula nos próximos dias.</p>;
  const days = [...new Set(occurrences.map((o) => o.date))];
  return (
    <div className="space-y-4">
      {days.map((day) => (
        <section key={day}>
          <h3 className={cn("mb-1 text-sm font-bold", hideDayHeader && "sr-only", day === today ? "text-bandeira-600 dark:text-bandeira-100" : "text-muted")}>
            {dayLabel(day, today)}
          </h3>
          <ul className="space-y-2">
            {occurrences
              .filter((o) => o.date === day)
              .map((o) => {
                const canManage = managerId && o.schedule.personal_id === managerId;
                return (
                  <li
                    key={`${o.schedule.id}-${o.date}`}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border border-border bg-surface p-3",
                      o.cancelled && "opacity-60",
                    )}
                  >
                    <span className={cn("font-display text-xl font-extrabold tabular-nums", o.cancelled && "line-through")}>{o.time}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      {showStudent && <p className="truncate font-semibold">{o.schedule.student?.full_name}</p>}
                      {showPersonal && <p className="truncate font-semibold">com {o.schedule.personal?.full_name}</p>}
                      <p className="text-xs text-muted">
                        {o.schedule.duration_minutes} min
                        {o.schedule.ends_on === o.schedule.starts_on && " · aula única"}
                        {o.cancelled &&
                          (o.rescheduled
                            ? ` · ${o.reason?.toLowerCase() ?? "remarcada"}`
                            : ` · cancelada${o.reason ? `: ${o.reason}` : ""}`)}
                      </p>
                    </div>
                    {showStudent && !o.cancelled && <WhatsAppButton phone={o.schedule.student?.phone} compact />}
                    {canManage && !o.cancelled && o.date >= today && (
                      <RescheduleButton
                        scheduleId={o.schedule.id}
                        date={o.date}
                        time={o.time}
                        weekday={o.schedule.weekday}
                        recurring={o.schedule.ends_on !== o.schedule.starts_on}
                        today={today}
                        studentName={o.schedule.student?.full_name}
                      />
                    )}
                    {canManage && (
                      <form action={toggleOccurrence}>
                        <input type="hidden" name="schedule_id" value={o.schedule.id} />
                        <input type="hidden" name="date" value={o.date} />
                        <input type="hidden" name="cancel" value={o.cancelled ? "0" : "1"} />
                        {o.cancelled ? (
                          <ConfirmSubmit
                            message={
                              o.rescheduled
                                ? `Desfazer a remarcação? A aula volta para ${o.date.slice(8, 10)}/${o.date.slice(5, 7)} às ${o.time} e o aluno será avisado.`
                                : `Reativar a aula de ${o.date.slice(8, 10)}/${o.date.slice(5, 7)} às ${o.time}?`
                            }
                            className="rounded-xl p-2 text-muted hover:bg-border/50"
                          >
                            <RotateCcw className="size-5" aria-label={o.rescheduled ? "Desfazer remarcação" : "Reativar aula"} />
                          </ConfirmSubmit>
                        ) : (
                          <ConfirmSubmit
                            message={`Cancelar a aula de ${o.date.slice(8, 10)}/${o.date.slice(5, 7)} às ${o.time}? O aluno será avisado.`}
                            className="rounded-xl p-2 text-pitanga-600 hover:bg-pitanga-100 dark:hover:bg-pitanga-500/15"
                          >
                            <CalendarX2 className="size-5" aria-label="Cancelar esta data" />
                          </ConfirmSubmit>
                        )}
                      </form>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
